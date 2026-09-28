/**
 * I documenti pubblicati sul sito: privacy, statuto, policy, rendiconti.
 *
 * Prima erano scritti a mano nei file di dati delle pagine; adesso stanno
 * nella tabella documenti e li gestisce l'amministratore dalla scheda
 * "Documenti". Le pagine pubbliche li leggono da /api/documenti.
 */

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { documenti, media } from "../db/schema.js";
import { urlFile } from "./file.js";
import { ErroreHttp } from "./risposte.js";

/**
 * Le sezioni, come le legge chi gestisce: dove compare il documento e
 * quali campi in più ha. L'ordine è quello della scheda.
 */
export const SEZIONI = [
  { valore: "menu", etichetta: "Menu \"Documenti\"", dove: "Nel menu in alto, su tutte le pagine del sito" },
  { valore: "privacy", etichetta: "Privacy", dove: "Pagina Privacy" },
  { valore: "tutela_minori", etichetta: "Tutela minori: policy", dove: "Pagina Tutela minori, le policy delle federazioni" },
  { valore: "safeguarding", etichetta: "Tutela minori: safeguarding", dove: "Pagina Tutela minori, gli atti della Responsabile Safeguarding" },
  { valore: "contributi", etichetta: "Contributi pubblici", dove: "Pagina Contributi, il rendiconto ufficiale" },
  { valore: "cinque_per_mille", etichetta: "Rendiconti 5x1000", dove: "Pagina 5x1000, la tabella dei rendiconti", conRendiconto: true }
];

const VALORI_SEZIONE = SEZIONI.map((s) => s.valore);

/* Un indirizzo che il sito sa aprire: un file del sito ("/documenti/…",
   "/caricamenti/…") o un indirizzo web completo. Niente "javascript:" e
   simili, che in un collegamento sarebbero un modo di eseguire codice. */
const indirizzo = z.string().trim().max(600)
  .refine((v) => /^\/(?!\/)/.test(v) || /^https?:\/\//i.test(v),
    "L'indirizzo deve iniziare con / (un file del sito) o con https://");

const facoltativo = (schema) => z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  schema.nullable()
).optional();

const CAMPI = {
  sezione: z.enum(VALORI_SEZIONE),
  titolo: z.string().trim().min(2, "Il titolo è troppo corto.").max(200),
  descrizione: facoltativo(z.string().trim().max(600)),
  url: facoltativo(indirizzo),
  mediaId: z.coerce.number().int().positive().nullable().optional(),
  anno: facoltativo(z.string().trim().max(20)),
  importo: facoltativo(z.string().trim().max(40)),
  percepitoIl: facoltativo(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La data va scritta come 2026-05-14.")),
  pubblicato: z.boolean().optional()
};

export const schemaDocumentoNuovo = z.object({
  ...CAMPI,
  descrizione: CAMPI.descrizione,
  pubblicato: CAMPI.pubblicato
});

export const schemaDocumentoModifica = z.object({
  sezione: CAMPI.sezione.optional(),
  titolo: CAMPI.titolo.optional(),
  descrizione: CAMPI.descrizione,
  url: CAMPI.url,
  mediaId: CAMPI.mediaId,
  anno: CAMPI.anno,
  importo: CAMPI.importo,
  percepitoIl: CAMPI.percepitoIl,
  pubblicato: CAMPI.pubblicato
});

export const schemaOrdine = z.object({
  sezione: z.enum(VALORI_SEZIONE),
  ids: z.array(z.coerce.number().int().positive()).min(1).max(200)
});

function daRiga(r, { perGestione = false } = {}) {
  const documento = {
    id: r.id,
    sezione: r.sezione,
    titolo: r.titolo,
    descrizione: r.descrizione ?? "",
    url: r.url,
    anno: r.anno ?? null,
    importo: r.importo ?? null,
    percepitoIl: r.percepitoIl ?? null,
    ordine: r.ordine
  };
  if (!perGestione) return documento;
  return {
    ...documento,
    mediaId: r.mediaId ?? null,
    nomeFile: r.nomeFile ?? null,
    pubblicato: r.pubblicato,
    aggiornatoIl: r.aggiornatoIl
  };
}

/** I documenti pubblicati, di una sezione o di tutte, nell'ordine deciso. */
export async function elencaDocumentiPubblici(sezione = null) {
  const condizioni = [eq(documenti.pubblicato, true)];
  if (sezione) condizioni.push(eq(documenti.sezione, sezione));
  const righe = await getDb().select().from(documenti)
    .where(and(...condizioni))
    .orderBy(asc(documenti.sezione), asc(documenti.ordine), asc(documenti.id));
  return righe.map((r) => daRiga(r));
}

/** Tutti, anche i nascosti, con il nome del file della libreria se c'è. */
export async function elencaDocumentiPerGestione() {
  const righe = await getDb()
    .select({
      id: documenti.id, sezione: documenti.sezione, titolo: documenti.titolo,
      descrizione: documenti.descrizione, url: documenti.url, mediaId: documenti.mediaId,
      anno: documenti.anno, importo: documenti.importo, percepitoIl: documenti.percepitoIl,
      ordine: documenti.ordine, pubblicato: documenti.pubblicato, aggiornatoIl: documenti.aggiornatoIl,
      nomeFile: media.titolo
    })
    .from(documenti)
    .leftJoin(media, eq(media.id, documenti.mediaId))
    .orderBy(asc(documenti.sezione), asc(documenti.ordine), asc(documenti.id));
  return righe.map((r) => daRiga(r, { perGestione: true }));
}

/**
 * L'indirizzo del file: quello scritto, oppure quello del file scelto
 * dalla libreria. Almeno uno dei due ci deve essere.
 */
async function indirizzoDi({ url, mediaId }) {
  if (mediaId) {
    const [m] = await getDb()
      .select({ chiave: media.chiave, urlWp: media.urlOriginaleWp })
      .from(media).where(eq(media.id, mediaId)).limit(1);
    if (!m) throw new ErroreHttp(400, "Il file scelto dalla libreria non esiste più.");
    const daLibreria = urlFile(m.chiave, m.urlWp);
    if (daLibreria) return daLibreria;
  }
  if (url) return url;
  throw new ErroreHttp(400, "Manca il file: sceglilo dalla libreria oppure scrivi il suo indirizzo.");
}

export async function creaDocumento(dati, autoreId) {
  const url = await indirizzoDi(dati);
  const db = getDb();
  // In fondo alla sua sezione: il nuovo arriva ultimo, poi lo si sposta
  const [{ ultimo }] = await db.select({ ultimo: sql`coalesce(max(${documenti.ordine}), 0)::int` })
    .from(documenti).where(eq(documenti.sezione, dati.sezione));
  const [creato] = await db.insert(documenti).values({
    sezione: dati.sezione,
    titolo: dati.titolo,
    descrizione: dati.descrizione ?? null,
    url,
    mediaId: dati.mediaId ?? null,
    anno: dati.anno ?? null,
    importo: dati.importo ?? null,
    percepitoIl: dati.percepitoIl ?? null,
    pubblicato: dati.pubblicato ?? true,
    ordine: ultimo + 1,
    aggiornatoDa: autoreId ?? null
  }).returning();
  return daRiga(creato, { perGestione: true });
}

export async function modificaDocumento(id, dati, autoreId) {
  const db = getDb();
  const [esistente] = await db.select().from(documenti).where(eq(documenti.id, Number(id))).limit(1);
  if (!esistente) throw new ErroreHttp(404, "Documento non trovato.");

  const modifiche = { aggiornatoIl: new Date(), aggiornatoDa: autoreId ?? null };
  for (const campo of ["sezione", "titolo", "descrizione", "anno", "importo", "percepitoIl", "pubblicato"]) {
    if (dati[campo] !== undefined) modifiche[campo] = dati[campo];
  }
  // Il file cambia solo se ne arriva uno nuovo (dalla libreria o scritto)
  if (dati.mediaId !== undefined || dati.url !== undefined) {
    const mediaId = dati.mediaId !== undefined ? dati.mediaId : null;
    modifiche.mediaId = mediaId;
    modifiche.url = await indirizzoDi({ url: dati.url ?? (mediaId ? null : esistente.url), mediaId });
  }

  const [salvato] = await db.update(documenti).set(modifiche)
    .where(eq(documenti.id, Number(id))).returning();
  return daRiga(salvato, { perGestione: true });
}

/** Cancella il documento dal sito. Il file resta dov'era (libreria o cartella). */
export async function eliminaDocumento(id) {
  const [tolto] = await getDb().delete(documenti)
    .where(eq(documenti.id, Number(id)))
    .returning({ id: documenti.id, titolo: documenti.titolo });
  if (!tolto) throw new ErroreHttp(404, "Documento non trovato.");
  return tolto;
}

/** Il nuovo ordine di una sezione: gli identificativi nell'ordine voluto. */
export async function riordinaDocumenti(sezione, ids) {
  const db = getDb();
  const suoi = await db.select({ id: documenti.id }).from(documenti)
    .where(and(eq(documenti.sezione, sezione), inArray(documenti.id, ids)));
  if (suoi.length !== ids.length) {
    throw new ErroreHttp(400, "L'ordine contiene documenti di un'altra sezione o che non esistono più.");
  }
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) {
      await tx.update(documenti).set({ ordine: i + 1 }).where(eq(documenti.id, id));
    }
  });
}
