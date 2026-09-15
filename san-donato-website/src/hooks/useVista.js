import { useCallback, useState } from "react";

/**
 * Come si guarda un elenco — lista, griglia, calendario — e se lo ricorda.
 *
 * Sta nel browser, in localStorage, e NON sul server: è una minuzia di
 * interfaccia, e farne una colonna in tabella vorrebbe dire una richiesta di
 * rete e una riga scritta nel database ogni volta che qualcuno preme
 * "griglia". Se il dato si perde — browser nuovo, cronologia ripulita — non
 * succede niente: si riparte dalla vista predefinita.
 *
 * Non sta nemmeno nell'indirizzo: è una preferenza della persona, non un
 * pezzo di quello che sta guardando, e un collegamento con ?vista=griglia
 * dentro verrebbe incollato a qualcuno a cui quella vista non serve.
 *
 * La chiave è per elenco: le notizie si guardano volentieri a griglia,
 * perché hanno una copertina; gli utenti no.
 */
export function useVista(chiave, predefinita, ammesse) {
  const [vista, setVista] = useState(() => {
    try {
      const salvata = localStorage.getItem(`psd:vista:${chiave}`);
      // Una vista sconosciuta si scarta: può essere rimasta da una versione
      // del sito in cui esisteva, e mostrerebbe il vuoto.
      return ammesse.includes(salvata) ? salvata : predefinita;
    } catch {
      // Navigazione privata, spazio pieno, cookie bloccati: si prosegue
      // senza ricordarsene, che è molto meglio di una pagina bianca.
      return predefinita;
    }
  });

  const cambia = useCallback((nuova) => {
    setVista(nuova);
    try {
      localStorage.setItem(`psd:vista:${chiave}`, nuova);
    } catch { /* vedi sopra */ }
  }, [chiave]);

  return [vista, cambia];
}
