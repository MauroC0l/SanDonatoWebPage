/**
 * GET /api/eventi/risultati — gli ultimi incontri con un esito.
 *
 * Serve alla sezione dei risultati. Un incontro passato senza punteggio
 * non compare: non è un risultato, è una partita di cui nessuno ha ancora
 * aggiornato l'esito.
 */

import { ultimiRisultati } from "../../eventi.js";
import { json, conGestioneErrori, soloMetodi } from "../../risposte.js";
import { parametri } from "../../richiesta.js";

export default conGestioneErrori(async (req, res) => {
  if (!soloMetodi(req, res, ["GET"])) return;

  const quanti = Math.min(Math.max(Number(parametri(req).quanti) || 12, 1), 50);
  const eventi = await ultimiRisultati(quanti);

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return json(res, { eventi });
});
