/**
 * /api/admin/eventi/:id/media — foto e video di una partita.
 *
 *   GET     i file collegati all'evento
 *   POST    collega un file già caricato   { mediaId, ordine? }
 *   DELETE  scollega                        ?mediaId=
 *
 * Il file si carica prima con /api/admin/media, che lo mette in archivio e
 * restituisce un identificativo; qui lo si collega all'evento. Sono due
 * passaggi distinti perché lo stesso file può servire in più punti, e
 * perché un caricamento interrotto non deve lasciare collegamenti a
 * qualcosa che non esiste.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db/client.js";
import { eventi, media, mediaEvento } from "../../../../../db/schema.js";
import { mediaDiEvento } from "../../../../eventi.js";
import { puoGestireSquadra } from "../../../../autorizzazioni.js";
import { richiedeAccesso } from "../../../../autenticazione.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../../risposte.js";
import { leggiCorpo, parametri } from "../../../../richiesta.js";

async function eventoGestibile(req) {
  const id = Number(parametri(req).id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroreHttp(400, "Identificativo non valido.");

  const [riga] = await getDb()
    .select({ id: eventi.id, squadraId: eventi.squadraId })
    .from(eventi)
    .where(eq(eventi.id, id))
    .limit(1);

  if (!riga) throw new ErroreHttp(404, "Evento non trovato.");
  if (!await puoGestireSquadra(req.utente, riga.squadraId)) {
    throw new ErroreHttp(403, "Non gestisci la squadra di questo evento.");
  }
  return riga.id;
}

export default conGestioneErrori(
  richiedeAccesso(async (req, res) => {
    const eventoId = await eventoGestibile(req);

    if (req.method === "GET") {
      res.setHeader("Cache-Control", "no-store");
      return json(res, { media: await mediaDiEvento(eventoId) });
    }

    if (req.method === "POST") {
      const corpo = await leggiCorpo(req);
      const mediaId = Number(corpo.mediaId);
      if (!Number.isInteger(mediaId) || mediaId <= 0) {
        throw new ErroreHttp(400, "Indica mediaId.");
      }

      const db = getDb();
      const [esiste] = await db
        .select({ id: media.id })
        .from(media)
        .where(eq(media.id, mediaId))
        .limit(1);

      if (!esiste) throw new ErroreHttp(404, "File non trovato in archivio.");

      await db.insert(mediaEvento)
        .values({ eventoId, mediaId, ordine: Number(corpo.ordine) || 0 })
        .onConflictDoNothing();

      return json(res, { media: await mediaDiEvento(eventoId) }, 201);
    }

    if (req.method === "DELETE") {
      const mediaId = Number(parametri(req).mediaId);
      if (!Number.isInteger(mediaId) || mediaId <= 0) {
        throw new ErroreHttp(400, "Indica mediaId.");
      }

      await getDb().delete(mediaEvento).where(and(
        eq(mediaEvento.eventoId, eventoId),
        eq(mediaEvento.mediaId, mediaId)
      ));

      return json(res, { media: await mediaDiEvento(eventoId) });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
