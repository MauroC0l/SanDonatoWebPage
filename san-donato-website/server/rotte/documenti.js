/**
 * GET /api/documenti[?sezione=privacy] — i documenti pubblicati sul sito.
 *
 * Pubblica: sono gli stessi PDF che chiunque scarica dalle pagine. Solo i
 * documenti con "pubblicato", nell'ordine deciso dall'amministratore.
 */

import { z } from "zod";
import { elencaDocumentiPubblici, SEZIONI } from "../documenti.js";
import { json, conGestioneErrori, soloMetodi } from "../risposte.js";
import { parametri } from "../richiesta.js";
import { valida } from "../validazione.js";

const schema = z.object({
  sezione: z.enum(SEZIONI.map((s) => s.valore)).optional()
});

export default conGestioneErrori(async (req, res) => {
  if (!soloMetodi(req, res, ["GET"])) return;
  const { sezione } = valida(schema, parametri(req));
  // Pochi secondi in cache: una modifica dalla scheda Documenti deve vedersi quasi subito
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=15, stale-while-revalidate=30");
  return json(res, { documenti: await elencaDocumentiPubblici(sezione ?? null) });
});
