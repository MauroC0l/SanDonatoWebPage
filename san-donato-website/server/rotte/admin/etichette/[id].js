/**
 * /api/admin/etichette/:id — rinominare o cancellare un'etichetta.
 *
 *   PATCH   { nome }  la rinomina, su tutte le notizie che l'hanno
 *   DELETE            la cancella: sparisce dalle notizie, che restano
 *
 * Serve "notizie.pubblica": sono gesti che cambiano le notizie di tutti,
 * comprese quelle già online.
 */

import { rinominaEtichetta, eliminaEtichetta } from "../../../etichette.js";
import { richiedeCapacita } from "../../../autenticazione.js";
import { annota } from "../../../registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../risposte.js";
import { leggiCorpo, parametri } from "../../../richiesta.js";
import { valida } from "../../../validazione.js";
import { schemaEtichetta } from "./index.js";

function idRichiesto(req) {
  const id = Number(parametri(req).id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroreHttp(400, "Identificativo non valido.");
  return id;
}

export default conGestioneErrori(
  richiedeCapacita("notizie.pubblica", async (req, res) => {
    const id = idRichiesto(req);

    if (req.method === "PATCH" || req.method === "PUT") {
      const { nome } = valida(schemaEtichetta, await leggiCorpo(req));
      const etichetta = await rinominaEtichetta(id, nome);
      await annota(req.utente, {
        azione: "etichette.rinomina",
        tipo: "etichetta",
        id,
        descrizione: `Ha rinominato un'etichetta in "${nome}"`
      });
      return json(res, { etichetta });
    }

    if (req.method === "DELETE") {
      const tolta = await eliminaEtichetta(id);
      await annota(req.utente, {
        azione: "etichette.elimina",
        tipo: "etichetta",
        id,
        descrizione: `Ha cancellato l'etichetta "${tolta.nome}"`
      });
      return json(res, { eliminata: tolta });
    }

    res.setHeader("Allow", "PATCH, PUT, DELETE");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
