/**
 * /api/admin/calendari/gironi/:id
 *
 *   PATCH  { squadraId }       collega il girone a una squadra del sito:
 *                              le sue partite entrano subito nel calendario
 *          { squadraId: null } lo scollega: torna da collegare, e le sue
 *                              partite escono dal calendario
 *          { ignorato: true }  "questo girone non ci riguarda"
 *          { ignorato: false } ci si ripensa
 */

import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db/client.js";
import { squadre } from "../../../../../db/schema.js";
import { richiedeCapacita } from "../../../../autenticazione.js";
import { annota } from "../../../../registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../../risposte.js";
import { leggiCorpo, parametri } from "../../../../richiesta.js";
import { valida } from "../../../../validazione.js";
import { aggiornaGirone, schemaGirone } from "../../../../calendari/pannello.js";

export default conGestioneErrori(
  richiedeCapacita("calendari.gestisci", async (req, res) => {
    if (req.method !== "PATCH" && req.method !== "PUT") {
      res.setHeader("Allow", "PATCH, PUT");
      return errore(res, 405, `Metodo ${req.method} non consentito.`);
    }

    const id = Number(parametri(req).id);
    if (!Number.isInteger(id) || id <= 0) throw new ErroreHttp(400, "Identificativo non valido.");

    const dati = valida(schemaGirone, await leggiCorpo(req));
    const { girone, prima, conto } = await aggiornaGirone(id, dati);

    const nomeGirone = `"${girone.nomeNelGirone}" in ${girone.nomeFile || girone.titolo || "un girone"}`;
    let descrizione;

    if (dati.squadraId === null && prima.squadraId) {
      const [squadra] = await getDb().select({ nome: squadre.nome })
        .from(squadre).where(eq(squadre.id, prima.squadraId)).limit(1);

      descrizione = `Ha scollegato ${nomeGirone} da ${squadra?.nome ?? "la sua squadra"}: `
        + `${conto.tolte} ${conto.tolte === 1 ? "partita tolta" : "partite tolte"} dal calendario`;
    } else if (dati.squadraId !== undefined && girone.squadraId !== prima.squadraId) {
      const [squadra] = await getDb().select({ nome: squadre.nome })
        .from(squadre).where(eq(squadre.id, girone.squadraId)).limit(1);

      descrizione = prima.squadraId
        ? `Ha spostato ${nomeGirone} su ${squadra?.nome}: le sue partite l'hanno seguita`
        : `Ha collegato ${nomeGirone} a ${squadra?.nome}`;
    } else if (dati.ignorato !== undefined && girone.ignorato !== prima.ignorato) {
      descrizione = girone.ignorato
        ? `Ha messo da parte ${nomeGirone}`
        : `Ha ripreso in considerazione ${nomeGirone}`;
    }

    if (descrizione) {
      await annota(req.utente, {
        azione: "calendari.girone",
        tipo: "girone",
        id,
        descrizione,
        dettaglio: { squadraPrima: prima.squadraId, squadraDopo: girone.squadraId, conto }
      });
    }

    return json(res, { girone: { id: girone.id, squadraId: girone.squadraId, ignorato: girone.ignorato }, conto });
  })
);
