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
 * L'account nasce ATTIVO e non in attesa: il calendario della squadra è
 * già pubblico, quindi farlo aspettare non proteggerebbe nulla e gli
 * negherebbe soltanto una comodità.
 *
 * La squadra scelta viene comunque registrata in richieste_iscrizione, ma
 * come dichiarazione di appartenenza da confermare, non come lucchetto:
 * l'allenatore e la segreteria vedono chi dice di far parte della loro
 * squadra. Servirà quando arriveranno i dati personali e i certificati,
 * che pubblici non sono.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { utenti, squadre, richiesteIscrizione } from "../db/schema.js";
import { creaHashPassword } from "../server/password.js";
import { creaSessione } from "../server/sessioni.js";
import { capacitaDi } from "../server/autorizzazioni.js";
import { json, errore, conGestioneErrori, soloMetodi, ErroreHttp } from "../server/risposte.js";
import { leggiCorpo, indirizzoChiamante } from "../server/richiesta.js";
import { schemaRegistrazione, valida } from "../server/validazione.js";
import { verificaFreno, registraFallimento } from "../server/freno.js";

export default conGestioneErrori(async (req, res) => {
  if (!soloMetodi(req, res, ["POST"])) return;

  const dati = valida(schemaRegistrazione, await leggiCorpo(req));
  const chiave = [`registrazione:${indirizzoChiamante(req)}`];

  await verificaFreno(chiave);

  const db = getDb();

  const [squadra] = await db
    .select({ id: squadre.id, nome: squadre.nome, attiva: squadre.attiva })
    .from(squadre)
    .where(eq(squadre.id, dati.squadraId))
    .limit(1);

  if (!squadra || !squadra.attiva) {
    throw new ErroreHttp(400, "La squadra scelta non esiste.");
  }

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

    // Attivo subito: gli eventi della squadra sono già pubblici, tenerlo
    // fuori non proteggerebbe niente.
    stato: "attivo",
    // La password se l'è scelta lui: non c'è niente da cambiare al primo giro
    deveCambiarePassword: false
  }).returning({
    id: utenti.id, email: utenti.email, nome: utenti.nome,
    cognome: utenti.cognome, ruolo: utenti.ruolo, stato: utenti.stato
  });

  await db.insert(richiesteIscrizione).values({
    utenteId: utente.id,
    squadraId: squadra.id,
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
    squadra: squadra.nome
  }, 201);
});
