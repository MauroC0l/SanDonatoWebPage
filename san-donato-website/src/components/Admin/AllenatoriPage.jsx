import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSearch, FaChalkboardTeacher, FaExclamationCircle, FaEuroSign
} from "react-icons/fa";
import { listAllenatori, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import { euro } from "../../utils/soldi";
import Ritratto from "./Ritratto";
import "../../css/Admin.css";
import "../../css/Ritratto.css";

/**
 * Gli allenatori, tutti e solo loro, con la loro quota.
 *
 * Anche chi allena è un iscritto e versa la quota degli allenatori, ma
 * nell'elenco degli atleti non compare: quello nasce dalle squadre in cui
 * si gioca. Qui la segreteria vede chi allena cosa e chi ha già versato.
 *
 * Chi non ha mai aperto il sito una quota non ce l'aveva: gliela assegna
 * il server aprendo questa pagina, con la tariffa degli allenatori.
 */

const FILTRI = [
  { chiave: "", etichetta: "Tutti" },
  { chiave: "da_versare", etichetta: "Da versare" },
  { chiave: "mai_entrati", etichetta: "Mai entrati nel sito" }
];

function residuo(a) {
  if (a.dovutoCentesimi == null) return null;
  return a.dovutoCentesimi - a.versatoCentesimi;
}

export default function AllenatoriPage() {
  const navigate = useNavigate();
  const { sessionExpired } = useAuth();
  const { avvisa } = useDialoghi();

  const [allenatori, setAllenatori] = useState([]);
  const [stagione, setStagione] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [ricerca, setRicerca] = useState("");
  const [filtro, setFiltro] = useState("");

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    setErrore(err.message || "Caricamento non riuscito.");
    avvisa(err.message || "Caricamento non riuscito.", "errore");
  }, [navigate, sessionExpired, avvisa]);

  useEffect(() => {
    let attivo = true;
    listAllenatori()
      .then(({ allenatori: elenco, stagione: s }) => {
        if (!attivo) return;
        setAllenatori(elenco);
        setStagione(s);
        setCaricamento(false);
      })
      .catch((err) => {
        if (!attivo) return;
        gestisciErrore(err);
        setCaricamento(false);
      });
    return () => { attivo = false; };
  }, [gestisciErrore]);

  const conConto = useMemo(
    () => allenatori.map((a) => ({ ...a, manca: residuo(a) })),
    [allenatori]
  );

  const visibili = useMemo(() => {
    const cercato = ricerca.trim().toLowerCase();
    return conConto.filter((a) => {
      if (filtro === "da_versare" && !(a.manca > 0)) return false;
      if (filtro === "mai_entrati" && a.ultimoAccesso) return false;
      if (!cercato) return true;
      return `${a.nomeCompleto} ${a.email} ${a.allena.map((s) => s.nome).join(" ")}`
        .toLowerCase().includes(cercato);
    });
  }, [conConto, ricerca, filtro]);

  const riepilogo = useMemo(() => ({
    daVersare: conConto.filter((a) => a.manca > 0).length,
    daIncassare: conConto.reduce((s, a) => s + (a.manca > 0 ? a.manca : 0), 0),
    maiEntrati: conConto.filter((a) => !a.ultimoAccesso).length
  }), [conConto]);

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento degli allenatori…</p>
      </div>
    );
  }

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">Allenatori</h1>
          <p className="adm-page-sub">
            {allenatori.length === 0
              ? "Nessun account ha il ruolo di allenatore."
              : `${allenatori.length} ${allenatori.length === 1 ? "allenatore" : "allenatori"}`}
            {stagione && ` · quota della stagione ${stagione.nome}`}
          </p>
        </div>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {allenatori.length > 0 && (
        <div className="adm-riepilogo">
          <button
            type="button"
            className={`adm-riquadro ${filtro === "da_versare" ? "is-active" : ""} ${riepilogo.daVersare ? "is-attenzione" : ""}`}
            onClick={() => setFiltro(filtro === "da_versare" ? "" : "da_versare")}
          >
            <span className="adm-riquadro-numero">{riepilogo.daVersare}</span>
            <span className="adm-riquadro-testo">quote da versare</span>
          </button>
          <div className="adm-riquadro adm-riquadro-statico">
            <span className="adm-riquadro-numero">{euro(riepilogo.daIncassare)}</span>
            <span className="adm-riquadro-testo">ancora da incassare</span>
          </div>
          {/* Chi non è mai entrato non ha mai visto la sua quota: va
              avvisato di persona, il sito da solo non lo raggiunge. */}
          <button
            type="button"
            className={`adm-riquadro ${filtro === "mai_entrati" ? "is-active" : ""}`}
            onClick={() => setFiltro(filtro === "mai_entrati" ? "" : "mai_entrati")}
          >
            <span className="adm-riquadro-numero">{riepilogo.maiEntrati}</span>
            <span className="adm-riquadro-testo">mai entrati nel sito</span>
          </button>
        </div>
      )}

      <div className="adm-toolbar">
        <div className="adm-chip-group">
          {FILTRI.map((f) => (
            <button
              key={f.chiave || "tutti"}
              type="button"
              className={`adm-chip ${filtro === f.chiave ? "is-active" : ""}`}
              onClick={() => setFiltro(f.chiave)}
              aria-pressed={filtro === f.chiave}
            >
              {f.etichetta}
            </button>
          ))}
        </div>

        <div className="adm-search">
          <FaSearch className="adm-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="adm-input"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca per nome, email o squadra…"
            aria-label="Cerca fra gli allenatori"
          />
        </div>
      </div>

      {visibili.length === 0 ? (
        <div className="adm-empty">
          <FaChalkboardTeacher className="adm-empty-icon" />
          <p>
            {allenatori.length === 0
              ? "Un account diventa allenatore dalla sezione Utenti."
              : "Nessuno corrisponde a questi filtri."}
          </p>
        </div>
      ) : (
        <ul className="adm-atleti">
          {visibili.map((a) => (
            <li key={a.utenteId}>
              {/* Non porta a una scheda: la scheda è dell'atleta, e chi
                  allena senza giocare non ne ha una. */}
              <div className="adm-atleta-riga adm-allenatore-riga">
                <Ritratto nome={a.nomeCompleto} url={a.immagineUrl} dimensione="m" />

                <div className="adm-atleta-chi">
                  <span className="adm-atleta-nome">{a.nomeCompleto}</span>
                  <span className="adm-atleta-sotto">
                    {a.email}
                    {!a.ultimoAccesso && " · mai entrato nel sito"}
                  </span>
                </div>

                <div className="adm-atleta-cert">
                  <span className="adm-atleta-sotto">
                    {a.allena.length ? `Allena ${a.allena.map((s) => s.nome).join(", ")}` : "Nessuna squadra affidata"}
                  </span>
                  {a.gioca.length > 0 && (
                    <span className="adm-atleta-nota">gioca in {a.gioca.join(", ")}</span>
                  )}
                </div>

                <div className="adm-atleta-quota">
                  {a.quotaCentesimi == null ? (
                    <span className="adm-atleta-nota">quota non impostata</span>
                  ) : (
                    <>
                      <span className={`adm-quota ${a.manca > 0 ? "is-aperta" : "is-saldata"}`}>
                        <FaEuroSign aria-hidden="true" />
                        {a.manca > 0 ? `${euro(a.manca)} da versare` : "Saldata"}
                      </span>
                      <span className="adm-atleta-nota">
                        {euro(a.versatoCentesimi)} di {euro(a.dovutoCentesimi)}
                        {a.tipoQuota && ` · ${a.tipoQuota}`}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
