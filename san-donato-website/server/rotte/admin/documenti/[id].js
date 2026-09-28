/**
 * /api/admin/documenti/:id — un documento.
 *
 *   PATCH   cambia titolo, descrizione, file, sezione, dati del rendiconto,
 *           o lo nasconde/mostra (pubblicato)
 *   DELETE  lo toglie dal sito; il file resta nella libreria o nella cartella
 */

import { modificaDocumento, eliminaDocumento, schemaDocumentoModifica } from "../../../documenti.js";
import { richiedeCapacita } from "../../../autenticazione.js";
import { annota } from "../../../registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../risposte.js";
import { leggiCorpo, parametri } from "../../../richiesta.js";
import { valida } from "../../../validazione.js";

export default conGestioneErrori(
  richiedeCapacita("documenti.gestisci", async (req, res) => {
    const id = Number(parametri(req).id);
    if (!Number.isInteger(id) || id <= 0) throw new ErroreHttp(400, "Identificativo non valido.");

    if (req.method === "PATCH" || req.method === "PUT") {
      const dati = valida(schemaDocumentoModifica, await leggiCorpo(req));
      const documento = await modificaDocumento(id, dati, req.utente.id);
      await annota(req.utente, {
        azione: "documenti.modifica",
        tipo: "documento",
        id,
        descrizione: `Ha modificato il documento "${documento.titolo}"`,
        dettaglio: { campi: Object.keys(dati) }
      });
      return json(res, { documento });
    }

    if (req.method === "DELETE") {
      const tolto = await eliminaDocumento(id);
      await annota(req.utente, {
        azione: "documenti.elimina",
        tipo: "documento",
        id,
        descrizione: `Ha tolto dal sito il documento "${tolto.titolo}"`
      });
      return json(res, { eliminato: tolto });
    }

    res.setHeader("Allow", "PATCH, PUT, DELETE");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
