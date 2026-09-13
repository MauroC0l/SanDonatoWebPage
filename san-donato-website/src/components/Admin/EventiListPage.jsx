import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaPlus, FaPencilAlt, FaTrashAlt, FaExclamationCircle,
  FaCalendarAlt, FaMapMarkerAlt, FaTrophy
} from "react-icons/fa";
import { listEventi, listSquadre, deleteEvento, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import "../../css/Admin.css";

/** I tre modi in cui si guarda un calendario: avanti, indietro, tutto. */
const PERIODI = [
  { chiave: "prossimi", etichetta: "In programma" },
  { chiave: "passati", etichetta: "Già svolti" },
  { chiave: "tutto", etichetta: "Tutti" }
];

function intervalloDi(periodo) {
  const adesso = new Date();
  const unAnno = 365 * 24 * 60 * 60 * 1000;

  if (periodo === "prossimi") return { da: adesso, a: new Date(adesso.getTime() + unAnno) };
  if (periodo === "passati") return { da: new Date(adesso.getTime() - unAnno), a: adesso };
  return { da: new Date(adesso.getTime() - 5 * unAnno), a: new Date(adesso.getTime() + unAnno) };
}

function dataLeggibile(iso, conOra = true) {
  const d = new Date(iso);
  const data = d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  if (!conOra) return data;
  return `${data} · ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function EventiListPage() {
  const navigate = useNavigate();
  const { sessionExpired } = useAuth();

  const [eventi, setEventi] = useState([]);
  const [squadre, setSquadre] = useState([]);
  const [squadreAmmesse, setSquadreAmmesse] = useState(null);
  const [periodo, setPeriodo] = useState("prossimi");
  const [squadraId, setSquadraId] = useState("");
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    setErrore(err.message || "Caricamento non riuscito.");
  }, [navigate, sessionExpired]);

  useEffect(() => {
    let attivo = true;
    listSquadre()
      .then((elenco) => attivo && setSquadre(elenco))
      .catch(gestisciErrore);
    return () => { attivo = false; };
  }, [gestisciErrore]);

  useEffect(() => {
    let attivo = true;
    const { da, a } = intervalloDi(periodo);

    // Nessun setState prima della richiesta: aggiornare lo stato in modo
    // sincrono dentro un effetto costringe React a un secondo render
    // immediato. Cambiando filtro si continuano a vedere i risultati
    // precedenti finché non arrivano i nuovi, invece di uno sfarfallio.
    listEventi({ da, a, squadraId: squadraId || undefined })
      .then((risultato) => {
        if (!attivo) return;
        // In "già svolti" i più recenti stanno in cima
        const ordinati = periodo === "passati"
          ? [...risultato.eventi].reverse()
          : risultato.eventi;

        setEventi(ordinati);
        setSquadreAmmesse(risultato.squadreAmmesse);
        setErrore("");
        setCaricamento(false);
      })
      .catch((err) => {
        if (!attivo) return;
        gestisciErrore(err);
        setCaricamento(false);
      });

    return () => { attivo = false; };
  }, [periodo, squadraId, gestisciErrore]);

  /* Un coach vede nel filtro solo le proprie squadre: proporgli le altre
     significherebbe offrirgli un elenco che tornerà sempre vuoto. */
  const squadreVisibili = useMemo(() => {
    if (!Array.isArray(squadreAmmesse)) return squadre;
    return squadre.filter((s) => squadreAmmesse.includes(s.id));
  }, [squadre, squadreAmmesse]);

  const elimina = async (evento) => {
    const conferma = window.confirm(
      `Eliminare "${evento.titolo}" del ${dataLeggibile(evento.inizio, false)}?\n\n` +
      "L'evento sparisce dal calendario del sito. Non è recuperabile."
    );
    if (!conferma) return;

    try {
      await deleteEvento(evento.id);
      setEventi((prima) => prima.filter((e) => e.id !== evento.id));
    } catch (err) {
      gestisciErrore(err);
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">Eventi</h1>
          <p className="adm-page-sub">
            Partite, allenamenti e appuntamenti: da qui finiscono nel calendario del sito.
          </p>
        </div>

        <div className="adm-head-actions">
          <Link to="/admin/eventi/nuovo" className="adm-btn adm-btn-primary">
            <FaPlus /> Nuovo evento
          </Link>
        </div>
      </div>

      <div className="adm-filters">
        <div className="adm-chip-group">
          {PERIODI.map((p) => (
            <button
              key={p.chiave}
              type="button"
              className={`adm-chip ${periodo === p.chiave ? "is-active" : ""}`}
              onClick={() => setPeriodo(p.chiave)}
            >
              {p.etichetta}
            </button>
          ))}
        </div>

        <select
          className="adm-input adm-select adm-filter-select"
          value={squadraId}
          onChange={(e) => setSquadraId(e.target.value)}
        >
          <option value="">Tutte le squadre</option>
          {squadreVisibili.map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {caricamento ? (
        <div className="adm-loading">
          <div className="adm-spinner" />
          <p>Caricamento degli eventi…</p>
        </div>
      ) : eventi.length === 0 ? (
        <div className="adm-empty">
          <FaCalendarAlt className="adm-empty-icon" />
          <p>
            {Array.isArray(squadreAmmesse) && squadreAmmesse.length === 0
              ? "Non sei associato a nessuna squadra. Chiedi a chi amministra il sito di collegarti alla tua."
              : "Nessun evento in questo periodo."}
          </p>
        </div>
      ) : (
        <ul className="adm-post-list">
          {eventi.map((evento) => (
            <li key={evento.id} className="adm-post-row">
              <span
                className="adm-evento-colore"
                style={{ backgroundColor: evento.colore || "#999" }}
                aria-hidden="true"
              />

              <div className="adm-post-main">
                <span className="adm-post-title">{evento.titolo}</span>

                <div className="adm-post-meta">
                  <span className="adm-sport-tag">{evento.squadra}</span>
                  <span>{dataLeggibile(evento.inizio, !evento.tuttoIlGiorno)}</span>
                  {evento.luogo && <span><FaMapMarkerAlt /> {evento.luogo}</span>}
                  {evento.risultato && (
                    <span className="adm-risultato"><FaTrophy /> {evento.risultato}</span>
                  )}
                </div>
              </div>

              <div className="adm-post-actions">
                <Link
                  to={`/admin/eventi/${evento.id}`}
                  className="adm-icon-btn"
                  title="Modifica"
                >
                  <FaPencilAlt />
                </Link>
                <button
                  type="button"
                  className="adm-icon-btn adm-icon-danger"
                  onClick={() => elimina(evento)}
                  title="Elimina"
                >
                  <FaTrashAlt />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
