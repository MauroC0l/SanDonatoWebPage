/**
 * /api/admin/eventi/:id
 *
 *   GET     un evento, con le foto e i video collegati
 *   PATCH   modifica
 *   DELETE  elimina
 *
 * Qui la cancellazione è definitiva, a differenza delle notizie: un evento
 * sbagliato nel calendario va tolto, non archiviato. I file collegati
 * restano nell'archivio, perché possono essere usati altrove.
 *
 * Ogni operazione verifica che la persona gestisca la squadra dell'evento,
 * e — se l'evento viene spostato di squadra — anche quella di destinazione:
 * altrimenti un coach potrebbe regalare una propria partita a un'altra
 * squadra, o sottrarne una.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../../../db/client.js";
import { eventi, mediaEvento } from "../../../db/schema.js";
import { trovaEvento } from "../../../server/eventi.js";
import { puoGestireSquadra } from "../../../server/autorizzazioni.js";
import { richiedeAccesso } from "../../../server/autenticazione.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../server/risposte.js";
import { leggiCorpo, parametri } from "../../../server/richiesta.js";
import { schemaEventoModifica, valida } from "../../../server/validazione.js";

function idRichiesto(req) {
  const id = Number(parametri(req).id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroreHttp(400, "Identificativo non valido.");
  return id;
}

/** Carica l'evento e verifica che la persona possa toccarlo. */
async function eventoGestibile(req) {
  const id = idRichiesto(req);

  const [riga] = await getDb()
    .select({ id: eventi.id, squadraId: eventi.squadraId })
    .from(eventi)
    .where(eq(eventi.id, id))
    .limit(1);

  if (!riga) throw new ErroreHttp(404, "Evento non trovato.");

  if (!await puoGestireSquadra(req.utente, riga.squadraId)) {
    throw new ErroreHttp(403, "Non gestisci la squadra di questo evento.");
  }
  return riga;
}

async function leggi(req, res) {
  await eventoGestibile(req);

  const evento = await trovaEvento(idRichiesto(req));
  res.setHeader("Cache-Control", "no-store");
  return json(res, { evento });
}

async function modifica(req, res) {
  await eventoGestibile(req);
  const dati = valida(schemaEventoModifica, await leggiCorpo(req));

  // Spostare un evento su un'altra squadra richiede il permesso anche su
  // quella: senza questo controllo si potrebbe scrivere nel calendario
  // di chiunque passando dal proprio.
  if (dati.squadraId !== undefined && !await puoGestireSquadra(req.utente, dati.squadraId)) {
    throw new ErroreHttp(403, "Non gestisci la squadra di destinazione.");
  }

  const modifiche = { aggiornatoIl: new Date() };
  for (const campo of [
    "squadraId", "tipo", "sport", "titolo", "avversario", "inizio", "fine",
    "tuttoIlGiorno", "luogo", "descrizione", "risultato", "parziali",
    "marcatori", "diretta"
  ]) {
    if (dati[campo] !== undefined) modifiche[campo] = dati[campo];
  }

  const [aggiornato] = await getDb()
    .update(eventi)
    .set(modifiche)
    .where(eq(eventi.id, idRichiesto(req)))
    .returning({ id: eventi.id, titolo: eventi.titolo, inizio: eventi.inizio });

  return json(res, { evento: aggiornato });
}

async function elimina(req, res) {
  await eventoGestibile(req);
  const id = idRichiesto(req);

  const db = getDb();
  // I collegamenti ai file si tolgono per primi; i file restano in archivio
  await db.delete(mediaEvento).where(eq(mediaEvento.eventoId, id));
  await db.delete(eventi).where(eq(eventi.id, id));

  return json(res, { eliminato: id });
}

export default conGestioneErrori(
  richiedeAccesso(async (req, res) => {
    if (req.method === "GET") return leggi(req, res);
    if (req.method === "PATCH" || req.method === "PUT") return modifica(req, res);
    if (req.method === "DELETE") return elimina(req, res);

    res.setHeader("Allow", "GET, PATCH, PUT, DELETE");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
