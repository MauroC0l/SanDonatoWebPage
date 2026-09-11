import { createContext, useContext } from "react";

// Contesto e hook stanno qui, separati dal provider: un modulo che esporta
// sia componenti sia funzioni rompe il fast refresh di Vite in sviluppo.
export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth va usato dentro <AuthProvider>");
  return context;
}
