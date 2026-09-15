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
import { trovaEvento, soloPartite, TIPI_PARTITA } from "../../../server/eventi.js";
import { puoGestireSquadra } from "../../../server/autorizzazioni.js";
import { richiedeAccesso } from "../../../server/autenticazione.js";
import { annota } from "../../../server/registro.js";
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
    // Titolo e data servono al registro, che deve poter raccontare cos'era
    // anche quando l'evento è stato cancellato.
    .select({
      id: eventi.id, squadraId: eventi.squadraId,
      titolo: eventi.titolo, inizio: eventi.inizio
    })
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

  /*
   * Un allenatore tocca solo partite, e non le programma.
   *
   * Vale anche in modifica: senza, basterebbe creare una partita e poi
   * cambiarle il tipo in "riunione" per avere un evento di società.
   */
  if (soloPartite(req.utente)) {
    if (dati.tipo !== undefined && !TIPI_PARTITA.includes(dati.tipo)) {
      throw new ErroreHttp(403, "Puoi gestire partite e tornei, non altri eventi.");
    }
    delete dati.visibileDal;
  }

  // Spostare un evento su un'altra squadra richiede il permesso anche su
  // quella: senza questo controllo si potrebbe scrivere nel calendario
  // di chiunque passando dal proprio.
  if (dati.squadraId !== undefined && !await puoGestireSquadra(req.utente, dati.squadraId)) {
    throw new ErroreHttp(403, "Non gestisci la squadra di destinazione.");
  }

  const modifiche = { aggiornatoIl: new Date() };
  for (const campo of [
    "squadraId", "tipo", "sport", "titolo", "avversario", "inizio", "fine",
    "tuttoIlGiorno", "visibileDal", "luogo", "latitudine", "longitudine", "descrizione",
    "risultato", "parziali",
    "marcatori", "diretta"
  ]) {
    if (dati[campo] !== undefined) modifiche[campo] = dati[campo];
  }

  const [aggiornato] = await getDb()
    .update(eventi)
    .set(modifiche)
    .where(eq(eventi.id, idRichiesto(req)))
    .returning({ id: eventi.id, titolo: eventi.titolo, inizio: eventi.inizio });

  await annota(req.utente, {
    // Inserire il risultato di una partita è l'operazione più frequente su un
    // evento, e nel registro merita un nome suo invece di sparire fra le
    // "modifiche": è quella che poi qualcuno contesta.
    azione: dati.risultato !== undefined ? "eventi.risultato" : "eventi.modifica",
    tipo: "evento",
    id: aggiornato.id,
    descrizione: dati.risultato !== undefined
      ? `Ha messo il risultato di "${aggiornato.titolo}": ${dati.risultato ?? "—"}`
      : `Ha modificato "${aggiornato.titolo}"`,
    dettaglio: { campi: Object.keys(modifiche).filter((c) => c !== "aggiornatoIl") }
  });

  return json(res, { evento: aggiornato });
}

async function elimina(req, res) {
  const riga = await eventoGestibile(req);
  const id = idRichiesto(req);

  const db = getDb();
  // I collegamenti ai file si tolgono per primi; i file restano in archivio
  await db.delete(mediaEvento).where(eq(mediaEvento.eventoId, id));
  await db.delete(eventi).where(eq(eventi.id, id));

  // Qui il registro conta più che altrove: l'evento non c'è più, e questa
  // riga è l'unica traccia che sia mai esistito.
  await annota(req.utente, {
    azione: "eventi.elimina",
    tipo: "evento",
    id,
    descrizione: `Ha eliminato "${riga.titolo}"`,
    dettaglio: { inizio: riga.inizio, squadraId: riga.squadraId }
  });

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
