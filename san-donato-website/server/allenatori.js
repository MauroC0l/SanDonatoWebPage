/**
 * Gli allenatori, come li vede chi tiene la cassa.
 *
 * Anche un allenatore è un iscritto e versa la sua quota, ma nell'elenco
 * "Atleti" non compare: quello nasce dalle richieste di iscrizione accolte,
 * e chi allena senza giocare non ne ha. La sua quota esisteva, ma per la
 * segreteria non c'era. Questo è il suo elenco: tutti gli allenatori e
 * solo loro, deciso dalla società il 27 settembre 2026.
 *
 * "Allenatore" qui è il RUOLO dell'account, non una capacità: la domanda è
 * chi deve la quota degli allenatori, e la risposta è chi ha quel ruolo.
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  utenti, squadre, associazioniSquadra, richiesteIscrizione, media
} from "../db/schema.js";
import { urlFile } from "./file.js";
import { quotePerUtenti } from "./stagioni.js";

export async function elencaAllenatori(stagione = null) {
  const db = getDb();

  const persone = await db
    .select({
      utenteId: utenti.id,
      email: utenti.email,
      nome: utenti.nome,
      cognome: utenti.cognome,
      stato: utenti.stato,
      ultimoAccesso: utenti.ultimoAccesso,
      immagineChiave: media.chiave,
      immagineUrlWp: media.urlOriginaleWp
    })
    .from(utenti)
    .leftJoin(media, eq(media.id, utenti.immagineId))
    .where(eq(utenti.ruolo, "coach"))
    .orderBy(asc(utenti.cognome), asc(utenti.nome), asc(utenti.id));

  if (persone.length === 0) return [];
  const ids = persone.map((p) => p.utenteId);

  const [allenate, giocate, quote] = await Promise.all([
    // Le squadre che allena
    db.select({ utenteId: associazioniSquadra.utenteId, id: squadre.id, nome: squadre.nome, colore: squadre.colore })
      .from(associazioniSquadra)
      .innerJoin(squadre, eq(squadre.id, associazioniSquadra.squadraId))
      .where(inArray(associazioniSquadra.utenteId, ids))
      .orderBy(asc(squadre.ordine)),
    // Le squadre in cui gioca: un allenatore di prima squadra può anche giocare
    db.select({ utenteId: richiesteIscrizione.utenteId, nome: squadre.nome })
      .from(richiesteIscrizione)
      .innerJoin(squadre, eq(squadre.id, richiesteIscrizione.squadraId))
      .where(and(inArray(richiesteIscrizione.utenteId, ids), eq(richiesteIscrizione.stato, "approvata"))),
    // Quota e versato della stagione chiesta (quella in corso se nessuna)
    quotePerUtenti(ids, stagione)
  ]);

  const raggruppa = (righe) => {
    const m = new Map();
    for (const r of righe) {
      if (!m.has(r.utenteId)) m.set(r.utenteId, []);
      m.get(r.utenteId).push(r);
    }
    return m;
  };
  const allenatePer = raggruppa(allenate);
  const giocatePer = raggruppa(giocate);

  return persone.map((p) => {
    const q = quote.get(p.utenteId);
    return {
      utenteId: p.utenteId,
      email: p.email,
      nomeCompleto: [p.nome, p.cognome].filter(Boolean).join(" ") || p.email,
      stato: p.stato,
      ultimoAccesso: p.ultimoAccesso,
      immagineUrl: urlFile(p.immagineChiave, p.immagineUrlWp),
      allena: (allenatePer.get(p.utenteId) ?? []).map(({ id, nome, colore }) => ({ id, nome, colore })),
      gioca: (giocatePer.get(p.utenteId) ?? []).map((g) => g.nome),
      quotaCentesimi: q?.quotaCentesimi ?? null,
      tipoQuota: q?.tipoQuota ?? null,
      versatoCentesimi: q?.versatoCentesimi ?? 0,
      dovutoCentesimi: q?.dovutoCentesimi ?? null
    };
  });
}

/** Solo per sapere se un utente è un allenatore, prima di assegnargli la quota. */
export async function eAllenatore(utenteId) {
  const [r] = await getDb().select({ ruolo: utenti.ruolo }).from(utenti)
    .where(eq(utenti.id, Number(utenteId))).limit(1);
  return r?.ruolo === "coach";
}

