/**
 * Come si racconta l'esito di una partita, sport per sport.
 *
 * Sta in un file suo perché lo leggono in due: il modulo della partita e il
 * riquadro "com'è finita?" dell'elenco. Se ognuno avesse la sua copia, prima
 * o poi il volley chiederebbe i set in un posto e i marcatori nell'altro.
 *
 * Prima il modulo era uno solo per tutti: chi inseriva una partita di volley
 * si trovava davanti il campo "Marcatori", che nella pallavolo non esiste, e
 * chi inseriva una di calcio il campo "Parziali", che nel calcio non c'è. I
 * campi che non servono non sono neutri: fanno dubitare di stare compilando
 * la cosa giusta, e ogni tanto qualcuno li riempie lo stesso.
 *
 * Un campo assente da questa tabella non viene mostrato NÉ inviato: il dato
 * eventualmente già in archivio resta dov'è, e il modulo lo segnala invece di
 * cancellarlo di nascosto.
 */
export const ESITO_PER_SPORT = {
  Calcio: {
    risultato: { etichetta: "Risultato", segnaposto: "Es. 3 - 1" },
    marcatori: { etichetta: "Marcatori", segnaposto: "Es. Rossi, Bianchi, Verdi" }
  },
  Pallavolo: {
    risultato: { etichetta: "Set vinti", segnaposto: "Es. 3 - 1" },
    parziali: { etichetta: "Parziali dei set", segnaposto: "Es. 25-20, 25-18, 23-25" }
  },
  Basket: {
    risultato: { etichetta: "Punteggio", segnaposto: "Es. 74 - 68" },
    parziali: { etichetta: "Parziali dei quarti", segnaposto: "Es. 18-15, 22-20, 14-19, 20-17" }
  }
};

/* Per gli eventi di società, e per tutto ciò che non è uno dei tre sport,
   si mostra il modulo completo: non sapendo che partita sia, togliere un
   campo rischia di togliere proprio quello che serviva. */
export const ESITO_GENERICO = {
  risultato: { etichetta: "Risultato", segnaposto: "Es. 3 - 1" },
  parziali: { etichetta: "Parziali", segnaposto: "Es. 25-20, 25-18, 23-25" },
  marcatori: { etichetta: "Marcatori", segnaposto: "Es. Rossi, Bianchi, Verdi" }
};

export function esitoDi(sport) {
  return sport ? (ESITO_PER_SPORT[sport] ?? ESITO_GENERICO) : ESITO_GENERICO;
}

/* Gli sport in cui senza parziali il tabellino è a metà. Deve combaciare con
   daCompletare in server/eventi.js. */
export const SPORT_CON_PARZIALI = ["Pallavolo", "Basket", "Minivolley"];

/**
 * Una partita già giocata a cui manca qualcosa.
 *
 * Il risultato manca a tutti. I parziali no: senza set o senza quarti il
 * tabellino di una partita di pallavolo o di basket è a metà, mentre nel
 * calcio quasi nessuno li scrive — chiederli a tutti vorrebbe dire tenere
 * ogni partita di calcio segnata come incompleta per sempre.
 */
export function daCompletare(e, adesso) {
  if (!["partita", "torneo"].includes(e.tipo)) return false;
  // Il risultato di una partita ufficiale lo porta la federazione: non è
  // qualcosa che chi guarda l'elenco possa completare.
  if (e.ufficiale) return false;
  if (new Date(e.fine ?? e.inizio) > adesso) return false;

  if (!e.risultato) return true;
  return SPORT_CON_PARZIALI.includes(e.sport) && !e.parziali;
}
