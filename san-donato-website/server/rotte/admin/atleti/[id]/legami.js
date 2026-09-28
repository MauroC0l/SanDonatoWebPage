/**
 * /api/admin/atleti/:id/legami — la segreteria decide sulle parentele.
 *
 *   PATCH  { legameId, conferma: true }              sono fratelli
 *   PATCH  { legameId, conferma: false, motivo }     non lo sono, ed ecco perché
 *
 * I legami si LEGGONO insieme alla scheda dell'atleta, come i versamenti:
 * chi apre quella pagina li trova lì. Qui c'è solo la decisione.
 *
 * CONFERMARE NON ASSEGNA NESSUNA TARIFFA, ed è voluto. "Sono fratelli?" e
 * "quanto paga?" sono due domande diverse: la prima è un fatto da
 * verificare, la seconda una decisione della società. La tariffa agevolata
 * si applica con lo stesso comando di sempre, sulla stessa pagina, un
 * momento dopo.
 *
 * Serve "quote.gestisci" e non "atleti.leggi": una parentela dichiarata
 * esiste per una ragione sola, decidere una quota, e all'allenatore le
 * quote non arrivano.
 */

import { z } from "zod";
import { trovaAtleta } from "../../../../atleti.js";
import { decidiLegame } from "../../../../legami.js";
import { squadreConAtletiVisibili } from "../../../../autorizzazioni.js";
import { richiedeCapacita } from "../../../../autenticazione.js";
import { annota } from "../../../../registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../../risposte.js";
import { leggiCorpo } from "../../../../richiesta.js";
import { valida } from "../../../../validazione.js";
import { applicaTariffaFamiglia } from "../../../../quote.js";

const schemaDecisione = z.object({
  legameId: z.coerce.number().int().positive(),
  conferma: z.boolean(),
  motivo: z.string().trim().max(500).optional()
}).refine(
  (d) => d.conferma || (d.motivo && d.motivo.length >= 3),
  {
    // Come per il certificato respinto: "no" e basta obbliga la famiglia a
    // telefonare per sapere cosa c'era di sbagliato.
    message: "Per respingere una parentela bisogna dire perché.",
    path: ["motivo"]
  }
);

export default conGestioneErrori(
  richiedeCapacita("quote.gestisci", async (req, res) => {
    if (req.method !== "PATCH") {
      res.setHeader("Allow", "PATCH");
      return errore(res, 405, `Metodo ${req.method} non consentito.`);
    }

    const id = Number(req.query?.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ErroreHttp(400, "Identificativo dell'atleta non valido.");
    }

    const ammesse = await squadreConAtletiVisibili(req.utente);

    /* La stessa porta di ogni altra operazione sulla scheda: chi non vede
       quell'atleta non decide sulle sue parentele. */
    const atleta = await trovaAtleta(id, { squadreAmmesse: ammesse, conQuote: true });
    if (!atleta) throw new ErroreHttp(404, "Atleta non trovato.");

    const dati = valida(schemaDecisione, await leggiCorpo(req));

    /* Il legame deve essere uno di quelli che si vedono su QUESTA scheda.
       Senza questo controllo, l'identificativo di un legame di chiunque
       altro, scritto a mano, verrebbe deciso lo stesso. */
    const suo = (atleta.legami ?? []).some((l) => l.id === dati.legameId);
    if (!suo) throw new ErroreHttp(404, "Questa dichiarazione non riguarda questo atleta.");

    const deciso = await decidiLegame(
      dati.legameId,
      { stato: dati.conferma ? "confermato" : "respinto", motivo: dati.motivo ?? null },
      req.utente
    );

    /* Deciso dalla società il 28 settembre 2026: confermare applica da sé
       la tariffa famiglia, per la stagione in corso, SOLO a chi l'ha
       chiesta (il secondo figlio). Il fratello già iscritto tiene la sua.
       Una tariffa scelta a mano dalla segreteria però resta. */
    const tariffa = dati.conferma
      ? await applicaTariffaFamiglia(deciso.utenteId, deciso.stagioneId, req.utente.id)
      : null;

    await annota(req.utente, {
      azione: dati.conferma ? "legame.conferma" : "legame.respinge",
      tipo: "atleta",
      id,
      descrizione: dati.conferma
        ? `Ha confermato una parentela dichiarata su ${atleta.nomeCompleto}`
        : `Ha respinto una parentela dichiarata su ${atleta.nomeCompleto}`,
      dettaglio: dati.conferma ? null : { motivo: dati.motivo }
    });

    return json(res, {
      atleta: await trovaAtleta(id, { squadreAmmesse: ammesse, conQuote: true }),
      tariffaApplicata: tariffa ? tariffa.nome : null
    });
  })
);
