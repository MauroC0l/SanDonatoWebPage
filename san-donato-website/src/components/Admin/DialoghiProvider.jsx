import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes,
  FaExclamationTriangle
} from "react-icons/fa";
import { DialoghiContext } from "../../context/dialoghi";
import "../../css/Dialoghi.css";

/**
 * Avvisi e finestre di dialogo, in un posto solo.
 *
 * Prima ogni pagina si arrangiava: gli esiti finivano in un riquadro in cima
 * al contenuto, che a metà elenco non si vede nemmeno, e le conferme passavano
 * da window.confirm e window.prompt. Quelle finestre le disegna il browser,
 * non noi: cambiano faccia su ogni sistema, non si possono scrivere in modo
 * comprensibile, e window.prompt su alcuni browser non compare affatto.
 *
 * Da qui escono tre funzioni:
 *
 *   avvisa(testo, tipo)   riquadro temporaneo in alto a destra
 *   avvisa(testo, tipo, { permanente: true })  resta finché non lo si chiude
 *   conferma({...})       finestra sì/no, restituisce una promessa booleana
 *   confermaConSpunta()   come sopra ma con una casella: { ok, spuntato }
 *   chiediTesto({...})    finestra con un campo, restituisce testo o null
 *
 * Le ultime due restituiscono una promessa apposta: al posto di window.confirm
 * si scrive "await conferma(...)" e il resto della funzione non cambia.
 */

/** Quanto resta in pagina un avviso, secondo la sua gravità. */
const DURATA = {
  ok: 4000,
  info: 5000,
  // Un errore va letto, non intravisto: più del doppio del tempo.
  errore: 9000
};

const ICONA = {
  ok: FaCheckCircle,
  errore: FaExclamationCircle,
  info: FaInfoCircle
};

function Avviso({ avviso, chiudi }) {
  const Icona = ICONA[avviso.tipo] ?? FaInfoCircle;

  return (
    <li
      className={`dlg-avviso dlg-avviso-${avviso.tipo} ${avviso.uscita ? "is-uscita" : ""} ${avviso.permanente ? "is-permanente" : ""}`}
      // Un errore interrompe la lettura di uno screen reader, una conferma no
      role={avviso.tipo === "errore" ? "alert" : "status"}
    >
      <Icona className="dlg-avviso-icona" aria-hidden="true" />
      <span className="dlg-avviso-testo">{avviso.testo}</span>
      <button
        type="button"
        className="dlg-avviso-chiudi"
        onClick={() => chiudi(avviso.id)}
        aria-label="Chiudi l'avviso"
      >
        <FaTimes />
      </button>
    </li>
  );
}

function Finestra({ richiesta, rispondi }) {
  const campoRef = useRef(null);
  const confermaRef = useRef(null);
  const [testo, setTesto] = useState(richiesta.valoreIniziale ?? "");

  /* Parte sempre spenta, anche quando la finestra si riapre: una casella
     che si ricorda "cancella anche i file" è una casella che un giorno
     cancella dei file che nessuno voleva cancellare. */
  const [spuntato, setSpuntato] = useState(false);

  const conCampo = richiesta.genere === "testo";

  // Il focus entra nella finestra appena si apre, e nel punto giusto: in una
  // conferma sul pulsante, in una domanda nel campo da riempire.
  useEffect(() => {
    const bersaglio = conCampo ? campoRef.current : confermaRef.current;
    bersaglio?.focus();
  }, [conCampo]);

  // Esc annulla, come in qualunque finestra di sistema. Il listener sta sul
  // documento e non sul riquadro: chi ha spostato il focus altrove deve
  // comunque poter uscire da tastiera.
  useEffect(() => {
    const tasto = (e) => { if (e.key === "Escape") rispondi(null); };
    document.addEventListener("keydown", tasto);
    return () => document.removeEventListener("keydown", tasto);
  }, [rispondi]);

  const invia = (e) => {
    e.preventDefault();
    if (conCampo) {
      const ripulito = testo.trim();
      if (richiesta.obbligatorio && !ripulito) return;
      rispondi(ripulito);
      return;
    }
    // Con la casella la risposta è un oggetto: chi la chiede vuole sapere
    // due cose, non una.
    rispondi(richiesta.spunta ? { ok: true, spuntato } : true);
  };

  const mancaIlTesto = conCampo && richiesta.obbligatorio && !testo.trim();

  return (
    <div
      className="dlg-velo"
      // Il clic fuori annulla, ma solo se parte E finisce sul velo: chi
      // seleziona del testo dentro e rilascia fuori non voleva chiudere.
      onMouseDown={(e) => { if (e.target === e.currentTarget) rispondi(null); }}
    >
      <form
        className={`dlg-finestra ${richiesta.pericolo ? "is-pericolo" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlg-titolo"
        onSubmit={invia}
      >
        {richiesta.pericolo && (
          <FaExclamationTriangle className="dlg-finestra-icona" aria-hidden="true" />
        )}

        <h2 className="dlg-finestra-titolo" id="dlg-titolo">{richiesta.titolo}</h2>

        {richiesta.testo && <p className="dlg-finestra-testo">{richiesta.testo}</p>}

        {conCampo && (
          <label className="dlg-campo">
            {richiesta.etichetta && <span className="dlg-campo-label">{richiesta.etichetta}</span>}

            {/* Un indirizzo web sta su una riga e si conferma con Invio; un
                motivo di rifiuto sono tre frasi e Invio deve andare a capo.
                Sono due campi diversi, non lo stesso con un'altezza diversa. */}
            {richiesta.monolinea ? (
              <input
                ref={campoRef}
                type="text"
                className="adm-input"
                value={testo}
                maxLength={richiesta.massimo ?? 300}
                placeholder={richiesta.segnaposto ?? ""}
                onChange={(e) => setTesto(e.target.value)}
              />
            ) : (
              <textarea
                ref={campoRef}
                className="adm-input adm-textarea"
                rows={3}
                value={testo}
                maxLength={richiesta.massimo ?? 300}
                placeholder={richiesta.segnaposto ?? ""}
                onChange={(e) => setTesto(e.target.value)}
              />
            )}
          </label>
        )}

        {richiesta.spunta && (
          <label className="dlg-spunta">
            <input
              type="checkbox"
              checked={spuntato}
              onChange={(e) => setSpuntato(e.target.checked)}
            />
            <span>{richiesta.spunta}</span>
          </label>
        )}

        <div className="dlg-finestra-azioni">
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => rispondi(null)}>
            {richiesta.annulla ?? "Annulla"}
          </button>
          <button
            ref={confermaRef}
            type="submit"
            className={`adm-btn ${richiesta.pericolo ? "adm-btn-pericolo" : "adm-btn-primary"}`}
            disabled={mancaIlTesto}
          >
            {richiesta.conferma ?? "Conferma"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function DialoghiProvider({ children }) {
  const [avvisi, setAvvisi] = useState([]);
  const [richiesta, setRichiesta] = useState(null);

  // I timer vivono fuori dallo stato: cambiarli non deve ridisegnare nulla,
  // e vanno spenti tutti insieme se il componente sparisce a metà.
  const timer = useRef(new Map());
  const contatore = useRef(0);
  const prometti = useRef(null);

  const chiudi = useCallback((id) => {
    // Prima si segna in uscita, poi si toglie: senza questo passaggio la
    // riga sparirebbe di colpo, senza la dissolvenza.
    setAvvisi((prima) => prima.map((a) => (a.id === id ? { ...a, uscita: true } : a)));

    const vecchio = timer.current.get(id);
    if (vecchio) clearTimeout(vecchio);

    timer.current.set(id, setTimeout(() => {
      setAvvisi((prima) => prima.filter((a) => a.id !== id));
      timer.current.delete(id);
    }, 220));
  }, []);

  /**
   * @param permanente  resta in pagina finché non lo si chiude a mano.
   *
   * Serve a un caso solo: gli avvisi che contengono qualcosa da copiare —
   * una password provvisoria appena impostata. Quattro secondi non bastano
   * per leggerla, girarsi e dettarla, e sparita non si recupera più.
   */
  const avvisa = useCallback((testo, tipo = "ok", { permanente = false } = {}) => {
    if (!testo) return undefined;

    const id = ++contatore.current;
    setAvvisi((prima) => {
      // Più di tre avvisi insieme sono una pila che nessuno legge: i vecchi
      // lasciano il posto ai nuovi. Ma quelli permanenti no: contengono
      // qualcosa da copiare, e farli scomparire per far posto a un "Salvato"
      // sarebbe il modo peggiore di perdere una password.
      const restano = prima.filter((a) => a.permanente);
      const passeggeri = prima.filter((a) => !a.permanente).slice(-2);
      return [...restano, ...passeggeri, { id, testo: String(testo), tipo, permanente }];
    });

    if (!permanente) {
      timer.current.set(id, setTimeout(() => chiudi(id), DURATA[tipo] ?? DURATA.info));
    }
    return id;
  }, [chiudi]);

  useEffect(() => {
    const timers = timer.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  const apri = useCallback((opzioni) => new Promise((risolvi) => {
    // Una finestra alla volta: se ne arriva un'altra mentre la prima è
    // aperta, la prima si chiude come se fosse stata annullata, altrimenti
    // chi la stava aspettando resterebbe fermo per sempre.
    prometti.current?.(null);
    prometti.current = risolvi;
    setRichiesta(opzioni);
  }), []);

  const rispondi = useCallback((valore) => {
    setRichiesta(null);
    const risolvi = prometti.current;
    prometti.current = null;
    risolvi?.(valore);
  }, []);

  const conferma = useCallback(
    (opzioni) => apri({ ...opzioni, genere: "conferma" }).then((v) => v === true),
    [apri]
  );

  /**
   * Come conferma, ma con una casella da spuntare.
   *
   * Restituisce { ok, spuntato } invece di un booleano, perché le domande
   * sono due: "vuoi farlo?" e "vuoi farlo anche a quello che c'è dentro?".
   * Serve a un caso solo — cancellare una cartella e, volendo, i suoi file
   * — e finché resta un caso solo non merita una finestra tutta sua.
   */
  const confermaConSpunta = useCallback(
    (opzioni) => apri({ ...opzioni, genere: "conferma" }).then((v) => (
      v && typeof v === "object" ? v : { ok: v === true, spuntato: false }
    )),
    [apri]
  );

  const chiediTesto = useCallback(
    (opzioni) => apri({ ...opzioni, genere: "testo" }),
    [apri]
  );

  return (
    <DialoghiContext.Provider value={{ avvisa, conferma, confermaConSpunta, chiediTesto }}>
      {children}

      {/* Fuori dall'albero del pannello: un avviso non deve finire tagliato
          dall'overflow di un riquadro, né passare sotto la barra in alto. */}
      {createPortal(
        <ul className="dlg-pila" aria-live="polite">
          {avvisi.map((a) => <Avviso key={a.id} avviso={a} chiudi={chiudi} />)}
        </ul>,
        document.body
      )}

      {richiesta && createPortal(
        <Finestra richiesta={richiesta} rispondi={rispondi} />,
        document.body
      )}
    </DialoghiContext.Provider>
  );
}
