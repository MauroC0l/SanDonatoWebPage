import { useCallback, useEffect, useMemo, useState } from "react";
import { listStagioni } from "../api/adminApi";
import { StagioneContext } from "./stagione";

const CHIAVE = "psd.stagione";

/* Il ricordo della scelta è una comodità di chi guarda, e basta: in una
   finestra anonima o con i dati del sito bloccati si riparte dalla
   stagione in corso, senza errori. */
function leggiRicordo() {
  try { return window.localStorage.getItem(CHIAVE); } catch { return null; }
}
function scriviRicordo(valore) {
  try {
    if (valore) window.localStorage.setItem(CHIAVE, valore);
    else window.localStorage.removeItem(CHIAVE);
  } catch { /* niente da fare: resta la scelta di questa pagina */ }
}

/**
 * Tiene la stagione scelta nel pannello.
 *
 * "attivo" è falso per chi non vede atleti: il selettore non gli serve, e
 * non si chiede al server un elenco che rifiuterebbe.
 */
export default function StagioneProvider({ attivo, children }) {
  const [stagioni, setStagioni] = useState([]);
  const [scelta, setScelta] = useState(() => leggiRicordo());

  const ricarica = useCallback(() => {
    if (!attivo) return Promise.resolve();
    return listStagioni()
      .then(setStagioni)
      // Senza elenco il selettore non compare e si guarda la stagione in corso
      .catch(() => setStagioni([]));
  }, [attivo]);

  useEffect(() => { ricarica(); }, [ricarica]);

  const valore = useMemo(() => {
    // Una stagione ricordata che non esiste più non vale: si torna a quella in corso
    const trovata = stagioni.find((s) => String(s.id) === String(scelta));
    const inCorso = stagioni.find((s) => s.inCorso) ?? null;
    const stagione = trovata ?? inCorso;
    return {
      stagioni,
      // null quando è quella in corso: le richieste restano quelle di sempre
      stagioneId: stagione && !stagione.inCorso ? stagione.id : null,
      stagione,
      scegli: (id) => {
        const s = stagioni.find((x) => String(x.id) === String(id));
        const valoreNuovo = s && !s.inCorso ? String(s.id) : null;
        setScelta(valoreNuovo);
        scriviRicordo(valoreNuovo);
      },
      ricarica
    };
  }, [stagioni, scelta, ricarica]);

  return <StagioneContext.Provider value={valore}>{children}</StagioneContext.Provider>;
}
