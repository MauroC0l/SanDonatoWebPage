/**
 * GET /api/io — chi sono.
 *
 * Il front-end lo chiama all'avvio per sapere se c'è una sessione aperta.
 * Risponde 200 con l'utente oppure 200 con utente: null — non 401, perché
 * "non sei entrato" è una risposta legittima a questa domanda, non un errore.
 */

import { utenteDallaSessione } from "../sessioni.js";
import { capacitaDi } from "../autorizzazioni.js";
import { json, conGestioneErrori, soloMetodi } from "../risposte.js";

export default conGestioneErrori(async (req, res) => {
  if (!soloMetodi(req, res, ["GET"])) return;

  const utente = await utenteDallaSessione(req);
  if (!utente) return json(res, { utente: null });

  return json(res, { utente: { ...utente, capacita: capacitaDi(utente.ruolo) } });
});
