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

import { and, asc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { tipiQuota, iscrizioniStagione, legamiFamiliari, utenti, stagioni } from "../db/schema.js";
import { ErroreHttp } from "./risposte.js";
import { quotaDi, salvaQuotaStagione, stagioneCorrente, stagioneDi, assicuraIscrizione } from "./stagioni.js";

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
      automatica: tipiQuota.automatica,
      // In tutte le stagioni: una tariffa usata l'anno scorso è ancora nei conti di allora
      quanti: sql`count(${iscrizioniStagione.id})::int`
    })
    .from(tipiQuota)
    .leftJoin(iscrizioniStagione, eq(iscrizioniStagione.tipoQuotaId, tipiQuota.id))
    .where(condizioni.length ? and(...condizioni) : undefined)
    .groupBy(
      tipiQuota.id, tipiQuota.nome, tipiQuota.descrizione,
      tipiQuota.importoCentesimi, tipiQuota.attiva, tipiQuota.ordine,
      tipiQuota.perAllenatori, tipiQuota.automatica
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

  const tariffa = await trovaTipoQuota(numero);
  if (tariffa?.automatica) {
    throw new ErroreHttp(
      409,
      `"${tariffa.nome}" è una delle tariffe che il sito assegna da solo: si rinomina, se ne cambia l'importo o la si spegne, ma non si cancella.`
    );
  }

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
      attiva: tipiQuota.attiva,
      automatica: tipiQuota.automatica
    })
    .from(tipiQuota)
    .where(eq(tipiQuota.id, Number(id)))
    .limit(1);

  return riga ?? null;
}

/* =====================================================
   Quote assegnate da sole
   ===================================================== */

/** Le tariffe automatiche ACCESE, per tipo: { prima_iscrizione, rinnovo, famiglia }. */
export async function tariffeAutomatiche() {
  const righe = await getDb()
    .select({
      id: tipiQuota.id,
      nome: tipiQuota.nome,
      importoCentesimi: tipiQuota.importoCentesimi,
      automatica: tipiQuota.automatica
    })
    .from(tipiQuota)
    .where(and(eq(tipiQuota.attiva, true), sql`${tipiQuota.automatica} is not null`));
  return Object.fromEntries(righe.map((r) => [r.automatica, r]));
}

/**
 * Quale tariffa automatica spetta a ciascuno, in una stagione.
 *
 *   famiglia          un fratello o una sorella confermati dalla segreteria
 *                     per QUELLA stagione
 *   rinnovo           era iscritto la stagione prima (anche se poi si è
 *                     ritirato: c'era)
 *   prima_iscrizione  tutti gli altri
 */
async function spettanze(ids, stagione) {
  const db = getDb();
  const precedente = stagioneDi(`${Number(stagione.inizio.slice(0, 4)) - 1}-09-01`).nome;

  const [c_erano, famiglie] = await Promise.all([
    db.select({ utenteId: iscrizioniStagione.utenteId })
      .from(iscrizioniStagione)
      .innerJoin(stagioni, eq(stagioni.id, iscrizioniStagione.stagioneId))
      .where(and(inArray(iscrizioniStagione.utenteId, ids), eq(stagioni.nome, precedente))),
    db.select({ utenteId: legamiFamiliari.utenteId })
      .from(legamiFamiliari)
      .where(and(
        inArray(legamiFamiliari.utenteId, ids),
        eq(legamiFamiliari.stagioneId, stagione.id),
        eq(legamiFamiliari.stato, "confermato")
      ))
  ]);

  const rinnovano = new Set(c_erano.map((r) => r.utenteId));
  const conFamiglia = new Set(famiglie.map((r) => r.utenteId));

  return new Map(ids.map((id) => [
    id,
    conFamiglia.has(id) ? "famiglia" : rinnovano.has(id) ? "rinnovo" : "prima_iscrizione"
  ]));
}

/**
 * Assegna la tariffa automatica a chi nella stagione in corso non ha ancora
 * una quota. Deciso dalla società il 28 settembre 2026: "Prima iscrizione" o
 * "Rinnovo" non li sceglie più nessuno, li sa il sito.
 *
 * NON sovrascrive una quota già scritta: se la segreteria ha messo a mano
 * "Minivolley" o uno zero, quella resta. E non tocca gli allenatori, che
 * hanno la loro (assicuraQuotaAllenatore).
 *
 * Una tariffa spenta non si assegna: le automatiche nascono spente e a zero
 * finché qualcuno non ne decide l'importo, e un'assegnazione a zero euro
 * sembrerebbe una quota saldata.
 *
 * @returns il numero di quote assegnate
 */
export async function assegnaQuoteAutomatiche(utentiIds) {
  const ids = [...new Set(utentiIds.map(Number))];
  if (!ids.length) return 0;

  const tariffe = await tariffeAutomatiche();
  if (!Object.keys(tariffe).length) return 0;

  const db = getDb();
  const stagione = await stagioneCorrente();

  const [allenatori, gia] = await Promise.all([
    db.select({ id: utenti.id }).from(utenti)
      .where(and(inArray(utenti.id, ids), eq(utenti.ruolo, "coach"))),
    db.select({ utenteId: iscrizioniStagione.utenteId }).from(iscrizioniStagione)
      .where(and(
        inArray(iscrizioniStagione.utenteId, ids),
        eq(iscrizioniStagione.stagioneId, stagione.id),
        sql`${iscrizioniStagione.quotaCentesimi} is not null`
      ))
  ]);
  const esclusi = new Set([...allenatori.map((r) => r.id), ...gia.map((r) => r.utenteId)]);

  const daFare = ids.filter((id) => !esclusi.has(id));
  if (!daFare.length) return 0;

  const spetta = await spettanze(daFare, stagione);
  let assegnate = 0;

  for (const id of daFare) {
    const tariffa = tariffe[spetta.get(id)];
    if (!tariffa) continue;
    await assicuraIscrizione(id, stagione);
    // Solo se è ancora vuota: due richieste insieme non assegnano due volte
    const fatte = await db.update(iscrizioniStagione)
      .set({ quotaCentesimi: tariffa.importoCentesimi, tipoQuotaId: tariffa.id, aggiornataIl: new Date() })
      .where(and(
        eq(iscrizioniStagione.utenteId, id),
        eq(iscrizioniStagione.stagioneId, stagione.id),
        isNull(iscrizioniStagione.quotaCentesimi)
      ))
      .returning({ id: iscrizioniStagione.id });
    assegnate += fatte.length;
  }
  return assegnate;
}

/**
 * Una parentela confermata dalla segreteria: la tariffa famiglia a chi
 * l'ha dichiarata, per la stagione della dichiarazione se è quella in corso.
 *
 * Sostituisce solo una quota vuota o una delle automatiche (prima
 * iscrizione, rinnovo): una tariffa scelta a mano dalla segreteria resta.
 *
 * @returns la tariffa applicata, o null se non è stato toccato niente
 */
export async function applicaTariffaFamiglia(utenteId, stagioneId, autoreId) {
  const stagione = await stagioneCorrente();
  if (stagioneId !== stagione.id) return null;

  const { famiglia } = await tariffeAutomatiche();
  if (!famiglia) return null;

  const db = getDb();
  await assicuraIscrizione(utenteId, stagione);

  const automatiche = db.select({ id: tipiQuota.id }).from(tipiQuota)
    .where(inArray(tipiQuota.automatica, ["prima_iscrizione", "rinnovo"]));

  const fatte = await db.update(iscrizioniStagione)
    .set({
      quotaCentesimi: famiglia.importoCentesimi,
      tipoQuotaId: famiglia.id,
      aggiornataDa: autoreId ?? null,
      aggiornataIl: new Date()
    })
    .where(and(
      eq(iscrizioniStagione.utenteId, Number(utenteId)),
      eq(iscrizioniStagione.stagioneId, stagione.id),
      or(isNull(iscrizioniStagione.quotaCentesimi), inArray(iscrizioniStagione.tipoQuotaId, automatiche))
    ))
    .returning({ id: iscrizioniStagione.id });

  return fatte.length ? famiglia : null;
}
