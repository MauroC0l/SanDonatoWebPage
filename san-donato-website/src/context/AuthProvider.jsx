import { useEffect, useState, useCallback } from "react";
import { fetchCurrentUser, login as apiLogin, logout as apiLogout } from "../api/adminApi";
import { AuthContext } from "./auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // Si parte sempre da "checking": la sessione vive in un cookie httpOnly,
  // che il JavaScript non può leggere. L'unico modo di sapere se c'è è
  // chiederlo al server. Senza questo stato la pagina di accesso apparirebbe
  // per un istante anche a chi è già dentro.
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    if (status !== "checking") return;

    let attivo = true;

    fetchCurrentUser()
      .then((profilo) => {
        if (!attivo) return;
        // Nessuna sessione aperta è una risposta legittima, non un errore
        setUser(profilo);
        setStatus(profilo ? "authenticated" : "anonymous");
      })
      .catch(() => {
        if (!attivo) return;
        setUser(null);
        setStatus("anonymous");
      });

    return () => { attivo = false; };
  }, [status]);

  const login = useCallback(async (email, password, remember) => {
    const profilo = await apiLogin(email, password, remember);
    setUser(profilo);
    setStatus("authenticated");
    return profilo;
  }, []);

  const endSession = useCallback(() => {
    // L'uscita va detta anche al server: il cookie da solo non basta,
    // la sessione va tolta dalla tabella o resterebbe valida altrove.
    apiLogout().catch(() => {});
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
