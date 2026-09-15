/**
 * POST /api/registrazione — un atleta si registra da solo.
 *
 * È l'unico punto del sito dove nasce un account senza che un
 * amministratore lo crei. Perciò:
 *
 *   - il ruolo è sempre "atleta", non si sceglie dalla richiesta
 *   - vale lo stesso freno dell'accesso, per non lasciare aperta una porta
 *     da cui si possono creare mille account in un minuto
 *
 * Si sceglie lo SPORT, non la squadra: quale sia la propria squadra non lo
 * decide chi si iscrive, lo decide chi la compone. L'account resta in
 * attesa finché l'allenatore o la segreteria non lo assegnano a una
 * squadra vera; quell'assegnazione è ciò che lo sblocca.
 *
 * La sessione viene aperta subito: chi si registra atterra sulla schermata
 * che gli spiega che deve aspettare, invece di ritrovarsi al modulo di
 * accesso senza capire se la registrazione sia andata a buon fine.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { utenti, richiesteIscrizione } from "../../db/schema.js";
import { creaHashPassword } from "../password.js";
import { creaSessione } from "../sessioni.js";
import { capacitaDi } from "../autorizzazioni.js";
import { json, errore, conGestioneErrori, soloMetodi } from "../risposte.js";
import { leggiCorpo, indirizzoChiamante } from "../richiesta.js";
import { schemaRegistrazione, valida } from "../validazione.js";
import { verificaFreno, registraFallimento } from "../freno.js";

export default conGestioneErrori(async (req, res) => {
  if (!soloMetodi(req, res, ["POST"])) return;

  const dati = valida(schemaRegistrazione, await leggiCorpo(req));
  const chiave = [`registrazione:${indirizzoChiamante(req)}`];

  await verificaFreno(chiave);

  const db = getDb();

  const [esistente] = await db
    .select({ id: utenti.id })
    .from(utenti)
    .where(eq(utenti.email, dati.email))
    .limit(1);

  if (esistente) {
    // Ogni tentativo su un'email già registrata conta come fallimento: senza
    // questo, il modulo diventerebbe un modo per scoprire chi è iscritto
    // provando indirizzi a raffica.
    await registraFallimento(chiave);
    return errore(res, 409, "Esiste già un account con questa email.");
  }

  const [utente] = await db.insert(utenti).values({
    email: dati.email,
    passwordHash: await creaHashPassword(dati.password),
    ruolo: "atleta",
    nome: dati.nome,
    cognome: dati.cognome,

    // In attesa finché non gli viene assegnata una squadra
    stato: "in_attesa",

    // La password se l'è scelta lui: non c'è niente da cambiare al primo giro
    deveCambiarePassword: false
  }).returning({
    id: utenti.id, email: utenti.email, nome: utenti.nome,
    cognome: utenti.cognome, ruolo: utenti.ruolo, stato: utenti.stato
  });

  await db.insert(richiesteIscrizione).values({
    utenteId: utente.id,
    sport: dati.sport,
    // La squadra la riempie chi decide
    squadraId: null,
    note: dati.note ?? null
  });

  await creaSessione(res, utente.id, {
    ricordami: false,
    userAgent: req.headers["user-agent"]
  });

  return json(res, {
    utente: {
      ...utente,
      capacita: capacitaDi(utente.ruolo),
      deveCambiarePassword: false
    },
    sport: dati.sport
  }, 201);
});
