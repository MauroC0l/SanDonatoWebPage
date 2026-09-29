import { useEffect, useRef, useState } from "react";
import { FaLayerGroup, FaPlus, FaPencilAlt, FaTrashAlt, FaCheck, FaTimes, FaLock } from "react-icons/fa";
import {
  listCategorieServizi, creaCategoriaServizi, rinominaCategoriaServizi, eliminaCategoriaServizi
} from "../../api/adminApi";
import { useDialoghi } from "../../context/dialoghi";
import "../../css/Dialoghi.css";
import "../../css/Etichette.css";

/**
 * La finestra per gestire le voci di "Di che cosa si tratta" nelle Spese
 * sito: aggiungerle, rinominarle, toglierle.
 *
 * Sorella di GestioneEtichette, di cui usa anche l'aspetto. Due differenze:
 * una categoria che qualche servizio usa non si toglie (prima si sposta il
 * servizio: un servizio senza categoria non saprebbe dove stare), e "Altro"
 * non si toglie mai, perché è quella di riserva.
 */
const RISERVA = "altro";

const quantiServizi = (n) => (n === 0 ? "nessun servizio" : n === 1 ? "1 servizio" : `${n} servizi`);

export default function GestioneCategorieServizi({ onChiudi }) {
  const { avvisa, conferma } = useDialoghi();

  const [categorie, setCategorie] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [nuova, setNuova] = useState("");
  const [inModifica, setInModifica] = useState(null); // { valore, etichetta }
  const [occupato, setOccupato] = useState(false);
  const campoNuova = useRef(null);

  const ricarica = () => listCategorieServizi()
    .then((elenco) => { setCategorie(elenco); setCaricamento(false); })
    .catch((err) => { avvisa(err.message || "Categorie non caricate.", "errore"); setCaricamento(false); });

  useEffect(() => {
    ricarica();
    campoNuova.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc chiude, come ogni finestra del pannello
  useEffect(() => {
    const tasto = (e) => {
      if (e.key !== "Escape") return;
      if (document.querySelector(".dlg-velo")) return;
      if (inModifica) setInModifica(null);
      else onChiudi();
    };
    document.addEventListener("keydown", tasto);
    return () => document.removeEventListener("keydown", tasto);
  }, [inModifica, onChiudi]);

  const esegui = async (azione, messaggio) => {
    setOccupato(true);
    try {
      await azione();
      if (messaggio) avvisa(messaggio, "ok");
      await ricarica();
      return true;
    } catch (err) {
      avvisa(err.message || "Operazione non riuscita.", "errore");
      return false;
    } finally {
      setOccupato(false);
    }
  };

  const aggiungi = async (e) => {
    e.preventDefault();
    const etichetta = nuova.trim();
    if (etichetta.length < 2) return;
    if (await esegui(() => creaCategoriaServizi(etichetta), `Categoria "${etichetta}" aggiunta.`)) setNuova("");
  };

  const salvaNome = async (e) => {
    e.preventDefault();
    const etichetta = inModifica.etichetta.trim();
    if (etichetta.length < 2) return;
    if (await esegui(() => rinominaCategoriaServizi(inModifica.valore, etichetta), "Categoria rinominata.")) {
      setInModifica(null);
    }
  };

  const togli = async (c) => {
    const ok = await conferma({
      titolo: `Togliere "${c.etichetta}"?`,
      testo: "Nessun servizio la usa: sparisce dall'elenco delle categorie.",
      conferma: "Togli",
      pericolo: true
    });
    if (!ok) return;
    await esegui(() => eliminaCategoriaServizi(c.valore), "Categoria tolta.");
  };

  return (
    <div
      className="etc-velo"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onChiudi(); }}
    >
      <div className="dlg-finestra etc-finestra" role="dialog" aria-modal="true" aria-labelledby="csv-titolo">
        <div className="etc-testa">
          <h2 className="dlg-finestra-titolo etc-titolo" id="csv-titolo">
            <FaLayerGroup aria-hidden="true" /> Di che cosa si tratta
          </h2>
          <button type="button" className="adm-icon-btn" onClick={onChiudi} aria-label="Chiudi">
            <FaTimes />
          </button>
        </div>

        <form className="etc-nuova" onSubmit={aggiungi}>
          <input
            ref={campoNuova}
            type="text"
            className="adm-input"
            value={nuova}
            maxLength={40}
            placeholder="Nuova categoria, es. Pagamenti"
            onChange={(e) => setNuova(e.target.value)}
            disabled={occupato}
            aria-label="Nome della nuova categoria"
          />
          <button type="submit" className="adm-btn adm-btn-primary" disabled={occupato || nuova.trim().length < 2}>
            <FaPlus /> Aggiungi
          </button>
        </form>

        {caricamento ? (
          <p className="adm-hint">Caricamento…</p>
        ) : (
          <ul className="etc-elenco">
            {categorie.map((c) => (
              <li key={c.valore} className="etc-riga">
                {inModifica?.valore === c.valore ? (
                  <form className="etc-rinomina" onSubmit={salvaNome}>
                    <input
                      type="text"
                      className="adm-input"
                      value={inModifica.etichetta}
                      maxLength={40}
                      onChange={(ev) => setInModifica({ ...inModifica, etichetta: ev.target.value })}
                      autoFocus
                      disabled={occupato}
                      aria-label={`Nuovo nome per ${c.etichetta}`}
                    />
                    <button type="submit" className="adm-icon-btn" disabled={occupato} aria-label="Salva il nome">
                      <FaCheck />
                    </button>
                    <button type="button" className="adm-icon-btn" onClick={() => setInModifica(null)} aria-label="Annulla">
                      <FaTimes />
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="etc-nome">{c.etichetta}</span>
                    <span className="etc-quante">{quantiServizi(c.quanti)}</span>
                    <span className="etc-azioni">
                      <button
                        type="button"
                        className="adm-icon-btn"
                        onClick={() => setInModifica({ valore: c.valore, etichetta: c.etichetta })}
                        disabled={occupato}
                        title="Rinomina"
                        aria-label={`Rinomina ${c.etichetta}`}
                      >
                        <FaPencilAlt />
                      </button>
                      {c.valore === RISERVA ? (
                        <span className="adm-icon-btn" title="Non si toglie: è la categoria di riserva" aria-label="Non si toglie">
                          <FaLock />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="adm-icon-btn adm-icon-danger"
                          onClick={() => togli(c)}
                          disabled={occupato || c.quanti > 0}
                          title={c.quanti > 0 ? "La usa qualche servizio: spostalo prima su un'altra categoria" : "Togli"}
                          aria-label={`Togli ${c.etichetta}`}
                        >
                          <FaTrashAlt />
                        </button>
                      )}
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="adm-hint etc-nota">
          Una categoria si toglie solo quando nessun servizio la usa. &laquo;Altro&raquo; resta sempre.
        </p>
      </div>
    </div>
  );
}
