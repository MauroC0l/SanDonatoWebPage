/**
 * POST /api/admin/calendari/lettura — "Aggiorna ora".
 *
 *   { fonteId }  legge solo quella fonte, anche se è disattivata: serve a
 *                provare una cartella nuova prima di accenderla
 *   {}           legge tutte le fonti attive, come fa la notte
 *
 * Risponde a lettura finita, con l'esito di ogni fonte: chi ha premuto il
 * pulsante vuole sapere com'è andata, non che "è partita".
 */

import { z } from "zod";
import { richiedeCapacita } from "../../../autenticazione.js";
import { json, conGestioneErrori, soloMetodi } from "../../../risposte.js";
import { leggiCorpo } from "../../../richiesta.js";
import { valida } from "../../../validazione.js";
import { sincronizzaFonte, sincronizzaTutte } from "../../../calendari/sincronizza.js";
import { trovaFonte } from "../../../calendari/pannello.js";

const schemaLettura = z.object({
  fonteId: z.coerce.number().int().positive().optional()
});

export default conGestioneErrori(
  richiedeCapacita("calendari.gestisci", async (req, res) => {
    if (!soloMetodi(req, res, ["POST"])) return;

    const { fonteId } = valida(schemaLettura, await leggiCorpo(req));

    if (fonteId) {
      await trovaFonte(fonteId);
      return json(res, { esiti: [await sincronizzaFonte(fonteId)] });
    }

    return json(res, { esiti: await sincronizzaTutte() });
  })
);
