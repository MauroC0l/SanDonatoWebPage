import { useEffect, useMemo, useRef, useState } from "react";
import { FaChevronDown, FaTimes } from "react-icons/fa";
import "../../css/CampoSuggerito.css";

/**
 * Un campo di testo che propone quello che si sta scrivendo.
 *
 * Serve per comune di nascita, città e provincia: campi in cui la stessa
 * cosa si scrive in dieci modi — "Torino", "TORINO", "torino", "Torino (TO)"
 * — e poi non si riesce più a cercare né a raggruppare.
 *
 * SUGGERISCE, e quanto obblighi lo decide chi lo usa:
 *
 *   obbligaScelta = true   il valore deve venire dall'elenco. Ha senso solo
 *                          dove l'elenco è completo, cioè per le province.
 *   obbligaScelta = false  si accetta anche quello che non c'è. È il caso
 *                          dei comuni: l'elenco ne copre duecento su
 *                          ottomila, e chi è nato altrove deve poter
 *                          scrivere il suo.
 *
 * Il suggerimento si conferma premendolo — col mouse, con Invio o con le
 * frecce. Uno che scorra da solo mentre si scrive cambierebbe il testo sotto
 * le dita di chi sta battendo.
 */

/** Minuscolo e senza accenti: "Forlì" si deve trovare scrivendo "forli". */
function confronta(testo) {
  return String(testo ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "");
}

export default function CampoSuggerito({
  valore,
  onChange,
  opzioni,
  segnaposto = "",
  disabilitato = false,
  etichettaAria,
  obbligaScelta = false,
  massimo = 8
}) {
  /*
   * Il testo scritto vive a parte dal valore confermato.
   *
   * Mentre si scrive "Tor", il valore della scheda è ancora quello di prima:
   * cambia solo quando si sceglie. Così un campo lasciato a metà non salva
   * mezza parola, e con obbligaScelta si può tornare indietro.
   */
  const [scritto, setScritto] = useState(null);
  const [aperto, setAperto] = useState(false);
  const [evidenziato, setEvidenziato] = useState(0);

  const contenitore = useRef(null);
  const testo = scritto ?? valore ?? "";

  const suggeriti = useMemo(() => {
    const cercato = confronta(testo);
    if (!cercato) return opzioni.slice(0, massimo);

    /* Prima quelli che COMINCIANO con quello che si è scritto, poi quelli
       che lo contengono: chi batte "tor" cerca Torino, non Pontorino. */
    const inizia = [];
    const dentro = [];

    for (const o of opzioni) {
      const confrontabile = confronta(o);
      if (confrontabile.startsWith(cercato)) inizia.push(o);
      else if (confrontabile.includes(cercato)) dentro.push(o);
      if (inizia.length >= massimo) break;
    }

    return [...inizia, ...dentro].slice(0, massimo);
  }, [testo, opzioni, massimo]);

  function chiudi() {
    setAperto(false);

    /* Con l'elenco completo, quello che non c'è non vale: si torna al valore
       buono invece di salvare una provincia inventata. Senza l'obbligo, si
       tiene quello che è stato scritto. */
    if (scritto !== null) {
      const esatto = opzioni.find((o) => confronta(o) === confronta(scritto));

      if (esatto) onChange(esatto);
      else if (!obbligaScelta) onChange(scritto.trim());
    }

    setScritto(null);
  }

  /*
   * Un clic fuori chiude e conferma quello che si è scritto.
   *
   * La funzione passa da un riferimento aggiornato a ogni disegno: agganciata
   * direttamente, l'ascoltatore resterebbe fermo alla versione nata quando
   * il campo si è aperto, e confermerebbe il testo di allora invece
   * dell'ultimo battuto.
   */
  const chiudiRef = useRef(chiudi);

  // L'aggiornamento sta in un effetto e non fra le righe del disegno:
  // scrivere dentro a un riferimento mentre React disegna è proprio la
  // cosa che la regola react-hooks/refs impedisce.
  useEffect(() => {
    chiudiRef.current = chiudi;
  });

  useEffect(() => {
    if (!aperto) return undefined;

    const fuori = (e) => {
      if (!contenitore.current?.contains(e.target)) chiudiRef.current();
    };

    document.addEventListener("mousedown", fuori);
    return () => document.removeEventListener("mousedown", fuori);
  }, [aperto]);

  const scegli = (opzione) => {
    onChange(opzione);
    setScritto(null);
    setAperto(false);
  };

  const suTasto = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAperto(true);
      setEvidenziato((i) => Math.min(i + 1, suggeriti.length - 1));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setEvidenziato((i) => Math.max(i - 1, 0));
      return;
    }

    if (e.key === "Enter" && aperto && suggeriti[evidenziato]) {
      // Non invia il modulo: qui Invio serve a confermare il suggerimento.
      e.preventDefault();
      scegli(suggeriti[evidenziato]);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setScritto(null);
      setAperto(false);
    }
  };

  return (
    <div className={`sug ${aperto ? "is-aperto" : ""}`} ref={contenitore}>
      <div className="sug-campo">
        <input
          type="text"
          className="adm-input"
          value={testo}
          onChange={(e) => {
            setScritto(e.target.value);
            setAperto(true);
            setEvidenziato(0);
          }}
          onFocus={() => setAperto(true)}
          onKeyDown={suTasto}
          placeholder={segnaposto}
          disabled={disabilitato}
          aria-label={etichettaAria}
          aria-autocomplete="list"
          aria-expanded={aperto}
          role="combobox"
          autoComplete="off"
        />

        {testo && !disabilitato ? (
          <button
            type="button"
            className="sug-svuota"
            onClick={() => { onChange(""); setScritto(null); }}
            aria-label="Svuota il campo"
          >
            <FaTimes />
          </button>
        ) : (
          <FaChevronDown className="sug-freccia" aria-hidden="true" />
        )}
      </div>

      {aperto && suggeriti.length > 0 && (
        <ul className="sug-elenco" role="listbox">
          {suggeriti.map((o, i) => (
            <li key={o}>
              <button
                type="button"
                className={`sug-voce ${i === evidenziato ? "is-evidenziata" : ""}`}
                role="option"
                aria-selected={o === valore}
                // onMouseDown e non onClick: il clic arriverebbe dopo la
                // perdita del fuoco, quando l'elenco si è già chiuso.
                onMouseDown={(e) => { e.preventDefault(); scegli(o); }}
                onMouseEnter={() => setEvidenziato(i)}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}

      {aperto && suggeriti.length === 0 && (
        <p className="sug-niente">
          {obbligaScelta
            ? "Nessuna corrispondenza: va scelta una voce dall'elenco."
            : "Non è nell'elenco: va bene lo stesso, resta quello che hai scritto."}
        </p>
      )}
    </div>
  );
}
