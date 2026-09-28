import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FaSearch, FaChalkboardTeacher, FaExclamationCircle, FaEuroSign,
  FaArrowRight, FaCheckCircle, FaUserClock
} from "react-icons/fa";
import { listAllenatori, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import { useStagione } from "../../context/stagione";
import { euro } from "../../utils/soldi";
import Ritratto from "./Ritratto";
import LinguetteFiltro from "./LinguetteFiltro";
import "../../css/Admin.css";
import "../../css/Ritratto.css";
import "../../css/admin/Persone.css";

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
  const { stagioneId } = useStagione();

  const [allenatori, setAllenatori] = useState([]);
  const [stagione, setStagione] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [ricerca, setRicerca] = useState("");
  // Dalla home si arriva già filtrati: ?quota=da_versare
  const [parametri] = useSearchParams();
  const [filtro, setFiltro] = useState(() => (parametri.get("quota") === "da_versare" ? "da_versare" : ""));

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
    listAllenatori({ stagioneId })
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
  }, [gestisciErrore, stagioneId]);

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
      <div className="adm-page" aria-busy="true" aria-label="Caricamento degli allenatori">
        <span className="adm-sagoma adm-sagoma-titolo" />
        <span className="adm-sagoma adm-sagoma-riga" style={{ width: "40%" }} />
        <span className="adm-sagoma adm-sagoma-scheda" />
        <span className="adm-sagoma adm-sagoma-scheda" />
      </div>
    );
  }

  const voci = FILTRI.map((f) => ({
    ...f,
    conta: f.chiave === "" ? allenatori.length
      : f.chiave === "da_versare" ? riepilogo.daVersare
        : riepilogo.maiEntrati,
    tono: f.chiave === "" ? undefined : "attenzione"
  }));

  const azzera = () => { setFiltro(""); setRicerca(""); };

  return (
    <div className="adm-page prs-pagina">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <p className="adm-occhiello">Persone</p>
          <h1 className="adm-page-title">Allenatori</h1>
          <p className="adm-page-sub">
            {allenatori.length === 0
              ? "Nessun account ha il ruolo di allenatore."
              : `${allenatori.length} ${allenatori.length === 1 ? "allenatore" : "allenatori"}, con le squadre che seguono e la loro quota`}
            {stagione && ` · stagione ${stagione.nome}`}.
          </p>
        </div>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {/* ---------- Da sistemare ----------
          Le stesse due domande dei filtri, dette come compiti e solo se
          c'è qualcosa: chi deve ancora versare, e chi non ha mai aperto il
          sito — quello va avvisato di persona, il sito da solo non lo
          raggiunge. */}
      {allenatori.length > 0 && (riepilogo.daVersare > 0 || riepilogo.maiEntrati > 0) ? (
        <section className="adm-sezione prs-da-fare" aria-labelledby="allenatori-da-fare">
          <div className="adm-sezione-testa">
            <div>
              <h2 className="adm-sezione-titolo" id="allenatori-da-fare">Da sistemare</h2>
              <p className="adm-sezione-sotto">Tocca una voce per vedere solo quelle persone.</p>
            </div>
          </div>
          <div className="adm-azioni-rapide">
            {riepilogo.daVersare > 0 && (
              <button
                type="button"
                className={`adm-tessera-azione ${filtro === "da_versare" ? "is-scelta" : ""}`}
                onClick={() => setFiltro(filtro === "da_versare" ? "" : "da_versare")}
                aria-pressed={filtro === "da_versare"}
              >
                <span className="adm-tessera-icona"><FaEuroSign aria-hidden="true" /></span>
                <span className="adm-tessera-titolo">
                  {riepilogo.daVersare === 1 ? "1 quota da versare" : `${riepilogo.daVersare} quote da versare`}
                </span>
                <span className="adm-tessera-testo">{euro(riepilogo.daIncassare)} ancora da incassare</span>
                <FaArrowRight className="adm-tessera-freccia" aria-hidden="true" />
              </button>
            )}
            {riepilogo.maiEntrati > 0 && (
              <button
                type="button"
                className={`adm-tessera-azione is-attenzione ${filtro === "mai_entrati" ? "is-scelta" : ""}`}
                onClick={() => setFiltro(filtro === "mai_entrati" ? "" : "mai_entrati")}
                aria-pressed={filtro === "mai_entrati"}
              >
                <span className="adm-tessera-icona"><FaUserClock aria-hidden="true" /></span>
                <span className="adm-tessera-titolo">
                  {riepilogo.maiEntrati === 1 ? "1 mai entrato nel sito" : `${riepilogo.maiEntrati} mai entrati nel sito`}
                </span>
                <span className="adm-tessera-testo">Non hanno visto la loro quota: vanno avvisati di persona</span>
                <FaArrowRight className="adm-tessera-freccia" aria-hidden="true" />
              </button>
            )}
          </div>
        </section>
      ) : allenatori.length > 0 && (
        <p className="prs-tutto-ok" role="status">
          <FaCheckCircle aria-hidden="true" />
          <span><strong>Tutto in ordine.</strong> Ogni allenatore ha versato la sua quota ed è entrato nel sito.</span>
        </p>
      )}

      {allenatori.length > 0 && (
        <div className="prs-filtri">
          <LinguetteFiltro
            voci={voci}
            attiva={filtro}
            onCambia={setFiltro}
            etichetta="Quali allenatori mostrare"
          />
          <div className="prs-cerca">
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
        </div>
      )}

      {visibili.length === 0 ? (
        allenatori.length === 0 ? (
          <div className="adm-vuoto-amico">
            <span className="adm-vuoto-icona"><FaChalkboardTeacher aria-hidden="true" /></span>
            <h2>Ancora nessun allenatore</h2>
            <p>Un account diventa allenatore dalla sezione Utenti: da lì gli si dà il ruolo e le squadre.</p>
          </div>
        ) : (
          <div className="adm-vuoto-amico">
            <span className="adm-vuoto-icona">
              {filtro && !ricerca.trim() ? <FaCheckCircle aria-hidden="true" /> : <FaSearch aria-hidden="true" />}
            </span>
            <h2>
              {filtro === "da_versare" && !ricerca.trim() ? "Nessuna quota da versare"
                : filtro === "mai_entrati" && !ricerca.trim() ? "Sono entrati tutti"
                  : "Nessuno corrisponde"}
            </h2>
            <p>
              {filtro && !ricerca.trim()
                ? "Qui non c'è niente da sistemare."
                : "Prova a cercare in un altro modo, o togli i filtri."}
            </p>
            <button type="button" className="adm-btn adm-btn-primary" onClick={azzera}>
              Mostra tutti gli allenatori
            </button>
          </div>
        )
      ) : (
        <ul className="adm-atleti prs-elenco">
          {visibili.map((a) => (
            <li key={a.utenteId}>
              {/* Non porta a una scheda: la scheda è dell'atleta, e chi
                  allena senza giocare non ne ha una. */}
              <div
                className={`adm-atleta-riga adm-allenatore-riga prs-riga ${
                  a.quotaCentesimi == null || !a.ultimoAccesso ? "is-attenzione" : ""
                }`}
              >
                <Ritratto nome={a.nomeCompleto} url={a.immagineUrl} dimensione="m" />

                <div className="adm-atleta-chi">
                  <span className="adm-atleta-nome">{a.nomeCompleto}</span>
                  <span className="adm-atleta-sotto">
                    <a href={`mailto:${a.email}`} className="adm-email">{a.email}</a>
                  </span>
                  {!a.ultimoAccesso && (
                    <span className="adm-atleta-nota adm-atleta-nota-attenzione">
                      <FaUserClock aria-hidden="true" /> mai entrato nel sito
                    </span>
                  )}
                </div>

                <div className="adm-atleta-cert prs-stato">
                  <span className="prs-stato-cosa">Allena</span>
                  <span className="prs-allena">
                    {a.allena.length ? a.allena.map((s) => s.nome).join(", ") : "Nessuna squadra affidata"}
                  </span>
                  {a.gioca.length > 0 && (
                    <span className="adm-atleta-nota">gioca in {a.gioca.join(", ")}</span>
                  )}
                </div>

                <div className="adm-atleta-quota prs-stato">
                  <span className="prs-stato-cosa">Quota</span>
                  {a.quotaCentesimi == null ? (
                    <span className="prs-pastiglia is-attenzione">
                      <FaEuroSign aria-hidden="true" /> Non impostata
                    </span>
                  ) : (
                    <>
                      <span className={`prs-pastiglia ${a.manca > 0 ? "is-aperta" : "is-ok"}`}>
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
