/**
 * Controlla che Cloudflare R2 sia collegato bene, prima di fidarsi.
 *
 *   node --env-file=.env.demo scripts/prova-r2.mjs
 *
 * Legge le stesse variabili del sito (R2_*, URL_PUBBLICO_FILE) e per
 * ciascuno dei due bucket fa il giro completo che fa il sito: scrive un
 * file di prova con un permesso firmato, come il browser, lo rilegge e lo
 * cancella. In più controlla le tre cose che, sbagliate, non danno un
 * errore leggibile ma un caricamento che "non va" e basta:
 *
 *   1. il CORS: senza, il browser non può caricare direttamente su R2;
 *   2. il bucket pubblico si legge davvero da URL_PUBBLICO_FILE;
 *   3. il bucket riservato NON si legge senza firma.
 *
 * Non tocca il database. I file di prova si chiamano prova/…, e vengono
 * cancellati alla fine anche se un controllo fallisce.
 *
 * Con --origine=https://indirizzo-del-sito si prova il CORS per quel sito;
 * senza, il controllo del CORS si salta (e lo dice).
 */

import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";

const argomento = (nome) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split("=").slice(1).join("=");
const ORIGINE = argomento("origine") || null;

const {
  R2_ACCOUNT_ID, R2_BUCKET, R2_BUCKET_PRIVATO, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, URL_PUBBLICO_FILE
} = process.env;

let problemi = 0;
const ok = (testo) => console.log(`  ✓ ${testo}`);
const no = (testo, consiglio) => {
  problemi += 1;
  console.log(`  ✗ ${testo}`);
  if (consiglio) console.log(`      → ${consiglio}`);
};

console.log("\nVariabili");
const mancanti = Object.entries({
  R2_ACCOUNT_ID, R2_BUCKET, R2_BUCKET_PRIVATO, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, URL_PUBBLICO_FILE
}).filter(([, v]) => !v).map(([k]) => k);

if (mancanti.length) {
  no(`mancano: ${mancanti.join(", ")}`, "vanno nel file .env usato per lanciare lo script, e in Vercel");
  process.exit(1);
}
ok("ci sono tutte");
if (R2_BUCKET === R2_BUCKET_PRIVATO) {
  no("R2_BUCKET e R2_BUCKET_PRIVATO sono lo stesso bucket", "i certificati devono stare in un bucket SENZA accesso pubblico");
}

const cliente = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
});

const contenuto = Buffer.from(`prova del ${new Date().toISOString()}\n`);
const scritti = [];

async function giro(bucket, { pubblico }) {
  console.log(`\nBucket ${pubblico ? "pubblico" : "riservato"}: ${bucket}`);
  const chiave = `prova/${randomBytes(8).toString("hex")}.txt`;

  // 1. Il CORS, con la stessa domanda che fa il browser prima di caricare
  const permesso = await getSignedUrl(cliente, new PutObjectCommand({
    Bucket: bucket, Key: chiave, ContentType: "text/plain", ContentLength: contenuto.length
  }), { expiresIn: 120 });

  if (!ORIGINE) {
    console.log("  - CORS non controllato: rilancia con --origine=https://indirizzo-del-sito");
  } else try {
    const preliminare = await fetch(permesso, {
      method: "OPTIONS",
      headers: {
        Origin: ORIGINE,
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type"
      }
    });
    const consentita = preliminare.headers.get("access-control-allow-origin");
    if (preliminare.ok && (consentita === ORIGINE || consentita === "*")) ok(`CORS: ${ORIGINE} può caricare`);
    else no(`CORS: ${ORIGINE} non può caricare (risposta ${preliminare.status})`, "Settings → CORS Policy del bucket: vedi MESSA-ONLINE.md, sezione R2");
  } catch (e) {
    no(`CORS: controllo non riuscito (${e.message})`);
  }

  // 2. Scrittura, come il browser: PUT sul permesso firmato
  const scrittura = await fetch(permesso, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: contenuto });
  if (!scrittura.ok) {
    no(`scrittura non riuscita (${scrittura.status})`, "il token deve avere \"Object Read & Write\" su questo bucket");
    return;
  }
  scritti.push({ bucket, chiave });
  ok("scrittura con permesso firmato");

  // 3. Lettura firmata: quella che il sito usa per i certificati
  const firmata = await getSignedUrl(cliente, new GetObjectCommand({ Bucket: bucket, Key: chiave }), { expiresIn: 60 });
  const letta = await fetch(firmata);
  if (letta.ok && (await letta.text()) === contenuto.toString()) ok("lettura con link firmato");
  else no(`lettura firmata non riuscita (${letta.status})`);

  // 4. Lettura SENZA firma
  if (pubblico) {
    const indirizzo = `${URL_PUBBLICO_FILE.replace(/\/+$/, "")}/${chiave}`;
    try {
      const aperta = await fetch(indirizzo);
      if (aperta.ok) ok(`si legge da ${URL_PUBBLICO_FILE}`);
      else no(`da ${indirizzo} risponde ${aperta.status}`, "accendi l'accesso pubblico del bucket (dominio r2.dev o dominio proprio) e mettilo in URL_PUBBLICO_FILE");
    } catch (e) {
      no(`URL_PUBBLICO_FILE non raggiungibile (${e.message})`);
    }
  } else {
    // L'indirizzo "grezzo" dell'API, senza firma: deve rifiutare
    const grezzo = await fetch(`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${chiave}`);
    if (!grezzo.ok) ok("senza firma non si legge");
    else no("il bucket riservato si legge senza firma!", "togli ogni accesso pubblico al bucket riservato");
  }
}

try {
  await giro(R2_BUCKET, { pubblico: true });
  await giro(R2_BUCKET_PRIVATO, { pubblico: false });
} catch (e) {
  no(`errore: ${e.message}`, "controlla R2_ACCOUNT_ID e le due chiavi del token");
} finally {
  for (const { bucket, chiave } of scritti) {
    await cliente.send(new DeleteObjectCommand({ Bucket: bucket, Key: chiave })).catch(() => {});
  }
}

console.log(problemi ? `\n${problemi} cose da sistemare.\n` : "\nTutto a posto: R2 è pronto.\n");
process.exit(problemi ? 1 : 0);
