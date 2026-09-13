/**
 * Protezione degli endpoint.
 *
 * Un endpoint protetto si scrive così:
 *
 *   export default conGestioneErrori(richiedeCapacita("notizie.scrivi", async (req, res) => {
 *     req.utente   // già verificato
 *   }));
 *
 * Il controllo sta qui e non dentro ai singoli endpoint: dimenticarselo
 * deve essere difficile, non facile.
 */

import { utenteDallaSessione } from "./sessioni.js";
import { puo } from "./autorizzazioni.js";
import { ErroreHttp } from "./risposte.js";

/** Richiede solo che ci sia una sessione valida. */
export function richiedeAccesso(handler) {
  return async (req, res) => {
    const utente = await utenteDallaSessione(req);
    if (!utente) throw new ErroreHttp(401, "Accesso richiesto.");
    req.utente = utente;
    return handler(req, res);
  };
}

/** Richiede una sessione valida e una capacità specifica. */
export function richiedeCapacita(capacita, handler) {
  return richiedeAccesso(async (req, res) => {
    if (!puo(req.utente, capacita)) {
      // 403 e non 404: chi è entrato ha diritto di sapere che il permesso
      // gli manca, invece di credere che la pagina non esista.
      throw new ErroreHttp(403, "Non hai i permessi per questa operazione.");
    }
    return handler(req, res);
  });
}
