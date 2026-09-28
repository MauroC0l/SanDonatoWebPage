/**
 * GET /api/cron/stagioni — la manutenzione notturna delle stagioni.
 *
 * Il 1° luglio porta tutti nella stagione nuova con la quota Rinnovo; dopo
 * la scadenza della prima metà segna come abbandonato chi non l'ha versata
 * (solo con ABBANDONI_AUTOMATICI=1). Vedi server/manutenzione-stagioni.js.
 * Nello stesso giro cancella le notizie nel cestino da più di 30 giorni.
 *
 * La chiama Vercel all'ora scritta in vercel.json, con CRON_SECRET come i
 * calendari. Gira anche quando si apre l'elenco degli atleti: il cron è la
 * garanzia che succeda anche se per giorni nessuno lo apre.
 */

import { json, errore, conGestioneErrori, soloMetodi } from "../../risposte.js";
import { cronAutorizzato } from "../../cron-segreto.js";
import { manutenzioneStagioni } from "../../manutenzione-stagioni.js";
import { pulisciCestinoNotizie } from "../../notizie.js";

export default conGestioneErrori(async (req, res) => {
  if (!soloMetodi(req, res, ["GET"])) return;

  if (!process.env.CRON_SECRET) {
    return errore(res, 503, "CRON_SECRET non impostato: la manutenzione notturna è spenta.");
  }
  if (!cronAutorizzato(req)) return errore(res, 401, "Non autorizzato.");

  const esito = await manutenzioneStagioni();
  /* Nello stesso giro notturno anche il cestino delle notizie: un cron in
     più su Vercel per una sola interrogazione non vale la pena. */
  const cestino = await pulisciCestinoNotizie();
  res.setHeader("Cache-Control", "no-store");
  return json(res, { ...esito, notizieCancellate: cestino.length });
});
