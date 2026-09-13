/**
 * Porta da WordPress al nostro database: prima i media, poi gli articoli.
 *
 * Legge dalla REST API pubblica in sola lettura: non scrive mai sul sito
 * della società.
 *
 * È ripetibile. La chiave è wp_id sia per i media sia per gli articoli,
 * quindi rieseguirlo aggiorna ciò che c'è invece di creare doppioni.
 *
 * I FILE non vengono spostati: restano su WordPress, e i media importati li
 * indicano con urlOriginaleWp. Il trasferimento su Cloudflare R2 è un passo
 * successivo, che riempirà la colonna "chiave" e cambierà gli indirizzi da
 * solo, senza toccare gli articoli.
 *
 * Uso:
 *   node --env-file=.env scripts/migra-da-wordpress.mjs --prova
 *   node --env-file=.env scripts/migra-da-wordpress.mjs
 */

import { sql } from "drizzle-orm";
import { getDb, chiudiDb } from "../db/client.js";
import { notizie, media } from "../db/schema.js";

const WP = "https://wp.polisportivasandonato.org/index.php";

/* Indirizzi che WordPress ha salvato sul dominio storico, che oggi porta al
   sito React. Qui si correggono una volta sola, in scrittura. */
const UPLOADS_STORICO = "https://polisportivasandonato.org/wp/wp-content/";
const UPLOADS_ATTUALE = "https://wp.polisportivasandonato.org/wp-content/";

const prova = process.argv.includes("--prova");

/* =====================================================
   Pulizia del testo
   ===================================================== */

const ENTITA = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
  ndash: "–", mdash: "—", egrave: "è", eacute: "é", agrave: "à",
  ograve: "ò", ugrave: "ù", igrave: "ì"
};

function decodificaHtml(testo = "") {
  return testo
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (intero, nome) => ENTITA[nome.toLowerCase()] ?? intero);
}

function soloTesto(html = "") {
  return decodificaHtml(html.replace(/<[^>]+>/g, " "))
    .replace(/\[&hellip;\]|\[…\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sommarioDa(excerpt, contenuto, limite = 200) {
  const testo = soloTesto(excerpt) || soloTesto(contenuto);
  if (testo.length <= limite) return testo;
  const tagliato = testo.slice(0, limite);
  return tagliato.slice(0, tagliato.lastIndexOf(" ")).trimEnd() + "…";
}

const correggiIndirizzi = (testo = "") =>
  testo.includes(UPLOADS_STORICO)
    ? testo.split(UPLOADS_STORICO).join(UPLOADS_ATTUALE)
    : testo;

/**
 * Ultimo utilizzo di questa funzione: su WordPress lo sport si deduceva dal
 * titolo perché il campo non esisteva. Da qui in avanti è una colonna, e lo
 * sceglie chi scrive.
 */
function deduciSport(titolo = "") {
  const t = titolo.toLowerCase();
  if (t.includes("minivolley")) return "Minivolley";
  if (t.includes("calcio")) return "Calcio";
  if (t.includes("pallavolo") || t.includes("volley")) return "Pallavolo";
  if (t.includes("basket")) return "Basket";
  return "Altro";
}

/* =====================================================
   Lettura da WordPress
   ===================================================== */

/**
 * Scarica tutte le pagine di una rotta.
 *
 * Il numero di pagine si legge da X-WP-TotalPages e NON si deduce dalla
 * lunghezza della risposta. WordPress applica i filtri sui permessi dopo
 * aver estratto la pagina, quindi una pagina intermedia può contenere meno
 * elementi di quelli richiesti pur non essendo l'ultima: fermarsi lì
 * significa perdere silenziosamente il resto dell'archivio.
 */
async function scaricaTutto(rotta, campi) {
  const risultati = [];
  let pagine = 1;

  for (let pagina = 1; pagina <= pagine; pagina++) {
    const url = `${WP}?rest_route=/wp/v2/${rotta}&per_page=100&page=${pagina}&_fields=${campi}`;
    const risposta = await fetch(url);

    if (!risposta.ok) throw new Error(`WordPress ha risposto ${risposta.status} su ${rotta}`);

    if (pagina === 1) {
      pagine = Number(risposta.headers.get("x-wp-totalpages") || 1);
      const totale = risposta.headers.get("x-wp-total");
      console.log(`  WordPress dichiara ${totale} elementi in ${pagine} pagine`);
    }

    risultati.push(...(await risposta.json()));
  }

  if (risultati.length === 0) throw new Error(`Nessun elemento ricevuto da ${rotta}`);
  return risultati;
}

/* =====================================================
   Trasformazione
   ===================================================== */

function trasformaMedia(elementi) {
  return elementi.map((m) => ({
    wpId: m.id,
    urlOriginaleWp: correggiIndirizzi(m.source_url || ""),
    mime: m.mime_type || "application/octet-stream",
    larghezza: m.media_details?.width ?? null,
    altezza: m.media_details?.height ?? null,
    alt: decodificaHtml(m.alt_text || "") || null,
    titolo: decodificaHtml(m.title?.rendered || "") || null
  }));
}

function trasformaArticoli(articoli, copertinePerWpId) {
  const slugUsati = new Set();

  return articoli.map((a) => {
    const titolo = decodificaHtml(a.title?.rendered || "(senza titolo)");
    const contenuto = correggiIndirizzi(a.content?.rendered || "");

    // In teoria WordPress garantisce slug unici. In pratica, se due articoli
    // ne condividessero uno, l'inserimento fallirebbe a metà lavoro.
    let slug = a.slug || `articolo-${a.id}`;
    if (slugUsati.has(slug)) slug = `${slug}-${a.id}`;
    slugUsati.add(slug);

    return {
      wpId: a.id,
      slug,
      titolo,
      sommario: sommarioDa(a.excerpt?.rendered, contenuto),
      contenuto,
      copertinaId: copertinePerWpId.get(a.featured_media) ?? null,
      sport: deduciSport(titolo),
      stato: a.status === "publish" ? "pubblicata" : "bozza",
      pubblicataIl: a.date ? new Date(a.date + "Z") : null,
      creataIl: a.date ? new Date(a.date + "Z") : new Date(),
      aggiornataIl: a.modified ? new Date(a.modified + "Z") : new Date()
    };
  });
}

/* =====================================================
   Esecuzione
   ===================================================== */

async function main() {
  console.log("Scarico i media da WordPress…");
  const mediaWp = await scaricaTutto(
    "media",
    "id,source_url,mime_type,alt_text,title,media_details"
  );
  console.log(`  ${mediaWp.length} file`);

  console.log("Scarico gli articoli…");
  const articoliWp = await scaricaTutto(
    "posts",
    "id,date,modified,slug,status,title,content,excerpt,featured_media"
  );
  console.log(`  ${articoliWp.length} articoli`);

  const righeMedia = trasformaMedia(mediaWp);
  const conCopertina = articoliWp.filter((a) => a.featured_media).length;
  const conIndirizziStorici = articoliWp.filter(
    (a) => (a.content?.rendered || "").includes(UPLOADS_STORICO)
  ).length;

  const perTipo = righeMedia.reduce((acc, m) => {
    const famiglia = m.mime.split("/")[0];
    return { ...acc, [famiglia]: (acc[famiglia] || 0) + 1 };
  }, {});

  console.log(`\nMedia per tipo: ${JSON.stringify(perTipo)}`);
  console.log(`Articoli con copertina: ${conCopertina}/${articoliWp.length}`);
  console.log(`Articoli con indirizzi immagine da riscrivere: ${conIndirizziStorici}`);

  if (prova) {
    console.log("\n--prova: non scrivo nulla.");
    const perSport = trasformaArticoli(articoliWp, new Map())
      .reduce((acc, r) => ({ ...acc, [r.sport]: (acc[r.sport] || 0) + 1 }), {});
    console.log("Ripartizione per sport:", perSport);
    return;
  }

  const db = getDb();

  console.log("\nImporto i media…");
  for (const riga of righeMedia) {
    await db.insert(media).values(riga).onConflictDoUpdate({
      target: media.wpId,
      set: {
        urlOriginaleWp: riga.urlOriginaleWp,
        mime: riga.mime,
        larghezza: riga.larghezza,
        altezza: riga.altezza,
        alt: riga.alt,
        titolo: riga.titolo
      }
    });
  }

  // Serve la corrispondenza fra il wp_id del media e il nostro id, per
  // poter collegare le copertine degli articoli.
  const mediaSalvati = await db.select({ id: media.id, wpId: media.wpId }).from(media);
  const copertinePerWpId = new Map(
    mediaSalvati.filter((m) => m.wpId).map((m) => [m.wpId, m.id])
  );

  console.log("Importo gli articoli…");
  const righeArticoli = trasformaArticoli(articoliWp, copertinePerWpId);

  for (const riga of righeArticoli) {
    await db.insert(notizie).values(riga).onConflictDoUpdate({
      target: notizie.wpId,
      set: {
        titolo: riga.titolo,
        sommario: riga.sommario,
        contenuto: riga.contenuto,
        copertinaId: riga.copertinaId,
        stato: riga.stato,
        aggiornataIl: riga.aggiornataIl
      }
    });
  }

  const [conteggi] = await db
    .select({
      articoli: sql`(select count(*) from notizie)::int`,
      media: sql`(select count(*) from media)::int`,
      conCopertina: sql`(select count(*) from notizie where copertina_id is not null)::int`
    })
    .from(notizie)
    .limit(1);

  console.log(
    `\n✅ Nel database: ${conteggi.articoli} articoli, ${conteggi.media} media, ` +
    `${conteggi.conCopertina} articoli con copertina collegata.`
  );
}

main()
  .catch((e) => {
    console.error("\n❌", e.message);
    process.exitCode = 1;
  })
  // Il pool di pg tiene vivo il processo: senza questa chiusura lo script
  // finisce il lavoro e poi resta appeso senza terminare.
  .finally(() => chiudiDb());
