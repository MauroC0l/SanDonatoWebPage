/**
 * GET /api/notizie/ultime-per-sport — le ultime notizie di ogni sport.
 *
 * Serve alla home, che divide le notizie per disciplina. Un solo giro al
 * database invece di una richiesta per sport.
 */

import { ultimePerSport } from "../../server/notizie.js";
import { json, conGestioneErrori, soloMetodi } from "../../server/risposte.js";
import { parametri } from "../../server/richiesta.js";

export default conGestioneErrori(async (req, res) => {
  if (!soloMetodi(req, res, ["GET"])) return;

  const quante = Math.min(Math.max(Number(parametri(req).quante) || 4, 1), 12);
  const perSport = await ultimePerSport(quante);

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
  return json(res, { perSport });
});
