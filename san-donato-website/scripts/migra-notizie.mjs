/**
 * Porta gli articoli da WordPress al nostro database.
 *
 * Legge dalla REST API pubblica di WordPress (sola lettura: non scrive mai
 * sul sito della società) oppure da un file JSON già scaricato.
 *
 * È ripetibile: la chiave è wp_id, quindi rieseguirlo aggiorna gli articoli
 * già importati invece di crearne dei doppioni.
 *
 * Uso:
 *   node --env-file=.env scripts/migra-notizie.mjs --prova
 *   node --env-file=.env scripts/migra-notizie.mjs
 *   node --env-file=.env scripts/migra-notizie.mjs --da percorso/articoli.json
 *
 * Questo script NON sposta i file delle immagini: gli indirizzi restano per
 * ora quelli di WordPress. Il trasferimento su R2 è il passo successivo.
 */

import { getDb } from "../db/client.js";
import { notizie } from "../db/schema.js";
import { sql } from "drizzle-orm";
import { readFile } from "node:fs/promises";

const WP = "https://wp.polisportivasandonato.org/index.php";

/* Gli stessi indirizzi che il front-end corregge a ogni lettura: qui la
   correzione si fa una volta sola, e poi il problema non esiste più. */
const UPLOADS_STORICO = "https://polisportivasandonato.org/wp/wp-content/";
const UPLOADS_ATTUALE = "https://wp.polisportivasandonato.org/wp-content/";

const argomenti = process.argv.slice(2);
const prova = argomenti.includes("--prova");
const daFile = argomenti[argomenti.indexOf("--da") + 1];
const leggiDaFile = argomenti.includes("--da");

/* =====================================================
   Utilità di pulizia
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
  // Taglia sull'ultimo spazio, per non spezzare una parola a metà
  const tagliato = testo.slice(0, limite);
  return tagliato.slice(0, tagliato.lastIndexOf(" ")).trimEnd() + "…";
}

function correggiIndirizzi(html = "") {
  if (!html.includes(UPLOADS_STORICO)) return html;
  return html.split(UPLOADS_STORICO).join(UPLOADS_ATTUALE);
}

/**
 * Su WordPress lo sport non era un campo: si deduceva dal titolo.
 * Lo deduciamo un'ultima volta, qui, per popolare la colonna vera.
 * Da domani lo sceglie chi scrive, e questa funzione non serve più.
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

async function scaricaArticoli() {
  if (leggiDaFile) {
    console.log(`Leggo da ${daFile}`);
    return JSON.parse(await readFile(daFile, "utf8"));
  }

  const campi = "id,date,modified,slug,status,title,content,excerpt,featured_media,link";
  const url = `${WP}?rest_route=/wp/v2/posts&per_page=100&_fields=${campi}`;

  console.log("Scarico gli articoli da WordPress…");
  const risposta = await fetch(url);
  if (!risposta.ok) throw new Error(`WordPress ha risposto ${risposta.status}`);

  const articoli = await risposta.json();
  const totale = risposta.headers.get("x-wp-total");
  console.log(`Ricevuti ${articoli.length} articoli (WordPress ne dichiara ${totale}).`);

  if (totale && Number(totale) > articoli.length) {
    console.warn(`⚠  Ne mancano ${Number(totale) - articoli.length}: servono più pagine.`);
  }
  return articoli;
}

/* =====================================================
   Trasformazione
   ===================================================== */

function trasforma(articoli) {
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
      sport: deduciSport(titolo),
      stato: a.status === "publish" ? "pubblicata" : "bozza",
      pubblicataIl: a.date ? new Date(a.date + "Z") : null,
      creataIl: a.date ? new Date(a.date + "Z") : new Date(),
      aggiornataIl: a.modified ? new Date(a.modified + "Z") : new Date()
    };
  });
}

/* =====================================================
   Scrittura
   ===================================================== */

async function main() {
  const articoli = await scaricaArticoli();
  const righe = trasforma(articoli);

  console.log(`\nArticoli pronti: ${righe.length}`);

  const perSport = righe.reduce((acc, r) => ({ ...acc, [r.sport]: (acc[r.sport] || 0) + 1 }), {});
  console.log("Ripartizione per sport:", perSport);

  // Va misurato PRIMA della correzione, altrimenti il conteggio dice sempre zero
  const conIndirizziStorici = articoli.filter(a => (a.content?.rendered || "").includes(UPLOADS_STORICO)).length;
  console.log(`Articoli con indirizzi immagine da riscrivere: ${conIndirizziStorici}`);

  if (prova) {
    console.log("\n--prova: non scrivo nulla. Primi tre articoli:\n");
    for (const r of righe.slice(0, 3)) {
      console.log(`  [${r.wpId}] ${r.sport.padEnd(10)} ${r.titolo.slice(0, 60)}`);
      console.log(`         slug: ${r.slug}`);
      console.log(`         ${r.sommario.slice(0, 90)}…\n`);
    }
    return;
  }

  const db = getDb();
  let inseriti = 0;

  for (const riga of righe) {
    await db.insert(notizie).values(riga).onConflictDoUpdate({
      target: notizie.wpId,
      set: {
        titolo: riga.titolo,
        sommario: riga.sommario,
        contenuto: riga.contenuto,
        stato: riga.stato,
        aggiornataIl: riga.aggiornataIl
      }
    });
    inseriti++;
    if (inseriti % 20 === 0) console.log(`  …${inseriti}/${righe.length}`);
  }

  const [{ totale }] = await db.select({ totale: sql`count(*)::int` }).from(notizie);
  console.log(`\n✅ Importati ${inseriti} articoli. Nel database ora ce ne sono ${totale}.`);
}

main().catch((e) => {
  console.error("\n❌", e.message);
  process.exit(1);
});
