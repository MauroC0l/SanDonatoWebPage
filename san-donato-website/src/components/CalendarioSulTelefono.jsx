import { useEffect, useId, useRef, useState } from "react";
import { FaChevronDown, FaCheck, FaGoogle, FaApple } from "react-icons/fa";
import { indirizziCalendario } from "../utils/calendarioSquadra";

/**
 * Il calendario di una squadra sul telefono, per chi non ha un account.
 *
 * Si sceglie la squadra e si abbona: Google Calendar o Calendario di Apple
 * rileggono l'indirizzo da soli, e una partita spostata si sposta anche lì.
 *
 * La tendina è disegnata qui e non è un <select>: il menu di sistema del
 * telefono è una lista grigia senza colori né gruppi, e con venti squadre
 * non si capisce dove finisce il calcio e comincia la pallavolo. Qui le
 * squadre stanno per sport, con il pallino del loro colore — lo stesso del
 * calendario — e senza nessun campo da scrivere: nessuna tastiera che si
 * apre per sbaglio.
 */

const NOME_SPORT = { Societa: "Società" };

export default function CalendarioSulTelefono({ squadre, className = "" }) {
  const [scelta, setScelta] = useState(null);
  const [aperta, setAperta] = useState(false);
  const contenitore = useRef(null);
  const idLista = useId();

  // Un tocco fuori o Esc chiudono
  useEffect(() => {
    if (!aperta) return undefined;
    const fuori = (e) => { if (!contenitore.current?.contains(e.target)) setAperta(false); };
    const tasti = (e) => { if (e.key === "Escape") setAperta(false); };
    document.addEventListener("mousedown", fuori);
    document.addEventListener("touchstart", fuori);
    document.addEventListener("keydown", tasti);
    return () => {
      document.removeEventListener("mousedown", fuori);
      document.removeEventListener("touchstart", fuori);
      document.removeEventListener("keydown", tasti);
    };
  }, [aperta]);

  if (!squadre.length) return null;

  // Le squadre per sport, nell'ordine in cui arrivano
  const gruppi = [];
  for (const s of squadre) {
    let gruppo = gruppi.find((g) => g.sport === s.sport);
    if (!gruppo) gruppi.push(gruppo = { sport: s.sport, squadre: [] });
    gruppo.squadre.push(s);
  }

  const indirizzi = scelta ? indirizziCalendario(scelta.squadraId) : null;

  const scegli = (s) => {
    setScelta(s);
    setAperta(false);
  };

  return (
    <div className={`cp-card cp-abbona ${className}`}>
      <h3 className="cp-card-title">Sul tuo telefono</h3>
      <p className="cp-card-subtitle">
        Aggiungi le partite di una squadra al calendario del telefono: si aggiornano da sole.
      </p>

      <div className="cp-scelta" ref={contenitore}>
        <button
          type="button"
          className={`cp-scelta-bottone ${aperta ? "is-aperta" : ""}`}
          onClick={() => setAperta((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={aperta}
          aria-controls={aperta ? idLista : undefined}
        >
          {scelta ? (
            <span className="cp-scelta-valore">
              <span className="cp-scelta-pallino" style={{ backgroundColor: scelta.color }} aria-hidden="true" />
              {scelta.label}
            </span>
          ) : (
            <span className="cp-scelta-valore is-vuoto">Scegli la squadra…</span>
          )}
          <FaChevronDown className="cp-scelta-freccia" aria-hidden="true" />
        </button>

        {aperta && (
          <div className="cp-scelta-pannello" id={idLista} role="listbox" aria-label="Squadre">
            {gruppi.map((g) => (
              <div key={g.sport} className="cp-scelta-gruppo">
                <p className="cp-scelta-gruppo-titolo">{NOME_SPORT[g.sport] ?? g.sport}</p>
                {g.squadre.map((s) => {
                  const attiva = scelta?.squadraId === s.squadraId;
                  return (
                    <button
                      key={s.squadraId}
                      type="button"
                      role="option"
                      aria-selected={attiva}
                      className={`cp-scelta-voce ${attiva ? "is-scelta" : ""}`}
                      onClick={() => scegli(s)}
                    >
                      <span className="cp-scelta-pallino" style={{ backgroundColor: s.color }} aria-hidden="true" />
                      <span className="cp-scelta-voce-nome">{s.label}</span>
                      {attiva && <FaCheck className="cp-scelta-spunta" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {indirizzi && (
        <div className="cp-abbona-azioni">
          <a className="cp-abbona-btn" href={indirizzi.google} target="_blank" rel="noreferrer">
            <FaGoogle aria-hidden="true" /> Google Calendar
          </a>
          <a className="cp-abbona-btn" href={indirizzi.webcal}>
            <FaApple aria-hidden="true" /> iPhone e Mac
          </a>
        </div>
      )}
    </div>
  );
}
