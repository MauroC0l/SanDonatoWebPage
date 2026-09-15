/**
 * Attacca un certificato finto ad alcuni atleti di prova.
 *
 *   node --env-file=.env scripts/certificati-di-prova.mjs
 *
 * PERCHÉ SERVE: semina-dati-prova.mjs scrive la scadenza del certificato ma
 * non il file, perché quando fu scritto non esisteva un archivio dove
 * metterlo. Il risultato è che in demo la segreteria non ha mai niente da
 * controllare, e il giro "consegna → controllo → approvazione" non si vede.
 *
 * Il file è uno solo, riusato da tutti: è un PNG grigio che non somiglia a
 * un certificato vero, ed è voluto — dei dati di prova non devono sembrare
 * dati veri nemmeno a colpo d'occhio.
 *
 * SOLO IN LOCALE: rifiuta di partire se DATABASE_URL non punta a localhost,
 * e scrive in public/caricamenti, che esiste solo con ARCHIVIO_LOCALE=1.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { media, schedeAtleta, utenti } from "../db/schema.js";

const QUANTI = 14;
const CHIAVE = "certificati/2026/01/00000000deadbeef.png";

/* Un quadrato grigio da 8×8: basta a far comparire un'anteprima e non
   somiglia a niente. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHUlEQVR4nGP8//8/AzUBEwNFYNSAUQNGDRgGBgAA//8DACfcA/2r0+8xAAAAAElFTkSuQmCC",
  "base64"
);

function verificaCheSiaLocale() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    throw new Error(
      "DATABASE_URL non punta a un database locale.\n" +
      "   Questo script attacca certificati finti alle schede: non deve\n" +
      "   poter toccare un database vero."
    );
  }
}

async function main() {
  verificaCheSiaLocale();
  const db = getDb();

  // Il file su disco, dove lo cerca ARCHIVIO_LOCALE
  const destinazione = join(
    fileURLToPath(new URL("../public/caricamenti/", import.meta.url)),
    CHIAVE
  );
  await mkdir(dirname(destinazione), { recursive: true });
  await writeFile(destinazione, PNG);

  // Una riga sola in tabella, riusata da tutti: il vincolo di unicità è
  // sulla chiave, e rifarla a ogni esecuzione creerebbe doppioni.
  const [esistente] = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.chiave, CHIAVE))
    .limit(1);

  const mediaId = esistente?.id ?? (await db
    .insert(media)
    .values({
      chiave: CHIAVE,
      mime: "image/png",
      byte: PNG.length,
      larghezza: 8,
      altezza: 8,
      titolo: "Certificato medico (finto, dati di prova)"
    })
    .returning({ id: media.id }))[0].id;

  /* Solo atleti di prova, solo quelli che hanno una scadenza e non hanno
     ancora un file: rieseguirlo non disfa niente di quello che c'è. */
  const candidati = await db
    .select({ id: schedeAtleta.id, utenteId: schedeAtleta.utenteId })
    .from(schedeAtleta)
    .innerJoin(utenti, eq(utenti.id, schedeAtleta.utenteId))
    .where(and(
      sql`${utenti.email} like '%@prova.psd'`,
      sql`${schedeAtleta.certificatoScadenza} is not null`,
      isNull(schedeAtleta.certificatoMediaId)
    ))
    .limit(QUANTI);

  if (candidati.length === 0) {
    console.log("Nessuna scheda da sistemare: hanno già tutti un file.");
    return;
  }

  const ids = candidati.map((c) => c.id);

  await db.update(schedeAtleta)
    .set({ certificatoMediaId: mediaId })
    .where(inArray(schedeAtleta.id, ids));

  /* Due terzi già controllati, un terzo in attesa: così in demo la
     segreteria ha qualcosa da fare e qualcosa di già fatto. */
  const daControllare = ids.filter((_, i) => i % 3 === 0);
  const approvati = ids.filter((_, i) => i % 3 !== 0);

  await db.update(schedeAtleta)
    .set({
      certificatoStato: "valido",
      certificatoValidatoIl: new Date(Date.now() - 30 * 86400000)
    })
    .where(inArray(schedeAtleta.id, approvati));

  await db.update(schedeAtleta)
    .set({
      certificatoStato: "da_validare",
      certificatoValidatoIl: null,
      certificatoValidatoDa: null
    })
    .where(inArray(schedeAtleta.id, daControllare));

  console.log(
    `Certificato finto attaccato a ${ids.length} schede: `
    + `${approvati.length} già approvate, ${daControllare.length} da controllare.`
  );
}

main().then(() => process.exit(0), (e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
