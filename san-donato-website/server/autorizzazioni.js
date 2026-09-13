/**
 * Permessi, elencati per capacità e non sparsi in mezzo agli endpoint.
 *
 * Con i ruoli scritti dentro ai controlli ("se è admin oppure editor…"),
 * aggiungere un ruolo significa rileggere tutto il codice. Qui si aggiunge
 * una riga a questa tabella.
 *
 * Le capacità delle fasi successive (eventi, atleti, certificati) si
 * aggiungono qui accanto.
 */

const CAPACITA = {
  admin: [
    "notizie.leggi_bozze",
    "notizie.scrivi",
    "notizie.pubblica",
    "notizie.cestina",
    "media.carica",
    "utenti.gestisci"
  ],
  editor: [
    "notizie.leggi_bozze",
    "notizie.scrivi",
    "notizie.pubblica",
    "notizie.cestina",
    "media.carica"
  ],
  coach: [
    "media.carica"
  ],
  atleta: []
};

export function puo(utente, capacita) {
  if (!utente?.ruolo) return false;
  return (CAPACITA[utente.ruolo] ?? []).includes(capacita);
}

/** Tutte le capacità di un ruolo: il front-end le usa per mostrare o meno i pulsanti. */
export function capacitaDi(ruolo) {
  return CAPACITA[ruolo] ?? [];
}
