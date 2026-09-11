import { useEffect, useState, useCallback } from "react";
import { fetchCurrentUser, login as apiLogin, logout as apiLogout, getCredential } from "../api/adminApi";
import { AuthContext } from "./auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // "checking" finché non sappiamo se la credenziale salvata è ancora valida:
  // senza questo stato la pagina di login apparirebbe per un istante anche
  // a chi è già autenticato.
  const [status, setStatus] = useState(() => (getCredential() ? "checking" : "anonymous"));

  useEffect(() => {
    if (status !== "checking") return;

    let mounted = true;

    fetchCurrentUser()
      .then(profile => {
        if (!mounted) return;
        setUser(profile);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!mounted) return;
        // Credenziale non più valida: revocata, o password cambiata
        apiLogout();
        setUser(null);
        setStatus("anonymous");
      });

    return () => { mounted = false; };
  }, [status]);

  const login = useCallback(async (username, password, remember) => {
    const profile = await apiLogin(username, password, remember);
    setUser(profile);
    setStatus("authenticated");
    return profile;
  }, []);

  const endSession = useCallback(() => {
    apiLogout();
    setUser(null);
    setStatus("anonymous");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        isChecking: status === "checking",
        isAuthenticated: status === "authenticated",
        login,
        logout: endSession,
        // Chiamata quando una richiesta fallisce con AuthError: la sessione
        // va chiusa ovunque, non solo nella schermata che se n'è accorta.
        sessionExpired: endSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
