/**
 * Il codice fiscale: forma e carattere di controllo.
 *
 * Fino a ieri il codice fiscale, in questo sito, era una stringa di sedici
 * caratteri qualunque: bastava la lunghezza. Andava bene finché serviva
 * solo a comparire sui moduli federali, e non va più bene adesso che con
 * un codice fiscale si CERCA una persona — il fratello o la sorella già
 * iscritti. Cercato con una lettera sbagliata, un codice fiscale non trova
 * nessuno, e chi ha dichiarato resta ad aspettare uno sconto che nessuno
 * gli darà mai senza sapere perché.
 *
 * Il carattere di controllo non dimostra che il codice fiscale esista —
 * quello lo sa solo l'Agenzia delle Entrate — ma intercetta le due cose
 * che capitano davvero: una lettera per un'altra e due caratteri invertiti.
 */

/* Il valore di ogni carattere nelle posizioni DISPARI (la prima, la terza,
   …). Non è l'ordine alfabetico: è una tabella pensata apposta perché due
   caratteri scambiati diano un risultato diverso. */
const DISPARI = {
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23
};

/* Nelle posizioni PARI vale l'ordine naturale: 0…9 valgono 0…9, A…Z
   valgono 0…25. */
const PARI = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
  K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18,
  T: 19, U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25
};

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * La forma, omocodia compresa.
 *
 * Quando due persone ottengono lo stesso codice, l'Agenzia ne cambia una
 * sostituendo le cifre con delle lettere secondo una tabella sua: per
 * questo dove ci si aspetterebbe un numero sono ammessi anche L, M, N, P,
 * Q, R, S, T, U e V. Chi è nato il primo del mese e ha un omonimo esiste, e
 * rifiutargli il proprio codice fiscale sarebbe un difetto raro e odioso.
 */
const FORMA = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

/** Maiuscolo e senza spazi: "rss mra 80a01 l219x" si scrive in tanti modi. */
export function normalizzaCodiceFiscale(valore) {
  if (typeof valore !== "string") return null;
  const pulito = valore.replace(/\s+/g, "").toUpperCase();
  return pulito || null;
}

/**
 * Il carattere di controllo che quel codice fiscale dovrebbe avere.
 *
 * Esportata a parte perché è la metà interessante: un test che si limita a
 * dire "questo è valido" non si accorge di una tabella copiata male.
 */
export function carattereDiControllo(primi15) {
  let somma = 0;

  for (let i = 0; i < 15; i++) {
    const carattere = primi15[i];
    // i parte da zero, quindi la PRIMA posizione è l'indice pari: le
    // posizioni dispari del codice fiscale sono gli indici pari qui.
    const tabella = i % 2 === 0 ? DISPARI : PARI;
    const valore = tabella[carattere];

    if (valore === undefined) return null;
    somma += valore;
  }

  return ALFABETO[somma % 26];
}

/** Vero se ha la forma giusta e il carattere di controllo torna. */
export function codiceFiscaleValido(valore) {
  const cf = normalizzaCodiceFiscale(valore);
  if (!cf || cf.length !== 16) return false;
  if (!FORMA.test(cf)) return false;

  return carattereDiControllo(cf.slice(0, 15)) === cf[15];
}
