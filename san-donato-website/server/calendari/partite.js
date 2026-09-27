/**
 * Dalle partite di un girone alle NOSTRE partite, e dal confronto con il
 * calendario del sito a cosa è cambiato.
 *
 * Qui non c'è né rete né database: sono le regole, e si provano da sole.
 * Valgono per ogni formato, perché ogni lettore restituisce le partite
 * nella stessa forma — casa, ospite, luogo, inizio, risultato.
 */

/**
 * Un nome di squadra ridotto all'osso per confrontarlo.
 *
 * "Pol. San Donato", "POL.SAN DONATO" e "Pol  San Donato" sono la stessa
 * squadra scritta da tre persone diverse: maiuscole, punti e spazi non
 * devono decidere se una partita è nostra.
 */
export function normalizzaNome(nome) {
  return String(nome ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Se una squadra del foglio è una delle nostre.
 *
 * Basta che il nome COMINCI con uno dei nostri: "Pol. San Donato Rossa"
 * è nostra anche se la fonte conosce solo "Pol. San Donato". Il nome per
 * intero resta però quello con cui la squadra si distingue nel girone —
 * due nostre squadre nello stesso girone sono due gironi da collegare,
 * uno per squadra.
 *
 * Una parola intera e non un pezzo di parola: "San Donatone" non è nostra.
 */
export function eNostra(squadra, nomiNostri) {
  const n = normalizzaNome(squadra);
  if (!n) return false;

  return nomiNostri.some((nostro) => {
    const m = normalizzaNome(nostro);
    return m && (n === m || n.startsWith(`${m} `));
  });
}

/**
 * Se si gioca in casa.
 *
 * La regola della società: in casa è SOLO la nostra palestra. Il foglio
 * mette per prima la squadra che ospita, ma capita che una squadra ospiti
 * in una palestra non sua — e per chi deve andarci conta dove si gioca,
 * non chi è scritto per primo.
 *
 * Se la fonte non ha palestre di casa indicate, resta l'unica informazione
 * che c'è: l'ordine del foglio.
 */
export function eInCasa(partita, latoNostro, palestreCasa = []) {
  const palestre = palestreCasa.map(normalizzaNome).filter(Boolean);
  if (!palestre.length || !partita.luogo) return latoNostro === "casa";

  const luogo = normalizzaNome(partita.luogo);
  return palestre.some((p) => luogo.includes(p));
}

/**
 * Le nostre partite di un file, raggruppate per nome della nostra squadra.
 *
 * Il gruppo è l'unità che l'amministratore collega a una squadra del sito:
 * "Pol. San Donato" nel girone A dell'Under 14 è la nostra Under 14. In un
 * derby fra due nostre squadre la partita compare in tutti e due i gruppi,
 * perché è nel calendario di entrambe.
 *
 * @returns {Map<string, Array<object>>} nome come è scritto nel foglio → partite
 */
export function nostrePartite(partite, { nomiNostri, palestreCasa = [] }) {
  const gruppi = new Map();

  const aggiungi = (nome, partita) => {
    if (!gruppi.has(nome)) gruppi.set(nome, []);
    gruppi.get(nome).push(partita);
  };

  for (const p of partite) {
    for (const lato of ["casa", "ospite"]) {
      const nostra = p[lato];
      if (!eNostra(nostra, nomiNostri)) continue;

      aggiungi(nostra, {
        numero: p.numero,
        inizio: p.inizio instanceof Date ? p.inizio.toISOString() : p.inizio,
        tuttoIlGiorno: Boolean(p.tuttoIlGiorno),
        // Il titolo resta quello ufficiale, casa prima e ospite dopo: è
        // come la partita si chiama per la federazione e per l'avversario.
        titolo: `${p.casa} - ${p.ospite}`,
        avversario: lato === "casa" ? p.ospite : p.casa,
        inCasa: eInCasa(p, lato, palestreCasa),
        luogo: p.luogo ?? null,
        note: p.note ?? null,
        risultato: p.risultato ?? null,
        parziali: p.parziali ?? null
      });
    }
  }

  return gruppi;
}

/* =====================================================
   Confronto con il calendario del sito
   ===================================================== */

/** Come una partita ufficiale si scrive in una riga di "eventi". */
export function campiEvento(ufficiale) {
  return {
    tipo: "partita",
    titolo: ufficiale.titolo,
    avversario: ufficiale.avversario,
    inizio: new Date(ufficiale.inizio),
    tuttoIlGiorno: ufficiale.tuttoIlGiorno,
    luogo: ufficiale.luogo,
    inCasa: ufficiale.inCasa,
    noteUfficiali: ufficiale.note,
    risultato: ufficiale.risultato,
    parziali: ufficiale.parziali
  };
}

const CAMPI_CONFRONTATI = [
  "inizio", "tuttoIlGiorno", "titolo", "avversario", "luogo",
  "inCasa", "noteUfficiali", "risultato", "parziali"
];

function stesso(a, b) {
  if (a instanceof Date || b instanceof Date) {
    return a != null && b != null && new Date(a).getTime() === new Date(b).getTime();
  }
  return (a ?? null) === (b ?? null);
}

/**
 * Cosa è cambiato fra la partita del sito e quella ufficiale.
 *
 * @returns {{ campi: string[], genere: "spostata"|"risultato"|"modificata"|null }}
 *
 * Il genere dice cosa raccontare nel registro. Se cambiano insieme data e
 * risultato — succede quando una partita rinviata viene giocata e
 * registrata fra una lettura e l'altra — vince lo spostamento, che è la
 * notizia per chi guarda il calendario.
 */
export function differenze(evento, ufficiale) {
  const nuovi = campiEvento(ufficiale);
  const campi = CAMPI_CONFRONTATI.filter((c) => !stesso(evento[c], nuovi[c]));

  let genere = null;
  if (campi.includes("inizio") || campi.includes("tuttoIlGiorno")) genere = "spostata";
  else if (campi.includes("risultato") || campi.includes("parziali")) genere = "risultato";
  else if (campi.length) genere = "modificata";

  return { campi, genere };
}

/**
 * La chiave con cui una partita ufficiale si ritrova da una lettura
 * all'altra: il girone e il numero di gara.
 *
 * Il girone e non il file, perché in un derby la stessa gara sta nel
 * calendario di due nostre squadre, e sono due eventi. E l'identificativo
 * del girone e non il suo nome, perché la stagione dopo i numeri di gara
 * ricominciano uguali in file nuovi.
 */
export function chiaveUfficiale(gironeId, numero) {
  return `girone:${gironeId}:${numero}`;
}
