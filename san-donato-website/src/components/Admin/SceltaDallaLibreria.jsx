import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  FaTimes, FaSearch, FaFolder, FaImages, FaCheck, FaExclamationCircle
} from "react-icons/fa";
import { listMedia, AuthError } from "../../api/adminApi";
import Paginazione from "./Paginazione";
import "../../css/Libreria.css";

/**
 * Scegli un'immagine fra quelle già caricate.
 *
 * Serve perché la stessa foto finisce caricata tre volte: quella della
 * squadra, quella del campo, il logo dello sponsor. Chi scrive un articolo
 * non ha modo di sapere che c'è già, e ricarica.
 *
 * Mostra solo immagini: questa finestra si apre da "copertina", e proporre
 * un PDF o un video vorrebbe dire far scegliere qualcosa che poi non si
 * vede in pagina.
 *
 * Il portale la attacca al body, fuori dal guscio del pannello: dentro
 * finirebbe tagliata dall'overflow della colonna di destra dell'editor.
 */
export default function SceltaDallaLibreria({ onScegli, onChiudi }) {
  const [pagina, setPagina] = useState(1);
  const [cartellaId, setCartellaId] = useState("");
  const [scritto, setScritto] = useState("");
  const [cerca, setCerca] = useState("");
  const [cartelle, setCartelle] = useState([]);
  const [errore, setErrore] = useState("");
  const [scelto, setScelto] = useState(null);

  const chiave = `${pagina}|${cartellaId}|${cerca}`;
  const [dati, setDati] = useState({ chiave: null, media: [], totale: 0, pagine: 1 });
  const caricamento = dati.chiave !== chiave;

  // Esc chiude, come in qualunque finestra. Sul documento e non sul
  // riquadro: chi ha il cursore nel campo di ricerca deve poter uscire.
  useEffect(() => {
    const suTasto = (e) => { if (e.key === "Escape") onChiudi(); };
    document.addEventListener("keydown", suTasto);
    return () => document.removeEventListener("keydown", suTasto);
  }, [onChiudi]);

  const gestisciErrore = useCallback((err) => {
    setErrore(err instanceof AuthError
      ? "La sessione è scaduta: ricarica la pagina."
      : (err.message || "Caricamento non riuscito."));
  }, []);

  useEffect(() => {
    let attivo = true;

    listMedia({
      pagina,
      perPagina: 24,
      tipo: "immagine",
      cartellaId: cartellaId || undefined,
      cerca: cerca || undefined
    })
      .then((risultato) => {
        if (!attivo) return;
        setDati({ ...risultato, chiave });
        if (risultato.cartelle) setCartelle(risultato.cartelle);
        setErrore("");
      })
      .catch((err) => {
        if (!attivo) return;
        gestisciErrore(err);
        setDati({ chiave, media: [], totale: 0, pagine: 1 });
      });

    return () => { attivo = false; };
  }, [chiave, pagina, cartellaId, cerca, gestisciErrore]);

  const conFile = useMemo(() => cartelle.filter((c) => c.quanti > 0), [cartelle]);

  return createPortal(
    <div
      className="scl-velo"
      role="dialog"
      aria-modal="true"
      aria-label="Scegli un'immagine dalla libreria"
      // Il click sullo sfondo chiude; quello dentro no, altrimenti si
      // chiuderebbe ogni volta che si preme un pulsante.
      onClick={(e) => { if (e.target === e.currentTarget) onChiudi(); }}
    >
      <div className="scl-finestra">
        <div className="scl-testa">
          <h2 className="scl-titolo">
            <FaImages aria-hidden="true" /> Dalla libreria
          </h2>

          <form
            className="adm-search"
            role="search"
            onSubmit={(e) => { e.preventDefault(); setPagina(1); setCerca(scritto.trim()); }}
          >
            <FaSearch className="adm-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="adm-input"
              value={scritto}
              onChange={(e) => setScritto(e.target.value)}
              placeholder="Cerca…"
              aria-label="Cerca fra le immagini"
            />
          </form>

          <button
            type="button"
            className="adm-icon-btn"
            onClick={onChiudi}
            aria-label="Chiudi"
          >
            <FaTimes />
          </button>
        </div>

        {conFile.length > 0 && (
          <div className="scl-cartelle">
            <button
              type="button"
              className={`adm-chip ${cartellaId === "" ? "is-active" : ""}`}
              onClick={() => { setPagina(1); setCartellaId(""); }}
            >
              Tutte
            </button>

            {conFile.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`adm-chip ${cartellaId === String(c.id) ? "is-active" : ""}`}
                onClick={() => { setPagina(1); setCartellaId(String(c.id)); }}
              >
                <FaFolder aria-hidden="true" /> {c.nome}
              </button>
            ))}
          </div>
        )}

        <div className="scl-corpo">
          {errore && (
            <div className="adm-alert adm-alert-error" role="alert">
              <FaExclamationCircle /> <span>{errore}</span>
            </div>
          )}

          {caricamento ? (
            <ul className="lib-griglia" aria-hidden="true">
              {Array.from({ length: 12 }, (_, i) => (
                <li key={i}><span className="lib-sagoma" /></li>
              ))}
            </ul>
          ) : dati.media.length === 0 ? (
            <div className="adm-empty">
              <FaImages className="adm-empty-icon" />
              <p>
                {cerca || cartellaId
                  ? "Nessuna immagine corrisponde a questi filtri."
                  : "Nella libreria non c'è ancora nessuna immagine."}
              </p>
            </div>
          ) : (
            <ul className="lib-griglia">
              {dati.media.map((file) => (
                <li key={file.id}>
                  <button
                    type="button"
                    className={`lib-scheda ${scelto?.id === file.id ? "is-scelta" : ""}`}
                    onClick={() => setScelto(file)}
                    // Doppio click: sceglie e chiude. È il gesto che fa
                    // chiunque abbia già usato un selettore di file.
                    onDoubleClick={() => onScegli(file)}
                    aria-pressed={scelto?.id === file.id}
                  >
                    <span className="lib-anteprima">
                      <img src={file.url} alt={file.alt || file.titolo || ""} loading="lazy" />
                    </span>
                    <span className="lib-nome">{file.titolo || "senza titolo"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!caricamento && dati.pagine > 1 && (
            <Paginazione
              pagina={dati.pagina ?? pagina}
              pagine={dati.pagine}
              onCambia={setPagina}
              totale={dati.totale}
              nome={["immagine", "immagini"]}
            />
          )}
        </div>

        <div className="scl-piede">
          <span className="adm-hint">
            {scelto ? (scelto.titolo || "immagine senza titolo") : "Scegli un'immagine."}
          </span>

          <div className="adm-head-actions">
            <button type="button" className="adm-btn adm-btn-ghost" onClick={onChiudi}>
              Annulla
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={() => onScegli(scelto)}
              disabled={!scelto}
            >
              <FaCheck /> Usa questa
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
