/**
 * "Aperto ora / chiuso" per la segreteria, letto dalla stringa degli orari
 * che sta in Contatti.json (per esempio "Giovedì 18:30 – 19:30").
 *
 * PERCHÉ DALLA STRINGA. L'orario lo aggiorna chi cura i contenuti, e lo
 * scrive come lo leggerebbe una persona: tenere un secondo campo "macchina"
 * vorrebbe dire due dati che prima o poi non coincidono. Se un giorno la
 * frase non si lascia leggere (più giorni, "su appuntamento"…) la funzione
 * restituisce null e la pagina semplicemente non mostra l'indicatore,
 * invece di dire una cosa sbagliata.
 *
 * L'ORA È QUELLA DI TORINO, non quella del telefono di chi guarda: chi apre
 * la pagina dall'estero deve sapere se la segreteria è aperta adesso a
 * Torino.
 */

const GIORNI = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"];

// "Giovedì" → "giovedi": gli accenti e le maiuscole non devono contare
const normalizza = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function leggiOrario(testo) {
  const m = /^\s*([a-zA-ZÀ-ÿ]+)\s+(\d{1,2})[:.](\d{2})\s*[–—-]\s*(\d{1,2})[:.](\d{2})/.exec(testo || "");
  if (!m) return null;
  const giorno = GIORNI.indexOf(normalizza(m[1]));
  if (giorno < 0) return null;
  return {
    giorno,
    nomeGiorno: m[1].toLowerCase(),
    inizio: Number(m[2]) * 60 + Number(m[3]),
    fine: Number(m[4]) * 60 + Number(m[5]),
    etichettaInizio: `${m[2].padStart(2, "0")}:${m[3]}`,
  };
}

function oraDiTorino(adesso = new Date()) {
  const parti = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(adesso);
  const valore = (tipo) => parti.find((p) => p.type === tipo)?.value;
  const giorno = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(valore("weekday"));
  return { giorno, minuti: Number(valore("hour")) * 60 + Number(valore("minute")) };
}

/** { aperto, testo } oppure null se l'orario non si lascia leggere */
export function statoSegreteria(orario, adesso) {
  if (!orario) return null;
  const { giorno, minuti } = oraDiTorino(adesso);
  if (giorno === orario.giorno && minuti >= orario.inizio && minuti < orario.fine) {
    return { aperto: true, testo: "Segreteria aperta ora" };
  }
  const oggiPiuTardi = giorno === orario.giorno && minuti < orario.inizio;
  const domani = (giorno + 1) % 7 === orario.giorno;
  const quando = oggiPiuTardi ? "oggi" : domani ? "domani" : orario.nomeGiorno;
  return { aperto: false, testo: `Chiusa · riapre ${quando} alle ${orario.etichettaInizio}` };
}
