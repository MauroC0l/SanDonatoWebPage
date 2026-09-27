/**
 * /api/admin/allenatori — gli allenatori e la loro quota.
 *
 *   GET  tutti gli allenatori, e solo loro: squadre allenate, quota della
 *        stagione in corso, versato
 *
 * Serve "quote.gestisci": è l'elenco di chi tiene la cassa, non una
 * rubrica. Chi allena si trova già nelle sue squadre.
 *
 * APRIRE L'ELENCO ASSEGNA LA QUOTA A CHI NON CE L'HA. Fino a oggi la quota
 * degli allenatori nasceva solo quando l'allenatore apriva la propria
 * iscrizione, e chi nel sito non era mai entrato per la società non doveva
 * niente. Adesso la assegna anche questa pagina, con la stessa regola: la
 * tariffa degli allenatori, solo a chi non ha nessuna quota per la stagione
 * in corso. Una quota già scritta — anche zero, un allenatore esentato —
 * non si tocca.
 */

import { assicuraQuotaAllenatore } from "../../quote.js";
import { elencaAllenatori } from "../../allenatori.js";
import { stagioneRichiesta, elencaStagioni } from "../../stagioni.js";
import { parametri } from "../../richiesta.js";
import { richiedeCapacita } from "../../autenticazione.js";
import { json, errore, conGestioneErrori } from "../../risposte.js";

export default conGestioneErrori(
  richiedeCapacita("quote.gestisci", async (req, res) => {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return errore(res, 405, `Metodo ${req.method} non consentito.`);
    }

    const stagione = await stagioneRichiesta(parametri(req).stagione);
    const descritta = (await elencaStagioni()).find((s) => s.id === stagione.id);

    let allenatori = await elencaAllenatori(stagione);

    // Solo nella stagione in corso: il passato non si riscrive
    const senzaQuota = descritta.inCorso ? allenatori.filter((a) => a.quotaCentesimi == null) : [];
    if (senzaQuota.length) {
      for (const a of senzaQuota) {
        await assicuraQuotaAllenatore({ id: a.utenteId, ruolo: "coach" });
      }
      allenatori = await elencaAllenatori(stagione);
    }

    res.setHeader("Cache-Control", "no-store");
    return json(res, { stagione: descritta, allenatori });
  })
);
