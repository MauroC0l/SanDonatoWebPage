/**
 * Porta su Cloudflare R2 i file che stanno ancora sul vecchio WordPress.
 *
 *   node --env-file=.env.demo scripts/trasferisci-file-wordpress.mjs --prova
 *   node --env-file=.env.demo scripts/trasferisci-file-wordpress.mjs
 *   node --env-file=.env.demo scripts/trasferisci-file-wordpress.mjs --limite=20
 *
 * PERCHÉ. Le immagini delle notizie importate (e alcuni documenti) sono
 * ancora file di wp.polisportivasandonato.org: il nostro database li indica
 * soltanto. Il giorno che WordPress si spegne, spariscono tutte insieme.
 * Questo script le copia nel bucket PUBBLICO di R2 e aggiorna i riferimenti:
 *
 *   1. media con solo urlOriginaleWp → scarica, carica su R2, riempie
 *      "chiave". Da lì l'indirizzo cambia da solo ovunque il file è usato
 *      come media (copertine, gallerie, libreria);
 *   2. il testo delle notizie, dove WordPress ha scritto l'indirizzo per
 *      intero (<img src="…">), anche nelle versioni ridotte "-1024x768":
 *      tutte puntano al file intero su R2;
 *   3. i documenti il cui indirizzo è ancora su WordPress: diventano un
 *      file della libreria (cartella documenti/) collegato al documento.
 *
 * urlOriginaleWp NON si cancella: resta la traccia di dove stava il file,
 * e permette di rieseguire lo script senza creare doppioni (un media che ha
 * già la chiave si salta).
 *
 * Con --prova non scrive niente: dice cosa farebbe. Con ARCHIVIO_LOCALE=1
 * scrive in public/caricamenti invece che su R2, per provarlo in locale.
 * Legge WordPress in sola lettura.
 */

import { and, eq, isNotNull, isNull, like, or, sql } from "drizzle-orm";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "node:crypto";
import { getDb, chiudiDb } from "../db/client.js";
import { media, notizie, documenti } from "../db/schema.js";
import { urlPubblico, archivioLocale } from "../server/file.js";
import { scriviFileLocale } from "../server/archivio.js";

const prova = process.argv.includes("--prova");
const limite = Number(process.argv.find((a) => a.startsWith("--limite="))?.split("=")[1]) || Infinity;

// Solo questi domini: un indirizzo esterno qualunque non è "nostro" da copiare
const DA_WORDPRESS = /^https?:\/\/(wp\.)?polisportivasandonato\.(org|it)\//i;

const ESTENSIONE_DA_MIME = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif",
  "image/gif": "gif", "application/pdf": "pdf", "video/mp4": "mp4", "video/webm": "webm"
};

function controllaAmbiente() {
  if (archivioLocale()) return;
  const mancanti = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "URL_PUBBLICO_FILE"]
    .filter((k) => !process.env[k]);
  if (mancanti.length) {
    console.error(`Mancano ${mancanti.join(", ")}. Prova prima scripts/prova-r2.mjs.`);
    process.exit(1);
  }
}

const cliente = archivioLocale() ? null : new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }
});

/* La chiave nella stessa forma di quelle del sito (cartella/anno/mese/
   casuale.estensione), con anno e mese presi dall'indirizzo di WordPress
   quando ci sono: "uploads/2023/05/" resta maggio 2023. */
function chiaveDa(url, mime, cartella) {
  const estensione = ESTENSIONE_DA_MIME[mime]
    ?? (url.split("?")[0].match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "bin").toLowerCase();
  const data = url.match(/\/uploads\/(\d{4})\/(\d{2})\//);
  const ora = new Date();
  const anno = data?.[1] ?? String(ora.getFullYear());
  const mese = data?.[2] ?? String(ora.getMonth() + 1).padStart(2, "0");
  return `${cartella}/${anno}/${mese}/${randomBytes(8).toString("hex")}.${estensione}`;
}

async function scarica(url) {
  const risposta = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!risposta.ok) throw new Error(`WordPress risponde ${risposta.status}`);
  return {
    byte: Buffer.from(await risposta.arrayBuffer()),
    mime: (risposta.headers.get("content-type") || "").split(";")[0].trim()
  };
}

async function carica(chiave, byte, mime) {
  if (archivioLocale()) return scriviFileLocale(chiave, byte);
  await cliente.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: chiave,
    Body: byte,
    ContentType: mime,
    // Il nome è casuale e non cambia mai: il browser può tenerlo a lungo
    CacheControl: "public, max-age=31536000, immutable"
  }));
}

const escapa = (testo) => testo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* L'indirizzo di WordPress e le sue varianti ridotte: "foto.jpg",
   "foto-300x200.jpg", "foto-1024x768.jpg". Il dominio vale con e senza "wp.". */
function espressioneDi(url) {
  const [, percorso] = url.match(/^https?:\/\/(?:wp\.)?polisportivasandonato\.(?:org|it)(\/.*)$/i) ?? [];
  if (!percorso) return null;
  const punto = percorso.lastIndexOf(".");
  const base = punto > 0 ? percorso.slice(0, punto) : percorso;
  const estensione = punto > 0 ? percorso.slice(punto) : "";
  return new RegExp(
    `https?://(?:wp\\.)?polisportivasandonato\\.(?:org|it)${escapa(base)}(?:-\\d+x\\d+)?${escapa(estensione)}`,
    "gi"
  );
}

async function main() {
  controllaAmbiente();
  const db = getDb();
  console.log(prova ? "\nPROVA: non scrivo niente.\n" : "\nTrasferimento su R2.\n");

  /* ---------- 1. i media ---------- */
  const daPortare = await db
    .select({ id: media.id, url: media.urlOriginaleWp, mime: media.mime })
    .from(media)
    .where(and(isNull(media.chiave), isNotNull(media.urlOriginaleWp)))
    .orderBy(media.id);

  console.log(`Media ancora su WordPress: ${daPortare.length}`);
  const sostituzioni = [];
  let fatti = 0;
  let falliti = 0;

  for (const m of daPortare.slice(0, limite)) {
    if (!DA_WORDPRESS.test(m.url)) continue;
    const chiave = chiaveDa(m.url, m.mime, "notizie");
    if (prova) {
      console.log(`  ${m.url}\n    → ${chiave}`);
      continue;
    }
    try {
      const { byte, mime } = await scarica(m.url);
      await carica(chiave, byte, m.mime || mime);
      await db.update(media).set({ chiave, byte: byte.length }).where(eq(media.id, m.id));
      sostituzioni.push({ espressione: espressioneDi(m.url), nuovo: urlPubblico(chiave) });
      fatti += 1;
      if (fatti % 25 === 0) console.log(`  … ${fatti} file`);
    } catch (e) {
      falliti += 1;
      console.warn(`  ✗ media ${m.id} (${m.url}): ${e.message}`);
    }
  }

  // Anche i media trasferiti in un giro precedente, per le notizie non ancora sistemate
  if (!prova) {
    const giaPortati = await db
      .select({ url: media.urlOriginaleWp, chiave: media.chiave })
      .from(media)
      .where(and(isNotNull(media.chiave), isNotNull(media.urlOriginaleWp)));
    for (const m of giaPortati) {
      if (!sostituzioni.some((s) => s.nuovo === urlPubblico(m.chiave))) {
        sostituzioni.push({ espressione: espressioneDi(m.url), nuovo: urlPubblico(m.chiave) });
      }
    }
  }

  console.log(`Media trasferiti: ${fatti}${falliti ? `, non riusciti: ${falliti} (si riprovano rilanciando)` : ""}`);

  /* ---------- 2. il testo delle notizie ---------- */
  const conIndirizzi = await db
    .select({ id: notizie.id, contenuto: notizie.contenuto })
    .from(notizie)
    .where(or(like(notizie.contenuto, "%polisportivasandonato.org/%"), like(notizie.contenuto, "%polisportivasandonato.it/%")));

  let notizieCambiate = 0;
  if (!prova) {
    for (const n of conIndirizzi) {
      let testo = n.contenuto;
      for (const s of sostituzioni) {
        if (s.espressione && s.nuovo) testo = testo.replace(s.espressione, s.nuovo);
      }
      if (testo !== n.contenuto) {
        await db.update(notizie).set({ contenuto: testo }).where(eq(notizie.id, n.id));
        notizieCambiate += 1;
      }
    }
  }
  console.log(`Notizie con indirizzi di WordPress nel testo: ${conIndirizzi.length}${prova ? "" : `, sistemate: ${notizieCambiate}`}`);

  /* ---------- 3. i documenti ---------- */
  const docs = await db
    .select({ id: documenti.id, titolo: documenti.titolo, url: documenti.url })
    .from(documenti)
    .where(isNull(documenti.mediaId));

  let docFatti = 0;
  for (const d of docs.filter((x) => DA_WORDPRESS.test(x.url))) {
    if (prova) {
      console.log(`  documento "${d.titolo}": ${d.url}`);
      continue;
    }
    try {
      const { byte, mime } = await scarica(d.url);
      const tipo = mime || "application/pdf";
      const chiave = chiaveDa(d.url, tipo, "documenti");
      await carica(chiave, byte, tipo);
      const [nuovo] = await db.insert(media).values({
        chiave, mime: tipo, byte: byte.length, titolo: d.titolo, urlOriginaleWp: d.url
      }).returning({ id: media.id });
      await db.update(documenti).set({ mediaId: nuovo.id, url: urlPubblico(chiave) }).where(eq(documenti.id, d.id));
      docFatti += 1;
    } catch (e) {
      console.warn(`  ✗ documento ${d.id} (${d.url}): ${e.message}`);
    }
  }
  console.log(`Documenti ancora su WordPress: ${docs.filter((x) => DA_WORDPRESS.test(x.url)).length}${prova ? "" : `, trasferiti: ${docFatti}`}`);

  // Quello che resta: da guardare a mano prima di spegnere WordPress
  const [resto] = await db
    .select({ n: sql`count(*)::int` })
    .from(notizie)
    .where(like(notizie.contenuto, "%wp-content/uploads%"));
  if (prova) {
    console.log(`\nNotizie che oggi citano wp-content/uploads: ${resto.n} (quante ne restano si vede dopo il trasferimento)\n`);
  } else {
    console.log(`\nNotizie che citano ancora wp-content/uploads: ${resto.n}${resto.n ? " (file mai importati come media: vanno guardate a mano)" : ""}\n`);
  }
}

try {
  await main();
} finally {
  await chiudiDb?.();
}
