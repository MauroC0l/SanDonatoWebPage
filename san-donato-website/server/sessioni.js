/**
 * Sessioni: creazione, lettura e chiusura.
 *
 * Il browser riceve un token casuale in un cookie httpOnly. Nel database
 * finisce il SUO HASH, mai il token: se l'archivio trapelasse, chi lo legge
 * non potrebbe impersonare nessuno.
 *
 * Perché un cookie e non l'intestazione Authorization come oggi con
 * WordPress: un cookie httpOnly è irraggiungibile dal JavaScript di pagina,
 * quindi una falla XSS non consegna le credenziali. L'attuale Basic auth
 * vive invece in sessionStorage, leggibile da qualunque script.
 */

import { randomBytes, createHash } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { sessioni, utenti, media } from "../db/schema.js";
import { urlFile } from "./file.js";

const NOME_COOKIE = "psd_sessione";

// Chi non spunta "resta collegato" ha una sessione che dura una giornata
// di lavoro; chi la spunta, due settimane.
const DURATA_BREVE_MS = 12 * 60 * 60 * 1000;
const DURATA_LUNGA_MS = 14 * 24 * 60 * 60 * 1000;

const impronta = (token) => createHash("sha256").update(token).digest("hex");

/* =====================================================
   Cookie
   ===================================================== */

export function leggiCookie(req, nome) {
  const intestazione = req.headers?.cookie;
  if (!intestazione) return null;

  for (const pezzo of intestazione.split(";")) {
    const uguale = pezzo.indexOf("=");
    if (uguale === -1) continue;
    if (pezzo.slice(0, uguale).trim() === nome) {
      return decodeURIComponent(pezzo.slice(uguale + 1).trim());
    }
  }
  return null;
}

function componiCookie(valore, { scadenzaMs, cancella = false }) {
  const parti = [
    `${NOME_COOKIE}=${cancella ? "" : encodeURIComponent(valore)}`,
    "Path=/",
    "HttpOnly",
    // Strict e non Lax: il pannello si usa dentro l'applicazione, non lo si
    // raggiunge da link esterni, quindi possiamo permetterci il più severo.
    "SameSite=Strict"
  ];

  // In locale il sito gira su http://localhost: con Secure il cookie non
  // verrebbe mai memorizzato e l'accesso sembrerebbe rotto senza motivo.
  if (process.env.NODE_ENV === "production") parti.push("Secure");

  if (cancella) parti.push("Max-Age=0");
  else if (scadenzaMs) parti.push(`Max-Age=${Math.floor(scadenzaMs / 1000)}`);

  return parti.join("; ");
}

/* =====================================================
   Ciclo di vita
   ===================================================== */

export async function creaSessione(res, utenteId, { ricordami = false, userAgent = null } = {}) {
  const db = getDb();

  const token = randomBytes(32).toString("base64url");
  const durata = ricordami ? DURATA_LUNGA_MS : DURATA_BREVE_MS;
  const scadeIl = new Date(Date.now() + durata);

  await db.insert(sessioni).values({
    id: impronta(token),
    utenteId,
    scadeIl,
    userAgent: userAgent ? String(userAgent).slice(0, 400) : null
  });

  // Senza "ricordami" il cookie muore con il browser: su un computer
  // condiviso non deve sopravvivere alla chiusura della finestra.
  res.setHeader("Set-Cookie", componiCookie(token, {
    scadenzaMs: ricordami ? durata : null
  }));

  return { scadeIl };
}

/**
 * Restituisce l'utente della sessione in corso, oppure null.
 * Le sessioni scadute vengono eliminate appena incontrate.
 */
export async function utenteDallaSessione(req) {
  const token = leggiCookie(req, NOME_COOKIE);
  if (!token) return null;

  const db = getDb();
  const id = impronta(token);

  const righe = await db
    .select({
      sessioneId: sessioni.id,
      scadeIl: sessioni.scadeIl,
      id: utenti.id,
      email: utenti.email,
      ruolo: utenti.ruolo,
      nome: utenti.nome,
      cognome: utenti.cognome,
      stato: utenti.stato,
      deveCambiarePassword: utenti.deveCambiarePassword,

      // L'immagine del profilo viaggia con la sessione perché la barra in
      // alto la mostra su ogni pagina: chiederla a parte vorrebbe dire una
      // seconda richiesta a ogni caricamento per un dato che è già qui a
      // portata di join. È un innesto in meno su una chiave primaria, non
      // una scansione.
      immagineChiave: media.chiave,
      immagineUrlWp: media.urlOriginaleWp
    })
    .from(sessioni)
    .innerJoin(utenti, eq(utenti.id, sessioni.utenteId))
    .leftJoin(media, eq(media.id, utenti.immagineId))
    .where(eq(sessioni.id, id))
    .limit(1);

  const riga = righe[0];
  if (!riga) return null;

  if (riga.scadeIl.getTime() < Date.now()) {
    await db.delete(sessioni).where(eq(sessioni.id, id));
    return null;
  }

  // Un account sospeso non deve poter usare una sessione già aperta.
  // Chi è "in_attesa" invece entra: vedrà una schermata che gli spiega
  // che manca l'approvazione, che è più utile di un accesso negato.
  if (riga.stato === "sospeso") {
    await db.delete(sessioni).where(eq(sessioni.id, id));
    return null;
  }

  await db.update(sessioni).set({ ultimoUsoIl: new Date() }).where(eq(sessioni.id, id));

  return {
    id: riga.id, email: riga.email, ruolo: riga.ruolo,
    nome: riga.nome, cognome: riga.cognome,
    stato: riga.stato, deveCambiarePassword: riga.deveCambiarePassword,
    immagineUrl: urlFile(riga.immagineChiave, riga.immagineUrlWp)
  };
}

export async function chiudiSessione(req, res) {
  const token = leggiCookie(req, NOME_COOKIE);
  if (token) {
    await getDb().delete(sessioni).where(eq(sessioni.id, impronta(token)));
  }
  res.setHeader("Set-Cookie", componiCookie("", { cancella: true }));
}

/** Manutenzione: toglie le sessioni scadute rimaste indietro. */
export async function pulisciSessioniScadute() {
  const risultato = await getDb().delete(sessioni).where(lt(sessioni.scadeIl, new Date()));
  return risultato.rowCount ?? 0;
}

/**
 * L'identificativo in tabella della sessione con cui arriva questa
 * richiesta, oppure null.
 *
 * Serve a chi deve chiudere "tutte le sessioni tranne questa": restituisce
 * l'hash, non il token, perché è quello che sta nel database.
 */
export function improntaSessioneCorrente(req) {
  const token = leggiCookie(req, NOME_COOKIE);
  return token ? impronta(token) : null;
}
