import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCheck, FaTimes, FaExclamationCircle, FaUserCheck, FaClock
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
  const [squadre, setSquadre] = useState([]);
  const [tutte, setTutte] = useState(false);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(null);

  // Squadra scelta per ciascuna richiesta, prima di confermare
  const [scelte, setScelte] = useState({});

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
      .then(({ richieste: elenco, squadreProponibili }) => {
        setRichieste(elenco);
        setSquadre(squadreProponibili);
        setCaricamento(false);
      })
      .catch((err) => {
        gestisciErrore(err);
        setCaricamento(false);
      });
  }, [gestisciErrore]);

  useEffect(() => { carica(tutte); }, [carica, tutte]);

  /* Le squadre raggruppate per sport: a una richiesta di calcio si possono
     proporre solo le squadre di calcio. */
  const squadrePerSport = useMemo(() => {
    const gruppi = {};
    for (const s of squadre) (gruppi[s.sport] ??= []).push(s);
    return gruppi;
  }, [squadre]);

  const accogli = async (richiesta) => {
    const squadraId = Number(scelte[richiesta.id]);

    if (!squadraId) {
      setErrore(`Scegli in quale squadra inserire ${richiesta.nomeCompleto}.`);
      return;
    }

    setErrore("");
    setInCorso(richiesta.id);

    try {
      await decidiIscrizione({ id: richiesta.id, approvata: true, squadraId });
      await carica(tutte);
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setInCorso(null);
    }
  };

  const respingi = async (richiesta) => {
    const motivo = window.prompt(
      `Perché ${richiesta.nomeCompleto} non viene inserito?\n` +
      "(facoltativo, ma aiuta se poi la persona chiede spiegazioni)"
    );
    // Annulla dalla finestra: null significa "ho cambiato idea"
    if (motivo === null) return;

    setErrore("");
    setInCorso(richiesta.id);

    try {
      await decidiIscrizione({
        id: richiesta.id,
        approvata: false,
        motivo: motivo || undefined
      });
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
          <h1 className="adm-page-title">Richieste di iscrizione</h1>
          <p className="adm-page-sub">
            Chi si è registrato scegliendo uno sport e aspetta una squadra.
          </p>
        </div>

        <div className="adm-head-actions">
          <button
            type="button"
            className={`adm-chip ${tutte ? "is-active" : ""}`}
            onClick={() => setTutte((v) => !v)}
          >
            {tutte ? "Solo da decidere" : "Mostra anche le decise"}
          </button>
        </div>
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
              : "Nessuno sta aspettando."}
          </p>
        </div>
      ) : (
        <>
          {!tutte && inAttesa.length > 0 && (
            <p className="adm-page-sub">
              {inAttesa.length === 1
                ? "Una persona aspetta una squadra."
                : `${inAttesa.length} persone aspettano una squadra.`}
              {" "}Finché non gliela assegni, non entrano.
            </p>
          )}

          <ul className="adm-post-list">
            {richieste.map((r) => {
              const proponibili = squadrePerSport[r.sport] ?? [];

              return (
                <li key={r.id} className="adm-post-row">
                  <div className="adm-post-main">
                    <span className="adm-post-title">
                      {r.nomeCompleto}
                      {r.stato === "approvata" && (
                        <span className="adm-role-tag adm-tag-ok">{r.squadra}</span>
                      )}
                      {r.stato === "rifiutata" && (
                        <span className="adm-role-tag adm-tag-spento">respinta</span>
                      )}
                    </span>

                    <div className="adm-post-meta">
                      <span className="adm-sport-tag">{r.sport}</span>
                      <span>{r.email}</span>
                      <span><FaClock /> {quando(r.richiestaIl)}</span>
                    </div>

                    {r.motivoRifiuto && (
                      <p className="adm-nota-richiesta adm-nota-rifiuto">
                        Respinta: {r.motivoRifiuto}
                      </p>
                    )}
                  </div>

                  {r.stato === "in_attesa" && (
                    <div className="adm-post-actions adm-azioni-iscrizione">
                      {proponibili.length === 0 ? (
                        <span className="adm-hint">
                          Nessuna squadra di {r.sport} fra quelle che gestisci.
                        </span>
                      ) : (
                        <select
                          className="adm-input adm-select adm-select-mini"
                          value={scelte[r.id] ?? ""}
                          onChange={(e) => setScelte((p) => ({ ...p, [r.id]: e.target.value }))}
                          disabled={inCorso === r.id}
                        >
                          <option value="">Scegli la squadra…</option>
                          {proponibili.map((s) => (
                            <option key={s.id} value={s.id}>{s.nome}</option>
                          ))}
                        </select>
                      )}

                      <button
                        type="button"
                        className="adm-btn adm-btn-primary"
                        onClick={() => accogli(r)}
                        disabled={inCorso === r.id || proponibili.length === 0}
                      >
                        <FaCheck /> Inserisci
                      </button>

                      <button
                        type="button"
                        className="adm-btn adm-btn-ghost"
                        onClick={() => respingi(r)}
                        disabled={inCorso === r.id}
                      >
                        <FaTimes /> Respingi
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
