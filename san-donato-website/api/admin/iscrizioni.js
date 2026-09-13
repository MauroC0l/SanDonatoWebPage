/**
 * /api/admin/iscrizioni — le richieste di chi si è registrato.
 *
 *   GET   le richieste che questa persona può decidere
 *   POST  approva o rifiuta  { id, approvata, motivo? }
 *
 * Chi decide: la segreteria e gli amministratori su tutte, un allenatore
 * solo sulle squadre che gli sono state affidate.
 *
 * Confermare NON sblocca nulla: chi si registra è già attivo, perché gli
 * eventi delle squadre sono pubblici. La conferma dice "sì, questa persona
 * fa parte della mia squadra", e servirà a dare accesso ai dati personali e
 * ai certificati quando arriveranno.
 *
 * L'aggiornamento dello stato dell'account resta per il caso di un account
 * sospeso e poi riammesso, e sta in transazione con la richiesta: due
 * tabelle che si contraddicono sarebbero uno stato che nessuna schermata
 * sa raccontare.
 */

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { richiesteIscrizione, utenti, squadre } from "../../db/schema.js";
import { puo, puoDecidereIscrizione, squadreGestibili } from "../../server/autorizzazioni.js";
import { richiedeAccesso } from "../../server/autenticazione.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../server/risposte.js";
import { leggiCorpo, parametri } from "../../server/richiesta.js";
import { schemaDecisione, valida } from "../../server/validazione.js";

/** Le squadre sulle cui richieste questa persona può decidere, o null per tutte. */
async function squadreDecidibili(utente) {
  if (puo(utente, "iscrizioni.decidi_tutte")) return null;
  if (!puo(utente, "iscrizioni.decidi_proprie")) return [];
  return squadreGestibili(utente) ?? [];
}

async function elenco(req, res) {
  const ammesse = await squadreDecidibili(req.utente);
  if (Array.isArray(ammesse) && ammesse.length === 0) {
    return json(res, { richieste: [] });
  }

  const soloInAttesa = parametri(req).stato !== "tutte";
  const condizioni = [];

  if (soloInAttesa) condizioni.push(eq(richiesteIscrizione.stato, "in_attesa"));
  if (Array.isArray(ammesse)) condizioni.push(inArray(richiesteIscrizione.squadraId, ammesse));

  const righe = await getDb()
    .select({
      id: richiesteIscrizione.id,
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
      squadra: squadre.nome,
      sport: squadre.sport
    })
    .from(richiesteIscrizione)
    .innerJoin(utenti, eq(utenti.id, richiesteIscrizione.utenteId))
    .innerJoin(squadre, eq(squadre.id, richiesteIscrizione.squadraId))
    .where(condizioni.length ? and(...condizioni) : undefined)
    // Le più vecchie in cima: chi aspetta da più tempo va servito prima
    .orderBy(asc(richiesteIscrizione.stato), asc(richiesteIscrizione.richiestaIl), desc(richiesteIscrizione.id));

  res.setHeader("Cache-Control", "no-store");

  return json(res, {
    richieste: righe.map((r) => ({
      ...r,
      nomeCompleto: [r.nome, r.cognome].filter(Boolean).join(" ") || r.email
    }))
  });
}

async function decidi(req, res) {
  const dati = valida(schemaDecisione, await leggiCorpo(req));
  const db = getDb();

  const [richiesta] = await db
    .select({
      id: richiesteIscrizione.id,
      utenteId: richiesteIscrizione.utenteId,
      squadraId: richiesteIscrizione.squadraId,
      stato: richiesteIscrizione.stato
    })
    .from(richiesteIscrizione)
    .where(eq(richiesteIscrizione.id, dati.id))
    .limit(1);

  if (!richiesta) throw new ErroreHttp(404, "Richiesta non trovata.");

  if (!await puoDecidereIscrizione(req.utente, richiesta.squadraId)) {
    throw new ErroreHttp(403, "Non puoi decidere sulle iscrizioni di questa squadra.");
  }

  if (richiesta.stato !== "in_attesa") {
    throw new ErroreHttp(409, "Su questa richiesta è già stato deciso.");
  }

  const adesso = new Date();

  await db.transaction(async (tx) => {
    await tx.update(richiesteIscrizione).set({
      stato: dati.approvata ? "approvata" : "rifiutata",
      decisaDa: req.utente.id,
      decisaIl: adesso,
      motivoRifiuto: dati.approvata ? null : (dati.motivo ?? null)
    }).where(eq(richiesteIscrizione.id, richiesta.id));

    if (dati.approvata) {
      await tx.update(utenti)
        .set({ stato: "attivo", aggiornatoIl: adesso })
        .where(eq(utenti.id, richiesta.utenteId));
    }
    // Un rifiuto non tocca l'account: la persona resta registrata e
    // continua a vedere ciò che è pubblico. Vuol dire soltanto "non fa
    // parte di questa squadra".
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
