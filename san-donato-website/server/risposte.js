/**
 * Risposte HTTP uniformi per tutte le API.
 *
 * Gli errori escono sempre con la stessa forma { errore: "..." }, così il
 * front-end ha un solo caso da gestire invece di indovinare ogni volta.
 */

export function json(res, dati, stato = 200) {
  res.status(stato).setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(dati));
}

export function errore(res, stato, messaggio) {
  return json(res, { errore: messaggio }, stato);
}

/** Errore con un codice HTTP già deciso da chi lo lancia. */
export class ErroreHttp extends Error {
  constructor(stato, messaggio) {
    super(messaggio);
    this.stato = stato;
  }
}

/**
 * Avvolge un handler: traduce le eccezioni in risposte JSON e non lascia
 * mai trapelare uno stack trace al browser.
 */
export function conGestioneErrori(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (e) {
      if (e instanceof ErroreHttp) return errore(res, e.stato, e.message);
      console.error("Errore non gestito:", e);
      return errore(res, 500, "Errore interno del server.");
    }
  };
}

/** Consente solo i metodi indicati, rispondendo 405 agli altri. */
export function soloMetodi(req, res, metodi) {
  if (!metodi.includes(req.method)) {
    res.setHeader("Allow", metodi.join(", "));
    errore(res, 405, `Metodo ${req.method} non consentito.`);
    return false;
  }
  return true;
}
