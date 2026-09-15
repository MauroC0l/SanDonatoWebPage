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
    "iscrizioni.decidi_tutte",
    "atleti.leggi",
    "quote.gestisci",

    /* Decidere le tariffe è un'altra cosa dall'applicarle: quanto si paga
       è una delibera del consiglio, dire chi paga quanto è amministrazione
       quotidiana. La segreteria fa la seconda, non la prima. */
    "quote.tariffe",

    "certificato.registra",
    // Il registro dice chi ha fatto cosa su tutto il sito: è uno strumento
    // di controllo, e chi controlla è chi amministra.
    "registro.leggi"
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
    "media.carica",
    // Il mestiere della segreteria: sapere di ogni atleta se ha pagato,
    // quanto, e se il certificato medico è valido. Su tutte le squadre,
    // perché è l'unica a vedere la società per intero.
    "atleti.leggi",
    "quote.gestisci",

    /**
     * L eccezione alla regola "chi vede i dati non li modifica".
     *
     * Il certificato medico arriva spesso su carta, consegnato a mano in
     * sede: chiedere a quella persona di tornare a casa, fotografarlo e
     * caricarlo da sola significherebbe che quel certificato non entra mai
     * nel sito. La segreteria puo caricare la copia e scrivere tipo e
     * scadenza, che sono gli unici dati leggibili sul foglio stesso.
     *
     * Anagrafica, recapiti e note restano dell atleta anche qui.
     */
    "certificato.registra"
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
    "iscrizioni.decidi_proprie",
    // Legge la scheda dei propri atleti ma non la scrive: quote e certificati
    // li registra la segreteria. All'allenatore serve saperlo, non deciderlo.
    "atleti.leggi"
  ],
  /**
   * Un atleta non amministra niente. L'unica cosa che può fare è caricare i
   * propri documenti — il certificato medico — dalla pagina dell'iscrizione.
   *
   * "media.carica" è più larga di così: apre il caricamento di qualunque
   * file. Il rischio però è contenuto, perché il permesso di scrittura che
   * l'archivio rilascia vale per un file solo, di un tipo ammesso e sotto i
   * 25 MB, e ogni riga porta scritto chi l'ha caricata. Il guadagno è che il
   * certificato lo consegna direttamente chi ce l'ha in mano, invece di
   * passare dalla segreteria che lo riceve via email.
   */
  atleta: [
    "media.carica"
    // La libreria dei file non la vede: quella sfoglia il materiale di
    // tutti, e si apre a chi scrive le notizie. Un atleta carica il
    // proprio certificato e basta.
  ]
};

/**
 * Se è un amministratore.
 *
 * Il ruolo e non una capacità, perché qui la domanda è proprio quella:
 * ci sono cose — il mucchio di file ereditati dal vecchio sito — che si
 * mostrano a chi tiene in ordine la casa e a nessun altro. Inventare una
 * capacità "vedi le cartelle riservate" per un caso solo vorrebbe dire
 * una riga in più da tenere allineata a ogni ruolo nuovo.
 */
export function eAmministratore(utente) {
  return utente?.ruolo === "admin";
}

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
 * Gli id delle squadre di cui questa persona può vedere gli atleti, null se
 * tutte, elenco vuoto se nessuna.
 *
 * Non si può riusare squadreGestibili(): quella parte da "eventi.gestisci_tutte"
 * e la segreteria non ce l'ha, quindi le risponderebbe con le sue associazioni,
 * che sono zero. La segreteria deve vedere tutti gli atleti pur non gestendo
 * nessuna squadra — è esattamente il caso che il suo ruolo esiste per coprire.
 */
export async function squadreConAtletiVisibili(utente) {
  if (puo(utente, "quote.gestisci")) return null;
  if (!puo(utente, "atleti.leggi")) return [];

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
