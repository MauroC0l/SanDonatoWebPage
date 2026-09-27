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
import { stagioneCorrente } from "../../stagioni.js";
import { richiedeCapacita } from "../../autenticazione.js";
import { json, errore, conGestioneErrori } from "../../risposte.js";

export default conGestioneErrori(
  richiedeCapacita("quote.gestisci", async (req, res) => {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return errore(res, 405, `Metodo ${req.method} non consentito.`);
    }

    let allenatori = await elencaAllenatori();

    const senzaQuota = allenatori.filter((a) => a.quotaCentesimi == null);
    if (senzaQuota.length) {
      for (const a of senzaQuota) {
        await assicuraQuotaAllenatore({ id: a.utenteId, ruolo: "coach" });
      }
      allenatori = await elencaAllenatori();
    }

    const stagione = await stagioneCorrente();
    res.setHeader("Cache-Control", "no-store");
    return json(res, {
      stagione: { id: stagione.id, nome: stagione.nome },
      allenatori
    });
  })
);
