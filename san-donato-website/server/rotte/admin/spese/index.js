/**
 * /api/admin/spese — la scheda "Spese sito" dell'amministratore.
 *
 *   GET   i servizi esterni, i consumi misurati adesso, i totali e gli avvisi
 *   POST  { nome, categoria, … }  aggiunge un servizio in fondo
 *
 * Serve "spese.gestisci": è l'inventario degli account della società.
 */

import {
  elencaServizi, misuraConsumi, riassumi, creaServizio, schemaServizioNuovo,
  CATEGORIE, PERIODICITA, MISURE
} from "../../../spese.js";
import { archivioConfigurato, archivioPrivatoConfigurato } from "../../../archivio.js";
import { richiedeCapacita } from "../../../autenticazione.js";
import { annota } from "../../../registro.js";
import { json, errore, conGestioneErrori } from "../../../risposte.js";
import { leggiCorpo } from "../../../richiesta.js";
import { valida } from "../../../validazione.js";

export default conGestioneErrori(
  richiedeCapacita("spese.gestisci", async (req, res) => {
    if (req.method === "GET") {
      const [servizi, consumi] = await Promise.all([elencaServizi(), misuraConsumi()]);
      res.setHeader("Cache-Control", "no-store");
      return json(res, {
        servizi,
        consumi,
        riepilogo: riassumi(servizi, consumi),
        /* Lo stato dei collegamenti che si configurano su Vercel: si vede
           se una variabile manca, senza mai mostrarne il valore. */
        collegamenti: {
          archivio: archivioConfigurato() && !process.env.ARCHIVIO_LOCALE,
          archivioRiservato: archivioPrivatoConfigurato() && !process.env.ARCHIVIO_LOCALE,
          archivioLocale: process.env.ARCHIVIO_LOCALE === "1",
          letturaNotturna: Boolean(process.env.CRON_SECRET),
          googleDrive: Boolean(process.env.GOOGLE_DRIVE_API_KEY),
          newsletter: Boolean(process.env.MAILERLITE_API_KEY || process.env.VITE_MAILERLITE_API_KEY)
        },
        categorie: CATEGORIE,
        periodicita: PERIODICITA,
        misure: MISURE
      });
    }

    if (req.method === "POST") {
      const dati = valida(schemaServizioNuovo, await leggiCorpo(req));
      const servizio = await creaServizio(dati, req.utente.id);
      await annota(req.utente, {
        azione: "spese.crea",
        tipo: "servizio",
        id: servizio.id,
        descrizione: `Ha aggiunto il servizio "${servizio.nome}" alle spese del sito`
      });
      return json(res, { servizio }, 201);
    }

    res.setHeader("Allow", "GET, POST");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
