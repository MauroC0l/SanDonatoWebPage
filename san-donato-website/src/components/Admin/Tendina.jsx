import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 *
 * Con `multipla` si sceglie più di una voce: `valore` è un array e
 * onChange riceve l'array nuovo, con i valori così come stanno nelle
 * opzioni (numeri restano numeri). Un clic o Invio/Spazio accende e spegne
 * la voce senza chiudere il pannello: chi mette tre etichette non deve
 * riaprire la tendina tre volte.
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
  vuoto = "Nessun risultato.",
  /* Il pannello si disegna SOPRA la pagina invece che dentro al suo
     contenitore. Serve dove il contenitore taglia o scorre — una tabella
     con lo scorrimento orizzontale — e dove, rimanendo dentro, il pannello
     aprendosi deformava la tabella intera. */
  sovrapposta = false,
  // Più voci insieme invece di una: vedi sopra
  multipla = false,
  /* Una riga in fondo al pannello, fuori dall'elenco che scorre: il posto
     per un collegamento come "Gestisci le etichette", che deve restare in
     vista anche quando le voci sono cinquanta. */
  piede = null
}) {
  const [aperta, setAperta] = useState(false);
  const [cerca, setCerca] = useState("");
  const [evidenziata, setEvidenziata] = useState(-1);

  const contenitore = useRef(null);
  const campoRicerca = useRef(null);
  const listaRef = useRef(null);
  const pannelloRef = useRef(null);
  const [posizione, setPosizione] = useState(null);
  const [destinazione, setDestinazione] = useState(null);
  const idLista = useId();

  const conRicerca = cercabile ?? opzioni.length > 8;

  /* Il confronto è sempre fra stringhe: i valori arrivano dal database come
     numeri e dai moduli come testo, e 3 e "3" sono la stessa voce. */
  const sceltiMultipla = useMemo(
    () => (multipla && Array.isArray(valore) ? valore.map(String) : []),
    [multipla, valore]
  );
  const eScelta = (o) => (multipla
    ? sceltiMultipla.includes(String(o.valore))
    : String(o.valore) === String(valore ?? ""));

  const scelta = multipla ? null : opzioni.find((o) => String(o.valore) === String(valore ?? ""));

  /* Il testo del pulsante. Con più voci si elencano finché si leggono;
     oltre, il numero dice di più di una riga troncata a metà nome. */
  let testoBottone = scelta?.etichetta;
  if (multipla && sceltiMultipla.length > 0) {
    const nomi = opzioni
      .filter((o) => sceltiMultipla.includes(String(o.valore)))
      .map((o) => o.etichetta);
    const elenco = nomi.join(", ");
    testoBottone = nomi.length > 0 && elenco.length <= 32
      ? elenco
      : `${sceltiMultipla.length} ${sceltiMultipla.length === 1 ? "selezionata" : "selezionate"}`;
  }

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
    setEvidenziata(multipla
      ? opzioni.findIndex((o) => sceltiMultipla.includes(String(o.valore)))
      : opzioni.findIndex((o) => String(o.valore) === String(valore ?? "")));
  }, [disabilitato, opzioni, valore, multipla, sceltiMultipla]);

  /* ---------- Pannello sovrapposto ----------

     Agganciato al pulsante con una posizione fissa, e ricalcolato quando
     la pagina o la tabella scorrono. Si apre verso l'alto quando sotto non
     ci sta: in fondo allo schermo, verso il basso finirebbe fuori. */

  const calcolaPosizione = useCallback(() => {
    const riquadro = contenitore.current?.getBoundingClientRect();
    if (!riquadro) return;

    const margine = 8;
    const larghezza = Math.min(Math.max(riquadro.width, 240), window.innerWidth - 2 * margine);
    const sinistra = Math.min(Math.max(riquadro.left, margine), window.innerWidth - larghezza - margine);
    const sotto = window.innerHeight - riquadro.bottom;
    const sopra = sotto < 300 && riquadro.top > sotto;

    setPosizione(sopra
      ? { left: sinistra, width: larghezza, bottom: window.innerHeight - riquadro.top + 4 }
      : { left: sinistra, width: larghezza, top: riquadro.bottom + 4 });
  }, []);

  useLayoutEffect(() => {
    if (!aperta || !sovrapposta) return undefined;

    /* Sovrapposto, il pannello va dentro al guscio del pannello (e non in
       fondo a <body>): i colori e i caratteri sono variabili dichiarate lì,
       e fuori il menu comparirebbe bianco su bianco. La posizione fissa lo
       porta comunque sopra a tutto. */
    setDestinazione(contenitore.current?.closest(".adm-shell, .alg-page, .adm-boot") ?? document.body);
    calcolaPosizione();
    // In cattura: così arrivano anche gli scorrimenti della tabella, non
    // solo quelli della pagina.
    window.addEventListener("scroll", calcolaPosizione, true);
    window.addEventListener("resize", calcolaPosizione);
    return () => {
      window.removeEventListener("scroll", calcolaPosizione, true);
      window.removeEventListener("resize", calcolaPosizione);
    };
  }, [aperta, sovrapposta, calcolaPosizione]);

  // Un clic fuori chiude. Il listener si attacca solo a tendina aperta:
  // lasciarlo sempre acceso significherebbe farlo girare su ogni clic della
  // pagina per ciascuna delle tendine presenti.
  useEffect(() => {
    if (!aperta) return;

    const fuori = (e) => {
      // Il pannello sovrapposto non sta dentro al contenitore: va contato a parte
      if (!contenitore.current?.contains(e.target) && !pannelloRef.current?.contains(e.target)) chiudi();
    };
    document.addEventListener("mousedown", fuori);
    return () => document.removeEventListener("mousedown", fuori);
  }, [aperta, chiudi]);

  /* Il campo di ricerca prende il fuoco da solo solo con un mouse. Su un
     telefono il fuoco apre la tastiera, che copre metà dello schermo proprio
     mentre si voleva scegliere una voce: la ricerca resta lì, e la tastiera
     arriva solo se la si tocca. */
  useEffect(() => {
    if (!aperta || !conRicerca) return;
    if (window.matchMedia?.("(pointer: fine)").matches) campoRicerca.current?.focus();
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

    if (multipla) {
      if (!opzione) return;
      const chiave = String(opzione.valore);
      const attuali = Array.isArray(valore) ? valore : [];
      // Il pannello resta aperto: si sta componendo un insieme, non
      // rispondendo a una domanda sola.
      onChange(sceltiMultipla.includes(chiave)
        ? attuali.filter((v) => String(v) !== chiave)
        : [...attuali, opzione.valore]);
      return;
    }

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
      case " ":
        /* Lo spazio accende una voce solo nella multipla, e mai mentre si
           scrive nel filtro: lì è uno spazio e basta. */
        if (!multipla || e.target === campoRicerca.current) break;
        e.preventDefault();
        if (evidenziata >= 0) scegli(righe[evidenziata]);
        break;
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

  const disegna = (pannello) => {
    if (!sovrapposta) return pannello;
    // Finché posizione e destinazione non sono calcolate non si mostra
    // niente: un fotogramma dopo, non un pannello nel punto sbagliato.
    return destinazione && posizione ? createPortal(pannello, destinazione) : null;
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
        <span className={`tnd-valore ${testoBottone ? "" : "is-vuoto"}`}>
          {testoBottone ?? segnaposto}
        </span>
        <FaChevronDown className="tnd-freccia" aria-hidden="true" />
      </button>

      {aperta && disegna(
        <div
          ref={pannelloRef}
          className={`tnd-pannello ${sovrapposta ? "tnd-pannello-sovrapposto" : ""} ${multipla ? "tnd-pannello-multipla" : ""}`}
          style={sovrapposta ? posizione : undefined}
        >
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

          <ul
            className="tnd-lista"
            role="listbox"
            id={idLista}
            ref={listaRef}
            aria-multiselectable={multipla || undefined}
          >
            {righe.length === 0 && <li className="tnd-vuoto">{vuoto}</li>}

            {righe.map((o) => (
              <li key={`${o.valore}`} className="tnd-voce-contenitore">
                {o.apreGruppo && <p className="tnd-gruppo">{o.gruppo}</p>}

                <button
                  type="button"
                  data-indice={o.indice}
                  className={`tnd-voce
                    ${eScelta(o) ? "is-scelta" : ""}
                    ${o.indice === evidenziata ? "is-evidenziata" : ""}`}
                  role="option"
                  aria-selected={eScelta(o)}
                  disabled={o.disabilitata}
                  onClick={() => scegli(o)}
                  onMouseEnter={() => setEvidenziata(o.indice)}
                >
                  {/* Nella multipla la casella sta a sinistra, come in un
                      elenco di spunte: si vede a colpo d'occhio cosa è acceso. */}
                  {multipla && (
                    <span className="tnd-casella" aria-hidden="true">
                      {eScelta(o) && <FaCheck />}
                    </span>
                  )}

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

                  {!multipla && eScelta(o) && (
                    <FaCheck className="tnd-spunta" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>

          {piede && <div className="tnd-piede">{piede}</div>}
        </div>
      )}
    </div>
  );
}
