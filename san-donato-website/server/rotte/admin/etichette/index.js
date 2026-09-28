/**
 * /api/admin/etichette — le etichette delle notizie.
 *
 *   GET   tutte, con quante notizie le usano
 *   POST  { nome }  ne crea una
 *
 * Crearne una la può chi scrive notizie: serve nel momento in cui scrive,
 * e aspettare qualcun altro per un'etichetta nuova vorrebbe dire usarne una
 * sbagliata. Rinominarle e cancellarle invece tocca tutte le notizie, e lo
 * fa chi può pubblicare (vedi [id].js).
 */

import { z } from "zod";
import { elencaEtichette, creaEtichetta } from "../../../etichette.js";
import { richiedeCapacita } from "../../../autenticazione.js";
import { annota } from "../../../registro.js";
import { json, errore, conGestioneErrori } from "../../../risposte.js";
import { leggiCorpo } from "../../../richiesta.js";
import { valida } from "../../../validazione.js";

export const schemaEtichetta = z.object({
  nome: z.string().trim().min(2, "Il nome è troppo corto.").max(40, "Il nome è troppo lungo.")
});

export default conGestioneErrori(async (req, res) => {
  if (req.method === "GET") {
    return richiedeCapacita("notizie.scrivi", async (_req, r) => {
      r.setHeader("Cache-Control", "no-store");
      return json(r, { etichette: await elencaEtichette() });
    })(req, res);
  }

  if (req.method === "POST") {
    return richiedeCapacita("notizie.scrivi", async (rq, r) => {
      const { nome } = valida(schemaEtichetta, await leggiCorpo(rq));
      const etichetta = await creaEtichetta(nome);
      await annota(rq.utente, {
        azione: "etichette.crea",
        tipo: "etichetta",
        id: etichetta.id,
        descrizione: `Ha creato l'etichetta "${nome}"`
      });
      return json(r, { etichetta }, 201);
    })(req, res);
  }

  res.setHeader("Allow", "GET, POST");
  return errore(res, 405, `Metodo ${req.method} non consentito.`);
});
