/**
 * /api/admin/atleti — chi fa parte delle squadre.
 *
 *   GET  l'elenco che questa persona può vedere
 *
 * Chi vede cosa: amministratori e segreteria tutti, un allenatore soltanto
 * gli atleti delle proprie squadre. Il taglio lo fa squadreConAtletiVisibili,
 * che è anche l'unico posto dove quella regola è scritta.
 */

import { elencaAtleti } from "../../../server/atleti.js";
import { puo, squadreConAtletiVisibili } from "../../../server/autorizzazioni.js";
import { richiedeCapacita } from "../../../server/autenticazione.js";
import { json, conGestioneErrori, soloMetodi } from "../../../server/risposte.js";
import { parametri } from "../../../server/richiesta.js";

export default conGestioneErrori(
  richiedeCapacita("atleti.leggi", async (req, res) => {
    if (!soloMetodi(req, res, ["GET"])) return;

    const ammesse = await squadreConAtletiVisibili(req.utente);
    const { squadraId } = parametri(req);

    // Quote e versamenti solo a chi li tiene: un allenatore riceve la
    // scheda sportiva dei suoi, non i conti delle loro famiglie.
    const conQuote = puo(req.utente, "quote.gestisci");

    const atleti = await elencaAtleti({
      squadreAmmesse: ammesse,
      squadraId: squadraId ? Number(squadraId) : null,
      conQuote
    });

    // Mai in cache: quote e certificati cambiano mentre qualcuno guarda
    res.setHeader("Cache-Control", "no-store");

    return json(res, {
      atleti,
      // Serve al pannello per proporre nel filtro solo le squadre giuste
      squadreAmmesse: ammesse,
      // Il pannello lo usa per non disegnare colonne che resterebbero vuote
      conQuote
    });
  })
);
