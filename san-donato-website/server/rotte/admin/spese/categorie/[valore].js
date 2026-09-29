/**
 * /api/admin/spese/categorie/:valore — una voce di "Di che cosa si tratta".
 *
 *   PATCH { etichetta }  la rinomina; i servizi che la usano la seguono
 *   DELETE               la toglie, solo se nessun servizio la usa
 */

import { rinominaCategoria, eliminaCategoria, schemaCategoria } from "../../../../spese.js";
import { richiedeCapacita } from "../../../../autenticazione.js";
import { annota } from "../../../../registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../../risposte.js";
import { leggiCorpo, parametri } from "../../../../richiesta.js";
import { valida } from "../../../../validazione.js";

export default conGestioneErrori(
  richiedeCapacita("spese.gestisci", async (req, res) => {
    const valore = String(parametri(req).valore ?? "");
    if (!/^[a-z0-9-]{1,60}$/.test(valore)) throw new ErroreHttp(400, "Categoria non valida.");

    if (req.method === "PATCH" || req.method === "PUT") {
      const { etichetta } = valida(schemaCategoria, await leggiCorpo(req));
      const categoria = await rinominaCategoria(valore, etichetta);
      await annota(req.utente, {
        azione: "spese.categoria_rinomina",
        tipo: "categoria_servizio",
        dettaglio: { valore },
        descrizione: `Ha rinominato una categoria delle spese in "${etichetta}"`
      });
      return json(res, { categoria });
    }

    if (req.method === "DELETE") {
      const tolta = await eliminaCategoria(valore);
      await annota(req.utente, {
        azione: "spese.categoria_elimina",
        tipo: "categoria_servizio",
        dettaglio: { valore },
        descrizione: `Ha tolto la categoria "${tolta.etichetta}" dalle spese del sito`
      });
      return json(res, { eliminata: tolta });
    }

    res.setHeader("Allow", "PATCH, PUT, DELETE");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
