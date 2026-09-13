/**
 * Permessi, elencati per capacità e non sparsi in mezzo agli endpoint.
 *
 * Con i ruoli scritti dentro ai controlli ("se è admin oppure editor…"),
 * aggiungere un ruolo significa rileggere tutto il codice. Qui si aggiunge
 * una riga a questa tabella.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { associazioniSquadra } from "../db/schema.js";

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
 * Può decidere sulle richieste di iscrizione a QUESTA squadra?
 *
 * Segreteria e amministratori decidono su tutte; un allenatore solo sulle
 * proprie. La logica è la stessa di puoGestireSquadra, ma le capacità sono
 * diverse: si può allenare una squadra senza poterne approvare gli
 * iscritti, e viceversa.
 */
export async function puoDecidereIscrizione(utente, squadraId) {
  if (!utente) return false;
  if (puo(utente, "iscrizioni.decidi_tutte")) return true;
  if (!puo(utente, "iscrizioni.decidi_proprie")) return false;

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
