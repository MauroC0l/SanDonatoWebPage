/**
 * /api/admin/documenti — la scheda "Documenti" dell'amministratore.
 *
 *   GET   tutti i documenti (anche i nascosti) e le sezioni del sito
 *   POST  { sezione, titolo, descrizione?, url? | mediaId?, anno?, importo?,
 *           percepitoIl?, pubblicato? }  ne aggiunge uno in fondo alla sezione
 *
 * Serve "documenti.gestisci": sono atti ufficiali della società.
 */

import {
  elencaDocumentiPerGestione, creaDocumento, schemaDocumentoNuovo, SEZIONI
} from "../../../documenti.js";
import { richiedeCapacita } from "../../../autenticazione.js";
import { annota } from "../../../registro.js";
import { json, errore, conGestioneErrori } from "../../../risposte.js";
import { leggiCorpo } from "../../../richiesta.js";
import { valida } from "../../../validazione.js";

export default conGestioneErrori(
  richiedeCapacita("documenti.gestisci", async (req, res) => {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "no-store");
      return json(res, { documenti: await elencaDocumentiPerGestione(), sezioni: SEZIONI });
    }

    if (req.method === "POST") {
      const dati = valida(schemaDocumentoNuovo, await leggiCorpo(req));
      const documento = await creaDocumento(dati, req.utente.id);
      await annota(req.utente, {
        azione: "documenti.crea",
        tipo: "documento",
        id: documento.id,
        descrizione: `Ha aggiunto il documento "${documento.titolo}"`,
        dettaglio: { sezione: documento.sezione }
      });
      return json(res, { documento }, 201);
    }

    res.setHeader("Allow", "GET, POST");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
