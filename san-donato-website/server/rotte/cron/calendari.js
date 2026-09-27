/**
 * GET /api/cron/calendari — la lettura notturna dei calendari ufficiali.
 *
 * La chiama Vercel, all'ora scritta in vercel.json, con l'intestazione
 * "Authorization: Bearer <CRON_SECRET>". Nessuno altro deve poterla far
 * partire: non per quello che scrive, che è comunque il calendario
 * ufficiale, ma perché ogni lettura scarica decine di file da Google e
 * chiunque potrebbe ripeterla mille volte.
 *
 * Senza CRON_SECRET l'indirizzo resta CHIUSO, non aperto: un segreto che
 * manca è una configurazione sbagliata, e la reazione giusta è non fare
 * niente e dirlo. La schermata dei calendari mostra l'avviso.
 */

import { timingSafeEqual } from "node:crypto";
import { json, errore, conGestioneErrori, soloMetodi } from "../../risposte.js";
import { sincronizzaTutte } from "../../calendari/sincronizza.js";

function autorizzata(req) {
  const segreto = process.env.CRON_SECRET;
  if (!segreto) return false;

  const atteso = Buffer.from(`Bearer ${segreto}`);
  const ricevuto = Buffer.from(String(req.headers.authorization ?? ""));

  // Confronto a tempo costante: con un confronto normale, il tempo di
  // risposta direbbe quanti caratteri del segreto sono giusti.
  return atteso.length === ricevuto.length && timingSafeEqual(atteso, ricevuto);
}

export default conGestioneErrori(async (req, res) => {
  if (!soloMetodi(req, res, ["GET"])) return;

  if (!process.env.CRON_SECRET) {
    return errore(res, 503, "CRON_SECRET non impostato: la lettura notturna è spenta.");
  }
  if (!autorizzata(req)) return errore(res, 401, "Non autorizzato.");

  const esiti = await sincronizzaTutte();
  res.setHeader("Cache-Control", "no-store");
  return json(res, {
    esiti: esiti.map(({ fonteId, nome, esito, riepilogo }) => ({ fonteId, nome, esito, riepilogo }))
  });
});
