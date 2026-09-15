/**
 * Chi fa parte delle squadre, e cosa la società sa di loro.
 *
 * Chi è un atleta, qui dentro: una persona con una richiesta di iscrizione
 * ACCOLTA. Non serve una tabella "membri" a parte, perché accogliere una
 * richiesta è esattamente il gesto che mette qualcuno in squadra, ed è già
 * registrato. Una seconda tabella con le stesse informazioni sarebbe la
 * solita doppia verità.
 *
 * Il ruolo "atleta" dell'account NON è il criterio: un allenatore che gioca
 * anche in prima squadra ha ruolo coach ed è comunque un atleta per la
 * segreteria, che deve vedere la sua quota e il suo certificato.
 */

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "../db/client.js";
import {
  utenti, squadre, richiesteIscrizione, schedeAtleta, pagamenti, media, tipiQuota
} from "../db/schema.js";
import { urlFile } from "./file.js";

/*
 * La tabella media entra due volte nella stessa interrogazione — una per il
 * certificato medico, una per l'immagine del profilo — e Postgres ha
 * bisogno di due nomi diversi per distinguerle.
 */
const immagineProfilo = alias(media, "immagine_profilo");

/**
 * Se è minorenne, adesso.
 *
 * Non "meno di diciotto anni compiuti oggi" ma proprio quello: chi compie
 * diciotto anni domani è minorenne stasera, e stasera in palestra qualcuno
 * deve poter chiamare un adulto.
 */
export function minorenne(dataNascita) {
  if (!dataNascita) return false;

  const nato = new Date(`${dataNascita}T00:00:00`);
  if (isNaN(nato.getTime())) return false;

  const maggiorenneDal = new Date(nato);
  maggiorenneDal.setFullYear(maggiorenneDal.getFullYear() + 18);

  return Date.now() < maggiorenneDal.getTime();
}

/**
 * Cosa manca perché l'iscrizione si possa dire completa.
 *
 * Sta qui e non nella schermata dell'atleta perché la stessa frase la
 * legge la segreteria sulla scheda di quella persona: due conti separati
 * vorrebbero dire un atleta convinto di aver finito e una segreteria che
 * lo cerca al telefono per un campo che nessuno gli ha mai chiesto.
 */
export function cosaManca(scheda) {
  const mancanti = [];

  if (!scheda?.dataNascita) mancanti.push("la data di nascita");
  if (!scheda?.codiceFiscale) mancanti.push("il codice fiscale");
  if (!scheda?.telefono) mancanti.push("un numero di telefono");

  /*
   * Per i minori serve un adulto da chiamare.
   *
   * Non è burocrazia: se un ragazzo si fa male in allenamento, il numero
   * che serve è quello, e serve in quel momento. Nome e telefono insieme —
   * un nome senza numero non si chiama, un numero senza nome non si sa chi
   * risponde.
   */
  if (minorenne(scheda?.dataNascita)) {
    if (!scheda?.tutoreNome || !scheda?.tutoreTelefono) {
      mancanti.push("il contatto di un genitore");
    }
  }

  if (!scheda?.certificatoScadenza) mancanti.push("la scadenza del certificato medico");
  if (!scheda?.certificatoMediaId) mancanti.push("la copia del certificato medico");

  return mancanti;
}

/** Le colonne della scheda, uguali in elenco e in dettaglio. */
const COLONNE_SCHEDA = {
  schedaId: schedeAtleta.id,
  dataNascita: schedeAtleta.dataNascita,
  luogoNascita: schedeAtleta.luogoNascita,
  provinciaNascita: schedeAtleta.provinciaNascita,
  codiceFiscale: schedeAtleta.codiceFiscale,
  tagliaMaglietta: schedeAtleta.tagliaMaglietta,
  telefono: schedeAtleta.telefono,
  indirizzo: schedeAtleta.indirizzo,
  civico: schedeAtleta.civico,
  citta: schedeAtleta.citta,
  provincia: schedeAtleta.provincia,
  cap: schedeAtleta.cap,
  tutoreNome: schedeAtleta.tutoreNome,
  tutoreParentela: schedeAtleta.tutoreParentela,
  tutoreTelefono: schedeAtleta.tutoreTelefono,
  tutoreEmail: schedeAtleta.tutoreEmail,
  tutore2Nome: schedeAtleta.tutore2Nome,
  tutore2Parentela: schedeAtleta.tutore2Parentela,
  tutore2Telefono: schedeAtleta.tutore2Telefono,
  tutore2Email: schedeAtleta.tutore2Email,
  tipoCertificato: schedeAtleta.tipoCertificato,
  certificatoScadenza: schedeAtleta.certificatoScadenza,
  certificatoMediaId: schedeAtleta.certificatoMediaId,
  certificatoStato: schedeAtleta.certificatoStato,
  certificatoValidatoIl: schedeAtleta.certificatoValidatoIl,
  certificatoMotivo: schedeAtleta.certificatoMotivo,
  quotaStagionaleCentesimi: schedeAtleta.quotaStagionaleCentesimi,
  tipoQuotaId: schedeAtleta.tipoQuotaId,
  note: schedeAtleta.note
};

/**
 * Quanto ha versato ciascuno, in un'interrogazione sola.
 *
 * Separata e non in join con l'elenco: sommare dentro alla stessa query
 * significa raggruppare su tutte le colonne della scheda, e se qualcuno ha
 * due squadre la somma finirebbe contata due volte. Con qualche centinaio
 * di atleti, due interrogazioni costano meno di un errore nei conti.
 */
async function versatoPerUtente(db, utentiIds) {
  if (utentiIds.length === 0) return new Map();

  const righe = await db
    .select({
      utenteId: pagamenti.utenteId,
      versato: sql`coalesce(sum(${pagamenti.importoCentesimi}), 0)::int`
    })
    .from(pagamenti)
    .where(inArray(pagamenti.utenteId, utentiIds))
    .groupBy(pagamenti.utenteId);

  return new Map(righe.map((r) => [r.utenteId, r.versato]));
}

/**
 * L'elenco degli atleti visibili a chi chiede.
 *
 * `squadreAmmesse` null significa tutte (amministratori e segreteria); un
 * elenco limita alle squadre indicate (un allenatore vede i propri).
 */
export async function elencaAtleti({ squadreAmmesse = null, squadraId = null, conQuote = true } = {}) {
  const db = getDb();

  const condizioni = [eq(richiesteIscrizione.stato, "approvata")];

  if (Array.isArray(squadreAmmesse)) {
    // Nessuna squadra significa nessun atleta, non tutti
    if (squadreAmmesse.length === 0) return [];
    condizioni.push(inArray(richiesteIscrizione.squadraId, squadreAmmesse));
  }

  if (squadraId) condizioni.push(eq(richiesteIscrizione.squadraId, Number(squadraId)));

  const righe = await db
    .select({
      utenteId: utenti.id,
      email: utenti.email,
      nome: utenti.nome,
      cognome: utenti.cognome,
      ruolo: utenti.ruolo,
      stato: utenti.stato,
      ultimoAccesso: utenti.ultimoAccesso,
      squadraId: squadre.id,
      squadra: squadre.nome,
      sport: squadre.sport,
      squadraColore: squadre.colore,
      immagineChiave: immagineProfilo.chiave,
      immagineUrlWp: immagineProfilo.urlOriginaleWp,
      ...COLONNE_SCHEDA
    })
    .from(richiesteIscrizione)
    .innerJoin(utenti, eq(utenti.id, richiesteIscrizione.utenteId))
    .innerJoin(squadre, eq(squadre.id, richiesteIscrizione.squadraId))
    .leftJoin(immagineProfilo, eq(immagineProfilo.id, utenti.immagineId))
    // leftJoin: un atleta appena inserito non ha ancora una scheda, e deve
    // comparire lo stesso — anzi, è proprio quello da compilare.
    .leftJoin(schedeAtleta, eq(schedeAtleta.utenteId, utenti.id))
    .where(and(...condizioni))
    .orderBy(asc(utenti.cognome), asc(utenti.nome), asc(utenti.id));

  /* Una riga per squadra diventa un atleta con le sue squadre: chi gioca in
     due categorie non deve comparire due volte nell'elenco. */
  const perUtente = new Map();

  for (const r of righe) {
    let atleta = perUtente.get(r.utenteId);

    if (!atleta) {
      atleta = {
        utenteId: r.utenteId,
        email: r.email,
        nome: r.nome,
        cognome: r.cognome,
        nomeCompleto: [r.nome, r.cognome].filter(Boolean).join(" ") || r.email,
        ruolo: r.ruolo,
        stato: r.stato,
        ultimoAccesso: r.ultimoAccesso,
        immagineUrl: urlFile(r.immagineChiave, r.immagineUrlWp),
        squadre: [],
        haScheda: r.schedaId != null,
        dataNascita: r.dataNascita,
        telefono: r.telefono,
        tipoCertificato: r.tipoCertificato,
        certificatoScadenza: r.certificatoScadenza,
        certificatoCaricato: r.certificatoMediaId != null,
        certificatoStato: r.certificatoStato,

        /**
         * Quote e versamenti solo a chi li tiene.
         *
         * Un allenatore deve sapere se il suo giocatore può scendere in
         * campo — cioè se il certificato è valido — ma quanto ha pagato e
         * quanto deve ancora sono affari fra quella famiglia e la
         * segreteria. Il taglio è QUI e non nella schermata: nascondere una
         * colonna lasciando il dato nella risposta significa consegnarlo
         * lo stesso a chiunque apra gli strumenti del browser.
         */
        ...(conQuote
          ? { quotaStagionaleCentesimi: r.quotaStagionaleCentesimi, versatoCentesimi: 0 }
          : {})
      };
      perUtente.set(r.utenteId, atleta);
    }

    atleta.squadre.push({
      id: r.squadraId, nome: r.squadra, sport: r.sport, colore: r.squadraColore
    });
  }

  const atleti = [...perUtente.values()];

  if (conQuote) {
    const versato = await versatoPerUtente(db, atleti.map((a) => a.utenteId));
    for (const a of atleti) a.versatoCentesimi = versato.get(a.utenteId) ?? 0;
  }

  return atleti;
}

/** La scheda completa di una persona, versamenti inclusi. */
export async function trovaAtleta(utenteId, { squadreAmmesse = null, conQuote = true } = {}) {
  const db = getDb();
  const id = Number(utenteId);

  const [anagrafica] = await db
    .select({
      utenteId: utenti.id,
      email: utenti.email,
      nome: utenti.nome,
      cognome: utenti.cognome,
      ruolo: utenti.ruolo,
      stato: utenti.stato,
      ultimoAccesso: utenti.ultimoAccesso,
      creatoIl: utenti.creatoIl,
      ...COLONNE_SCHEDA,
      certificatoChiave: media.chiave,
      certificatoUrlWp: media.urlOriginaleWp,
      certificatoMime: media.mime,
      immagineChiave: immagineProfilo.chiave,
      immagineUrlWp: immagineProfilo.urlOriginaleWp,
      // Il nome della tariffa applicata: l'importo sta sulla scheda, ma
      // "perché quella cifra" è metà della risposta su un conto.
      tipoQuota: tipiQuota.nome
    })
    .from(utenti)
    .leftJoin(schedeAtleta, eq(schedeAtleta.utenteId, utenti.id))
    .leftJoin(media, eq(media.id, schedeAtleta.certificatoMediaId))
    .leftJoin(immagineProfilo, eq(immagineProfilo.id, utenti.immagineId))
    .leftJoin(tipiQuota, eq(tipiQuota.id, schedeAtleta.tipoQuotaId))
    .where(eq(utenti.id, id))
    .limit(1);

  if (!anagrafica) return null;

  const squadreSue = await db
    .select({
      id: squadre.id,
      nome: squadre.nome,
      sport: squadre.sport,
      colore: squadre.colore,
      dal: richiesteIscrizione.decisaIl
    })
    .from(richiesteIscrizione)
    .innerJoin(squadre, eq(squadre.id, richiesteIscrizione.squadraId))
    .where(and(
      eq(richiesteIscrizione.utenteId, id),
      eq(richiesteIscrizione.stato, "approvata")
    ));

  /**
   * Un allenatore apre solo le schede dei propri atleti.
   *
   * Il controllo sta qui e non sul front-end, perché l'indirizzo della
   * scheda si può scrivere a mano: senza, basterebbe cambiare il numero
   * nella barra per leggere il certificato medico di chiunque.
   */
  if (Array.isArray(squadreAmmesse)) {
    const suo = squadreSue.some((s) => squadreAmmesse.includes(s.id));
    if (!suo) return null;
  }

  // Vedi la nota in elencaAtleti: senza "quote.gestisci" i versamenti non
  // partono proprio, non vengono nascosti a schermo.
  const versamenti = conQuote ? await db
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
    .where(eq(pagamenti.utenteId, id))
    // I più recenti in cima: è l'ultimo versamento quello che si cerca
    .orderBy(sql`${pagamenti.pagatoIl} desc`, sql`${pagamenti.id} desc`) : [];

  const versatoCentesimi = versamenti.reduce((somma, v) => somma + v.importoCentesimi, 0);

  /* La data di iscrizione e quella del PRIMO versamento: iscritti alla
     societa lo si e da quando si e pagato. I versamenti arrivano dal piu
     recente, quindi il primo e in fondo. */
  const iscrittoDal = versamenti.length ? versamenti[versamenti.length - 1].pagatoIl : null;

  return {
    utenteId: anagrafica.utenteId,
    email: anagrafica.email,
    nome: anagrafica.nome,
    cognome: anagrafica.cognome,
    nomeCompleto: [anagrafica.nome, anagrafica.cognome].filter(Boolean).join(" ") || anagrafica.email,
    ruolo: anagrafica.ruolo,
    stato: anagrafica.stato,
    ultimoAccesso: anagrafica.ultimoAccesso,
    creatoIl: anagrafica.creatoIl,
    immagineUrl: urlFile(anagrafica.immagineChiave, anagrafica.immagineUrlWp),

    haScheda: anagrafica.schedaId != null,

    /* Cosa manca, calcolato una volta sola dal server: la segreteria lo
       vede sulla scheda, l'atleta nella sua area, ed è lo stesso elenco. */
    manca: cosaManca(anagrafica),
    minorenne: minorenne(anagrafica.dataNascita),

    dataNascita: anagrafica.dataNascita,
    luogoNascita: anagrafica.luogoNascita,
    provinciaNascita: anagrafica.provinciaNascita,
    codiceFiscale: anagrafica.codiceFiscale,
    tagliaMaglietta: anagrafica.tagliaMaglietta,
    telefono: anagrafica.telefono,
    indirizzo: anagrafica.indirizzo,
    civico: anagrafica.civico,
    citta: anagrafica.citta,
    provincia: anagrafica.provincia,
    cap: anagrafica.cap,
    tutoreNome: anagrafica.tutoreNome,
    tutoreParentela: anagrafica.tutoreParentela,
    tutoreTelefono: anagrafica.tutoreTelefono,
    tutoreEmail: anagrafica.tutoreEmail,
    tutore2Nome: anagrafica.tutore2Nome,
    tutore2Parentela: anagrafica.tutore2Parentela,
    tutore2Telefono: anagrafica.tutore2Telefono,
    tutore2Email: anagrafica.tutore2Email,
    note: anagrafica.note,

    tipoCertificato: anagrafica.tipoCertificato,
    certificatoScadenza: anagrafica.certificatoScadenza,
    certificatoStato: anagrafica.certificatoStato,
    certificatoValidatoIl: anagrafica.certificatoValidatoIl,
    certificatoMotivo: anagrafica.certificatoMotivo,
    certificatoMediaId: anagrafica.certificatoMediaId ?? null,
    certificatoUrl: anagrafica.certificatoMediaId
      ? urlFile(anagrafica.certificatoChiave, anagrafica.certificatoUrlWp)
      : null,
    certificatoMime: anagrafica.certificatoMime ?? null,

    ...(conQuote ? {
      quotaStagionaleCentesimi: anagrafica.quotaStagionaleCentesimi,
      tipoQuotaId: anagrafica.tipoQuotaId ?? null,
      tipoQuota: anagrafica.tipoQuota ?? null,
      versatoCentesimi,
      pagamenti: versamenti,
      iscrittoDal
    } : {}),

    squadre: squadreSue
  };
}

/**
 * Scrive la scheda, creandola se non c'era.
 *
 * Una sola istruzione con "on conflict do update" invece di leggere e poi
 * decidere: fra la lettura e la scrittura, due persone che salvano la stessa
 * scheda nello stesso momento creerebbero due righe, e l'indice unico
 * farebbe fallire la seconda con un errore che nessuno saprebbe spiegare.
 */
/* I campi che, cambiando, rimettono in discussione il certificato. */
const CAMPI_CERTIFICATO = ["tipoCertificato", "certificatoScadenza", "certificatoMediaId"];

export async function salvaScheda(utenteId, campi, autoreId) {
  const db = getDb();
  const adesso = new Date();

  /*
   * Toccare il certificato lo riporta "da validare".
   *
   * Senza, basterebbe far approvare un foglio buono e poi sostituirlo con
   * un altro: il sito continuerebbe a dire "valido" mostrando un file che
   * nessuno ha guardato. Chi ha il permesso di validare lo fa dal proprio
   * comando apposta, non salvando la scheda.
   */
  const tocca = CAMPI_CERTIFICATO.some((c) => campi[c] !== undefined);

  const daScrivere = tocca
    ? {
      ...campi,
      certificatoStato: "da_validare",
      certificatoValidatoDa: null,
      certificatoValidatoIl: null,
      certificatoMotivo: null
    }
    : campi;

  const [salvata] = await db
    .insert(schedeAtleta)
    .values({ utenteId: Number(utenteId), ...daScrivere, aggiornataDa: autoreId, aggiornataIl: adesso })
    .onConflictDoUpdate({
      target: schedeAtleta.utenteId,
      set: { ...daScrivere, aggiornataDa: autoreId, aggiornataIl: adesso }
    })
    .returning({ id: schedeAtleta.id });

  return salvata;
}

/**
 * Approva o respinge il certificato di un atleta.
 *
 * Lo fa chi ha "certificato.registra": segreteria e amministratori. Un
 * rifiuto senza motivo obbligherebbe la famiglia a telefonare per sapere
 * cosa c'era di sbagliato, quindi il motivo è obbligatorio.
 */
export async function validaCertificato(utenteId, { approva, motivo }, autoreId) {
  const [salvata] = await getDb()
    .update(schedeAtleta)
    .set({
      certificatoStato: approva ? "valido" : "rifiutato",
      certificatoValidatoDa: autoreId,
      certificatoValidatoIl: new Date(),
      certificatoMotivo: approva ? null : (motivo ?? null)
    })
    .where(eq(schedeAtleta.utenteId, Number(utenteId)))
    .returning({ id: schedeAtleta.id, stato: schedeAtleta.certificatoStato });

  return salvata ?? null;
}
