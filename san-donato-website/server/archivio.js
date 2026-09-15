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
 *
 * IN LOCALE, senza credenziali R2, si può accendere ARCHIVIO_LOCALE=1: i
 * file finiscono in public/caricamenti/ e Vite li serve da /caricamenti.
 * Non è un ripiego per la produzione — su Vercel il disco è di sola
 * lettura e riparte vuoto a ogni invocazione — ma senza di esso in sviluppo
 * non si può provare NIENTE che riguardi un file: copertine, certificati
 * medici, immagini del profilo, libreria dei media. Aspettare le chiavi di
 * Cloudflare per scrivere quel codice vorrebbe dire scriverlo alla cieca.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ErroreHttp } from "./risposte.js";
import { archivioLocale, urlPubblico } from "./file.js";

const DURATA_PERMESSO_SECONDI = 300; // cinque minuti per completare il caricamento

let cliente = null;

export function archivioConfigurato() {
  if (archivioLocale()) return true;

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
    /* Messaggio per chi lo legge, non per chi l'ha scritto.

       Finisce davanti a un allenatore che sta caricando la foto di una
       partita, o davanti a un cliente durante una dimostrazione: "mancano
       le variabili R2_*" non gli dice cosa fare né di chi è il turno.
       Quello che serve a chi programma sta qui sopra, in questo file. */
    throw new ErroreHttp(
      503,
      "I caricamenti non sono ancora attivi: manca il collegamento "
      + "all'archivio dei file, che la società deve ancora fornire."
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
   Modalita' locale: i file su disco
   ===================================================== */

/*
 * public/ e non una cartella qualsiasi: Vite serve quel contenuto così
 * com'è, quindi l'immagine caricata è raggiungibile subito senza
 * aggiungere una rotta statica al server di sviluppo. La cartella è
 * ignorata da git: sono file di prova, non codice.
 */
const CARTELLA_LOCALE = fileURLToPath(new URL("../public/caricamenti/", import.meta.url));

/*
 * Forma ammessa per una chiave: cartella/anno/mese/casuale.estensione.
 * Serve a due cose. La prima è respingere i percorsi che tentano di
 * risalire ("../../.env"): la chiave arriva dal browser, e in modalità
 * locale finisce dritta in un percorso su disco. La seconda è rifiutare
 * chiavi che non abbiamo generato noi, che non corrisponderebbero comunque
 * a nessun permesso di caricamento.
 */
const FORMA_CHIAVE = new RegExp("^[a-z]+/[0-9]{4}/[0-9]{2}/[0-9a-f]{16}[.][a-z0-9]+$");

export function chiaveValida(chiave) {
  return typeof chiave === "string" && FORMA_CHIAVE.test(chiave);
}

/** Scrive il file in public/caricamenti. Solo in modalità locale. */
export async function scriviFileLocale(chiave, contenuto) {
  if (!chiaveValida(chiave)) throw new ErroreHttp(400, "Nome del file non valido.");

  const destinazione = join(CARTELLA_LOCALE, chiave);
  await mkdir(dirname(destinazione), { recursive: true });
  await writeFile(destinazione, contenuto);
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
  /*
   * In locale non c'è niente da firmare: il permesso è l'indirizzo di una
   * nostra rotta, che accetta la PUT solo da chi ha già una sessione con la
   * capacita' di caricare. Stessa sequenza di R2 vista dal browser — chiedi,
   * carica, registra — così il codice del front-end è uno solo.
   */
  if (archivioLocale()) return `/api/admin/carica-file?chiave=${encodeURIComponent(chiave)}`;

  const comando = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: chiave,
    ContentType: mime,
    ContentLength: byte
  });

  return getSignedUrl(getCliente(), comando, { expiresIn: DURATA_PERMESSO_SECONDI });
}

export async function eliminaFile(chiave) {
  if (archivioLocale()) {
    // Il file potrebbe non esserci piu': la riga in tabella resta il
    // riferimento buono, e fallire qui bloccherebbe una cancellazione
    // legittima per un file già sparito.
    await unlink(join(CARTELLA_LOCALE, chiave)).catch(() => {});
    return;
  }

  await getCliente().send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: chiave
  }));
}

// Riesportati da file.js: chi lavora con l'archivio si aspetta di
// trovarli qui, e non deve sapere che stanno altrove per non trascinarsi
// dietro l'SDK di S3.
export { archivioLocale, urlPubblico };
