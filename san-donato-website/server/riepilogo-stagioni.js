/**
 * I numeri di ogni stagione, per il pannello "Stagioni".
 *
 * Tutto si calcola da quello che le stagioni hanno scritto: iscrizioni,
 * squadre di allora, quote e versamenti di quella stagione. Nessun numero
 * dipende da come sono le squadre oggi, così il riepilogo del 2026/27 si
 * legge uguale anche nel 2030.
 *
 * Si calcola in memoria e non con una sola interrogazione: sono poche
 * centinaia di righe per stagione, e le regole del conto (le due metà, il
 * ritiro prima di gennaio) stanno già in contoStagione — riscriverle in
 * SQL vorrebbe dire due posti da tenere d'accordo.
 */

import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { iscrizioniStagione, pagamenti, utenti } from "../db/schema.js";
import { contoStagione, elencaStagioni, stagioneDi } from "./stagioni.js";

export async function riepilogoStagioni() {
  const db = getDb();
  const elenco = await elencaStagioni();

  const [iscrizioni, versati] = await Promise.all([
    db.select({
      utenteId: iscrizioniStagione.utenteId,
      stagioneId: iscrizioniStagione.stagioneId,
      quotaCentesimi: iscrizioniStagione.quotaCentesimi,
      stato: iscrizioniStagione.stato,
      ritiratoIl: iscrizioniStagione.ritiratoIl,
      squadre: iscrizioniStagione.squadre,
      ruolo: utenti.ruolo
    })
      .from(iscrizioniStagione)
      .innerJoin(utenti, eq(utenti.id, iscrizioniStagione.utenteId)),
    db.select({
      utenteId: pagamenti.utenteId,
      stagioneId: pagamenti.stagioneId,
      versato: sql`coalesce(sum(${pagamenti.importoCentesimi}), 0)::int`
    })
      .from(pagamenti)
      .groupBy(pagamenti.utenteId, pagamenti.stagioneId)
  ]);

  const versatoDi = new Map(versati.map((v) => [`${v.utenteId}:${v.stagioneId}`, v.versato]));

  // Chi c'era in quale stagione, per distinguere le prime iscrizioni dai rinnovi
  const nomePerId = new Map(elenco.map((s) => [s.id, s.nome]));
  const presenze = new Set(iscrizioni.map((i) => `${i.utenteId}:${nomePerId.get(i.stagioneId)}`));

  return elenco.map((s) => {
    const sue = iscrizioni.filter((i) => i.stagioneId === s.id);
    const precedente = stagioneDi(`${Number(s.inizio.slice(0, 4)) - 1}-09-01`).nome;

    const atleti = sue.filter((i) => Array.isArray(i.squadre) && i.squadre.length > 0);
    const allenatori = sue.filter((i) => i.ruolo === "coach");

    let dovuto = 0;
    let versato = 0;
    let residuo = 0;
    let saldate = 0;
    let senzaQuota = 0;

    for (const i of sue) {
      const v = versatoDi.get(`${i.utenteId}:${s.id}`) ?? 0;
      const conto = contoStagione(i, v, s);
      versato += v;
      if (conto.dovuto == null) {
        if (i.stato !== "ritirata") senzaQuota += 1;
        continue;
      }
      dovuto += conto.dovuto;
      if (conto.residuo > 0) residuo += conto.residuo;
      else saldate += 1;
    }

    /* Per sport: chi gioca in due sport conta in tutti e due, ed è giusto
       così — la domanda è "quanti ragazzi fanno volley", non una somma. */
    const perSport = {};
    for (const i of atleti) {
      for (const sport of new Set(i.squadre.map((q) => q.sport).filter(Boolean))) {
        perSport[sport] = (perSport[sport] ?? 0) + 1;
      }
    }

    const rinnovi = atleti.filter((i) => presenze.has(`${i.utenteId}:${precedente}`)).length;

    return {
      ...s,
      atleti: atleti.length,
      allenatori: allenatori.length,
      ritirati: sue.filter((i) => i.stato === "ritirata").length,
      primeIscrizioni: atleti.length - rinnovi,
      rinnovi,
      perSport: Object.entries(perSport)
        .map(([sport, quanti]) => ({ sport, quanti }))
        .sort((a, b) => b.quanti - a.quanti),
      quote: { dovuto, versato, residuo, saldate, senzaQuota }
    };
  });
}
