/**
 * Il cruscotto: cosa vede ciascuno entrando.
 *
 * Prima entrando si finiva dritti su un elenco — le notizie, gli eventi, le
 * richieste — e toccava scoprire da soli se c'era qualcosa da fare. Qui
 * invece la prima schermata risponde alla domanda vera, che è sempre la
 * stessa: "c'è qualcosa che aspetta me?".
 *
 * Quello che si costruisce dipende dalle CAPACITÀ, non dal nome del ruolo:
 * chi domani avrà "iscrizioni.decidi_proprie" vedrà il riquadro delle
 * richieste senza che nessuno tocchi questo file.
 *
 * Ogni voce esce già in italiano e già con il suo indirizzo: la schermata la
 * disegna e basta, senza rifare i conti né decidere dove mandare chi clicca.
 */

import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  notizie, eventi, squadre, utenti, richiesteIscrizione, schedeAtleta, pagamenti
} from "../db/schema.js";
import {
  puo, squadreGestibili, squadreConAtletiVisibili, sportGestibili
} from "./autorizzazioni.js";

/** Fra quanti giorni un certificato è "in scadenza". Stessa soglia del pannello. */
const GIORNI_PREAVVISO = 30;

/* =====================================================
   Pezzi, uno per domanda
   ===================================================== */

/** Le richieste che questa persona può decidere e che aspettano. */
async function richiesteDaDecidere(utente) {
  const sportSuoi = await sportGestibili(utente);
  if (Array.isArray(sportSuoi) && sportSuoi.length === 0) return 0;

  const condizioni = [eq(richiesteIscrizione.stato, "in_attesa")];
  if (Array.isArray(sportSuoi)) condizioni.push(inArray(richiesteIscrizione.sport, sportSuoi));

  const [{ quante }] = await getDb()
    .select({ quante: sql`count(*)::int` })
    .from(richiesteIscrizione)
    .where(and(...condizioni));

  return quante;
}

/** Certificati scaduti e in scadenza, fra gli atleti che questa persona vede. */
async function statoCertificati(utente) {
  const ammesse = await squadreConAtletiVisibili(utente);
  if (Array.isArray(ammesse) && ammesse.length === 0) {
    return { scaduti: 0, inScadenza: 0, senzaScheda: 0, daValidare: 0 };
  }

  const condizioni = [eq(richiesteIscrizione.stato, "approvata")];
  if (Array.isArray(ammesse)) condizioni.push(inArray(richiesteIscrizione.squadraId, ammesse));

  /* Un conteggio solo con tre casi dentro, invece di tre interrogazioni:
     sono la stessa scansione, e chiederla tre volte sarebbe sprecarla. */
  const [righe] = await getDb()
    .select({
      scaduti: sql`count(*) filter (
        where ${schedeAtleta.certificatoScadenza} is not null
          and ${schedeAtleta.certificatoScadenza} < current_date
      )::int`,
      /* Il cast su ::int non è decorativo: il parametro arriva senza tipo, e
         Postgres non sa quale "+" usare fra una data e un valore ignoto —
         rifiuta la query con "could not choose a best candidate operator". */
      inScadenza: sql`count(*) filter (
        where ${schedeAtleta.certificatoScadenza} >= current_date
          and ${schedeAtleta.certificatoScadenza} <= current_date + ${GIORNI_PREAVVISO}::int
      )::int`,
      senzaScheda: sql`count(*) filter (where ${schedeAtleta.certificatoScadenza} is null)::int`,

      /* Consegnati e mai guardati da nessuno.

         Serve il FILE, non la scadenza: si controlla un documento, e una
         data battuta a mano dall'atleta non è qualcosa che la segreteria
         possa approvare. Chi ha scritto la scadenza senza allegare niente
         rientra nel conto di chi il certificato non l'ha consegnato. */
      daValidare: sql`count(*) filter (
        where ${schedeAtleta.certificatoStato} = 'da_validare'
          and ${schedeAtleta.certificatoMediaId} is not null
      )::int`
    })
    .from(richiesteIscrizione)
    .leftJoin(schedeAtleta, eq(schedeAtleta.utenteId, richiesteIscrizione.utenteId))
    .where(and(...condizioni));

  return righe;
}

/** Quanto resta da incassare, in centesimi. */
async function quoteAperte(utente) {
  const ammesse = await squadreConAtletiVisibili(utente);
  if (Array.isArray(ammesse) && ammesse.length === 0) {
    return { daIncassare: 0, quanti: 0, senzaQuota: 0 };
  }

  const condizioni = [eq(richiesteIscrizione.stato, "approvata")];
  if (Array.isArray(ammesse)) condizioni.push(inArray(richiesteIscrizione.squadraId, ammesse));

  const db = getDb();

  /* Il versato si somma in una interrogazione a parte e si riporta qui con
     una sottoselezione: in join diretto, un atleta con tre versamenti
     comparirebbe tre volte e la sua quota sarebbe contata tre volte. */
  const versato = db
    .select({
      utenteId: pagamenti.utenteId,
      totale: sql`sum(${pagamenti.importoCentesimi})`.as("totale")
    })
    .from(pagamenti)
    .groupBy(pagamenti.utenteId)
    .as("versato");

  const righe = await db
    .select({
      manca: sql`${schedeAtleta.quotaStagionaleCentesimi} - coalesce(${versato.totale}, 0)`.as("manca")
    })
    .from(richiesteIscrizione)
    .innerJoin(schedeAtleta, eq(schedeAtleta.utenteId, richiesteIscrizione.utenteId))
    .leftJoin(versato, eq(versato.utenteId, richiesteIscrizione.utenteId))
    .where(and(...condizioni, sql`${schedeAtleta.quotaStagionaleCentesimi} is not null`));

  const aperte = righe.map((r) => Number(r.manca)).filter((n) => n > 0);

  /*
   * Gli atleti a cui la quota non è ancora stata decisa.
   *
   * Sono invisibili in ogni altro conto: non risultano fra chi deve dei
   * soldi, perché non si sa quanti, e non risultano fra chi è a posto,
   * perché non lo è. Restano fermi lì finché qualcuno non ci pensa — ed è
   * la segreteria che deve pensarci, quindi glielo si dice.
   *
   * "Senza scheda" vale come "senza quota": chi non ha ancora una riga in
   * tabella una quota non ce l'ha di sicuro. Da qui il left join.
   */
  const [{ senzaQuota }] = await db
    .select({ senzaQuota: sql`count(*)::int` })
    .from(richiesteIscrizione)
    .leftJoin(schedeAtleta, eq(schedeAtleta.utenteId, richiesteIscrizione.utenteId))
    .where(and(...condizioni, sql`${schedeAtleta.quotaStagionaleCentesimi} is null`));

  return {
    daIncassare: aperte.reduce((s, n) => s + n, 0),
    quanti: aperte.length,
    senzaQuota
  };
}

/** I prossimi appuntamenti, già visibili sul sito o no. */
async function prossimiEventi(utente, { quanti = 5 } = {}) {
  const ammesse = await squadreGestibili(utente);
  if (Array.isArray(ammesse) && ammesse.length === 0) return [];

  const condizioni = [gte(eventi.inizio, new Date())];
  if (Array.isArray(ammesse)) condizioni.push(inArray(eventi.squadraId, ammesse));

  return getDb()
    .select({
      id: eventi.id,
      titolo: eventi.titolo,
      inizio: eventi.inizio,
      tuttoIlGiorno: eventi.tuttoIlGiorno,
      luogo: eventi.luogo,
      tipo: eventi.tipo,
      visibileDal: eventi.visibileDal,
      squadra: squadre.nome,
      colore: squadre.colore
    })
    .from(eventi)
    .innerJoin(squadre, eq(squadre.id, eventi.squadraId))
    .where(and(...condizioni))
    .orderBy(asc(eventi.inizio))
    .limit(quanti);
}

/** Partite già giocate a cui manca il risultato. */
async function risultatiMancanti(utente) {
  const ammesse = await squadreGestibili(utente);
  if (Array.isArray(ammesse) && ammesse.length === 0) return 0;

  /*
   * "Da completare" vuol dire due cose diverse a seconda dello sport.
   *
   * Il risultato manca sempre a tutti. I parziali no: in una partita di
   * pallavolo o di basket il tabellino senza set o senza quarti è un
   * tabellino a metà, mentre nel calcio quasi nessuno li scrive. Chiederli
   * a tutti vorrebbe dire tenere ogni partita di calcio segnata come
   * incompleta per sempre, e un avviso che non si spegne mai è un avviso
   * che si smette di leggere.
   */
  const condizioni = [
    sql`${eventi.inizio} < now()`,
    sql`${eventi.inizio} > now() - interval '60 days'`,
    inArray(eventi.tipo, ["partita", "torneo"]),
    sql`(
      ${eventi.risultato} is null or ${eventi.risultato} = ''
      or (
        ${squadre.sport} in ('Pallavolo', 'Basket')
        and (${eventi.parziali} is null or ${eventi.parziali} = '')
      )
    )`
  ];
  if (Array.isArray(ammesse)) condizioni.push(inArray(eventi.squadraId, ammesse));

  const [{ quanti }] = await getDb()
    .select({ quanti: sql`count(*)::int` })
    .from(eventi)
    .innerJoin(squadre, eq(squadre.id, eventi.squadraId))
    .where(and(...condizioni));

  return quanti;
}

/** Lo stato delle notizie: bozze, in revisione, programmate. */
async function statoNotizie() {
  const [righe] = await getDb()
    .select({
      bozze: sql`count(*) filter (where ${notizie.stato} = 'bozza')::int`,
      inRevisione: sql`count(*) filter (where ${notizie.stato} = 'in_revisione')::int`,
      programmate: sql`count(*) filter (
        where ${notizie.stato} = 'pubblicata'
          and not (${notizie.pubblicataIl} is not null and ${notizie.pubblicataIl} <= now())
      )::int`,
      online: sql`count(*) filter (
        where ${notizie.stato} = 'pubblicata'
          and ${notizie.pubblicataIl} is not null and ${notizie.pubblicataIl} <= now()
      )::int`
    })
    .from(notizie);

  return righe;
}

/** Quanti atleti vede questa persona, in tutto. */
async function quantiAtleti(utente) {
  const ammesse = await squadreConAtletiVisibili(utente);
  if (Array.isArray(ammesse) && ammesse.length === 0) return 0;

  const condizioni = [eq(richiesteIscrizione.stato, "approvata")];
  if (Array.isArray(ammesse)) condizioni.push(inArray(richiesteIscrizione.squadraId, ammesse));

  /* distinct sull'utente e non count(*): chi gioca in due categorie ha due
     righe accolte, e senza distinct verrebbe contato due volte. */
  const [{ quanti }] = await getDb()
    .select({ quanti: sql`count(distinct ${richiesteIscrizione.utenteId})::int` })
    .from(richiesteIscrizione)
    .where(and(...condizioni));

  return quanti;
}

/** Quante squadre attive, e quante in pensione. */
async function quanteSquadre() {
  const [righe] = await getDb()
    .select({
      attive: sql`count(*) filter (where ${squadre.attiva})::int`,
      spente: sql`count(*) filter (where not ${squadre.attiva})::int`
    })
    .from(squadre);

  return righe;
}

/**
 * Gli account, divisi fra chi il sito lo usa e chi no.
 *
 * "Mai entrati" è il numero che conta davvero: sono le credenziali create e
 * consegnate a voce che non sono mai arrivate a destinazione.
 */
async function quantiAccount() {
  const [righe] = await getDb()
    .select({
      totali: sql`count(*)::int`,
      attivi: sql`count(*) filter (where ${utenti.stato} = 'attivo')::int`,
      sospesi: sql`count(*) filter (where ${utenti.stato} = 'sospeso')::int`,
      maiEntrati: sql`count(*) filter (where ${utenti.ultimoAccesso} is null)::int`
    })
    .from(utenti);

  return righe;
}

/* =====================================================
   La scheda dell'atleta che guarda le proprie cose
   ===================================================== */

async function cruscottoAtleta(utente) {
  const db = getDb();

  const [scheda] = await db
    .select({
      dataNascita: schedeAtleta.dataNascita,
      codiceFiscale: schedeAtleta.codiceFiscale,
      telefono: schedeAtleta.telefono,
      certificatoScadenza: schedeAtleta.certificatoScadenza,
      certificatoMediaId: schedeAtleta.certificatoMediaId,
      certificatoStato: schedeAtleta.certificatoStato,
      quota: schedeAtleta.quotaStagionaleCentesimi
    })
    .from(schedeAtleta)
    .where(eq(schedeAtleta.utenteId, utente.id))
    .limit(1);

  const [appartenenza] = await db
    .select({
      squadraId: squadre.id,
      squadra: squadre.nome,
      sport: squadre.sport,
      colore: squadre.colore,
      stato: richiesteIscrizione.stato,
      motivoRifiuto: richiesteIscrizione.motivoRifiuto,
      sportChiesto: richiesteIscrizione.sport
    })
    .from(richiesteIscrizione)
    .leftJoin(squadre, eq(squadre.id, richiesteIscrizione.squadraId))
    .where(eq(richiesteIscrizione.utenteId, utente.id))
    .orderBy(desc(richiesteIscrizione.richiestaIl))
    .limit(1);

  /* I prossimi appuntamenti della propria squadra: gli stessi che stanno sul
     sito, quindi con il filtro della visibilità. */
  let appuntamenti = [];
  if (appartenenza?.squadraId) {
    appuntamenti = await db
      .select({
        id: eventi.id,
        titolo: eventi.titolo,
        inizio: eventi.inizio,
        tuttoIlGiorno: eventi.tuttoIlGiorno,
        luogo: eventi.luogo,
        latitudine: eventi.latitudine,
        longitudine: eventi.longitudine,
        tipo: eventi.tipo
      })
      .from(eventi)
      .where(and(
        eq(eventi.squadraId, appartenenza.squadraId),
        gte(eventi.inizio, new Date()),
        sql`${eventi.visibileDal} is null or ${eventi.visibileDal} <= now()`
      ))
      .orderBy(asc(eventi.inizio))
      .limit(4);
  }

  /* Cosa manca all'iscrizione: lo stesso elenco che si vede nella pagina
     Iscrizione, ricalcolato qui perché la home lo dica per prima. */
  const manca = [];
  if (!scheda?.dataNascita) manca.push("la data di nascita");
  if (!scheda?.codiceFiscale) manca.push("il codice fiscale");
  if (!scheda?.telefono) manca.push("un numero di telefono");
  if (!scheda?.certificatoScadenza) manca.push("la scadenza del certificato medico");
  if (!scheda?.certificatoMediaId) manca.push("la copia del certificato medico");

  return {
    genere: "atleta",
    appartenenza: appartenenza ?? null,
    certificatoScadenza: scheda?.certificatoScadenza ?? null,
    certificatoCaricato: !!scheda?.certificatoMediaId,
    certificatoStato: scheda?.certificatoStato ?? null,
    manca,
    appuntamenti
  };
}

/* =====================================================
   Composizione
   ===================================================== */

export async function componiCruscotto(utente) {
  if (utente.ruolo === "atleta") return cruscottoAtleta(utente);

  const dati = { genere: "staff" };

  if (puo(utente, "iscrizioni.decidi_tutte") || puo(utente, "iscrizioni.decidi_proprie")) {
    dati.richieste = await richiesteDaDecidere(utente);
  }

  if (puo(utente, "atleti.leggi")) {
    dati.certificati = await statoCertificati(utente);
    dati.iscritti = await quantiAtleti(utente);
  }

  if (puo(utente, "quote.gestisci")) {
    dati.quote = await quoteAperte(utente);
  }

  if (puo(utente, "eventi.gestisci_tutte") || puo(utente, "eventi.gestisci_proprie")) {
    dati.prossimi = await prossimiEventi(utente);
    dati.risultatiMancanti = await risultatiMancanti(utente);
  }

  if (puo(utente, "notizie.leggi_bozze")) {
    dati.notizie = await statoNotizie();
  }

  if (puo(utente, "squadre.gestisci")) {
    dati.squadre = await quanteSquadre();
  }

  if (puo(utente, "utenti.gestisci")) {
    dati.account = await quantiAccount();
  }

  return dati;
}
