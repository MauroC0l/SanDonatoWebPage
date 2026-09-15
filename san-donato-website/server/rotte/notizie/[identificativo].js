/**
 * GET /api/notizie/:identificativo — una notizia pubblicata.
 *
 * Accetta lo slug, il nostro id o il vecchio id di WordPress: i
 * collegamenti già condivisi puntano a quest'ultimo e devono continuare
 * a funzionare anche dopo lo spegnimento di WordPress.
 */

import { trovaNotizia } from "../../notizie.js";
import { json, errore, conGestioneErrori, soloMetodi } from "../../risposte.js";
import { parametri } from "../../richiesta.js";

export default conGestioneErrori(async (req, res) => {
  if (!soloMetodi(req, res, ["GET"])) return;

  const identificativo = parametri(req).identificativo;
  if (!identificativo) return errore(res, 400, "Manca l'identificativo della notizia.");

  const notizia = await trovaNotizia(identificativo, { soloPubblicate: true });
  if (!notizia) return errore(res, 404, "Notizia non trovata.");

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
  return json(res, { notizia });
});
