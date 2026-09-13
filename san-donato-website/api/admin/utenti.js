/**
 * /api/admin/utenti — gestione degli account.
 *
 *   GET    elenco con ruolo e ultimo accesso
 *   POST   crea un account          { email, ruolo, nome?, cognome?, password? }
 *   PATCH  modifica                 { id, ruolo?, stato?, nome?, cognome?, password? }
 *
 * L'ultimo accesso era una richiesta esplicita: serve a capire chi usa
 * davvero il sito e chi ha un account fermo da mesi.
 *
 * Non esiste la cancellazione: un account si disattiva. Cancellarlo
 * lascerebbe senza autore le notizie che quella persona ha scritto.
 */

import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { utenti, associazioniSquadra, squadre } from "../../db/schema.js";
import { creaHashPassword } from "../../server/password.js";
import { richiedeCapacita } from "../../server/autenticazione.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../server/risposte.js";
import { leggiCorpo } from "../../server/richiesta.js";
import { z } from "zod";
import { valida } from "../../server/validazione.js";

const RUOLI = ["admin", "segreteria", "editor", "coach", "atleta"];
const STATI = ["in_attesa", "attivo", "sospeso"];

const schemaNuovo = z.object({
  email: z.string().trim().toLowerCase().email("Indirizzo email non valido.").max(255),
  ruolo: z.enum(RUOLI),
  nome: z.string().trim().max(80).optional(),
  cognome: z.string().trim().max(80).optional(),
  password: z.string().min(10, "La password deve avere almeno 10 caratteri.").max(200)
});

const schemaModifica = z.object({
  id: z.coerce.number().int().positive(),
  ruolo: z.enum(RUOLI).optional(),
  stato: z.enum(STATI).optional(),
  nome: z.string().trim().max(80).optional(),
  cognome: z.string().trim().max(80).optional(),
  password: z.string().min(10, "La password deve avere almeno 10 caratteri.").max(200).optional()
});

async function elenco(req, res) {
  const db = getDb();

  const persone = await db
    .select({
      id: utenti.id,
      email: utenti.email,
      nome: utenti.nome,
      cognome: utenti.cognome,
      ruolo: utenti.ruolo,
      stato: utenti.stato,
      deveCambiarePassword: utenti.deveCambiarePassword,
      ultimoAccesso: utenti.ultimoAccesso,
      creatoIl: utenti.creatoIl
    })
    .from(utenti)
    // Chi non è mai entrato va in fondo: è l'informazione che si cerca
    // quando si controlla se un account è stato consegnato davvero.
    //
    // L'ordinamento è scritto per intero in SQL invece di usare desc():
    // avvolgere con desc() un frammento che contiene già "nulls last"
    // produce "... nulls last desc", che Postgres rifiuta.
    .orderBy(sql`${utenti.ultimoAccesso} desc nulls last`, asc(utenti.cognome));

  const squadrePerUtente = await db
    .select({
      utenteId: associazioniSquadra.utenteId,
      squadraId: squadre.id,
      nome: squadre.nome
    })
    .from(associazioniSquadra)
    .innerJoin(squadre, eq(squadre.id, associazioniSquadra.squadraId));

  const perUtente = new Map();
  for (const s of squadrePerUtente) {
    if (!perUtente.has(s.utenteId)) perUtente.set(s.utenteId, []);
    perUtente.get(s.utenteId).push({ id: s.squadraId, nome: s.nome });
  }

  res.setHeader("Cache-Control", "no-store");
  return json(res, {
    utenti: persone.map((p) => ({
      ...p,
      nomeCompleto: [p.nome, p.cognome].filter(Boolean).join(" ") || p.email,
      squadre: perUtente.get(p.id) ?? []
    }))
  });
}

async function crea(req, res) {
  const dati = valida(schemaNuovo, await leggiCorpo(req));

  const db = getDb();
  const [esistente] = await db
    .select({ id: utenti.id })
    .from(utenti)
    .where(eq(utenti.email, dati.email))
    .limit(1);

  if (esistente) throw new ErroreHttp(409, "Esiste già un account con questa email.");

  const [creato] = await db.insert(utenti).values({
    email: dati.email,
    passwordHash: await creaHashPassword(dati.password),
    ruolo: dati.ruolo,
    nome: dati.nome ?? null,
    cognome: dati.cognome ?? null,

    // Creato da chi amministra: è già approvato, non deve aspettare nessuno
    stato: "attivo",

    // La password provvisoria la conosce chi l'ha creata, perché deve
    // consegnarla. Finché resta quella, chi amministra può entrare come
    // questa persona: il cambio al primo accesso chiude la finestra.
    deveCambiarePassword: true
  }).returning({ id: utenti.id, email: utenti.email, ruolo: utenti.ruolo });

  return json(res, { utente: creato }, 201);
}

async function modifica(req, res) {
  const dati = valida(schemaModifica, await leggiCorpo(req));

  // Togliersi da soli il ruolo di amministratore, o disattivarsi, lascia il
  // sito senza nessuno che possa rimediare. Meglio impedirlo.
  if (dati.id === req.utente.id) {
    if (dati.ruolo && dati.ruolo !== "admin") {
      throw new ErroreHttp(400, "Non puoi cambiare il tuo stesso ruolo.");
    }
    if (dati.stato && dati.stato !== "attivo") {
      throw new ErroreHttp(400, "Non puoi sospendere il tuo stesso account.");
    }
  }

  const modifiche = { aggiornatoIl: new Date() };
  if (dati.ruolo !== undefined) modifiche.ruolo = dati.ruolo;
  if (dati.stato !== undefined) modifiche.stato = dati.stato;
  if (dati.nome !== undefined) modifiche.nome = dati.nome;
  if (dati.cognome !== undefined) modifiche.cognome = dati.cognome;
  if (dati.password !== undefined) modifiche.passwordHash = await creaHashPassword(dati.password);

  const [aggiornato] = await getDb()
    .update(utenti)
    .set(modifiche)
    .where(eq(utenti.id, dati.id))
    .returning({ id: utenti.id, email: utenti.email, ruolo: utenti.ruolo, stato: utenti.stato });

  if (!aggiornato) throw new ErroreHttp(404, "Utente non trovato.");
  return json(res, { utente: aggiornato });
}

export default conGestioneErrori(
  richiedeCapacita("utenti.gestisci", async (req, res) => {
    if (req.method === "GET") return elenco(req, res);
    if (req.method === "POST") return crea(req, res);
    if (req.method === "PATCH") return modifica(req, res);

    res.setHeader("Allow", "GET, POST, PATCH");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
