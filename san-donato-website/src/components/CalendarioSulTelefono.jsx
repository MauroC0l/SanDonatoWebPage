import { useEffect, useId, useRef, useState } from "react";
import { FaChevronDown, FaCheck, FaGoogle, FaApple, FaMobileAlt, FaLink } from "react-icons/fa";
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
  const [copiato, setCopiato] = useState(false);
  const contenitore = useRef(null);
  const bottone = useRef(null);
  const pannello = useRef(null);
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

  /* Aperta la tendina, il fuoco va sulla squadra scelta (o sulla prima):
     con la tastiera si scorre poi con le frecce, come in un menu vero. */
  useEffect(() => {
    if (!aperta) return;
    const voci = pannello.current?.querySelectorAll('[role="option"]');
    if (!voci?.length) return;
    ([...voci].find((v) => v.getAttribute("aria-selected") === "true") || voci[0]).focus();
  }, [aperta]);

  // "Copiato" resta un attimo e poi torna il testo di prima
  useEffect(() => {
    if (!copiato) return undefined;
    const t = setTimeout(() => setCopiato(false), 2200);
    return () => clearTimeout(t);
  }, [copiato]);

  if (!squadre.length) return null;

  const frecce = (e) => {
    const voci = [...(pannello.current?.querySelectorAll('[role="option"]') ?? [])];
    const i = voci.indexOf(document.activeElement);
    const passi = { ArrowDown: 1, ArrowUp: -1 };
    if (e.key in passi) {
      e.preventDefault();
      voci[(i + passi[e.key] + voci.length) % voci.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      voci[e.key === "Home" ? 0 : voci.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setAperta(false);
    }
  };

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
    setCopiato(false);
    bottone.current?.focus();
  };

  /* Per Outlook e per tutti gli altri calendari: l'indirizzo da incollare
     in "Aggiungi calendario da Internet". */
  const copia = async () => {
    try {
      await navigator.clipboard.writeText(indirizzi.https);
      setCopiato(true);
    } catch {
      window.prompt("Copia questo indirizzo:", indirizzi.https);
    }
  };

  return (
    <section className={`cp-abbona ${className}`} aria-label="Il calendario sul tuo telefono">
      <div className="cp-abbona-testa">
        <span className="cp-abbona-icona" aria-hidden="true"><FaMobileAlt /></span>
        <div>
          <h2 className="cp-abbona-titolo">Sul tuo telefono</h2>
          <p className="cp-abbona-testo">
            Le partite di una squadra nel calendario del telefono: si aggiornano da sole.
          </p>
        </div>
      </div>

      <div className="cp-scelta" ref={contenitore}>
        <button
          type="button"
          ref={bottone}
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
          <div className="cp-scelta-pannello" id={idLista} role="listbox" aria-label="Squadre" ref={pannello} onKeyDown={frecce}>
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
          <a className="cp-abbona-btn cp-abbona-btn-pieno" href={indirizzi.google} target="_blank" rel="noreferrer" aria-label="Aggiungi a Google Calendar">
            <FaGoogle aria-hidden="true" /> Google
          </a>
          <a className="cp-abbona-btn" href={indirizzi.webcal}>
            <FaApple aria-hidden="true" /> iPhone e Mac
          </a>
          <button type="button" className={`cp-abbona-btn cp-abbona-copia ${copiato ? "is-copiato" : ""}`} onClick={copia}>
            {copiato ? <FaCheck aria-hidden="true" /> : <FaLink aria-hidden="true" />}
            <span aria-live="polite">{copiato ? "Indirizzo copiato" : "Copia il link (Outlook e altri)"}</span>
          </button>
        </div>
      )}
    </section>
  );
}
