import { createContext, useContext } from "react";

/**
 * Avvisi e finestre di dialogo dell'area riservata.
 *
 * Contesto e hook stanno qui, separati dal provider: un modulo che esporta
 * sia componenti sia funzioni rompe il fast refresh di Vite in sviluppo.
 * Stessa divisione di auth.js / AuthProvider.jsx.
 */
export const DialoghiContext = createContext(null);

export function useDialoghi() {
  const contesto = useContext(DialoghiContext);
  if (!contesto) throw new Error("useDialoghi va usato dentro <DialoghiProvider>");
  return contesto;
}
