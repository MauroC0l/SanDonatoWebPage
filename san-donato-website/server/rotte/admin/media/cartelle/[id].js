/**
 * /api/admin/media/cartelle/:id
 *
 *   PATCH   rinomina        { nome }
 *   DELETE  la toglie, e i file che conteneva restano senza cartella
 *
 * Cancellare una cartella non cancella niente: è la colonna cartella_id a
 * tornare vuota, per via del "set null" sulla chiave esterna. Riordinare
 * non deve poter distruggere, altrimenti nessuno riordina più.
 */

import { richiedeCapacita } from "../../../../autenticazione.js";
import { rinominaCartella, eliminaCartella, GIORNI_CESTINO } from "../../../../media.js";
import { annota } from "../../../../registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../../risposte.js";
import { leggiCorpo, parametri } from "../../../../richiesta.js";

export default conGestioneErrori(
  richiedeCapacita("notizie.scrivi", async (req, res) => {
    const id = Number(req.query?.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ErroreHttp(400, "Identificativo della cartella non valido.");
    }

    if (req.method === "PATCH") {
      const dati = await leggiCorpo(req);
      const cartella = await rinominaCartella(id, dati.nome);

      await annota(req.utente, {
        azione: "cartelle.rinomina",
        tipo: "media",
        id,
        descrizione: `Ha rinominato una cartella in "${cartella.nome}"`
      });

      return json(res, { cartella });
    }

    if (req.method === "DELETE") {
      /* Con "conFile" i file dentro finiscono nel cestino, non nel nulla:
         dieci giorni per accorgersi di aver spuntato la casella con la
         cartella sbagliata aperta. */
      const p = parametri(req);
      const conFile = p.conFile === "1" || p.conFile === "true";

      const tolta = await eliminaCartella(id, { conFile, utenteId: req.utente.id });

      await annota(req.utente, {
        azione: "cartelle.elimina",
        tipo: "media",
        id,
        descrizione: conFile
          ? `Ha eliminato la cartella "${tolta.nome}" e cestinato ${tolta.cestinati} file`
          : `Ha eliminato la cartella "${tolta.nome}" (i file sono rimasti)`
      });

      return json(res, {
        eliminata: true,
        cestinati: tolta.cestinati,
        saltati: tolta.saltati,
        giorniCestino: GIORNI_CESTINO
      });
    }

    res.setHeader("Allow", "PATCH, DELETE");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
