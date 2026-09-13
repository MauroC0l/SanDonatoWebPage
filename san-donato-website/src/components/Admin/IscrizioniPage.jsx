import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCheck, FaTimes, FaExclamationCircle, FaUserCheck, FaClock, FaInfoCircle
} from "react-icons/fa";
import { listIscrizioni, decidiIscrizione, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import "../../css/Admin.css";

function quando(iso) {
  const giorni = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (giorni === 0) return "oggi";
  if (giorni === 1) return "ieri";
  if (giorni < 30) return `${giorni} giorni fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

export default function IscrizioniPage() {
  const navigate = useNavigate();
  const { sessionExpired } = useAuth();

  const [richieste, setRichieste] = useState([]);
  const [tutte, setTutte] = useState(false);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(null);

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    setErrore(err.message || "Operazione non riuscita.");
  }, [navigate, sessionExpired]);

  const carica = useCallback((conTutte) => {
    return listIscrizioni({ tutte: conTutte })
      .then((elenco) => {
        setRichieste(elenco);
        setCaricamento(false);
      })
      .catch((err) => {
        gestisciErrore(err);
        setCaricamento(false);
      });
  }, [gestisciErrore]);

  useEffect(() => { carica(tutte); }, [carica, tutte]);

  const decidi = async (richiesta, approvata) => {
    let motivo;

    if (!approvata) {
      motivo = window.prompt(
        `Perché ${richiesta.nomeCompleto} non fa parte di ${richiesta.squadra}?\n` +
        "(facoltativo, ma aiuta se poi la persona chiede spiegazioni)"
      );
      // Annulla dalla finestra: null significa "ho cambiato idea"
      if (motivo === null) return;
    }

    setErrore("");
    setInCorso(richiesta.id);

    try {
      await decidiIscrizione(richiesta.id, approvata, motivo || undefined);
      await carica(tutte);
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setInCorso(null);
    }
  };

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento delle richieste…</p>
      </div>
    );
  }

  const inAttesa = richieste.filter((r) => r.stato === "in_attesa");

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">Richieste di appartenenza</h1>
          <p className="adm-page-sub">
            Chi si è registrato dicendo di far parte di una squadra.
          </p>
        </div>

        <div className="adm-head-actions">
          <button
            type="button"
            className={`adm-chip ${tutte ? "is-active" : ""}`}
            onClick={() => setTutte((v) => !v)}
          >
            {tutte ? "Mostra solo da decidere" : "Mostra anche le decise"}
          </button>
        </div>
      </div>

      {/* Il cambio di regola va detto: senza, chi approva crede di star
          sbloccando qualcosa e si sente responsabile di un ritardo. */}
      <div className="adm-alert adm-alert-info">
        <FaInfoCircle />
        <span>
          Confermare <strong>non sblocca</strong> nulla: chi si registra vede
          già il calendario, che è pubblico. Serve a sapere chi fa parte
          davvero della squadra, e servirà quando arriveranno i dati
          personali e i certificati.
        </span>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {richieste.length === 0 ? (
        <div className="adm-empty">
          <FaUserCheck className="adm-empty-icon" />
          <p>
            {tutte
              ? "Nessuna richiesta, né da decidere né decisa."
              : "Nessuna richiesta da decidere."}
          </p>
        </div>
      ) : (
        <>
          {!tutte && inAttesa.length > 0 && (
            <p className="adm-page-sub">
              {inAttesa.length === 1
                ? "Una persona aspetta una conferma."
                : `${inAttesa.length} persone aspettano una conferma.`}
            </p>
          )}

          <ul className="adm-post-list">
            {richieste.map((r) => (
              <li key={r.id} className="adm-post-row">
                <div className="adm-post-main">
                  <span className="adm-post-title">
                    {r.nomeCompleto}
                    {r.stato === "approvata" && (
                      <span className="adm-role-tag adm-tag-ok">confermata</span>
                    )}
                    {r.stato === "rifiutata" && (
                      <span className="adm-role-tag adm-tag-spento">respinta</span>
                    )}
                  </span>

                  <div className="adm-post-meta">
                    <span className="adm-sport-tag">{r.squadra}</span>
                    <span>{r.email}</span>
                    <span><FaClock /> {quando(r.richiestaIl)}</span>
                  </div>

                  {r.note && <p className="adm-nota-richiesta">“{r.note}”</p>}

                  {r.motivoRifiuto && (
                    <p className="adm-nota-richiesta adm-nota-rifiuto">
                      Respinta: {r.motivoRifiuto}
                    </p>
                  )}
                </div>

                {r.stato === "in_attesa" && (
                  <div className="adm-post-actions">
                    <button
                      type="button"
                      className="adm-btn adm-btn-primary"
                      onClick={() => decidi(r, true)}
                      disabled={inCorso === r.id}
                    >
                      <FaCheck /> Conferma
                    </button>
                    <button
                      type="button"
                      className="adm-btn adm-btn-ghost"
                      onClick={() => decidi(r, false)}
                      disabled={inCorso === r.id}
                    >
                      <FaTimes /> Non è dei nostri
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
