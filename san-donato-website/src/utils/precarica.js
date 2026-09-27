/**
 * Scarica in anticipo le pagine pigre, quando il browser non ha altro da fare.
 *
 * Le pagine si scaricano solo quando servono, per non far pagare a chi apre
 * la home il peso di tutto il sito. Il prezzo era un attimo di attesa alla
 * PRIMA apertura di ogni pagina: la rotella fra un clic e l'altro. Qui lo si
 * toglie senza rimettere tutto nel pacchetto iniziale: finita la prima
 * pagina, a browser fermo, le altre arrivano una alla volta, e quando si
 * clicca sono già lì.
 *
 * Con la connessione a risparmio dati (o lenta) non si scarica niente in
 * anticipo: chi paga i dati a consumo non deve pagare pagine che non apre.
 */
export function precaricaQuandoLibero(importatori, { ritardo = 1500 } = {}) {
  if (typeof window === "undefined") return;

  const connessione = navigator.connection;
  if (connessione?.saveData || /(^|-)2g$/.test(connessione?.effectiveType ?? "")) return;

  const inAttesa = (fn) => (window.requestIdleCallback
    ? window.requestIdleCallback(fn, { timeout: 4000 })
    : window.setTimeout(fn, 300));

  const coda = [...importatori];
  const prossimo = () => {
    const importa = coda.shift();
    if (!importa) return;
    // Un errore qui non conta: la pagina si riscaricherà quando la si apre
    importa().catch(() => {}).finally(() => inAttesa(prossimo));
  };

  window.setTimeout(() => inAttesa(prossimo), ritardo);
}
