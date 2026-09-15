/**
 * POST /api/accesso — apre una sessione.
 *
 * Sostituisce le Application Password di WordPress. Differenze che contano:
 * la credenziale non transita più a ogni richiesta, vive in un cookie
 * httpOnly irraggiungibile dal JavaScript di pagina, e si può revocare
 * lato server chiudendo la sessione.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { utenti, media } from "../../db/schema.js";
import { urlFile } from "../file.js";
import { verificaPassword } from "../password.js";
import { creaSessione } from "../sessioni.js";
import { capacitaDi } from "../autorizzazioni.js";
import { json, errore, conGestioneErrori, soloMetodi } from "../risposte.js";
import { leggiCorpo, indirizzoChiamante } from "../richiesta.js";
import { schemaAccesso, valida } from "../validazione.js";
import { verificaFreno, registraFallimento, azzeraFallimenti } from "../freno.js";

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
  // Un account sospeso non entra. Uno "in_attesa" sì: vedrà una schermata
  // che gli spiega che manca l'approvazione, il che è più utile di un
  // rifiuto senza motivo.
  const valida_ = utente && utente.stato !== "sospeso"
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

  /*
   * L'immagine del profilo si legge a parte e solo se c'è.
   *
   * Il front-end disegna la barra in alto con quello che risponde qui,
   * senza richiedere di nuovo chi è: senza questo indirizzo comparirebbero
   * le iniziali fino al primo ricaricamento della pagina, che è proprio il
   * genere di stranezza che poi viene segnalata come un difetto.
   */
  const [immagine] = utente.immagineId
    ? await db
      .select({ chiave: media.chiave, urlWp: media.urlOriginaleWp })
      .from(media)
      .where(eq(media.id, utente.immagineId))
      .limit(1)
    : [];

  return json(res, {
    utente: {
      id: utente.id,
      email: utente.email,
      nome: utente.nome,
      cognome: utente.cognome,
      ruolo: utente.ruolo,
      stato: utente.stato,
      deveCambiarePassword: utente.deveCambiarePassword,
      immagineUrl: urlFile(immagine?.chiave, immagine?.urlWp),
      capacita: capacitaDi(utente.ruolo)
    }
  });
});
