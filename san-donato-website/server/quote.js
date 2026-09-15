/**
 * Le tariffe della stagione: prima iscrizione, rinnovo, sconto fratello.
 *
 * Prima la quota si batteva a mano su ogni scheda. Sessanta importi scritti
 * uno per uno vogliono dire, ogni anno, qualche 200 al posto di 250 e gli
 * sconti applicati a memoria — e nessun modo di rispondere alla domanda
 * "quanti hanno lo sconto fratello".
 *
 * CHI FA COSA: le tariffe le crea e le cambia l'amministratore
 * ("quote.tariffe"); la segreteria le applica alle schede ("quote.gestisci").
 * Sono due mestieri diversi: decidere quanto si paga è una delibera, dire
 * chi paga quanto è amministrazione.
 */

import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { tipiQuota, schedeAtleta } from "../db/schema.js";
import { ErroreHttp } from "./risposte.js";

/**
 * Le tariffe, con quante schede le stanno usando.
 *
 * Il conteggio serve prima di spegnerne una: "questa tariffa ce l'hanno in
 * quarantadue" è l'informazione che fa decidere.
 */
export async function elencaTipiQuota({ ancheSpente = true } = {}) {
  const db = getDb();

  const condizioni = ancheSpente ? [] : [eq(tipiQuota.attiva, true)];

  /* Il conteggio con un innesto e un raggruppamento, non con una
     sottoselezione: dentro a un sql`` il riferimento a una tabella non
     viene reso come nome ma come oggetto, e il conto tornava sempre zero. */
  const righe = await db
    .select({
      id: tipiQuota.id,
      nome: tipiQuota.nome,
      descrizione: tipiQuota.descrizione,
      importoCentesimi: tipiQuota.importoCentesimi,
      attiva: tipiQuota.attiva,
      ordine: tipiQuota.ordine,
      quanti: sql`count(${schedeAtleta.id})::int`
    })
    .from(tipiQuota)
    .leftJoin(schedeAtleta, eq(schedeAtleta.tipoQuotaId, tipiQuota.id))
    .where(condizioni.length ? and(...condizioni) : undefined)
    .groupBy(
      tipiQuota.id, tipiQuota.nome, tipiQuota.descrizione,
      tipiQuota.importoCentesimi, tipiQuota.attiva, tipiQuota.ordine
    )
    .orderBy(asc(tipiQuota.ordine), asc(tipiQuota.nome));

  return righe;
}

export async function creaTipoQuota(dati, autoreId) {
  const [creata] = await getDb()
    .insert(tipiQuota)
    .values({
      nome: dati.nome,
      descrizione: dati.descrizione ?? null,
      importoCentesimi: dati.importoCentesimi,
      ordine: dati.ordine ?? 0,
      creataDa: autoreId
    })
    .returning({ id: tipiQuota.id, nome: tipiQuota.nome });

  return creata;
}

export async function aggiornaTipoQuota(id, dati) {
  const modifiche = {};

  if (dati.nome !== undefined) modifiche.nome = dati.nome;
  if (dati.descrizione !== undefined) modifiche.descrizione = dati.descrizione || null;
  if (dati.importoCentesimi !== undefined) modifiche.importoCentesimi = dati.importoCentesimi;
  if (dati.attiva !== undefined) modifiche.attiva = dati.attiva;
  if (dati.ordine !== undefined) modifiche.ordine = dati.ordine;

  if (Object.keys(modifiche).length === 0) {
    throw new ErroreHttp(400, "Non c'è niente da salvare.");
  }

  /*
   * Cambiare l'importo NON tocca le quote già assegnate.
   *
   * Sono accordi presi con le famiglie: riscriverli tutti insieme perché il
   * consiglio ha ritoccato il listino a gennaio non sarebbe una comodità, è
   * il modo di ritrovarsi quaranta persone che devono improvvisamente di
   * più senza che nessuno gliel'abbia detto.
   */
  const [aggiornata] = await getDb()
    .update(tipiQuota)
    .set(modifiche)
    .where(eq(tipiQuota.id, Number(id)))
    .returning({ id: tipiQuota.id, nome: tipiQuota.nome });

  if (!aggiornata) throw new ErroreHttp(404, "Tariffa non trovata.");
  return aggiornata;
}

/**
 * Toglie una tariffa, ma solo se non la sta usando nessuno.
 *
 * Se qualcuno ce l'ha, si spegne invece di cancellarla: sparita, i conti
 * dell'anno scorso resterebbero con un importo senza più un perché.
 */
export async function eliminaTipoQuota(id) {
  const numero = Number(id);

  const [{ quanti }] = await getDb()
    .select({ quanti: sql`count(*)::int` })
    .from(schedeAtleta)
    .where(eq(schedeAtleta.tipoQuotaId, numero));

  if (quanti > 0) return { esito: "in_uso", quanti };

  const [tolta] = await getDb()
    .delete(tipiQuota)
    .where(eq(tipiQuota.id, numero))
    .returning({ id: tipiQuota.id, nome: tipiQuota.nome });

  if (!tolta) throw new ErroreHttp(404, "Tariffa non trovata.");
  return { esito: "eliminata", tariffa: tolta };
}

/** Una tariffa sola, per applicarla a una scheda. */
export async function trovaTipoQuota(id) {
  const [riga] = await getDb()
    .select({
      id: tipiQuota.id,
      nome: tipiQuota.nome,
      importoCentesimi: tipiQuota.importoCentesimi,
      attiva: tipiQuota.attiva
    })
    .from(tipiQuota)
    .where(eq(tipiQuota.id, Number(id)))
    .limit(1);

  return riga ?? null;
}
