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
import {
  utenti, associazioniSquadra, squadre, media, richiesteIscrizione
} from "../../db/schema.js";
import { urlFile } from "../../server/file.js";
import { creaHashPassword } from "../../server/password.js";
import { richiedeCapacita } from "../../server/autenticazione.js";
import { annota } from "../../server/registro.js";
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
  // Correggere un indirizzo sbagliato era impossibile: si vedeva e basta.
  // È anche il nome con cui si entra, quindi l'unicità va ricontrollata.
  email: z.string().trim().toLowerCase().email("Indirizzo email non valido.").max(255).optional(),
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
      creatoIl: utenti.creatoIl,
      immagineChiave: media.chiave,
      immagineUrlWp: media.urlOriginaleWp
    })
    .from(utenti)
    .leftJoin(media, eq(media.id, utenti.immagineId))
    // Chi non è mai entrato va in fondo: è l'informazione che si cerca
    // quando si controlla se un account è stato consegnato davvero.
    //
    // L'ordinamento è scritto per intero in SQL invece di usare desc():
    // avvolgere con desc() un frammento che contiene già "nulls last"
    // produce "... nulls last desc", che Postgres rifiuta.
    .orderBy(sql`${utenti.ultimoAccesso} desc nulls last`, asc(utenti.cognome));

  /*
   * Lo stato dell'ULTIMA richiesta di iscrizione, per ciascuno.
   *
   * Serve a distinguere due account che in tabella sono identici — stato
   * "in_attesa" tutti e due — ma che per chi guarda sono cose opposte:
   * uno aspetta una risposta, l'altro se l'è già sentita dire di no e non
   * ha modo di riprovare. Senza questa colonna, in elenco sono la stessa
   * riga e nessuno se ne accorge.
   *
   * La più recente e non tutte: chi è stato respinto una volta e poi
   * accolto deve risultare accolto.
   */
  const richieste = await db
    .select({
      utenteId: richiesteIscrizione.utenteId,
      id: richiesteIscrizione.id,
      stato: richiesteIscrizione.stato,
      sport: richiesteIscrizione.sport,
      motivoRifiuto: richiesteIscrizione.motivoRifiuto,
      decisaIl: richiesteIscrizione.decisaIl,
      richiestaIl: richiesteIscrizione.richiestaIl
    })
    .from(richiesteIscrizione)
    .orderBy(asc(richiesteIscrizione.richiestaIl), asc(richiesteIscrizione.id));

  // L'ultima vince: si scorre dalla più vecchia e si sovrascrive.
  const richiestaPerUtente = new Map();
  for (const r of richieste) richiestaPerUtente.set(r.utenteId, r);

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
    utenti: persone.map(({ immagineChiave, immagineUrlWp, ...p }) => ({
      ...p,
      nomeCompleto: [p.nome, p.cognome].filter(Boolean).join(" ") || p.email,
      // Solo l'indirizzo, non la chiave: come sia fatto l'archivio non
      // riguarda chi disegna un elenco.
      immagineUrl: urlFile(immagineChiave, immagineUrlWp),
      richiesta: richiestaPerUtente.get(p.id) ?? null,
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

  await annota(req.utente, {
    azione: "utenti.crea",
    tipo: "utente",
    id: creato.id,
    descrizione: `Ha creato l'account ${creato.email} come ${creato.ruolo}`
  });

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

  const db = getDb();

  const modifiche = { aggiornatoIl: new Date() };
  if (dati.ruolo !== undefined) modifiche.ruolo = dati.ruolo;
  if (dati.stato !== undefined) modifiche.stato = dati.stato;
  if (dati.nome !== undefined) modifiche.nome = dati.nome || null;
  if (dati.cognome !== undefined) modifiche.cognome = dati.cognome || null;

  if (dati.email !== undefined) {
    const [occupata] = await db
      .select({ id: utenti.id })
      .from(utenti)
      .where(eq(utenti.email, dati.email))
      .limit(1);

    // L'indirizzo che ha già lui non è "occupato": salvare senza cambiarlo
    // non deve diventare un errore.
    if (occupata && occupata.id !== dati.id) {
      throw new ErroreHttp(409, "Esiste già un account con questa email.");
    }
    modifiche.email = dati.email;
  }

  if (dati.password !== undefined) {
    modifiche.passwordHash = await creaHashPassword(dati.password);
    // Una password decisa da un amministratore la conosce anche lui: vale la
    // stessa regola della creazione, va cambiata al primo accesso.
    modifiche.deveCambiarePassword = true;
  }

  const [aggiornato] = await db
    .update(utenti)
    .set(modifiche)
    .where(eq(utenti.id, dati.id))
    .returning({ id: utenti.id, email: utenti.email, ruolo: utenti.ruolo, stato: utenti.stato });

  if (!aggiornato) throw new ErroreHttp(404, "Utente non trovato.");

  /* Cosa è cambiato, detto in italiano. La password non compare mai nel
     dettaglio, nemmeno per dire che è stata cambiata con quale valore. */
  const cosa = [];
  if (dati.ruolo !== undefined) cosa.push(`ruolo → ${dati.ruolo}`);
  if (dati.stato !== undefined) cosa.push(`stato → ${dati.stato}`);
  if (dati.email !== undefined) cosa.push(`email → ${dati.email}`);
  if (dati.nome !== undefined || dati.cognome !== undefined) cosa.push("nome");
  if (dati.password !== undefined) cosa.push("password reimpostata");

  await annota(req.utente, {
    azione: dati.password !== undefined ? "utenti.password" : "utenti.modifica",
    tipo: "utente",
    id: aggiornato.id,
    descrizione: `Ha modificato ${aggiornato.email}: ${cosa.join(", ") || "nulla"}`,
    dettaglio: { cambi: cosa }
  });

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
