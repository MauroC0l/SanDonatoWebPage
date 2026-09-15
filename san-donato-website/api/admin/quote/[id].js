/**
 * /api/admin/quote/:id
 *
 *   PATCH   cambia nome, importo, descrizione, ordine, o la spegne
 *   DELETE  la toglie, ma solo se non la sta usando nessuno
 *
 * CAMBIARE L'IMPORTO NON RITOCCA LE QUOTE GIÀ ASSEGNATE. Sono accordi presi
 * con le famiglie: riscriverli tutti insieme perché il listino è cambiato a
 * gennaio vorrebbe dire quaranta persone che di colpo devono di più senza
 * che nessuno gliel'abbia detto.
 */

import { z } from "zod";
import { richiedeCapacita } from "../../../server/autenticazione.js";
import { aggiornaTipoQuota, eliminaTipoQuota } from "../../../server/quote.js";
import { annota } from "../../../server/registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../server/risposte.js";
import { leggiCorpo } from "../../../server/richiesta.js";
import { valida } from "../../../server/validazione.js";

const schemaModifica = z.object({
  nome: z.string().trim().min(2, "Il nome è troppo corto.").max(80).optional(),
  descrizione: z.string().trim().max(300).optional(),
  importoCentesimi: z.coerce.number().int().min(0).max(100000000).optional(),
  attiva: z.boolean().optional(),
  ordine: z.coerce.number().int().min(0).max(999).optional()
});

export default conGestioneErrori(
  richiedeCapacita("quote.tariffe", async (req, res) => {
    const id = Number(req.query?.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ErroreHttp(400, "Identificativo della tariffa non valido.");
    }

    if (req.method === "PATCH") {
      const dati = valida(schemaModifica, await leggiCorpo(req));
      const aggiornata = await aggiornaTipoQuota(id, dati);

      await annota(req.utente, {
        azione: "quote.tariffa_modifica",
        tipo: "atleta",
        id,
        descrizione: `Ha modificato la tariffa "${aggiornata.nome}"`,
        dettaglio: { campi: Object.keys(dati) }
      });

      return json(res, { tariffa: aggiornata });
    }

    if (req.method === "DELETE") {
      const esito = await eliminaTipoQuota(id);

      if (esito.esito === "in_uso") {
        throw new ErroreHttp(
          409,
          `Non si può cancellare: ce l'hanno ${esito.quanti} atleti. `
          + "Spegnila invece, così smette di comparire fra le scelte ma i conti restano leggibili."
        );
      }

      await annota(req.utente, {
        azione: "quote.tariffa_elimina",
        tipo: "atleta",
        id,
        descrizione: `Ha eliminato la tariffa "${esito.tariffa.nome}"`
      });

      return json(res, { eliminata: true });
    }

    res.setHeader("Allow", "PATCH, DELETE");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
