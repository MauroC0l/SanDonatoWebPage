/**
 * /api/admin/atleti/:id/certificato — il controllo della segreteria.
 *
 *   POST  { approva: true }              lo dichiara valido
 *   POST  { approva: false, motivo }     lo respinge, dicendo perché
 *
 * Caricare un file e consegnare un certificato valido non sono la stessa
 * cosa: arriva la foto storta, la pagina sbagliata, il foglio dell'anno
 * prima, il certificato non agonistico per chi fa campionato. Finché
 * qualcuno non l'ha guardato, quell'atleta non è a posto — anche se sul
 * sito risulta "caricato".
 *
 * Il motivo del rifiuto è obbligatorio. "Respinto" e basta costringe la
 * famiglia a telefonare in segreteria per sapere cosa rifare, che è
 * esattamente la telefonata che questo sito dovrebbe far sparire.
 */

import { z } from "zod";
import { trovaAtleta, validaCertificato } from "../../../../server/atleti.js";
import { squadreConAtletiVisibili } from "../../../../server/autorizzazioni.js";
import { richiedeCapacita } from "../../../../server/autenticazione.js";
import { annota } from "../../../../server/registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../../server/risposte.js";
import { leggiCorpo } from "../../../../server/richiesta.js";
import { valida } from "../../../../server/validazione.js";

const schemaValidazione = z.object({
  approva: z.boolean(),
  motivo: z.string().trim().max(500).optional()
}).refine(
  (d) => d.approva || (d.motivo && d.motivo.length >= 3),
  { message: "Per respingere un certificato bisogna dire perché.", path: ["motivo"] }
);

export default conGestioneErrori(
  richiedeCapacita("certificato.registra", async (req, res) => {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return errore(res, 405, `Metodo ${req.method} non consentito.`);
    }

    const id = Number(req.query?.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ErroreHttp(400, "Identificativo dell'atleta non valido.");
    }

    /* Stessa porta di tutte le altre operazioni sulla scheda: chi non vede
       quell'atleta non deve poterne toccare il certificato. */
    const atleta = await trovaAtleta(id, {
      squadreAmmesse: await squadreConAtletiVisibili(req.utente),
      conQuote: false
    });

    if (!atleta) throw new ErroreHttp(404, "Atleta non trovato.");

    // Serve il file: una scadenza battuta a mano non è un documento, e
    // approvarla vorrebbe dire firmare qualcosa che nessuno ha visto.
    if (!atleta.certificatoMediaId) {
      throw new ErroreHttp(409, "Non c'è nessun file da controllare: l'atleta ha scritto solo la scadenza.");
    }

    const dati = valida(schemaValidazione, await leggiCorpo(req));
    const salvata = await validaCertificato(id, dati, req.utente.id);

    if (!salvata) throw new ErroreHttp(404, "Scheda non trovata.");

    await annota(req.utente, {
      azione: dati.approva ? "certificato.approva" : "certificato.respinge",
      tipo: "atleta",
      id,
      descrizione: dati.approva
        ? `Ha approvato il certificato di ${atleta.nomeCompleto}`
        : `Ha respinto il certificato di ${atleta.nomeCompleto}`,
      dettaglio: dati.approva ? null : { motivo: dati.motivo }
    });

    return json(res, {
      atleta: await trovaAtleta(id, {
        squadreAmmesse: await squadreConAtletiVisibili(req.utente),
        conQuote: true
      })
    });
  })
);
