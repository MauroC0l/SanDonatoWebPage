/**
 * /api/admin/stagioni — le stagioni, per il selettore e per il riepilogo.
 *
 *   GET  { stagioni: [...] }  dalla più recente; a chi tiene i conti, ogni
 *        stagione arriva con i suoi numeri (iscritti, rinnovi, quote)
 *
 * Il selettore in alto nel pannello serve a chi vede gli atleti: anche un
 * allenatore può voler guardare chi aveva l'anno scorso. I numeri delle
 * quote invece solo a chi le tiene, come ovunque.
 */

import { elencaStagioni } from "../../stagioni.js";
import { riepilogoStagioni } from "../../riepilogo-stagioni.js";
import { puo } from "../../autorizzazioni.js";
import { richiedeCapacita } from "../../autenticazione.js";
import { json, conGestioneErrori, soloMetodi } from "../../risposte.js";

export default conGestioneErrori(
  richiedeCapacita("atleti.leggi", async (req, res) => {
    if (!soloMetodi(req, res, ["GET"])) return;

    const stagioni = puo(req.utente, "quote.gestisci")
      ? await riepilogoStagioni()
      : await elencaStagioni();

    res.setHeader("Cache-Control", "no-store");
    return json(res, { stagioni });
  })
);
