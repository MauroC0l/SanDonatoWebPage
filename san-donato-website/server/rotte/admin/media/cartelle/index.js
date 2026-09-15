/**
 * /api/admin/media/cartelle — le cartelle della libreria.
 *
 *   GET   elenco con quanti file contengono
 *   POST  ne crea una          { nome }
 *
 * Perché una rotta con un segmento fisso davanti a /media/:id funziona: sia
 * Vercel sia il server di sviluppo provano prima le rotte senza parametri,
 * quindi "cartelle" non finisce dentro a :id. La stessa cosa vale già per
 * /api/notizie/ultime-per-sport.
 */

import { richiedeCapacita } from "../../../../autenticazione.js";
import { eAmministratore } from "../../../../autorizzazioni.js";
import { elencaCartelle, creaCartella } from "../../../../media.js";
import { annota } from "../../../../registro.js";
import { json, errore, conGestioneErrori } from "../../../../risposte.js";
import { leggiCorpo } from "../../../../richiesta.js";

export default conGestioneErrori(
  richiedeCapacita("notizie.scrivi", async (req, res) => {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "no-store");
      return json(res, await elencaCartelle({ amministratore: eAmministratore(req.utente) }));
    }

    if (req.method === "POST") {
      const dati = await leggiCorpo(req);
      const creata = await creaCartella(dati.nome, req.utente.id);

      await annota(req.utente, {
        azione: "cartelle.crea",
        tipo: "media",
        id: creata.id,
        descrizione: `Ha creato la cartella "${creata.nome}"`
      });

      return json(res, { cartella: creata }, 201);
    }

    res.setHeader("Allow", "GET, POST");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
