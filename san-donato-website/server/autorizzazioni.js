/**
 * Permessi, elencati per capacità e non sparsi in mezzo agli endpoint.
 *
 * Con i ruoli scritti dentro ai controlli ("se è admin oppure editor…"),
 * aggiungere un ruolo significa rileggere tutto il codice. Qui si aggiunge
 * una riga a questa tabella.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { associazioniSquadra, squadre } from "../db/schema.js";

const CAPACITA = {
  admin: [
    "notizie.leggi_bozze",
    "notizie.scrivi",
    "notizie.pubblica",
    "notizie.cestina",
    "media.carica",
    "eventi.gestisci_tutte",
    "squadre.gestisci",
    "utenti.gestisci",
    "iscritti.leggi",
    "iscrizioni.decidi_tutte"
  ],

  /**
   * Segreteria: vede tutti gli iscritti e i loro dati, e decide sulle
   * richieste di iscrizione.
   *
   * Non gestisce notizie né eventi: è un ruolo amministrativo, non
   * redazionale. E non ha "utenti.gestisci", che comprende il cambio di
   * ruolo altrui: promuovere qualcuno ad amministratore resta una cosa che
   * fa un amministratore.
   */
  segreteria: [
    "iscritti.leggi",
    "iscrizioni.decidi_tutte",
    "media.carica"
  ],
  editor: [
    "notizie.leggi_bozze",
    "notizie.scrivi",
    "notizie.pubblica",
    "notizie.cestina",
    "media.carica",
    // Solo per le squadre a cui è associato: la capacità apre la porta,
    // poi puoGestireSquadra() decide quale stanza.
    "eventi.gestisci_proprie"
  ],
  coach: [
    "media.carica",
    "eventi.gestisci_proprie",
    // Solo per le proprie squadre: chi allena una squadra sa chi ne fa
    // parte, ed è la persona giusta per dire di sì a chi chiede di entrarci.
    "iscrizioni.decidi_proprie"
  ],
  atleta: []
};

export function puo(utente, capacita) {
  if (!utente?.ruolo) return false;
  return (CAPACITA[utente.ruolo] ?? []).includes(capacita);
}

/** Tutte le capacità di un ruolo: il front-end le usa per mostrare o meno i pulsanti. */
export function capacitaDi(ruolo) {
  return CAPACITA[ruolo] ?? [];
}

/**
 * Può gestire gli eventi di QUESTA squadra?
 *
 * Serve una domanda al database perché il permesso non dipende solo dal
 * ruolo: un coach comanda sulle proprie squadre e su nessun'altra. Con il
 * solo controllo di capacità, un allenatore potrebbe modificare gli eventi
 * di tutte e venti.
 */
export async function puoGestireSquadra(utente, squadraId) {
  if (!utente) return false;
  if (puo(utente, "eventi.gestisci_tutte")) return true;
  if (!puo(utente, "eventi.gestisci_proprie")) return false;

  const righe = await getDb()
    .select({ id: associazioniSquadra.id })
    .from(associazioniSquadra)
    .where(and(
      eq(associazioniSquadra.utenteId, utente.id),
      eq(associazioniSquadra.squadraId, Number(squadraId))
    ))
    .limit(1);

  return righe.length > 0;
}

/** Gli id delle squadre che questa persona può gestire, o null se tutte. */
export async function squadreGestibili(utente) {
  if (puo(utente, "eventi.gestisci_tutte")) return null;

  const righe = await getDb()
    .select({ squadraId: associazioniSquadra.squadraId })
    .from(associazioniSquadra)
    .where(eq(associazioniSquadra.utenteId, utente.id));

  return righe.map((r) => r.squadraId);
}

/**
 * Gli sport delle squadre che questa persona gestisce, o null se le
 * gestisce tutte.
 *
 * Serve per le richieste di iscrizione: chi si registra sceglie lo sport,
 * non la squadra, quindi una richiesta appena arrivata NON ha una squadra
 * su cui filtrare. Un allenatore di Calcio Allievi vede le richieste di
 * chi ha chiesto "Calcio" e poi decide in quale squadra metterlo.
 */
export async function sportGestibili(utente) {
  if (puo(utente, "iscrizioni.decidi_tutte")) return null;
  if (!puo(utente, "iscrizioni.decidi_proprie")) return [];

  const righe = await getDb()
    .select({ sport: squadre.sport })
    .from(associazioniSquadra)
    .innerJoin(squadre, eq(squadre.id, associazioniSquadra.squadraId))
    .where(eq(associazioniSquadra.utenteId, utente.id));

  return [...new Set(righe.map((r) => r.sport))];
}

/**
 * Può decidere su una richiesta di questo sport?
 *
 * Segreteria e amministratori su tutte; un allenatore solo sugli sport
 * che allena. La squadra vera la sceglie al momento della decisione, e
 * che sia una delle sue lo verifica puoGestireSquadra.
 */
export async function puoDecidereSport(utente, sport) {
  if (!utente) return false;
  if (puo(utente, "iscrizioni.decidi_tutte")) return true;

  const sportSuoi = await sportGestibili(utente);
  return Array.isArray(sportSuoi) && sportSuoi.includes(sport);
}
