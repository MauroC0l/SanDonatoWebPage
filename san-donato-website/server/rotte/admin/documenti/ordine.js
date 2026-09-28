/**
 * PUT /api/admin/documenti/ordine — { sezione, ids } il nuovo ordine di una
 * sezione, dal primo all'ultimo. È l'ordine in cui compaiono sul sito.
 */

import { riordinaDocumenti, schemaOrdine } from "../../../documenti.js";
import { richiedeCapacita } from "../../../autenticazione.js";
import { annota } from "../../../registro.js";
import { json, conGestioneErrori, soloMetodi } from "../../../risposte.js";
import { leggiCorpo } from "../../../richiesta.js";
import { valida } from "../../../validazione.js";

export default conGestioneErrori(
  richiedeCapacita("documenti.gestisci", async (req, res) => {
    if (!soloMetodi(req, res, ["PUT", "PATCH"])) return;
    const { sezione, ids } = valida(schemaOrdine, await leggiCorpo(req));
    await riordinaDocumenti(sezione, ids);
    await annota(req.utente, {
      azione: "documenti.ordine",
      tipo: "documento",
      id: null,
      descrizione: `Ha riordinato i documenti della sezione ${sezione}`
    });
    return json(res, { ok: true });
  })
);
