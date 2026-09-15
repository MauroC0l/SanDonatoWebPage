import { useMemo, useState } from "react";

/**
 * Impaginazione di un elenco che sta già tutto in memoria.
 *
 * Gli elenchi del pannello arrivano interi dal server — sono qualche
 * centinaio di righe, e tagliarli lato server significherebbe rifare una
 * richiesta a ogni cambio di filtro. Qui si taglia solo ciò che si disegna,
 * che è la parte che costa: il browser non deve costruire duecento righe per
 * mostrarne venti.
 *
 * La pagina in eccesso viene RICAVATA e non corretta con un setState: quando
 * un filtro accorcia l'elenco sotto i piedi, "pagina 7 di 2" non diventa un
 * secondo render che rimette a posto le cose, diventa semplicemente pagina 2.
 * Il numero scelto da chi clicca resta dov'è, e riallargando il filtro si
 * torna dov'era.
 */
export function usePaginazione(elenco, perPagina = 25) {
  const [scelta, setScelta] = useState(1);

  const pagine = Math.max(1, Math.ceil(elenco.length / perPagina));
  const pagina = Math.min(scelta, pagine);

  const visibili = useMemo(
    () => elenco.slice((pagina - 1) * perPagina, pagina * perPagina),
    [elenco, pagina, perPagina]
  );

  return { pagina, pagine, setPagina: setScelta, visibili, totale: elenco.length };
}
