/**
 * /api/admin/spese/:id — un servizio esterno.
 *
 *   PATCH   cambia i suoi dati (piano, importo, rinnovo, account…), o lo
 *           spegne con attivo: false
 *   DELETE  lo toglie dall'elenco
 */

import { modificaServizio, eliminaServizio, schemaServizioModifica } from "../../../spese.js";
import { richiedeCapacita } from "../../../autenticazione.js";
import { annota } from "../../../registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../risposte.js";
import { leggiCorpo, parametri } from "../../../richiesta.js";
import { valida } from "../../../validazione.js";

export default conGestioneErrori(
  richiedeCapacita("spese.gestisci", async (req, res) => {
    const id = Number(parametri(req).id);
    if (!Number.isInteger(id) || id <= 0) throw new ErroreHttp(400, "Identificativo non valido.");

    if (req.method === "PATCH" || req.method === "PUT") {
      const dati = valida(schemaServizioModifica, await leggiCorpo(req));
      const servizio = await modificaServizio(id, dati, req.utente.id);
      await annota(req.utente, {
        azione: "spese.modifica",
        tipo: "servizio",
        id,
        descrizione: `Ha modificato il servizio "${servizio.nome}" nelle spese del sito`,
        dettaglio: { campi: Object.keys(dati) }
      });
      return json(res, { servizio });
    }

    if (req.method === "DELETE") {
      const tolto = await eliminaServizio(id);
      await annota(req.utente, {
        azione: "spese.elimina",
        tipo: "servizio",
        id,
        descrizione: `Ha tolto il servizio "${tolto.nome}" dalle spese del sito`
      });
      return json(res, { eliminato: tolto });
    }

    res.setHeader("Allow", "PATCH, PUT, DELETE");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
