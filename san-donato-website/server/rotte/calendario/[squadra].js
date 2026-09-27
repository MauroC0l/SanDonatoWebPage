/**
 * GET /api/calendario/:squadra.ics — il calendario di una squadra da
 * abbonare con Google Calendar, Apple Calendario o Outlook.
 *
 * Pubblico come il calendario del sito, e con gli stessi filtri: niente
 * eventi ancora programmati, niente partite tolte dal calendario ufficiale.
 * Una partita che sparisce da qui sparisce anche dal telefono alla lettura
 * successiva.
 *
 * L'indirizzo usa l'identificativo della squadra e non il suo nome: il nome
 * cambia quando la squadra si rinomina, e con lui cambierebbe l'indirizzo —
 * rompendo in silenzio l'abbonamento di ogni famiglia che l'aveva aggiunto.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../../../db/client.js";
import { squadre } from "../../../db/schema.js";
import { elencaEventi } from "../../eventi.js";
import { calendarioIcs } from "../../ical.js";
import { errore, conGestioneErrori, soloMetodi } from "../../risposte.js";
import { parametri } from "../../richiesta.js";

// Un anno indietro basta a ritrovare la stagione in corso; avanti, tutto
const GIORNI_INDIETRO = 365;

export default conGestioneErrori(async (req, res) => {
  if (!soloMetodi(req, res, ["GET", "HEAD"])) return;

  // "14.ics" oppure "14": l'estensione aiuta i programmi di calendario a
  // riconoscere il file, ma non è obbligatoria
  const id = Number(String(parametri(req).squadra ?? "").replace(/\.ics$/i, ""));
  if (!Number.isInteger(id) || id <= 0) return errore(res, 404, "Calendario non trovato.");

  const [squadra] = await getDb()
    .select({ id: squadre.id, nome: squadre.nome })
    .from(squadre)
    .where(eq(squadre.id, id))
    .limit(1);

  if (!squadra) return errore(res, 404, "Calendario non trovato.");

  const eventi = await elencaEventi({
    squadraId: id,
    da: new Date(Date.now() - GIORNI_INDIETRO * 86_400_000),
    limite: 1000,
    soloVisibili: true
  });

  res.status(200);
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `inline; filename="psd-squadra-${id}.ics"`);
  // I calendari rileggono ogni poche ore: un quarto d'ora di cache davanti
  // al database non si vede, e risparmia il grosso delle richieste.
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
  return res.end(req.method === "HEAD" ? undefined : calendarioIcs(squadra, eventi));
});
