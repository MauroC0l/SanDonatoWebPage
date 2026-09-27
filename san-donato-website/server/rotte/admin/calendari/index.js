/**
 * /api/admin/calendari
 *
 *   GET   tutto quello che serve alla schermata dei calendari ufficiali:
 *         fonti, gironi, partite sparite, ultime variazioni
 *   POST  aggiunge una fonte
 *
 * Solo l'amministratore: quello che si decide qui finisce nel calendario
 * di tutte le squadre.
 */

import { richiedeCapacita } from "../../../autenticazione.js";
import { annota } from "../../../registro.js";
import { json, errore, conGestioneErrori } from "../../../risposte.js";
import { leggiCorpo } from "../../../richiesta.js";
import { valida } from "../../../validazione.js";
import { statoCalendari, creaFonte, schemaFonteNuova } from "../../../calendari/pannello.js";

export default conGestioneErrori(
  richiedeCapacita("calendari.gestisci", async (req, res) => {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "no-store");
      return json(res, await statoCalendari());
    }

    if (req.method === "POST") {
      const dati = valida(schemaFonteNuova, await leggiCorpo(req));
      const fonte = await creaFonte(dati, req.utente);

      await annota(req.utente, {
        azione: "calendari.fonte_crea",
        tipo: "fonte",
        id: fonte.id,
        descrizione: `Ha aggiunto la fonte di calendari "${fonte.nome}"`,
        dettaglio: { formato: fonte.formato, cartella: fonte.cartella }
      });

      return json(res, { fonte }, 201);
    }

    res.setHeader("Allow", "GET, POST");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
