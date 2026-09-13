/**
 * GET /api/notizie — elenco pubblico.
 *
 * Restituisce SOLO le notizie pubblicate: bozze, articoli in revisione e
 * cestino non escono da qui in nessun caso, qualunque parametro si passi.
 */

import { elencaNotizie } from "../../server/notizie.js";
import { json, conGestioneErrori, soloMetodi } from "../../server/risposte.js";
import { parametri } from "../../server/richiesta.js";
import { schemaElencoNotizie, valida } from "../../server/validazione.js";

export default conGestioneErrori(async (req, res) => {
  if (!soloMetodi(req, res, ["GET"])) return;

  const { pagina, perPagina, sport, cerca } = valida(schemaElencoNotizie, parametri(req));

  const risultato = await elencaNotizie({
    pagina, perPagina, sport, cerca,
    soloPubblicate: true
  });

  // Il contenuto degli articoli cambia di rado: mezz'ora di cache sul bordo
  // toglie al database quasi tutto il traffico di lettura.
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");

  return json(res, risultato);
});
