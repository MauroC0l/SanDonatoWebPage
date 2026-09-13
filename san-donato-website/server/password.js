/**
 * Hashing delle password con scrypt.
 *
 * scrypt sta nel modulo crypto di Node: nessuna dipendenza nativa da far
 * compilare, nessun pacchetto esterno a cui affidare le password.
 * È una funzione deliberatamente lenta e avida di memoria, quindi un
 * attacco a forza bruta su un archivio rubato costa caro.
 *
 * Formato memorizzato:  scrypt$N$r$p$salt_base64$hash_base64
 * I parametri viaggiano insieme all'hash: se un domani li alzeremo, le
 * password vecchie continueranno a verificarsi con quelli con cui sono nate.
 */

import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

// N=2^16 è il compromesso consigliato: circa 64 MB di memoria per verifica.
const PARAMETRI = { N: 65536, r: 8, p: 1, lunghezza: 32 };

/**
 * `minimoCaratteri` esiste per un solo motivo: lo script che riempie il
 * database locale di dati di prova, dove serve una password banale da
 * digitare cento volte. Non va usato da nessun endpoint — quelli hanno la
 * loro validazione, che non guarda qui.
 */
export async function creaHashPassword(password, { minimoCaratteri = 10 } = {}) {
  if (typeof password !== "string" || password.length < minimoCaratteri) {
    throw new Error(`La password deve avere almeno ${minimoCaratteri} caratteri.`);
  }

  const { N, r, p, lunghezza } = PARAMETRI;
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, lunghezza, { N, r, p, maxmem: 256 * 1024 * 1024 });

  return ["scrypt", N, r, p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verificaPassword(password, memorizzato) {
  if (typeof password !== "string" || typeof memorizzato !== "string") return false;

  const parti = memorizzato.split("$");
  if (parti.length !== 6 || parti[0] !== "scrypt") return false;

  const [, N, r, p, saltB64, hashB64] = parti;
  const salt = Buffer.from(saltB64, "base64");
  const atteso = Buffer.from(hashB64, "base64");

  const calcolato = await scryptAsync(password, salt, atteso.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: 256 * 1024 * 1024
  });

  // Confronto a tempo costante: un confronto normale rivelerebbe, dalla
  // durata, quanti caratteri iniziali sono corretti.
  return calcolato.length === atteso.length && timingSafeEqual(calcolato, atteso);
}
