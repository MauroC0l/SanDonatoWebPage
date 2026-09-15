/**
 * /api/admin/quote — le tariffe della stagione.
 *
 *   GET   elenco, con quante schede stanno usando ciascuna
 *   POST  ne crea una  { nome, importoCentesimi, descrizione?, ordine? }
 *
 * Le crea l'amministratore. La segreteria le legge — le servono per
 * applicarle — ma non le decide: quanto si paga è una delibera, chi paga
 * quanto è amministrazione.
 */

import { z } from "zod";
import { richiedeCapacita } from "../../../server/autenticazione.js";
import { puo } from "../../../server/autorizzazioni.js";
import { elencaTipiQuota, creaTipoQuota } from "../../../server/quote.js";
import { annota } from "../../../server/registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../server/risposte.js";
import { leggiCorpo } from "../../../server/richiesta.js";
import { valida } from "../../../server/validazione.js";

const schemaTariffa = z.object({
  nome: z.string().trim().min(2, "Il nome è troppo corto.").max(80),
  descrizione: z.string().trim().max(300).optional(),
  // In centesimi e interi, come ogni importo del sito. Zero è ammesso: una
  // tariffa gratuita esiste — gli istruttori, i dirigenti.
  importoCentesimi: z.coerce.number().int().min(0).max(100000000),
  ordine: z.coerce.number().int().min(0).max(999).optional()
});

export default conGestioneErrori(
  richiedeCapacita("quote.gestisci", async (req, res) => {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "no-store");
      return json(res, { tariffe: await elencaTipiQuota() });
    }

    if (req.method === "POST") {
      if (!puo(req.utente, "quote.tariffe")) {
        throw new ErroreHttp(403, "Le tariffe le decide chi amministra il sito.");
      }

      const dati = valida(schemaTariffa, await leggiCorpo(req));
      const creata = await creaTipoQuota(dati, req.utente.id);

      await annota(req.utente, {
        azione: "quote.tariffa_crea",
        tipo: "atleta",
        id: creata.id,
        descrizione: `Ha creato la tariffa "${creata.nome}"`,
        dettaglio: { importoCentesimi: dati.importoCentesimi }
      });

      return json(res, { tariffa: creata }, 201);
    }

    res.setHeader("Allow", "GET, POST");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
