/**
 * POST /api/accesso — apre una sessione.
 *
 * Sostituisce le Application Password di WordPress. Differenze che contano:
 * la credenziale non transita più a ogni richiesta, vive in un cookie
 * httpOnly irraggiungibile dal JavaScript di pagina, e si può revocare
 * lato server chiudendo la sessione.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { utenti } from "../db/schema.js";
import { verificaPassword } from "../server/password.js";
import { creaSessione } from "../server/sessioni.js";
import { capacitaDi } from "../server/autorizzazioni.js";
import { json, errore, conGestioneErrori, soloMetodi } from "../server/risposte.js";
import { leggiCorpo, indirizzoChiamante } from "../server/richiesta.js";
import { schemaAccesso, valida } from "../server/validazione.js";
import { verificaFreno, registraFallimento, azzeraFallimenti } from "../server/freno.js";

export default conGestioneErrori(async (req, res) => {
  if (!soloMetodi(req, res, ["POST"])) return;

  const dati = valida(schemaAccesso, await leggiCorpo(req));
  const chiavi = [`email:${dati.email}`, `ip:${indirizzoChiamante(req)}`];

  await verificaFreno(chiavi);

  const db = getDb();
  const [utente] = await db.select().from(utenti).where(eq(utenti.email, dati.email)).limit(1);

  // Stesso messaggio e stesso percorso sia che l'email non esista sia che la
  // password sia sbagliata: distinguere permetterebbe di scoprire quali
  // indirizzi sono registrati.
  const valida_ = utente && utente.attivo
    ? await verificaPassword(dati.password, utente.passwordHash)
    : false;

  if (!valida_) {
    await registraFallimento(chiavi);
    return errore(res, 401, "Email o password non corretti.");
  }

  await azzeraFallimenti(chiavi);

  await db.update(utenti)
    .set({ ultimoAccesso: new Date() })
    .where(eq(utenti.id, utente.id));

  await creaSessione(res, utente.id, {
    ricordami: dati.ricordami,
    userAgent: req.headers["user-agent"]
  });

  return json(res, {
    utente: {
      id: utente.id,
      email: utente.email,
      nome: utente.nome,
      cognome: utente.cognome,
      ruolo: utente.ruolo,
      capacita: capacitaDi(utente.ruolo)
    }
  });
});
