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

import { and, asc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { tipiQuota, iscrizioniStagione } from "../db/schema.js";
import { ErroreHttp } from "./risposte.js";
import { quotaDi, salvaQuotaStagione } from "./stagioni.js";

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
      perAllenatori: tipiQuota.perAllenatori,
      // In tutte le stagioni: una tariffa usata l'anno scorso è ancora nei conti di allora
      quanti: sql`count(${iscrizioniStagione.id})::int`
    })
    .from(tipiQuota)
    .leftJoin(iscrizioniStagione, eq(iscrizioniStagione.tipoQuotaId, tipiQuota.id))
    .where(condizioni.length ? and(...condizioni) : undefined)
    .groupBy(
      tipiQuota.id, tipiQuota.nome, tipiQuota.descrizione,
      tipiQuota.importoCentesimi, tipiQuota.attiva, tipiQuota.ordine,
      tipiQuota.perAllenatori
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
      perAllenatori: dati.perAllenatori ?? false,
      creataDa: autoreId
    })
    .returning({ id: tipiQuota.id, nome: tipiQuota.nome });

  if (dati.perAllenatori) await restaLaSolaPerAllenatori(creata.id);

  return creata;
}

export async function aggiornaTipoQuota(id, dati) {
  const modifiche = {};

  if (dati.nome !== undefined) modifiche.nome = dati.nome;
  if (dati.descrizione !== undefined) modifiche.descrizione = dati.descrizione || null;
  if (dati.importoCentesimi !== undefined) modifiche.importoCentesimi = dati.importoCentesimi;
  if (dati.attiva !== undefined) modifiche.attiva = dati.attiva;
  if (dati.ordine !== undefined) modifiche.ordine = dati.ordine;
  if (dati.perAllenatori !== undefined) modifiche.perAllenatori = dati.perAllenatori;

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

  if (modifiche.perAllenatori === true) await restaLaSolaPerAllenatori(aggiornata.id);

  return aggiornata;
}

/**
 * Spegne il contrassegno "allenatori" su tutte le altre tariffe.
 *
 * Due tariffe degli allenatori vorrebbero dire due importi diversi assegnati
 * a caso a seconda di quale il database restituisce per prima. Invece di
 * rifiutare la seconda con un errore — che obbligherebbe a ricordarsi quale
 * fosse la prima e a spegnerla a mano — l'ultima parola è dell'ultima
 * scelta: si contrassegna quella nuova e la vecchia si spegne da sé.
 *
 * Le quote già assegnate non si toccano: chi ha versato i suoi 10 € li ha
 * versati, e cambiare il listino non riscrive il passato.
 */
async function restaLaSolaPerAllenatori(idTenuta) {
  await getDb()
    .update(tipiQuota)
    .set({ perAllenatori: false })
    .where(and(eq(tipiQuota.perAllenatori, true), ne(tipiQuota.id, Number(idTenuta))));
}

/**
 * La tariffa degli allenatori, o null se nessuno l'ha ancora decisa.
 *
 * Null e non un importo di ripiego: 10 € scritti nel codice sarebbero una
 * cifra che nessun consiglio ha deliberato, e il giorno che cambia
 * resterebbe lì. Senza tariffa, all'allenatore non viene chiesto niente —
 * che è la cosa giusta da fare quando non si sa quanto chiedere.
 */
export async function tariffaAllenatori() {
  const [riga] = await getDb()
    .select({
      id: tipiQuota.id,
      nome: tipiQuota.nome,
      importoCentesimi: tipiQuota.importoCentesimi
    })
    .from(tipiQuota)
    .where(and(eq(tipiQuota.perAllenatori, true), eq(tipiQuota.attiva, true)))
    .orderBy(asc(tipiQuota.ordine), asc(tipiQuota.id))
    .limit(1);

  return riga ?? null;
}

/**
 * Assegna a un allenatore la quota degli allenatori, se non ne ha già una.
 *
 * Si chiama quando l'allenatore apre la propria iscrizione, e non al momento
 * in cui l'account viene creato: gli allenatori ci sono già tutti, e una
 * assegnazione fatta solo ai nuovi lascerebbe fuori proprio quelli che
 * allenano da anni. Il prezzo di questa scelta va detto: finché un
 * allenatore non entra nel sito almeno una volta, la società non sa che
 * deve 10 € — e quando ci sarà il pagamento online quel conto dovrà
 * comparire anche a chi tiene la cassa.
 *
 * Il ruolo e non una capacità, come per eAmministratore(): qui la domanda
 * non è cosa gli è permesso fare, è chi deve pagare quella cifra.
 *
 * NON sovrascrive mai una quota già scritta. Se la segreteria ha messo
 * zero — un allenatore esentato — quello zero resta: assegnare è una cosa
 * sola, che avviene una volta.
 */
export async function assicuraQuotaAllenatore(utente) {
  if (utente?.ruolo !== "coach") return null;

  /* Sulla stagione in corso: il 1° luglio la stagione nuova non ha ancora
     la quota, e alla prima apertura gliela si assegna di nuovo. Quella
     dell'anno prima resta dov'era. */
  const attuale = await quotaDi(utente.id);
  if (attuale.quotaCentesimi != null) return null;

  const tariffa = await tariffaAllenatori();
  if (!tariffa) return null;

  await salvaQuotaStagione(
    utente.id,
    { quotaCentesimi: tariffa.importoCentesimi, tipoQuotaId: tariffa.id },
    null
  );

  return tariffa;
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
    .from(iscrizioniStagione)
    .where(eq(iscrizioniStagione.tipoQuotaId, numero));

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
