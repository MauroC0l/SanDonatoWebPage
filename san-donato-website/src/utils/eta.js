/**
 * L'età, che non è un campo.
 *
 * Chiederla in un modulo vuol dire avere due dati che possono
 * contraddirsi — e che si contraddicono di sicuro il giorno del compleanno,
 * perché nessuno torna sul sito a correggerla. Si ricava dalla data di
 * nascita, che è l'unica cosa che non cambia.
 *
 * Sta qui e non dentro a una schermata perché ormai serve in due posti: al
 * modulo dell'iscrizione, per accendere gli asterischi sul contatto del
 * genitore, e alla scheda che lo staff legge, per segnalare un minorenne
 * senza nessuno da chiamare. La stessa regola scritta due volte è la stessa
 * regola che un giorno cambia in un posto solo.
 *
 * Il server ne ha una copia sua in `api/iscrizione.js`: lì la risposta non
 * può dipendere da quello che il browser ha calcolato.
 */

/** Gli anni compiuti, da una data "2010-05-14". Null se la data non c'è o non si legge. */
export function anni(iso) {
  if (!iso) return null;

  // Mezzanotte esplicita: senza, il fuso sposta la data al giorno prima
  const nato = new Date(`${iso}T00:00:00`);
  if (isNaN(nato.getTime())) return null;

  const oggi = new Date();
  let eta = oggi.getFullYear() - nato.getFullYear();

  // Il compleanno di quest'anno non è ancora arrivato
  const primaDelCompleanno = oggi.getMonth() < nato.getMonth()
    || (oggi.getMonth() === nato.getMonth() && oggi.getDate() < nato.getDate());

  if (primaDelCompleanno) eta -= 1;

  // Fuori da questi estremi è una data battuta male, non un'età
  return eta >= 0 && eta < 120 ? eta : null;
}

/**
 * Se è minorenne.
 *
 * Una funzione a parte e non `anni(x) < 18` sparso nelle schermate: il
 * confronto è sempre lo stesso, e il caso "data non indicata" va deciso una
 * volta sola. Senza data non si sa: e non sapendo non si può pretendere il
 * contatto di un genitore da un adulto.
 */
export function minorenne(iso) {
  const eta = anni(iso);
  return eta != null && eta < 18;
}
