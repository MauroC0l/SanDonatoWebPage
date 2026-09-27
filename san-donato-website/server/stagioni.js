/**
 * Le stagioni: dal 1° luglio al 30 giugno, e i dati di un atleta per ciascuna.
 *
 * Le regole decise dalla società il 27 settembre 2026:
 *
 *   - la stagione cambia DA SOLA: quella in corso è quella che contiene la
 *     data di oggi, e la riga nasce la prima volta che serve;
 *   - i dati di un atleta restano per sempre legati alla stagione in cui ha
 *     giocato: quota, tariffa, versamenti, squadre, ritiro;
 *   - la quota è divisa in due metà, la seconda da gennaio: chi smette prima
 *     non la deve.
 *
 * Le funzioni pure stanno in cima e non toccano il database: sono le regole,
 * e si provano da sole (test/stagioni.test.js).
 */

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  stagioni, iscrizioniStagione, pagamenti, tipiQuota, richiesteIscrizione, squadre
} from "../db/schema.js";
import { ErroreHttp } from "./risposte.js";

/* =====================================================
   Regole, senza database
   ===================================================== */

const GIORNO_ROMA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit"
});

/** La data di oggi a Torino, "2026-09-27": la stagione cambia a mezzanotte di Torino. */
export function oggiRoma(adesso = new Date()) {
  return GIORNO_ROMA.format(adesso);
}

/**
 * La stagione di una data: l'anno in cui comincia, il nome, i due estremi.
 *
 * Luglio apre la stagione nuova: il 1° luglio 2026 è già 2026/27, il 30
 * giugno 2026 è ancora 2025/26.
 */
export function stagioneDi(dataIso) {
  const [anno, mese] = String(dataIso).split("-").map(Number);
  const a = mese >= 7 ? anno : anno - 1;
  return {
    nome: `${a}/${String((a + 1) % 100).padStart(2, "0")}`,
    inizio: `${a}-07-01`,
    fine: `${a + 1}-06-30`,
    // Da questo giorno è dovuta la seconda metà della quota
    inizioSecondaMeta: `${a + 1}-01-01`
  };
}

/**
 * Il conto di una stagione: quanto si deve, in due metà, e quanto manca.
 *
 * La prima metà è dovuta sempre; la seconda solo se la persona è ancora
 * iscritta a gennaio, cioè se non si è ritirata o si è ritirata dal 1°
 * gennaio in poi. È la DATA DEL RITIRO a decidere, non quella dei
 * versamenti (scelta da confermare con la società).
 *
 * Il centesimo dispari va alla prima metà: 125,01 € fanno 62,51 + 62,50.
 *
 * @param iscrizione  { quotaCentesimi, stato, ritiratoIl }
 * @param versato     i centesimi versati per QUELLA stagione
 * @param stagione    { inizioSecondaMeta } (vedi stagioneDi)
 */
export function contoStagione(iscrizione, versato, stagione) {
  const quota = iscrizione?.quotaCentesimi;
  if (quota == null) {
    return { quota: null, primaMeta: null, secondaMeta: null, secondaDovuta: null, dovuto: null, versato, residuo: null };
  }

  const primaMeta = Math.ceil(quota / 2);
  const secondaMeta = quota - primaMeta;

  const ritirata = iscrizione.stato === "ritirata" && iscrizione.ritiratoIl;
  const secondaDovuta = !ritirata || String(iscrizione.ritiratoIl) >= stagione.inizioSecondaMeta;

  const dovuto = primaMeta + (secondaDovuta ? secondaMeta : 0);

  return {
    quota,
    primaMeta,
    secondaMeta,
    secondaDovuta,
    dovuto,
    versato,
    // Negativo vuol dire credito: ha versato più del dovuto (un ritiro dopo il saldo)
    residuo: dovuto - versato
  };
}

/* =====================================================
   La stagione in corso
   ===================================================== */

/**
 * La riga della stagione che contiene una data, creata se non c'è.
 *
 * Nessuno "apre" la stagione: il 1° luglio la prima richiesta che ne ha
 * bisogno la trova già pronta, perché la crea lei. Due richieste insieme
 * non la creano due volte: il nome è unico.
 */
export async function stagionePer(dataIso = oggiRoma()) {
  const s = stagioneDi(dataIso);
  const db = getDb();

  await db.insert(stagioni)
    .values({ nome: s.nome, inizio: s.inizio, fine: s.fine })
    .onConflictDoNothing({ target: stagioni.nome });

  const [riga] = await db.select().from(stagioni).where(eq(stagioni.nome, s.nome)).limit(1);
  return { ...riga, inizioSecondaMeta: s.inizioSecondaMeta };
}

export const stagioneCorrente = () => stagionePer(oggiRoma());

/** Una stagione per identificativo, con le sue date di calcolo. */
async function stagioneDaId(id) {
  const [riga] = await getDb().select().from(stagioni).where(eq(stagioni.id, Number(id))).limit(1);
  return riga ? { ...riga, inizioSecondaMeta: stagioneDi(riga.inizio).inizioSecondaMeta } : null;
}

/* =====================================================
   Iscrizioni
   ===================================================== */

/**
 * L'iscrizione di una persona a una stagione, creata vuota se non c'è.
 *
 * Crearla vuota è innocuo: dice "questa persona c'era, quella stagione",
 * senza quota finché la segreteria non ne assegna una.
 */
export async function assicuraIscrizione(utenteId, stagione) {
  const db = getDb();
  await db.insert(iscrizioniStagione)
    .values({ utenteId: Number(utenteId), stagioneId: stagione.id })
    .onConflictDoNothing({ target: [iscrizioniStagione.utenteId, iscrizioniStagione.stagioneId] });

  const [riga] = await db.select().from(iscrizioniStagione).where(and(
    eq(iscrizioniStagione.utenteId, Number(utenteId)),
    eq(iscrizioniStagione.stagioneId, stagione.id)
  )).limit(1);
  return riga;
}

/** Scrive quota e tariffa della stagione in corso, creando l'iscrizione se serve. */
export async function salvaQuotaStagione(utenteId, { quotaCentesimi, tipoQuotaId }, autoreId, stagione = null) {
  const s = stagione ?? await stagioneCorrente();
  const iscrizione = await assicuraIscrizione(utenteId, s);

  const [salvata] = await getDb().update(iscrizioniStagione)
    .set({ quotaCentesimi, tipoQuotaId, aggiornataDa: autoreId ?? null, aggiornataIl: new Date() })
    .where(eq(iscrizioniStagione.id, iscrizione.id))
    .returning();
  return salvata;
}

/**
 * Quanto ha versato ciascuno, per una stagione.
 *
 * Solo i versamenti di quella stagione: il saldo dell'anno scorso non paga
 * la quota di quest'anno.
 */
async function versatoPer(ids, stagioneId) {
  if (!ids.length) return new Map();
  const righe = await getDb()
    .select({
      utenteId: pagamenti.utenteId,
      versato: sql`coalesce(sum(${pagamenti.importoCentesimi}), 0)::int`
    })
    .from(pagamenti)
    .where(and(inArray(pagamenti.utenteId, ids), eq(pagamenti.stagioneId, stagioneId)))
    .groupBy(pagamenti.utenteId);
  return new Map(righe.map((r) => [r.utenteId, r.versato]));
}

/**
 * Quota, versato e conto di più persone per una stagione (quella in corso
 * se non si dice altro), in due interrogazioni in tutto.
 *
 * @returns {Map<utenteId, { quotaCentesimi, tipoQuota, tipoQuotaId, versatoCentesimi,
 *          dovutoCentesimi, residuoCentesimi, stato, ritiratoIl, motivoRitiro, conto }>}
 */
export async function quotePerUtenti(ids, stagione = null) {
  const s = stagione ?? await stagioneCorrente();
  const risultato = new Map();
  if (!ids.length) return risultato;

  const [iscrizioni, versato] = await Promise.all([
    getDb()
      .select({
        utenteId: iscrizioniStagione.utenteId,
        quotaCentesimi: iscrizioniStagione.quotaCentesimi,
        tipoQuotaId: iscrizioniStagione.tipoQuotaId,
        tipoQuota: tipiQuota.nome,
        stato: iscrizioniStagione.stato,
        ritiratoIl: iscrizioniStagione.ritiratoIl,
        motivoRitiro: iscrizioniStagione.motivoRitiro
      })
      .from(iscrizioniStagione)
      .leftJoin(tipiQuota, eq(tipiQuota.id, iscrizioniStagione.tipoQuotaId))
      .where(and(inArray(iscrizioniStagione.utenteId, ids), eq(iscrizioniStagione.stagioneId, s.id))),
    versatoPer(ids, s.id)
  ]);

  const perUtente = new Map(iscrizioni.map((i) => [i.utenteId, i]));

  for (const id of ids) {
    const i = perUtente.get(id) ?? null;
    const v = versato.get(id) ?? 0;
    const conto = contoStagione(i, v, s);
    risultato.set(id, {
      quotaCentesimi: i?.quotaCentesimi ?? null,
      tipoQuotaId: i?.tipoQuotaId ?? null,
      tipoQuota: i?.tipoQuota ?? null,
      versatoCentesimi: v,
      dovutoCentesimi: conto.dovuto,
      residuoCentesimi: conto.residuo,
      stato: i?.stato ?? null,
      ritiratoIl: i?.ritiratoIl ?? null,
      motivoRitiro: i?.motivoRitiro ?? null,
      conto
    });
  }
  return risultato;
}

/** Quota e conto di una persona sola, per la stagione in corso. */
export async function quotaDi(utenteId) {
  const s = await stagioneCorrente();
  const q = (await quotePerUtenti([Number(utenteId)], s)).get(Number(utenteId));
  return { ...q, stagione: { id: s.id, nome: s.nome, inizio: s.inizio, fine: s.fine, inizioSecondaMeta: s.inizioSecondaMeta } };
}

/** I versamenti di una persona per una stagione, dal più recente. */
export async function versamentiDi(utenteId, stagioneId) {
  return getDb()
    .select({
      id: pagamenti.id,
      importoCentesimi: pagamenti.importoCentesimi,
      causale: pagamenti.causale,
      pagatoIl: pagamenti.pagatoIl,
      metodo: pagamenti.metodo,
      registratoDa: pagamenti.registratoDa,
      creatoIl: pagamenti.creatoIl
    })
    .from(pagamenti)
    .where(and(eq(pagamenti.utenteId, Number(utenteId)), eq(pagamenti.stagioneId, stagioneId)))
    .orderBy(desc(pagamenti.pagatoIl), desc(pagamenti.id));
}

/**
 * Le stagioni passate di una persona, dalla più recente: squadre, quota,
 * versato, ritiro. È la storia che non si riscrive.
 */
export async function storicoStagioni(utenteId, { conQuote = true } = {}) {
  const db = getDb();
  const corrente = await stagioneCorrente();

  const righe = await db
    .select({
      stagioneId: stagioni.id,
      nome: stagioni.nome,
      inizio: stagioni.inizio,
      quotaCentesimi: iscrizioniStagione.quotaCentesimi,
      tipoQuota: tipiQuota.nome,
      stato: iscrizioniStagione.stato,
      ritiratoIl: iscrizioniStagione.ritiratoIl,
      motivoRitiro: iscrizioniStagione.motivoRitiro,
      squadre: iscrizioniStagione.squadre
    })
    .from(iscrizioniStagione)
    .innerJoin(stagioni, eq(stagioni.id, iscrizioniStagione.stagioneId))
    .leftJoin(tipiQuota, eq(tipiQuota.id, iscrizioniStagione.tipoQuotaId))
    .where(eq(iscrizioniStagione.utenteId, Number(utenteId)))
    .orderBy(desc(stagioni.inizio));

  const passate = righe.filter((r) => r.stagioneId !== corrente.id);
  if (!passate.length) return [];

  const versati = conQuote ? await db
    .select({
      stagioneId: pagamenti.stagioneId,
      versato: sql`coalesce(sum(${pagamenti.importoCentesimi}), 0)::int`
    })
    .from(pagamenti)
    .where(eq(pagamenti.utenteId, Number(utenteId)))
    .groupBy(pagamenti.stagioneId) : [];
  const versatoPerStagione = new Map(versati.map((v) => [v.stagioneId, v.versato]));

  return passate.map((r) => {
    const base = {
      stagioneId: r.stagioneId,
      nome: r.nome,
      stato: r.stato,
      ritiratoIl: r.ritiratoIl,
      squadre: r.squadre ?? []
    };
    if (!conQuote) return base;
    const conto = contoStagione(r, versatoPerStagione.get(r.stagioneId) ?? 0, stagioneDi(r.inizio));
    return { ...base, motivoRitiro: r.motivoRitiro, tipoQuota: r.tipoQuota, conto };
  });
}

/* =====================================================
   Squadre della stagione
   ===================================================== */

/**
 * Copia sull'iscrizione della stagione in corso le squadre in cui la
 * persona gioca adesso.
 *
 * Si chiama ogni volta che l'appartenenza cambia (una richiesta accolta,
 * una squadra spostata). Finita la stagione nessuno la chiama più su
 * quella riga, che resta com'era: è la risposta a "dove giocava nel 2026".
 */
export async function aggiornaSquadreStagione(utenteId) {
  const db = getDb();
  const s = await stagioneCorrente();

  const sue = await db
    .select({ id: squadre.id, nome: squadre.nome, sport: squadre.sport })
    .from(richiesteIscrizione)
    .innerJoin(squadre, eq(squadre.id, richiesteIscrizione.squadraId))
    .where(and(eq(richiesteIscrizione.utenteId, Number(utenteId)), eq(richiesteIscrizione.stato, "approvata")))
    .orderBy(asc(squadre.ordine));

  const iscrizione = await assicuraIscrizione(utenteId, s);
  await db.update(iscrizioniStagione)
    .set({ squadre: sue, aggiornataIl: new Date() })
    .where(eq(iscrizioniStagione.id, iscrizione.id));
}

/* =====================================================
   Ritiro
   ===================================================== */

/**
 * Segna che una persona ha smesso durante la stagione in corso.
 *
 * Non cancella niente e non tocca l'account: la sua stagione resta, con la
 * quota e i versamenti, e la data del ritiro decide se la seconda metà
 * della quota è dovuta. Si annulla con annullaRitiro, per chi torna.
 */
export async function ritira(utenteId, { data, motivo }, autoreId) {
  const s = await stagioneCorrente();
  if (data < s.inizio || data > s.fine) {
    throw new ErroreHttp(400, `La data del ritiro deve cadere nella stagione ${s.nome} (dal 1 luglio al 30 giugno).`);
  }

  const iscrizione = await assicuraIscrizione(utenteId, s);
  const [salvata] = await getDb().update(iscrizioniStagione)
    .set({
      stato: "ritirata",
      ritiratoIl: data,
      motivoRitiro: motivo || null,
      ritiroRegistratoDa: autoreId ?? null,
      aggiornataIl: new Date()
    })
    .where(eq(iscrizioniStagione.id, iscrizione.id))
    .returning();
  return { iscrizione: salvata, stagione: s };
}

export async function annullaRitiro(utenteId) {
  const s = await stagioneCorrente();
  const [salvata] = await getDb().update(iscrizioniStagione)
    .set({ stato: "attiva", ritiratoIl: null, motivoRitiro: null, ritiroRegistratoDa: null, aggiornataIl: new Date() })
    .where(and(eq(iscrizioniStagione.utenteId, Number(utenteId)), eq(iscrizioniStagione.stagioneId, s.id)))
    .returning();
  if (!salvata) throw new ErroreHttp(404, "Nessuna iscrizione a questa stagione da riaprire.");
  return { iscrizione: salvata, stagione: s };
}

export { stagioneDaId };
