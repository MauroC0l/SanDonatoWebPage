/**
 * Lettura di squadre ed eventi.
 *
 * Come per le notizie, le interrogazioni stanno qui e non dentro agli
 * endpoint: il sito pubblico e il pannello devono vedere la stessa forma.
 */

import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { eventi, squadre, media, mediaEvento } from "../db/schema.js";
import { urlFile } from "./notizie.js";

/* =====================================================
   Squadre
   ===================================================== */

export async function elencaSquadre({ soloAttive = true } = {}) {
  const db = getDb();

  const righe = await db
    .select({
      id: squadre.id,
      nome: squadre.nome,
      slug: squadre.slug,
      sport: squadre.sport,
      colore: squadre.colore,
      cssVar: squadre.cssVar,
      ordine: squadre.ordine,
      attiva: squadre.attiva
    })
    .from(squadre)
    .where(soloAttive ? eq(squadre.attiva, true) : undefined)
    .orderBy(asc(squadre.ordine));

  return righe;
}

/* =====================================================
   Eventi
   ===================================================== */

const COLONNE = {
  id: eventi.id,
  squadraId: eventi.squadraId,
  tipo: eventi.tipo,
  titolo: eventi.titolo,
  avversario: eventi.avversario,
  inizio: eventi.inizio,
  fine: eventi.fine,
  tuttoIlGiorno: eventi.tuttoIlGiorno,
  luogo: eventi.luogo,
  descrizione: eventi.descrizione,
  risultato: eventi.risultato,
  parziali: eventi.parziali,
  marcatori: eventi.marcatori,
  diretta: eventi.diretta,
  squadraNome: squadre.nome,
  squadraColore: squadre.colore,
  squadraCssVar: squadre.cssVar,
  squadraSport: squadre.sport
};

function daRiga(riga) {
  return {
    id: riga.id,
    squadraId: riga.squadraId,
    squadra: riga.squadraNome,
    colore: riga.squadraColore,
    cssVar: riga.squadraCssVar,
    sport: riga.squadraSport,
    tipo: riga.tipo,
    titolo: riga.titolo,
    avversario: riga.avversario,
    inizio: riga.inizio,
    fine: riga.fine,
    tuttoIlGiorno: riga.tuttoIlGiorno,
    luogo: riga.luogo ?? "",
    descrizione: riga.descrizione ?? "",
    // Erano righe di testo dentro alla descrizione dell'evento Google:
    // "Partita: 3 - 1", "Marcatori: Rossi, Bianchi". Ora sono campi.
    risultato: riga.risultato,
    parziali: riga.parziali,
    marcatori: riga.marcatori ?? [],
    diretta: riga.diretta
  };
}

function base(db) {
  return db
    .select(COLONNE)
    .from(eventi)
    .innerJoin(squadre, eq(squadre.id, eventi.squadraId));
}

/**
 * Gli eventi in un intervallo di date.
 *
 * `squadreAmmesse` limita il risultato a certe squadre: il pannello di un
 * coach lo usa per mostrargli solo le proprie. Con null si vedono tutte.
 */
export async function elencaEventi({
  da = null,
  a = null,
  squadraId = null,
  squadreAmmesse = null,
  limite = 500,
  ordine = "asc"
} = {}) {
  const db = getDb();
  const condizioni = [];

  if (da) condizioni.push(gte(eventi.inizio, new Date(da)));
  if (a) condizioni.push(lte(eventi.inizio, new Date(a)));
  if (squadraId) condizioni.push(eq(eventi.squadraId, Number(squadraId)));

  if (Array.isArray(squadreAmmesse)) {
    // Nessuna squadra associata significa nessun evento, non tutti:
    // inArray con un elenco vuoto genererebbe una condizione sempre falsa
    // su alcuni database e sempre vera su altri, quindi si taglia corto.
    if (squadreAmmesse.length === 0) return [];
    condizioni.push(inArray(eventi.squadraId, squadreAmmesse));
  }

  const righe = await base(db)
    .where(condizioni.length ? and(...condizioni) : undefined)
    .orderBy(ordine === "desc" ? desc(eventi.inizio) : asc(eventi.inizio))
    .limit(limite);

  return righe.map(daRiga);
}

export async function trovaEvento(id) {
  const righe = await base(getDb()).where(eq(eventi.id, Number(id))).limit(1);
  if (!righe[0]) return null;

  const evento = daRiga(righe[0]);
  evento.media = await mediaDiEvento(id);
  return evento;
}

/** Foto e video collegati a un evento. */
export async function mediaDiEvento(eventoId) {
  const righe = await getDb()
    .select({
      id: media.id,
      chiave: media.chiave,
      urlWp: media.urlOriginaleWp,
      mime: media.mime,
      alt: media.alt,
      larghezza: media.larghezza,
      altezza: media.altezza,
      ordine: mediaEvento.ordine
    })
    .from(mediaEvento)
    .innerJoin(media, eq(media.id, mediaEvento.mediaId))
    .where(eq(mediaEvento.eventoId, Number(eventoId)))
    .orderBy(asc(mediaEvento.ordine), asc(media.id));

  return righe.map((r) => ({
    id: r.id,
    url: urlFile(r.chiave, r.urlWp),
    mime: r.mime,
    alt: r.alt ?? "",
    larghezza: r.larghezza,
    altezza: r.altezza
  }));
}

/**
 * I risultati già disputati, per la sezione dei risultati della settimana.
 * Solo eventi passati che hanno un risultato: un incontro senza punteggio
 * non è un risultato, è una partita di cui nessuno ha aggiornato l'esito.
 */
export async function ultimiRisultati(quanti = 12) {
  const righe = await base(getDb())
    .where(and(
      lte(eventi.inizio, new Date()),
      sql`${eventi.risultato} is not null and ${eventi.risultato} <> ''`
    ))
    .orderBy(desc(eventi.inizio))
    .limit(quanti);

  return righe.map(daRiga);
}
