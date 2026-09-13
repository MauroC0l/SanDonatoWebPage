/**
 * /api/admin/squadre — squadre e persone che le gestiscono.
 *
 *   GET     l'elenco delle squadre, ognuna con chi la gestisce
 *   POST    associa una persona a una squadra  { utenteId, squadraId }
 *   DELETE  toglie l'associazione              ?utenteId=&squadraId=
 *
 * L'associazione vale per coach ed editor: è la tabella che decide di quali
 * squadre una persona può gestire gli eventi.
 */

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { squadre, utenti, associazioniSquadra } from "../../db/schema.js";
import { richiedeCapacita } from "../../server/autenticazione.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../server/risposte.js";
import { leggiCorpo, parametri } from "../../server/richiesta.js";
import { schemaAssociazione, valida } from "../../server/validazione.js";

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
        gestori: []
      });
    }

    if (r.utenteId) {
      perSquadra.get(r.squadraId).gestori.push({
        id: r.utenteId,
        email: r.utenteEmail,
        nome: [r.utenteNome, r.utenteCognome].filter(Boolean).join(" ") || r.utenteEmail,
        ruolo: r.utenteRuolo,
        ultimoAccesso: r.utenteUltimoAccesso
      });
    }
  }

  res.setHeader("Cache-Control", "no-store");
  return json(res, { squadre: [...perSquadra.values()] });
}

async function associa(req, res) {
  const { utenteId, squadraId } = valida(schemaAssociazione, await leggiCorpo(req));

  const db = getDb();

  const [utente] = await db
    .select({ id: utenti.id, ruolo: utenti.ruolo })
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

  return json(res, { associata: true, utenteId, squadraId }, 201);
}

async function dissocia(req, res) {
  const { utenteId, squadraId } = valida(schemaAssociazione, parametri(req));

  await getDb().delete(associazioniSquadra).where(and(
    eq(associazioniSquadra.utenteId, utenteId),
    eq(associazioniSquadra.squadraId, squadraId)
  ));

  return json(res, { dissociata: true, utenteId, squadraId });
}

export default conGestioneErrori(
  richiedeCapacita("squadre.gestisci", async (req, res) => {
    if (req.method === "GET") return elenco(req, res);
    if (req.method === "POST") return associa(req, res);
    if (req.method === "DELETE") return dissocia(req, res);

    res.setHeader("Allow", "GET, POST, DELETE");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
