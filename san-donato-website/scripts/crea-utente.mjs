/**
 * Crea o aggiorna un utente.
 *
 * Serve per il primo amministratore: senza di lui nessuno può entrare nel
 * pannello, e non esiste una registrazione aperta (né deve esistere: gli
 * account li crea la società, non chi passa di lì).
 *
 * Uso:
 *   node --env-file=.env scripts/crea-utente.mjs --email x@y.it --ruolo admin
 *
 * La password si può passare con --password, ma è meglio non farlo: resta
 * nella cronologia del terminale. Senza, viene generata e mostrata una volta.
 */

import { randomBytes } from "node:crypto";
import { getDb, chiudiDb } from "../db/client.js";
import { utenti } from "../db/schema.js";
import { creaHashPassword } from "../server/password.js";

const RUOLI = ["admin", "editor", "coach", "atleta"];

function argomento(nome) {
  const i = process.argv.indexOf(`--${nome}`);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

/** Password leggibile ma robusta: 24 caratteri da un alfabeto senza ambiguità. */
function generaPassword() {
  const alfabeto = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(24))
    .map((b) => alfabeto[b % alfabeto.length])
    .join("");
}

async function main() {
  const email = (argomento("email") || "").trim().toLowerCase();
  const ruolo = argomento("ruolo") || "admin";
  const nome = argomento("nome");
  const cognome = argomento("cognome");
  const passwordIndicata = argomento("password");

  if (!email || !email.includes("@")) {
    throw new Error("Indica un'email valida con --email");
  }
  if (!RUOLI.includes(ruolo)) {
    throw new Error(`Ruolo non valido. Ammessi: ${RUOLI.join(", ")}`);
  }

  const password = passwordIndicata || generaPassword();
  const passwordHash = await creaHashPassword(password);

  const db = getDb();

  const [utente] = await db
    .insert(utenti)
    .values({ email, passwordHash, ruolo, nome, cognome })
    .onConflictDoUpdate({
      target: utenti.email,
      set: { passwordHash, ruolo, aggiornatoIl: new Date() }
    })
    .returning({ id: utenti.id, email: utenti.email, ruolo: utenti.ruolo });

  console.log(`\n✅ Utente #${utente.id} — ${utente.email} — ruolo ${utente.ruolo}`);

  if (!passwordIndicata) {
    console.log(`\n   Password: ${password}`);
    console.log("   Compare solo adesso: copiala prima di chiudere.\n");
  }
}

main()
  .catch((e) => {
    console.error("\n❌", e.message);
    process.exitCode = 1;
  })
  .finally(() => chiudiDb());
