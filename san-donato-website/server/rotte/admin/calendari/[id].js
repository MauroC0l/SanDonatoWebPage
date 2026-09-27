/**
 * /api/admin/calendari/:id — una fonte di calendari ufficiali.
 *
 *   PATCH   nome, formato, cartella, nomi nostri, palestre di casa, attiva
 *   DELETE  solo se non ha ancora portato partite: altrimenti si disattiva
 *           (vedi eliminaFonte)
 */

import { richiedeCapacita } from "../../../autenticazione.js";
import { annota } from "../../../registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../risposte.js";
import { leggiCorpo, parametri } from "../../../richiesta.js";
import { valida } from "../../../validazione.js";
import {
  trovaFonte, modificaFonte, eliminaFonte, schemaFonteModifica
} from "../../../calendari/pannello.js";

function idRichiesto(req) {
  const id = Number(parametri(req).id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroreHttp(400, "Identificativo non valido.");
  return id;
}

export default conGestioneErrori(
  richiedeCapacita("calendari.gestisci", async (req, res) => {
    const id = idRichiesto(req);

    if (req.method === "PATCH" || req.method === "PUT") {
      const dati = valida(schemaFonteModifica, await leggiCorpo(req));
      if (Object.keys(dati).length === 0) throw new ErroreHttp(400, "Non c'è niente da salvare.");

      const prima = await trovaFonte(id);
      const fonte = await modificaFonte(id, dati);

      const spenta = dati.attiva === false && prima.attiva;
      const accesa = dati.attiva === true && !prima.attiva;

      await annota(req.utente, {
        azione: "calendari.fonte_modifica",
        tipo: "fonte",
        id,
        descrizione: spenta
          ? `Ha disattivato la fonte "${fonte.nome}": non viene più letta`
          : accesa
            ? `Ha riattivato la fonte "${fonte.nome}"`
            : `Ha modificato la fonte "${fonte.nome}"`,
        dettaglio: { campi: Object.keys(dati) }
      });

      return json(res, { fonte });
    }

    if (req.method === "DELETE") {
      const tolta = await eliminaFonte(id);

      await annota(req.utente, {
        azione: "calendari.fonte_elimina",
        tipo: "fonte",
        id,
        descrizione: `Ha tolto la fonte "${tolta.nome}"`
      });

      return json(res, { eliminata: id });
    }

    res.setHeader("Allow", "PATCH, PUT, DELETE");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
