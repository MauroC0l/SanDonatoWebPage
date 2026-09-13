/**
 * Lettura del corpo delle richieste.
 *
 * Vercel lo analizza da solo e lo mette in req.body; il server di sviluppo
 * locale no. Questa funzione copre entrambi i casi, così gli endpoint sono
 * identici in locale e in produzione.
 */

import { ErroreHttp } from "./risposte.js";

const LIMITE_BYTE = 1024 * 1024; // 1 MB: una notizia lunga sta abbondantemente dentro

export async function leggiCorpo(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      try { return JSON.parse(req.body); } catch { throw new ErroreHttp(400, "Corpo della richiesta non valido."); }
    }
    return req.body;
  }

  const pezzi = [];
  let byte = 0;

  for await (const pezzo of req) {
    byte += pezzo.length;
    if (byte > LIMITE_BYTE) throw new ErroreHttp(413, "Richiesta troppo grande.");
    pezzi.push(pezzo);
  }

  if (byte === 0) return {};

  try {
    return JSON.parse(Buffer.concat(pezzi).toString("utf8"));
  } catch {
    throw new ErroreHttp(400, "Corpo della richiesta non valido.");
  }
}

/** Indirizzo del chiamante, tenendo conto del proxy davanti all'applicazione. */
export function indirizzoChiamante(req) {
  const inoltrato = req.headers["x-forwarded-for"];
  if (inoltrato) return String(inoltrato).split(",")[0].trim();
  return req.socket?.remoteAddress ?? "sconosciuto";
}

/**
 * Parametri della query.
 *
 * Vercel li mette in req.query; il server di sviluppo locale li ricava
 * dall'URL. Restituisce sempre un oggetto piatto di stringhe.
 */
export function parametri(req) {
  if (req.query && typeof req.query === "object") return req.query;

  const url = new URL(req.url, "http://interno");
  return Object.fromEntries(url.searchParams.entries());
}
