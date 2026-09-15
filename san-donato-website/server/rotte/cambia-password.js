/**
 * POST /api/cambia-password — chi è connesso cambia la propria password.
 *
 * Serve la password attuale anche se la sessione è già aperta: se qualcuno
 * trovasse un computer lasciato acceso, senza questa richiesta potrebbe
 * cambiare la password e prendersi l'account.
 *
 * Al cambio si chiudono TUTTE le altre sessioni di quella persona. È il
 * comportamento che ci si aspetta da un cambio password: se lo si fa perché
 * si teme che qualcuno sia entrato, lasciargli la sessione aperta
 * renderebbe il gesto inutile.
 */

import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { utenti, sessioni } from "../../db/schema.js";
import { creaHashPassword, verificaPassword } from "../password.js";
import { richiedeAccesso } from "../autenticazione.js";
import { annota } from "../registro.js";
import { improntaSessioneCorrente } from "../sessioni.js";
import { json, errore, conGestioneErrori, soloMetodi } from "../risposte.js";
import { leggiCorpo } from "../richiesta.js";
import { schemaCambioPassword, valida } from "../validazione.js";

export default conGestioneErrori(
  richiedeAccesso(async (req, res) => {
    if (!soloMetodi(req, res, ["POST"])) return;

    const dati = valida(schemaCambioPassword, await leggiCorpo(req));
    const db = getDb();

    const [riga] = await db
      .select({ passwordHash: utenti.passwordHash })
      .from(utenti)
      .where(eq(utenti.id, req.utente.id))
      .limit(1);

    if (!riga || !await verificaPassword(dati.attuale, riga.passwordHash)) {
      return errore(res, 400, "La password attuale non è corretta.");
    }

    await db.update(utenti).set({
      passwordHash: await creaHashPassword(dati.nuova),
      deveCambiarePassword: false,
      aggiornatoIl: new Date()
    }).where(eq(utenti.id, req.utente.id));

    // Tutte le altre sessioni cadono; questa resta, per non buttare fuori
    // chi ha appena cambiato la password dalla schermata in cui si trova.
    const sessioneCorrente = improntaSessioneCorrente(req);

    await db.delete(sessioni).where(and(
      eq(sessioni.utenteId, req.utente.id),
      sessioneCorrente ? ne(sessioni.id, sessioneCorrente) : undefined
    ));

    await annota(req.utente, {
      azione: "password.cambia",
      tipo: "utente",
      id: req.utente.id,
      descrizione: "Ha cambiato la propria password"
    });

    return json(res, { cambiata: true });
  })
);
