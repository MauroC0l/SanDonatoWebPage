/** POST /api/uscita — chiude la sessione in corso e cancella il cookie. */

import { chiudiSessione } from "../server/sessioni.js";
import { json, conGestioneErrori, soloMetodi } from "../server/risposte.js";

export default conGestioneErrori(async (req, res) => {
  if (!soloMetodi(req, res, ["POST"])) return;

  await chiudiSessione(req, res);
  return json(res, { uscita: true });
});
