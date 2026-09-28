/**
 * /api/admin/atleti/:id/abbandono — chi per la stagione in corso non c'è.
 *
 *   POST    segna "abbandonato": non ha rinnovato, o non ha versato
 *   DELETE  lo riattiva
 *
 * Non tocca l'account: la persona può ancora entrare, vedere la sua pagina
 * e tornare. Non cancella niente: la stagione resta scritta, con lo stato
 * "abbandonata", e il conto non chiede più niente (vedi contoStagione).
 *
 * Lo stesso stato il sito lo mette da solo a chi non versa la prima metà
 * entro la scadenza (server/manutenzione-stagioni.js). Uno segnato qui,
 * a mano, invece non si annulla da solo: lo toglie solo la segreteria.
 *
 * Serve "quote.gestisci", come il ritiro.
 */

import { trovaAtleta } from "../../../../atleti.js";
import { segnaAbbandono, annullaAbbandono } from "../../../../stagioni.js";
import { squadreConAtletiVisibili } from "../../../../autorizzazioni.js";
import { richiedeCapacita } from "../../../../autenticazione.js";
import { annota } from "../../../../registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../../risposte.js";

export default conGestioneErrori(
  richiedeCapacita("quote.gestisci", async (req, res) => {
    if (req.method !== "POST" && req.method !== "DELETE") {
      res.setHeader("Allow", "POST, DELETE");
      return errore(res, 405, `Metodo ${req.method} non consentito.`);
    }

    const id = Number(req.query?.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ErroreHttp(400, "Identificativo dell'atleta non valido.");
    }

    const ammesse = await squadreConAtletiVisibili(req.utente);
    const atleta = await trovaAtleta(id, { squadreAmmesse: ammesse, conQuote: true });
    if (!atleta) throw new ErroreHttp(404, "Atleta non trovato.");

    if (req.method === "POST") {
      const { stagione } = await segnaAbbandono(id, req.utente.id);
      await annota(req.utente, {
        azione: "atleti.abbandono",
        tipo: "atleta",
        id,
        descrizione: `Ha segnato ${atleta.nomeCompleto} come abbandonato (stagione ${stagione.nome})`
      });
    } else {
      const { stagione } = await annullaAbbandono(id, req.utente.id);
      await annota(req.utente, {
        azione: "atleti.abbandono_annullato",
        tipo: "atleta",
        id,
        descrizione: `Ha riattivato ${atleta.nomeCompleto} (stagione ${stagione.nome})`
      });
    }

    return json(res, {
      atleta: await trovaAtleta(id, { squadreAmmesse: ammesse, conQuote: true })
    });
  })
);
