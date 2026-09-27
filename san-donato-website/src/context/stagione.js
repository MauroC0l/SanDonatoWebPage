import { createContext, useContext } from "react";

/**
 * La stagione che si sta guardando nel pannello.
 *
 * La sceglie il selettore in alto e la leggono le pagine che hanno dati di
 * stagione (atleti, scheda, allenatori). Contesto e hook qui, il provider in
 * StagioneProvider.jsx: stessa divisione di auth.js / AuthProvider.jsx.
 *
 *   stagioni      tutte, dalla più recente (vuoto finché non arrivano)
 *   stagioneId    quella scelta, o null per "quella in corso"
 *   stagione      l'oggetto della scelta, con inCorso e passata
 *   scegli(id)    cambia stagione
 */
export const StagioneContext = createContext({
  stagioni: [],
  stagioneId: null,
  stagione: null,
  scegli: () => {},
  ricarica: () => {}
});

export function useStagione() {
  return useContext(StagioneContext);
}
