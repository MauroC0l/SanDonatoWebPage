/**
 * Archivio dei file su Cloudflare R2 (protocollo S3).
 *
 * Il browser NON manda il file a noi: chiede un permesso di scrittura a
 * scadenza breve e poi carica direttamente su R2. Due motivi.
 *
 * Il primo è un limite pratico: il corpo di una richiesta verso una funzione
 * serverless ha un tetto di pochi megabyte, e un video di una partita lo
 * supera senza sforzo.
 *
 * Il secondo è di sostanza: i file non attraversano il nostro codice, quindi
 * non c'è nulla da tenere in memoria né da rimettere in coda se la funzione
 * viene interrotta a metà.
 *
 * Configurazione richiesta (variabili d'ambiente):
 *   R2_ACCOUNT_ID          identificativo dell'account Cloudflare
 *   R2_BUCKET              nome del bucket
 *   R2_ACCESS_KEY_ID       chiave del token API con permesso di scrittura
 *   R2_SECRET_ACCESS_KEY   segreto corrispondente
 *   URL_PUBBLICO_FILE      dominio da cui i file si leggono pubblicamente
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";
import { ErroreHttp } from "./risposte.js";

const DURATA_PERMESSO_SECONDI = 300; // cinque minuti per completare il caricamento

let cliente = null;

export function archivioConfigurato() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_BUCKET &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  );
}

function getCliente() {
  if (cliente) return cliente;

  if (!archivioConfigurato()) {
    // Messaggio esplicito invece di un errore oscuro dell'SDK: chi lo legge
    // deve capire che manca una configurazione, non che il codice è rotto.
    throw new ErroreHttp(
      503,
      "L'archivio dei file non è configurato. Mancano le variabili R2_* sul server."
    );
  }

  cliente = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });

  return cliente;
}

/* =====================================================
   Nomi dei file
   ===================================================== */

const ESTENSIONI = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/avif": "avif", "image/gif": "gif",
  "application/pdf": "pdf",
  "video/mp4": "mp4", "video/webm": "webm"
};

export const TIPI_AMMESSI = Object.keys(ESTENSIONI);

/**
 * Chiave dell'oggetto dentro il bucket.
 *
 * Divisa per anno e mese come faceva WordPress, e con una parte casuale:
 * due persone che caricano "foto.jpg" lo stesso giorno non devono
 * sovrascriversi a vicenda, e un nome indovinabile renderebbe elencabili
 * file che non devono esserlo.
 */
export function componiChiave(mime, cartella = "notizie") {
  const estensione = ESTENSIONI[mime];
  if (!estensione) throw new ErroreHttp(415, `Tipo di file non ammesso: ${mime}`);

  const ora = new Date();
  const anno = ora.getFullYear();
  const mese = String(ora.getMonth() + 1).padStart(2, "0");
  const casuale = randomBytes(8).toString("hex");

  return `${cartella}/${anno}/${mese}/${casuale}.${estensione}`;
}

/* =====================================================
   Operazioni
   ===================================================== */

/** Permesso di scrittura a scadenza, per un caricamento dal browser. */
export async function permessoDiCaricamento(chiave, mime, byte) {
  const comando = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: chiave,
    ContentType: mime,
    ContentLength: byte
  });

  return getSignedUrl(getCliente(), comando, { expiresIn: DURATA_PERMESSO_SECONDI });
}

export async function eliminaFile(chiave) {
  await getCliente().send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: chiave
  }));
}

/** Indirizzo pubblico di una chiave. */
export function urlPubblico(chiave) {
  const base = (process.env.URL_PUBBLICO_FILE || "").replace(/\/+$/, "");
  return base ? `${base}/${chiave}` : null;
}
