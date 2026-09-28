/**
 * Le etichette delle notizie.
 *
 * Al posto delle quattro categorie fisse di prima (società, eventi, sport,
 * solidarietà), che si cambiavano solo toccando il codice. Le etichette le
 * crea, le rinomina e le cancella la redazione dall'editor delle notizie,
 * e una notizia ne può avere più d'una.
 */

import { asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { etichette, notizieEtichette } from "../db/schema.js";
import { ErroreHttp } from "./risposte.js";

/** Tutte le etichette, in ordine di nome, con quante notizie le usano. */
export async function elencaEtichette() {
  return getDb()
    .select({
      id: etichette.id,
      nome: etichette.nome,
      quante: sql`count(${notizieEtichette.notiziaId})::int`
    })
    .from(etichette)
    .leftJoin(notizieEtichette, eq(notizieEtichette.etichettaId, etichette.id))
    .groupBy(etichette.id, etichette.nome)
    .orderBy(asc(sql`lower(${etichette.nome})`));
}

/* Il nome esiste già (senza guardare maiuscole e minuscole)? L'indice
   unico lo impedirebbe comunque, ma con un errore che nessuno capirebbe. */
async function nomeOccupato(nome, escludiId = null) {
  const [riga] = await getDb()
    .select({ id: etichette.id })
    .from(etichette)
    .where(sql`lower(${etichette.nome}) = lower(${nome})`)
    .limit(1);
  return Boolean(riga && riga.id !== escludiId);
}

export async function creaEtichetta(nome) {
  if (await nomeOccupato(nome)) throw new ErroreHttp(409, `L'etichetta "${nome}" c'è già.`);
  const [creata] = await getDb().insert(etichette).values({ nome })
    .returning({ id: etichette.id, nome: etichette.nome });
  return creata;
}

export async function rinominaEtichetta(id, nome) {
  if (await nomeOccupato(nome, Number(id))) {
    throw new ErroreHttp(409, `Un'altra etichetta si chiama già "${nome}".`);
  }
  const [rinominata] = await getDb().update(etichette).set({ nome })
    .where(eq(etichette.id, Number(id)))
    .returning({ id: etichette.id, nome: etichette.nome });
  if (!rinominata) throw new ErroreHttp(404, "Etichetta non trovata.");
  return rinominata;
}

/** Cancella l'etichetta: sparisce dalle notizie che l'avevano, le notizie restano. */
export async function eliminaEtichetta(id) {
  const [tolta] = await getDb().delete(etichette)
    .where(eq(etichette.id, Number(id)))
    .returning({ id: etichette.id, nome: etichette.nome });
  if (!tolta) throw new ErroreHttp(404, "Etichetta non trovata.");
  return tolta;
}

/** Le etichette di più notizie insieme: Map notiziaId → [{ id, nome }]. */
export async function etichettePerNotizie(ids) {
  const mappa = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return mappa;

  const righe = await getDb()
    .select({ notiziaId: notizieEtichette.notiziaId, id: etichette.id, nome: etichette.nome })
    .from(notizieEtichette)
    .innerJoin(etichette, eq(etichette.id, notizieEtichette.etichettaId))
    .where(inArray(notizieEtichette.notiziaId, ids))
    .orderBy(asc(sql`lower(${etichette.nome})`));

  for (const r of righe) mappa.get(r.notiziaId)?.push({ id: r.id, nome: r.nome });
  return mappa;
}

/**
 * Le etichette di una notizia, sostituite in blocco con quelle indicate.
 * Gli identificativi che non esistono (un'etichetta appena cancellata da
 * qualcun altro) si scartano senza errore.
 */
export async function impostaEtichette(notiziaId, ids) {
  const db = getDb();
  const unici = [...new Set((ids ?? []).map(Number))];

  const esistenti = unici.length
    ? (await db.select({ id: etichette.id }).from(etichette).where(inArray(etichette.id, unici)))
      .map((r) => r.id)
    : [];

  await db.transaction(async (tx) => {
    await tx.delete(notizieEtichette).where(eq(notizieEtichette.notiziaId, Number(notiziaId)));
    if (esistenti.length) {
      await tx.insert(notizieEtichette)
        .values(esistenti.map((etichettaId) => ({ notiziaId: Number(notiziaId), etichettaId })));
    }
  });
}
