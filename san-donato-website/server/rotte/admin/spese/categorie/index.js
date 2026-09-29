/**
 * /api/admin/spese/categorie — le voci di "Di che cosa si tratta".
 *
 *   GET                 le categorie, con quanti servizi usano ciascuna
 *   POST { etichetta }  ne aggiunge una, prima di "Altro"
 *
 * Serve "spese.gestisci", come il resto della scheda Spese sito.
 */

import { elencaCategorie, creaCategoria, schemaCategoria } from "../../../../spese.js";
import { richiedeCapacita } from "../../../../autenticazione.js";
import { annota } from "../../../../registro.js";
import { json, errore, conGestioneErrori } from "../../../../risposte.js";
import { leggiCorpo } from "../../../../richiesta.js";
import { valida } from "../../../../validazione.js";

export default conGestioneErrori(
  richiedeCapacita("spese.gestisci", async (req, res) => {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "no-store");
      return json(res, { categorie: await elencaCategorie() });
    }

    if (req.method === "POST") {
      const { etichetta } = valida(schemaCategoria, await leggiCorpo(req));
      const categoria = await creaCategoria(etichetta);
      await annota(req.utente, {
        azione: "spese.categoria_crea",
        tipo: "categoria_servizio",
        dettaglio: { valore: categoria.valore },
        descrizione: `Ha aggiunto la categoria "${etichetta}" alle spese del sito`
      });
      return json(res, { categoria }, 201);
    }

    res.setHeader("Allow", "GET, POST");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
