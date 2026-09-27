/**
 * /api/admin/atleti/:id/ritiro — chi smette durante la stagione.
 *
 *   POST    { data: "2026-11-15", motivo? }   segna il ritiro
 *   DELETE                                    lo annulla: chi torna
 *
 * Il ritiro non cancella niente e non tocca l'account né le squadre: la
 * stagione di quella persona resta com'era, con la quota e i versamenti.
 * Quello che cambia è il conto — chi smette prima del 1° gennaio non deve
 * la seconda metà della quota — e il segno accanto al nome negli elenchi.
 *
 * Serve "quote.gestisci": è la segreteria a registrarlo, perché è la
 * segreteria a incassare o a non incassare la seconda metà.
 */

import { z } from "zod";
import { trovaAtleta } from "../../../../atleti.js";
import { ritira, annullaRitiro, oggiRoma } from "../../../../stagioni.js";
import { squadreConAtletiVisibili } from "../../../../autorizzazioni.js";
import { richiedeCapacita } from "../../../../autenticazione.js";
import { annota } from "../../../../registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../../risposte.js";
import { leggiCorpo } from "../../../../richiesta.js";
import { valida } from "../../../../validazione.js";

const schemaRitiro = z.object({
  data: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La data va scritta come 2026-11-15.").optional()
  ),
  motivo: z.string().trim().max(500).optional()
});

export default conGestioneErrori(
  richiedeCapacita("quote.gestisci", async (req, res) => {
    if (req.method !== "POST" && req.method !== "DELETE") {
      res.setHeader("Allow", "POST, DELETE");
      return errore(res, 405, `Metodo ${req.method} non consentito.`);
    }

    const id = Number(req.query?.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ErroreHttp(400, "Identificativo dell'atleta non valido.");
    }

    const ammesse = await squadreConAtletiVisibili(req.utente);
    const atleta = await trovaAtleta(id, { squadreAmmesse: ammesse, conQuote: true });
    if (!atleta) throw new ErroreHttp(404, "Atleta non trovato.");

    if (req.method === "POST") {
      const dati = valida(schemaRitiro, await leggiCorpo(req));
      // Senza data vale oggi: è il caso normale, la famiglia avvisa e si segna
      const data = dati.data ?? oggiRoma();
      if (data > oggiRoma()) {
        throw new ErroreHttp(400, "Il ritiro non può avere una data futura: si segna quando succede.");
      }

      const { stagione } = await ritira(id, { data, motivo: dati.motivo }, req.utente.id);

      await annota(req.utente, {
        azione: "atleti.ritiro",
        tipo: "atleta",
        id,
        descrizione: `Ha segnato il ritiro di ${atleta.nomeCompleto} (stagione ${stagione.nome})`,
        dettaglio: { data, motivo: dati.motivo ?? null }
      });
    } else {
      const { stagione } = await annullaRitiro(id);

      await annota(req.utente, {
        azione: "atleti.ritiro_annullato",
        tipo: "atleta",
        id,
        descrizione: `Ha annullato il ritiro di ${atleta.nomeCompleto} (stagione ${stagione.nome})`
      });
    }

    return json(res, {
      atleta: await trovaAtleta(id, { squadreAmmesse: ammesse, conQuote: true })
    });
  })
);
