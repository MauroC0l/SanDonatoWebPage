/**
 * GET /api/eventi — gli eventi in un intervallo di date.
 *
 * Parametri: da, a (date ISO), squadraId, limite.
 * Senza intervallo restituisce i prossimi eventi a partire da oggi.
 */

import { elencaEventi } from "../../eventi.js";
import { json, conGestioneErrori, soloMetodi } from "../../risposte.js";
import { parametri } from "../../richiesta.js";
import { schemaElencoEventi, valida } from "../../validazione.js";

export default conGestioneErrori(async (req, res) => {
  if (!soloMetodi(req, res, ["GET"])) return;

  const { da, a, squadraId, limite } = valida(schemaElencoEventi, parametri(req));

  const eventi = await elencaEventi({
    da: da ?? (a ? null : new Date()),
    a,
    squadraId,
    limite,
    // Il sito pubblico non vede gli eventi ancora programmati
    soloVisibili: true
  });

  // Poco: un risultato inserito durante la partita deve comparire in fretta
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return json(res, { eventi });
});
