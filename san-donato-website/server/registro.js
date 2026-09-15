/**
 * Registro delle attività: chi ha fatto cosa.
 *
 * Si usa così, in coda all'operazione riuscita:
 *
 *   await annota(req.utente, {
 *     azione: "notizie.cestina",
 *     tipo: "notizia", id: notizia.id,
 *     descrizione: `Ha cestinato "${titolo}"`
 *   });
 *
 * REGOLA IMPORTANTE: annotare non può far fallire ciò che si stava facendo.
 * Se il registro va in errore — tabella piena, connessione persa, una colonna
 * che non c'è — l'articolo è già stato pubblicato e la quota già registrata:
 * rispondere 500 a quel punto racconterebbe una bugia a chi ha premuto il
 * pulsante, e lo farebbe riprovare duplicando l'operazione. L'errore finisce
 * nei log del server, dove lo vede chi mantiene il sito, e basta.
 */

import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { registroAttivita, utenti } from "../db/schema.js";

/**
 * Scrive una riga nel registro. Non lancia mai.
 *
 * @param utente  chi ha agito (req.utente), oppure null per le azioni
 *                che avvengono senza sessione, come la registrazione
 */
export async function annota(utente, { azione, tipo = null, id = null, descrizione = null, dettaglio = null }) {
  try {
    const autore = utente
      ? ([utente.nome, utente.cognome].filter(Boolean).join(" ") || utente.email)
      : null;

    await getDb().insert(registroAttivita).values({
      utenteId: utente?.id ?? null,
      autore,
      azione,
      oggettoTipo: tipo,
      oggettoId: id ?? null,
      descrizione,
      dettaglio
    });
  } catch (e) {
    console.error("Registro non scritto:", azione, e.message);
  }
}

/**
 * Le righe del registro, dalla più recente.
 *
 * Paginato sempre: dopo un anno di attività sono decine di migliaia di righe,
 * e l'unica domanda che si fa davvero è "cos'è successo di recente".
 */
export async function elencaAttivita({
  pagina = 1,
  perPagina = 40,
  utenteId = null,
  tipo = null,
  cerca = null,
  da = null,
  a = null
} = {}) {
  const db = getDb();
  const condizioni = [];

  if (utenteId) condizioni.push(eq(registroAttivita.utenteId, Number(utenteId)));
  if (tipo) condizioni.push(eq(registroAttivita.oggettoTipo, tipo));

  /* L intervallo di date. Il secondo estremo arriva come giorno e va portato
     a fine giornata: "fino al 14" vuol dire compreso il 14, non fino alla
     sua mezzanotte, che escluderebbe tutto quello che e successo quel giorno. */
  if (da) condizioni.push(gte(registroAttivita.quando, new Date(da)));
  if (a) {
    const fine = new Date(a);
    fine.setHours(23, 59, 59, 999);
    condizioni.push(lte(registroAttivita.quando, fine));
  }

  if (cerca) {
    const modello = `%${cerca}%`;
    condizioni.push(or(
      ilike(registroAttivita.descrizione, modello),
      ilike(registroAttivita.autore, modello),
      ilike(registroAttivita.azione, modello)
    ));
  }

  const dove = condizioni.length ? and(...condizioni) : undefined;

  const [{ totale }] = await db
    .select({ totale: sql`count(*)::int` })
    .from(registroAttivita)
    .where(dove);

  const righe = await db
    .select({
      id: registroAttivita.id,
      utenteId: registroAttivita.utenteId,
      autore: registroAttivita.autore,
      azione: registroAttivita.azione,
      oggettoTipo: registroAttivita.oggettoTipo,
      oggettoId: registroAttivita.oggettoId,
      descrizione: registroAttivita.descrizione,
      dettaglio: registroAttivita.dettaglio,
      quando: registroAttivita.quando,
      // L'email attuale di chi ha agito, quando l'account esiste ancora:
      // serve a riconoscere due omonimi.
      email: utenti.email
    })
    .from(registroAttivita)
    .leftJoin(utenti, eq(utenti.id, registroAttivita.utenteId))
    .where(dove)
    .orderBy(desc(registroAttivita.quando), desc(registroAttivita.id))
    .limit(perPagina)
    .offset((pagina - 1) * perPagina);

  return {
    attivita: righe,
    totale,
    pagina,
    perPagina,
    pagine: Math.max(1, Math.ceil(totale / perPagina))
  };
}

/** Chi compare nel registro, per il filtro per persona. */
export async function autoriDelRegistro() {
  const righe = await getDb()
    .selectDistinct({
      utenteId: registroAttivita.utenteId,
      autore: registroAttivita.autore
    })
    .from(registroAttivita)
    .where(sql`${registroAttivita.utenteId} is not null`)
    .orderBy(registroAttivita.autore);

  // Lo stesso account può comparire con nomi diversi, se nel frattempo è
  // stato rinominato: qui si tiene il più recente per ciascuno.
  const perUtente = new Map();
  for (const r of righe) perUtente.set(r.utenteId, r.autore);

  return [...perUtente].map(([id, nome]) => ({ id, nome }));
}
