/**
 * Date e ore dei calendari ufficiali, che sono sempre ore di Torino.
 *
 * Un foglio Excel non conosce i fusi orari: "15:00" è scritto come la
 * frazione di giorno 0.625, e "sabato 3 ottobre" come il numero di giorni
 * trascorsi dal 30 dicembre 1899. Sta a noi dire che sono l'ora e il giorno
 * di chi va in palestra, e trasformarli nell'istante giusto — che d'estate è
 * due ore prima in UTC e d'inverno una.
 *
 * LA TRAPPOLA DA NON RIPETERE. Passare quei numeri a `new Date()` e
 * leggerli con l'ora locale sposta tutto di un'ora: per le date del 1899
 * JavaScript applica il fuso di allora, che non era quello di oggi. Una
 * partita delle 15:00 risultava alle 16:00. Qui i numeri si fanno a mano e
 * il fuso lo applica Intl, che conosce l'ora legale anno per anno.
 */

const GIORNO_MS = 86_400_000;
const ORIGINE_EXCEL = Date.UTC(1899, 11, 30);

/** Il giorno di calendario scritto in un numero di serie di Excel. */
export function giornoDaSeriale(seriale) {
  if (typeof seriale !== "number" || !Number.isFinite(seriale) || seriale < 1) return null;

  const data = new Date(ORIGINE_EXCEL + Math.floor(seriale) * GIORNO_MS);
  return {
    anno: data.getUTCFullYear(),
    mese: data.getUTCMonth() + 1,
    giorno: data.getUTCDate()
  };
}

/**
 * L'ora scritta nella parte frazionaria di un numero di Excel.
 *
 * Accetta sia l'ora da sola (0.625) sia una data con l'ora dentro
 * (46298.625): della seconda conta solo quello che sta dopo la virgola.
 */
export function oraDaSeriale(seriale) {
  if (typeof seriale !== "number" || !Number.isFinite(seriale) || seriale < 0) return null;

  // Arrotondato al minuto: Excel salva 0.6458333333 per le 15:30
  const minuti = Math.round((seriale - Math.floor(seriale)) * 1440) % 1440;
  return { ore: Math.floor(minuti / 60), minuti: minuti % 60 };
}

const FORMATO_ROMA = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Rome",
  hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit"
});

/** Di quanti millisecondi Torino è avanti rispetto a UTC in quell'istante. */
function scostamentoRoma(istante) {
  const parti = Object.fromEntries(
    FORMATO_ROMA.formatToParts(new Date(istante)).map((p) => [p.type, p.value])
  );
  const comeSeFosseUtc = Date.UTC(
    Number(parti.year), Number(parti.month) - 1, Number(parti.day),
    Number(parti.hour), Number(parti.minute), Number(parti.second)
  );
  return comeSeFosseUtc - istante;
}

/**
 * L'istante corrispondente a un giorno e a un'ora di Torino.
 *
 * Due passaggi e non uno: lo scostamento dipende dall'istante, che è
 * proprio quello che si sta cercando. Il secondo giro corregge il primo
 * nelle due notti dell'anno in cui cambia l'ora.
 */
export function istanteRoma({ anno, mese, giorno }, { ore = 0, minuti = 0 } = {}) {
  const comeSeFosseUtc = Date.UTC(anno, mese - 1, giorno, ore, minuti);
  let istante = comeSeFosseUtc - scostamentoRoma(comeSeFosseUtc);
  istante = comeSeFosseUtc - scostamentoRoma(istante);
  return new Date(istante);
}
