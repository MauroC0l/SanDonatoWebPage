/**
 * /api/admin/squadre — le squadre e chi le gestisce.
 *
 *   GET     l'elenco, ognuna con i suoi gestori e quanti atleti ne fanno parte
 *   POST    crea una squadra            { nome, sport, colore?, ordine? }
 *   PUT     associa una persona         { utenteId, squadraId }
 *   DELETE  toglie l'associazione       ?utenteId=&squadraId=
 *
 * Le squadre erano l'unica cosa che nessuno poteva creare dal sito: sono
 * arrivate tutte da uno script di semina, e aggiungerne una richiedeva un
 * amministratore di database. Ora si fa da qui, che è dove uno va a cercarlo.
 *
 * La MODIFICA di una squadra sta nel file accanto, [id].js. Il metodo PUT su
 * questo indirizzo resta l'associazione delle persone, com'era: cambiarlo
 * avrebbe rotto il pannello senza guadagnarci nulla.
 */

import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../../db/client.js";
import {
  squadre, utenti, associazioniSquadra, richiesteIscrizione
} from "../../../../db/schema.js";
import { richiedeCapacita } from "../../../autenticazione.js";
import { annota } from "../../../registro.js";
import { creaSlug } from "../../../sanitizza.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../risposte.js";
import { leggiCorpo, parametri } from "../../../richiesta.js";
import { schemaAssociazione, SPORT_SQUADRA, valida } from "../../../validazione.js";

const schemaNuova = z.object({
  nome: z.string().trim().min(2, "Il nome è troppo corto.").max(80),
  sport: z.enum(SPORT_SQUADRA),
  // Esadecimale: è quello che escono dal selettore dei colori del browser
  colore: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Il colore va scritto come #1a2b3c.").optional(),
  ordine: z.coerce.number().int().min(0).max(999).optional()
});

async function elenco(req, res) {
  const db = getDb();

  const righe = await db
    .select({
      squadraId: squadre.id,
      nome: squadre.nome,
      slug: squadre.slug,
      sport: squadre.sport,
      colore: squadre.colore,
      ordine: squadre.ordine,
      attiva: squadre.attiva,
      utenteId: utenti.id,
      utenteEmail: utenti.email,
      utenteNome: utenti.nome,
      utenteCognome: utenti.cognome,
      utenteRuolo: utenti.ruolo,
      utenteUltimoAccesso: utenti.ultimoAccesso
    })
    .from(squadre)
    .leftJoin(associazioniSquadra, eq(associazioniSquadra.squadraId, squadre.id))
    .leftJoin(utenti, eq(utenti.id, associazioniSquadra.utenteId))
    .orderBy(asc(squadre.ordine), asc(utenti.cognome));

  /* Quanti atleti ne fanno parte, contati a parte.
     In join con l'elenco qui sopra il conteggio verrebbe moltiplicato per il
     numero di gestori, e una squadra con due allenatori risulterebbe con il
     doppio dei giocatori. */
  const conteggi = await db
    .select({
      squadraId: richiesteIscrizione.squadraId,
      quanti: sql`count(*)::int`
    })
    .from(richiesteIscrizione)
    .where(eq(richiesteIscrizione.stato, "approvata"))
    .groupBy(richiesteIscrizione.squadraId);

  const atletiPer = new Map(conteggi.map((c) => [c.squadraId, c.quanti]));

  // Una riga per associazione diventa una squadra con dentro le persone
  const perSquadra = new Map();

  for (const r of righe) {
    if (!perSquadra.has(r.squadraId)) {
      perSquadra.set(r.squadraId, {
        id: r.squadraId,
        nome: r.nome,
        slug: r.slug,
        sport: r.sport,
        colore: r.colore,
        ordine: r.ordine,
        attiva: r.attiva,
        atleti: atletiPer.get(r.squadraId) ?? 0,
        gestori: []
      });
    }

    if (r.utenteId) {
      perSquadra.get(r.squadraId).gestori.push({
        id: r.utenteId,
        email: r.utenteEmail,
        nomeCompleto: [r.utenteNome, r.utenteCognome].filter(Boolean).join(" ") || r.utenteEmail,
        ruolo: r.utenteRuolo,
        ultimoAccesso: r.utenteUltimoAccesso
      });
    }
  }

  res.setHeader("Cache-Control", "no-store");
  return json(res, { squadre: [...perSquadra.values()] });
}

async function crea(req, res) {
  const dati = valida(schemaNuova, await leggiCorpo(req));
  const db = getDb();

  /**
   * Lo slug si ricava dal nome, e deve restare unico.
   *
   * A differenza delle notizie non si aggiunge un numero in coda: due
   * squadre con lo stesso nome sono quasi sempre un doppione creato per
   * sbaglio, e "allievi-2" non aiuterebbe nessuno a distinguerle.
   */
  const slug = creaSlug(dati.nome);

  const [occupato] = await db
    .select({ id: squadre.id, nome: squadre.nome })
    .from(squadre)
    .where(eq(squadre.slug, slug))
    .limit(1);

  if (occupato) {
    throw new ErroreHttp(409, `Esiste già una squadra che si chiama "${occupato.nome}".`);
  }

  // In fondo all'elenco, se non è stato detto diversamente
  const [{ massimo }] = await db
    .select({ massimo: sql`coalesce(max(${squadre.ordine}), 0)::int` })
    .from(squadre);

  const [creata] = await db.insert(squadre).values({
    nome: dati.nome,
    slug,
    sport: dati.sport,
    colore: dati.colore ?? null,
    ordine: dati.ordine ?? massimo + 1,
    attiva: true
  }).returning({ id: squadre.id, nome: squadre.nome, slug: squadre.slug });

  await annota(req.utente, {
    azione: "squadre.crea",
    tipo: "squadra",
    id: creata.id,
    descrizione: `Ha creato la squadra "${creata.nome}" (${dati.sport})`
  });

  return json(res, { squadra: creata }, 201);
}

async function associa(req, res) {
  const { utenteId, squadraId } = valida(schemaAssociazione, await leggiCorpo(req));

  const db = getDb();

  const [utente] = await db
    .select({ id: utenti.id, ruolo: utenti.ruolo, nome: utenti.nome, cognome: utenti.cognome, email: utenti.email })
    .from(utenti)
    .where(eq(utenti.id, utenteId))
    .limit(1);

  if (!utente) throw new ErroreHttp(404, "Utente non trovato.");

  // Associare un atleta a una squadra non gli darebbe comunque alcun
  // permesso: meglio dirlo subito che lasciare credere il contrario.
  if (!["coach", "editor", "admin"].includes(utente.ruolo)) {
    throw new ErroreHttp(400, `Il ruolo "${utente.ruolo}" non gestisce eventi di squadra.`);
  }

  await db.insert(associazioniSquadra)
    .values({ utenteId, squadraId })
    .onConflictDoNothing();

  await annota(req.utente, {
    azione: "squadre.associa",
    tipo: "squadra",
    id: squadraId,
    descrizione: `Ha affidato una squadra a ${[utente.nome, utente.cognome].filter(Boolean).join(" ") || utente.email}`,
    dettaglio: { utenteId, squadraId }
  });

  return json(res, { associata: true, utenteId, squadraId }, 201);
}

async function dissocia(req, res) {
  const { utenteId, squadraId } = valida(schemaAssociazione, parametri(req));

  await getDb().delete(associazioniSquadra).where(and(
    eq(associazioniSquadra.utenteId, utenteId),
    eq(associazioniSquadra.squadraId, squadraId)
  ));

  await annota(req.utente, {
    azione: "squadre.dissocia",
    tipo: "squadra",
    id: squadraId,
    descrizione: "Ha tolto a qualcuno la gestione di una squadra",
    dettaglio: { utenteId, squadraId }
  });

  return json(res, { dissociata: true, utenteId, squadraId });
}

export default conGestioneErrori(
  richiedeCapacita("squadre.gestisci", async (req, res) => {
    if (req.method === "GET") return elenco(req, res);
    if (req.method === "POST") return crea(req, res);
    if (req.method === "PUT") return associa(req, res);
    if (req.method === "DELETE") return dissocia(req, res);

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
