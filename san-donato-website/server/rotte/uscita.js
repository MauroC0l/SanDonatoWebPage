/** POST /api/uscita — chiude la sessione in corso e cancella il cookie. */

import { chiudiSessione } from "../sessioni.js";
import { json, conGestioneErrori, soloMetodi } from "../risposte.js";

export default conGestioneErrori(async (req, res) => {
  if (!soloMetodi(req, res, ["POST"])) return;

  await chiudiSessione(req, res);
  return json(res, { uscita: true });
});
