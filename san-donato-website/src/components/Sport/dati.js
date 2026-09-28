/**
 * Conti fatti sui dati di SportPage.json, così la pagina non ha numeri
 * scritti a mano: aggiungere una squadra al JSON aggiorna da sola i
 * contatori, la settimana e l'elenco delle sedi.
 */

export const GIORNI = [
  { nome: "Lunedì", breve: "Lun" },
  { nome: "Martedì", breve: "Mar" },
  { nome: "Mercoledì", breve: "Mer" },
  { nome: "Giovedì", breve: "Gio" },
  { nome: "Venerdì", breve: "Ven" },
  { nome: "Sabato", breve: "Sab" },
  { nome: "Domenica", breve: "Dom" },
];

const NOMI_GIORNI = new Set(GIORNI.map((g) => g.nome));

export const linkMappa = (luogo) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(luogo)}`;

/* Gli allenamenti con un giorno vero: "Da ottobre" (orari ancora da
   decidere) non è un giorno della settimana e non va contato. */
const allenamenti = (sport) =>
  sport.groups.flatMap((g) => g.times).filter((t) => NOMI_GIORNI.has(t.day));

/** Quanti allenamenti cadono in ogni giorno, da lunedì a domenica. */
export function settimana(sport) {
  const conti = Object.fromEntries(GIORNI.map((g) => [g.nome, 0]));
  for (const t of allenamenti(sport)) conti[t.day] += 1;
  return GIORNI.map((g) => ({ ...g, quanti: conti[g.nome] }));
}

/**
 * Le sedi di uno sport, con le squadre che ci si allenano. Le sedi
 * "secondarie" (il campo place di un singolo orario) nel JSON non hanno
 * indirizzo: per la mappa si cerca il nome con la città.
 */
export function sedi(sport) {
  const perNome = new Map();
  const aggiungi = (nome, indirizzo, squadra) => {
    if (!perNome.has(nome)) perNome.set(nome, { nome, indirizzo, squadre: new Set() });
    const sede = perNome.get(nome);
    if (!sede.indirizzo && indirizzo) sede.indirizzo = indirizzo;
    sede.squadre.add(squadra);
  };
  for (const g of sport.groups) {
    aggiungi(g.location, g.address, g.name);
    for (const t of g.times) if (t.place) aggiungi(t.place, null, g.name);
  }
  return [...perNome.values()]
    .map((s) => ({ ...s, squadre: [...s.squadre] }))
    .sort((a, b) => b.squadre.length - a.squadre.length);
}

/** I numeri della testata, su tutti gli sport insieme. */
export function totali(tuttiGliSport) {
  const elenco = Object.values(tuttiGliSport);
  const nomiSedi = new Set(elenco.flatMap((s) => sedi(s).map((x) => x.nome)));
  return {
    sport: elenco.length,
    squadre: elenco.reduce((n, s) => n + s.groups.length, 0),
    sedi: nomiSedi.size,
    allenamenti: elenco.reduce((n, s) => n + allenamenti(s).length, 0),
  };
}

/**
 * Da "… Contattare: Tommaso 380 2042115" ricava nome e numero, per farne
 * un pulsante che chiama. Se il testo cambia forma il pulsante sparisce
 * e resta il testo, che resta comunque sempre visibile.
 */
export function contatto(testo) {
  const trovato = testo?.match(/([A-ZÀ-Ý][a-zà-ÿ]+)\s+(3\d{2}[\s.]?\d{6,7})\s*\.?\s*$/);
  if (!trovato) return null;
  const cifre = trovato[2].replace(/\D/g, "");
  return { nome: trovato[1], numero: trovato[2], tel: `tel:+39${cifre}` };
}
