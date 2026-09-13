/**
 * /api/admin/iscrizioni — chi si è registrato e aspetta una squadra.
 *
 *   GET   le richieste che questa persona può decidere
 *   POST  accoglie o respinge  { id, approvata, squadraId?, motivo? }
 *
 * Chi decide: la segreteria e gli amministratori su tutte, un allenatore
 * sugli sport che allena.
 *
 * Il filtro è per SPORT e non per squadra perché una richiesta appena
 * arrivata una squadra non ce l'ha: chi si registra sceglie il calcio, poi
 * è l'allenatore a dire "va negli Allievi".
 *
 * Accogliere significa assegnare una squadra: non esiste un sì senza
 * destinazione. Le due scritture — squadra sulla richiesta, account da
 * "in_attesa" ad "attivo" — stanno in una transazione, perché un account
 * attivo senza squadra sarebbe uno stato che nessuna schermata sa
 * raccontare.
 */

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { richiesteIscrizione, utenti, squadre } from "../../db/schema.js";
import {
  puo, puoDecidereSport, puoGestireSquadra, sportGestibili, squadreGestibili
} from "../../server/autorizzazioni.js";
import { richiedeAccesso } from "../../server/autenticazione.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../server/risposte.js";
import { leggiCorpo, parametri } from "../../server/richiesta.js";
import { schemaDecisione, valida } from "../../server/validazione.js";

async function elenco(req, res) {
  const sportAmmessi = await sportGestibili(req.utente);

  // Elenco vuoto = nessuno sport, quindi nessuna richiesta. Non "tutte".
  if (Array.isArray(sportAmmessi) && sportAmmessi.length === 0) {
    return json(res, { richieste: [], squadreProponibili: [] });
  }

  const soloInAttesa = parametri(req).stato !== "tutte";
  const condizioni = [];

  if (soloInAttesa) condizioni.push(eq(richiesteIscrizione.stato, "in_attesa"));
  if (Array.isArray(sportAmmessi)) {
    condizioni.push(inArray(richiesteIscrizione.sport, sportAmmessi));
  }

  const db = getDb();

  const righe = await db
    .select({
      id: richiesteIscrizione.id,
      sport: richiesteIscrizione.sport,
      stato: richiesteIscrizione.stato,
      note: richiesteIscrizione.note,
      richiestaIl: richiesteIscrizione.richiestaIl,
      decisaIl: richiesteIscrizione.decisaIl,
      motivoRifiuto: richiesteIscrizione.motivoRifiuto,
      utenteId: utenti.id,
      email: utenti.email,
      nome: utenti.nome,
      cognome: utenti.cognome,
      statoUtente: utenti.stato,
      ultimoAccesso: utenti.ultimoAccesso,
      squadraId: squadre.id,
      squadra: squadre.nome
    })
    .from(richiesteIscrizione)
    .innerJoin(utenti, eq(utenti.id, richiesteIscrizione.utenteId))
    // leftJoin: una richiesta ancora da decidere non ha squadra
    .leftJoin(squadre, eq(squadre.id, richiesteIscrizione.squadraId))
    .where(condizioni.length ? and(...condizioni) : undefined)
    // Le più vecchie in cima: chi aspetta da più tempo va servito prima
    .orderBy(
      asc(richiesteIscrizione.stato),
      asc(richiesteIscrizione.richiestaIl),
      desc(richiesteIscrizione.id)
    );

  // Le squadre fra cui scegliere davvero.
  //
  // Non tutte quelle dello sport: un allenatore può inserire qualcuno solo
  // nelle squadre che gestisce. Proporgliene altre vorrebbe dire offrirgli
  // scelte che il server rifiuterà.
  const suoi = await squadreGestibili(req.utente);
  const decideSuTutte = puo(req.utente, "iscrizioni.decidi_tutte");

  const condizioniSquadre = [eq(squadre.attiva, true)];

  if (!decideSuTutte) {
    if (!Array.isArray(suoi) || suoi.length === 0) {
      return json(res, { richieste: [], squadreProponibili: [] });
    }
    condizioniSquadre.push(inArray(squadre.id, suoi));
  }

  const squadreProponibili = await db
    .select({ id: squadre.id, nome: squadre.nome, sport: squadre.sport })
    .from(squadre)
    .where(and(...condizioniSquadre))
    .orderBy(asc(squadre.ordine));

  res.setHeader("Cache-Control", "no-store");

  return json(res, {
    richieste: righe.map((r) => ({
      ...r,
      nomeCompleto: [r.nome, r.cognome].filter(Boolean).join(" ") || r.email
    })),
    squadreProponibili: squadreProponibili.filter((s) => s.sport !== "Societa")
  });
}

async function decidi(req, res) {
  const dati = valida(schemaDecisione, await leggiCorpo(req));
  const db = getDb();

  const [richiesta] = await db
    .select({
      id: richiesteIscrizione.id,
      utenteId: richiesteIscrizione.utenteId,
      sport: richiesteIscrizione.sport,
      stato: richiesteIscrizione.stato
    })
    .from(richiesteIscrizione)
    .where(eq(richiesteIscrizione.id, dati.id))
    .limit(1);

  if (!richiesta) throw new ErroreHttp(404, "Richiesta non trovata.");

  if (!await puoDecidereSport(req.utente, richiesta.sport)) {
    throw new ErroreHttp(403, `Non decidi sulle richieste di ${richiesta.sport}.`);
  }

  if (richiesta.stato !== "in_attesa") {
    throw new ErroreHttp(409, "Su questa richiesta è già stato deciso.");
  }

  if (dati.approvata) {
    const [squadra] = await db
      .select({ id: squadre.id, sport: squadre.sport, attiva: squadre.attiva })
      .from(squadre)
      .where(eq(squadre.id, dati.squadraId))
      .limit(1);

    if (!squadra || !squadra.attiva) throw new ErroreHttp(400, "La squadra scelta non esiste.");

    // Un allenatore non deve poter parcheggiare qualcuno in una squadra
    // che non è sua, nemmeno se è dello sport giusto.
    //
    // La segreteria invece assegna ovunque pur non gestendo squadre: è il
    // suo mestiere. Per questo il controllo guarda prima la capacità di
    // decidere su tutte, e solo dopo le squadre affidate.
    const puoAssegnare = puo(req.utente, "iscrizioni.decidi_tutte")
      || await puoGestireSquadra(req.utente, squadra.id);

    if (!puoAssegnare) {
      throw new ErroreHttp(403, "Non gestisci la squadra scelta.");
    }

    // Chiedeva calcio e lo si mette nel volley: quasi certamente un errore
    // di chi clicca, e vale la pena fermarlo.
    if (squadra.sport !== richiesta.sport) {
      throw new ErroreHttp(
        400,
        `La richiesta è per ${richiesta.sport}, la squadra scelta è di ${squadra.sport}.`
      );
    }
  }

  const adesso = new Date();

  await db.transaction(async (tx) => {
    await tx.update(richiesteIscrizione).set({
      stato: dati.approvata ? "approvata" : "rifiutata",
      squadraId: dati.approvata ? dati.squadraId : null,
      decisaDa: req.utente.id,
      decisaIl: adesso,
      motivoRifiuto: dati.approvata ? null : (dati.motivo ?? null)
    }).where(eq(richiesteIscrizione.id, richiesta.id));

    if (dati.approvata) {
      await tx.update(utenti)
        .set({ stato: "attivo", aggiornatoIl: adesso })
        .where(eq(utenti.id, richiesta.utenteId));
    }
    // Su un rifiuto l'account resta "in_attesa" e non "sospeso": la persona
    // può essere ripresa in considerazione senza doverla riattivare a mano.
  });

  return json(res, { id: richiesta.id, approvata: dati.approvata });
}

export default conGestioneErrori(
  richiedeAccesso(async (req, res) => {
    if (req.method === "GET") return elenco(req, res);
    if (req.method === "POST") return decidi(req, res);

    res.setHeader("Allow", "GET, POST");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
