/**
 * Importi in centesimi.
 *
 * Nel database gli importi sono interi di centesimi e non decimali, perché
 * 0,1 + 0,2 in virgola mobile non fa 0,3: su una somma di quote l'errore si
 * vede, e sui soldi della gente non si discute. Queste due funzioni sono
 * l'unico punto in cui si passa dalla forma che legge una persona a quella
 * che sta in archivio.
 */

const FORMATO = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR"
});

/** Da 12345 a "123,45 €". */
export function euro(centesimi) {
  if (centesimi == null) return "—";
  return FORMATO.format(centesimi / 100);
}

/** Solo il numero, per i campi da compilare: da 12345 a "123,45". */
export function versoCampo(centesimi) {
  if (centesimi == null) return "";
  return (centesimi / 100).toFixed(2).replace(".", ",");
}

/**
 * Da quello che si scrive a centesimi.
 *
 * Accetta la virgola e il punto: in Italia si scrive 12,50, ma chi ha il
 * tastierino numerico batte 12.50 e non deve trovarsi un errore. Restituisce
 * null se non è un numero, così chi chiama distingue "vuoto" da "zero".
 */
export function daCampo(testo) {
  const ripulito = String(testo ?? "").trim().replace(/[€\s]/g, "").replace(",", ".");
  if (ripulito === "") return null;

  const numero = Number(ripulito);
  if (!Number.isFinite(numero)) return null;

  // Arrotondato al centesimo: "12.345" è un errore di battitura, non un
  // terzo di centesimo.
  return Math.round(numero * 100);
}
