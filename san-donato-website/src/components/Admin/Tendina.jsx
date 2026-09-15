import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { FaCheck, FaChevronDown, FaSearch } from "react-icons/fa";
import "../../css/Tendina.css";

/**
 * Menu a tendina disegnato da noi.
 *
 * Il <select> del browser non si può vestire: su Windows è una lista grigia
 * di sistema, su Mac un'altra cosa, e con venti squadre diventa un elenco in
 * cui si scorre alla cieca. Qui invece si cerca scrivendo, le voci possono
 * stare in gruppi (le squadre per sport) e ognuna può portarsi dietro una
 * riga di spiegazione.
 *
 * Resta comunque un campo di modulo: freccia giù apre, le frecce scorrono,
 * Invio sceglie, Esc chiude. Chi usa la tastiera non deve accorgersi che
 * non è più un <select>.
 */
export default function Tendina({
  valore,
  onChange,
  opzioni = [],
  segnaposto = "Scegli…",
  disabilitato = false,
  // Il campo di ricerca compare da solo quando l'elenco è lungo: su cinque
  // voci sarebbe un ingombro, su venti è l'unico modo di arrivarci.
  cercabile,
  className = "",
  etichettaAria,
  // Testo da mostrare quando la ricerca non trova nulla
  vuoto = "Nessun risultato."
}) {
  const [aperta, setAperta] = useState(false);
  const [cerca, setCerca] = useState("");
  const [evidenziata, setEvidenziata] = useState(-1);

  const contenitore = useRef(null);
  const campoRicerca = useRef(null);
  const listaRef = useRef(null);
  const idLista = useId();

  const conRicerca = cercabile ?? opzioni.length > 8;

  const scelta = opzioni.find((o) => String(o.valore) === String(valore ?? ""));

  /* ---------- Voci filtrate e raggruppate ---------- */

  const filtrate = useMemo(() => {
    const testo = cerca.trim().toLowerCase();
    if (!testo) return opzioni;
    return opzioni.filter((o) =>
      `${o.etichetta} ${o.gruppo ?? ""} ${o.nota ?? ""}`.toLowerCase().includes(testo)
    );
  }, [opzioni, cerca]);

  /* Le voci con il loro gruppo, in ordine di comparsa: serve un elenco
     piatto perché le frecce devono scorrere l'intero menu, non un gruppo
     alla volta. L'intestazione la decide il confronto con la voce prima. */
  const righe = useMemo(() => filtrate.map((o, i) => ({
    ...o,
    indice: i,
    apreGruppo: o.gruppo && o.gruppo !== filtrate[i - 1]?.gruppo
  })), [filtrate]);

  /* ---------- Apertura e chiusura ---------- */

  const chiudi = useCallback(() => {
    setAperta(false);
    setCerca("");
    setEvidenziata(-1);
  }, []);

  const apri = useCallback(() => {
    if (disabilitato) return;
    setAperta(true);
    // Si parte dalla voce già scelta, non dalla prima: premendo freccia giù
    // ci si aspetta di muoversi da dove si è, non di ricominciare.
    setEvidenziata(opzioni.findIndex((o) => String(o.valore) === String(valore ?? "")));
  }, [disabilitato, opzioni, valore]);

  // Un clic fuori chiude. Il listener si attacca solo a tendina aperta:
  // lasciarlo sempre acceso significherebbe farlo girare su ogni clic della
  // pagina per ciascuna delle tendine presenti.
  useEffect(() => {
    if (!aperta) return;

    const fuori = (e) => {
      if (!contenitore.current?.contains(e.target)) chiudi();
    };
    document.addEventListener("mousedown", fuori);
    return () => document.removeEventListener("mousedown", fuori);
  }, [aperta, chiudi]);

  useEffect(() => {
    if (aperta && conRicerca) campoRicerca.current?.focus();
  }, [aperta, conRicerca]);

  // La voce evidenziata deve restare in vista anche quando ci si arriva con
  // le frecce e l'elenco è più lungo del riquadro.
  useEffect(() => {
    if (!aperta || evidenziata < 0) return;
    listaRef.current
      ?.querySelector(`[data-indice="${evidenziata}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [aperta, evidenziata]);

  /* ---------- Scelta ---------- */

  const scegli = (opzione) => {
    if (opzione?.disabilitata) return;
    onChange(opzione ? String(opzione.valore) : "");
    chiudi();
    // Il focus torna al pulsante: dopo aver scelto con la tastiera non deve
    // sparire in cima alla pagina.
    contenitore.current?.querySelector(".tnd-bottone")?.focus();
  };

  const muovi = (passo) => {
    if (righe.length === 0) return;
    setEvidenziata((prima) => {
      const partenza = prima < 0 ? (passo > 0 ? -1 : righe.length) : prima;
      const dopo = partenza + passo;
      // Si ferma agli estremi invece di girare: con un elenco lungo il
      // salto dal fondo alla cima fa perdere il segno.
      return Math.max(0, Math.min(righe.length - 1, dopo));
    });
  };

  const tasti = (e) => {
    if (disabilitato) return;

    if (!aperta) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        apri();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown": e.preventDefault(); muovi(1); break;
      case "ArrowUp": e.preventDefault(); muovi(-1); break;
      case "Home": e.preventDefault(); setEvidenziata(0); break;
      case "End": e.preventDefault(); setEvidenziata(righe.length - 1); break;
      case "Enter":
        e.preventDefault();
        // Senza nulla di evidenziato, con un solo risultato in elenco si
        // prende quello: è quasi sempre ciò che si stava cercando.
        if (evidenziata >= 0) scegli(righe[evidenziata]);
        else if (righe.length === 1) scegli(righe[0]);
        break;
      case "Escape": e.preventDefault(); chiudi(); break;
      case "Tab": chiudi(); break;
      default: break;
    }
  };

  return (
    <div
      ref={contenitore}
      className={`tnd ${aperta ? "is-aperta" : ""} ${disabilitato ? "is-disabilitata" : ""} ${className}`}
      onKeyDown={tasti}
    >
      <button
        type="button"
        className="tnd-bottone adm-input"
        onClick={() => (aperta ? chiudi() : apri())}
        disabled={disabilitato}
        aria-haspopup="listbox"
        aria-expanded={aperta}
        aria-controls={aperta ? idLista : undefined}
        aria-label={etichettaAria}
      >
        <span className={`tnd-valore ${scelta ? "" : "is-vuoto"}`}>
          {scelta?.etichetta ?? segnaposto}
        </span>
        <FaChevronDown className="tnd-freccia" aria-hidden="true" />
      </button>

      {aperta && (
        <div className="tnd-pannello">
          {conRicerca && (
            <div className="tnd-ricerca">
              <FaSearch aria-hidden="true" />
              <input
                ref={campoRicerca}
                type="text"
                value={cerca}
                onChange={(e) => { setCerca(e.target.value); setEvidenziata(-1); }}
                placeholder="Filtra…"
                aria-label="Filtra le voci"
              />
            </div>
          )}

          <ul className="tnd-lista" role="listbox" id={idLista} ref={listaRef}>
            {righe.length === 0 && <li className="tnd-vuoto">{vuoto}</li>}

            {righe.map((o) => (
              <li key={`${o.valore}`} className="tnd-voce-contenitore">
                {o.apreGruppo && <p className="tnd-gruppo">{o.gruppo}</p>}

                <button
                  type="button"
                  data-indice={o.indice}
                  className={`tnd-voce
                    ${String(o.valore) === String(valore ?? "") ? "is-scelta" : ""}
                    ${o.indice === evidenziata ? "is-evidenziata" : ""}`}
                  role="option"
                  aria-selected={String(o.valore) === String(valore ?? "")}
                  disabled={o.disabilitata}
                  onClick={() => scegli(o)}
                  onMouseEnter={() => setEvidenziata(o.indice)}
                >
                  {o.colore && (
                    <span
                      className="tnd-pallino"
                      style={{ backgroundColor: o.colore }}
                      aria-hidden="true"
                    />
                  )}

                  <span className="tnd-voce-testo">
                    {o.etichetta}
                    {o.nota && <span className="tnd-voce-nota">{o.nota}</span>}
                  </span>

                  {String(o.valore) === String(valore ?? "") && (
                    <FaCheck className="tnd-spunta" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
