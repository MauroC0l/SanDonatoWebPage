/**
 * GET /api/squadre — l'elenco delle squadre, per i filtri del calendario.
 *
 * Prima questo elenco stava nel codice del front-end (CALENDARS_CONFIG),
 * con nomi e colori scritti a mano: aggiungere una squadra richiedeva una
 * modifica al codice e una nuova pubblicazione del sito.
 */

import { elencaSquadre } from "../eventi.js";
import { json, conGestioneErrori, soloMetodi } from "../risposte.js";

export default conGestioneErrori(async (req, res) => {
  if (!soloMetodi(req, res, ["GET"])) return;

  const squadre = await elencaSquadre({ soloAttive: true });

  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
  return json(res, { squadre });
});
