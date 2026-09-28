import { useState } from "react";
import { FaGoogle, FaApple, FaLink, FaCheck } from "react-icons/fa";
import { indirizziCalendario } from "../../utils/calendarioSquadra";

/**
 * "Porta il calendario sul telefono": tre pulsanti, per i tre modi in cui
 * la gente lo usa davvero.
 *
 * Abbonarsi e non scaricare: il telefono rilegge il calendario da solo, e
 * una partita spostata dalla federazione si sposta anche lì, senza che
 * nessuno debba avvisare.
 */
export default function AbbonaCalendario({ squadraId, nome }) {
  const [copiato, setCopiato] = useState(false);
  const { https, webcal, google } = indirizziCalendario(squadraId);

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(https);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2500);
    } catch {
      // Senza permesso per gli appunti resta il campo qui sotto, da cui
      // si copia a mano: meglio di un pulsante che non fa niente.
      setCopiato(false);
    }
  };

  return (
    <section className="adm-panel atl-abbona">
      <h2 className="adm-panel-title">Il calendario sul tuo telefono</h2>
      <p className="adm-hint atl-abbona-testo">
        Aggiungi il calendario di {nome} a quello del telefono: partite spostate e
        risultati si aggiornano da soli.
      </p>

      <div className="atl-abbona-azioni">
        <a className="adm-btn adm-btn-ghost" href={google} target="_blank" rel="noreferrer">
          <FaGoogle aria-hidden="true" /> Google Calendar
        </a>
        <a className="adm-btn adm-btn-ghost" href={webcal}>
          <FaApple aria-hidden="true" /> iPhone e Mac
        </a>
        <button type="button" className="adm-btn adm-btn-ghost" onClick={copia}>
          {copiato ? <FaCheck aria-hidden="true" /> : <FaLink aria-hidden="true" />}
          {copiato ? " Copiato" : " Copia il link"}
        </button>
      </div>

      <input
        className="adm-input atl-abbona-link"
        type="text"
        readOnly
        value={https}
        aria-label={`Indirizzo del calendario di ${nome}`}
        onFocus={(e) => e.target.select()}
      />
    </section>
  );
}
