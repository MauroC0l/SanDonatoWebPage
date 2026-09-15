/**
 * GET /api/cruscotto — cosa aspetta chi è appena entrato.
 *
 * Nessuna capacità da controllare: la risposta si compone su quelle che
 * questa persona ha, quindi chiede a sé stessa cosa può contenere. Serve
 * solo una sessione.
 */

import { componiCruscotto } from "../cruscotto.js";
import { richiedeAccesso } from "../autenticazione.js";
import { json, conGestioneErrori, soloMetodi } from "../risposte.js";

export default conGestioneErrori(
  richiedeAccesso(async (req, res) => {
    if (!soloMetodi(req, res, ["GET"])) return;

    const cruscotto = await componiCruscotto(req.utente);

    // Mai in cache: è la schermata che deve dire com'è la situazione ADESSO
    res.setHeader("Cache-Control", "no-store");
    return json(res, { cruscotto });
  })
);
