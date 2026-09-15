import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHistory, FaSearch, FaExclamationCircle, FaUserCircle, FaRegCalendarAlt, FaTimes
} from "react-icons/fa";
import { listAttivita, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import Tendina from "./Tendina";
import CampoData from "./CampoData";
import Paginazione from "./Paginazione";
import "../../css/Admin.css";

/** Gli oggetti su cui si può filtrare, con il nome che usa la gente. */
const TIPI = [
  { valore: "", etichetta: "Tutto" },
  { valore: "notizia", etichetta: "Notizie" },
  { valore: "evento", etichetta: "Eventi" },
  { valore: "richiesta", etichetta: "Richieste" },
  { valore: "atleta", etichetta: "Atleti e quote" },
  { valore: "utente", etichetta: "Account" }
];

/**
 * Il colore della riga, dal prefisso dell'azione.
 *
 * Le cancellazioni si devono distinguere a colpo d'occhio da tutto il resto:
 * sono le uniche che non si possono rifare, e sono quelle che si va a
 * cercare quando manca qualcosa.
 */
function tono(azione) {
  if (/\.(cestina|elimina|pagamento_tolto|respinge)$/.test(azione)) return "is-toglie";
  if (/\.(crea|pubblica|accoglie|pagamento)$/.test(azione)) return "is-aggiunge";
  return "";
}

function quando(iso) {
  const d = new Date(iso);
  const oggi = new Date();
  const stessoGiorno = d.toDateString() === oggi.toDateString();

  const ora = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  if (stessoGiorno) return `oggi, ${ora}`;

  return `${d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}, ${ora}`;
}

/**
 * Il registro: chi ha fatto cosa, dal più recente.
 *
 * Serve a rispondere a domande che prima restavano senza risposta — chi ha
 * cestinato quell'articolo, chi ha respinto quella richiesta, quando è stata
 * cambiata quella quota. Con dieci persone che toccano lo stesso sito, "non
 * sono stato io" è una conversazione che si chiude solo così.
 */
export default function RegistroPage() {
  const navigate = useNavigate();
  const { sessionExpired } = useAuth();

  const [autori, setAutori] = useState([]);
  const [errore, setErrore] = useState("");

  const [pagina, setPagina] = useState(1);
  const [tipo, setTipo] = useState("");
  const [utenteId, setUtenteId] = useState("");
  const [scritto, setScritto] = useState("");
  const [cerca, setCerca] = useState("");

  // Gli estremi dell intervallo, entrambi facoltativi: si puo dire solo
  // "da", solo "a", o tutti e due.
  const [da, setDa] = useState("");
  const [a, setA] = useState("");

  /**
   * L'identificativo della richiesta in corso.
   *
   * Lo stato di caricamento si RICAVA confrontandolo con quello dei dati già
   * arrivati, invece di essere acceso a mano dentro all'effetto: accendere
   * una spia lì dentro costringe React a un secondo render immediato a ogni
   * cambio di filtro. È lo stesso schema dell'elenco delle notizie.
   */
  const chiave = `${pagina}|${tipo}|${utenteId}|${cerca}|${da}|${a}`;

  const [dati, setDati] = useState({ chiave: null, attivita: [], totale: 0, pagine: 1 });
  const caricamento = dati.chiave !== chiave;

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

    listAttivita({
      pagina,
      tipo: tipo || undefined,
      utenteId: utenteId || undefined,
      cerca: cerca || undefined,
      da: da || undefined,
      a: a || undefined
    })
      .then((risultato) => {
        if (!attivo) return;
        setDati({ ...risultato, chiave });
        // L'elenco delle persone arriva solo con la prima pagina: cambiando
        // pagina non deve svuotarsi il filtro da cui si è appena passati.
        if (risultato.autori) setAutori(risultato.autori);
        setErrore("");
      })
      .catch((err) => {
        if (!attivo) return;
        gestisciErrore(err);
        setDati({ chiave, attivita: [], totale: 0, pagine: 1 });
      });

    return () => { attivo = false; };
  }, [chiave, pagina, tipo, utenteId, cerca, da, a, gestisciErrore]);

  const opzioniAutore = useMemo(() => [
    { valore: "", etichetta: "Tutte le persone" },
    ...autori.map((a) => ({ valore: String(a.id), etichetta: a.nome }))
  ], [autori]);

  const cambiaFiltro = (azione) => (valore) => {
    // Un filtro nuovo riparte dalla prima pagina: restare sulla dodicesima
    // di un elenco che ora ne ha due mostrerebbe il vuoto.
    setPagina(1);
    azione(valore);
  };

  const cercaOra = (evento) => {
    evento.preventDefault();
    setPagina(1);
    setCerca(scritto.trim());
  };

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">Registro</h1>
          <p className="adm-page-sub">
            Ogni operazione che cambia qualcosa lascia una riga qui. Non si
            modifica e non si cancella, nemmeno da qui.
          </p>
        </div>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      <div className="adm-toolbar">
        <Tendina
          className="adm-filter-select"
          valore={tipo}
          onChange={cambiaFiltro(setTipo)}
          opzioni={TIPI}
          segnaposto="Tutto"
          etichettaAria="Filtra per tipo"
        />

        <Tendina
          className="adm-filter-select"
          valore={utenteId}
          onChange={cambiaFiltro(setUtenteId)}
          opzioni={opzioniAutore}
          segnaposto="Tutte le persone"
          etichettaAria="Filtra per persona"
        />

        <form className="adm-search" onSubmit={cercaOra} role="search">
          <FaSearch className="adm-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="adm-input"
            value={scritto}
            onChange={(e) => setScritto(e.target.value)}
            placeholder="Cerca nel registro…"
            aria-label="Cerca nel registro"
          />
          <button type="submit" className="adm-btn adm-btn-ghost">Cerca</button>
        </form>
      </div>

      {/* L'intervallo su una riga sua: sono due campi larghi, e in mezzo agli
          altri filtri li spingerebbero a capo a ogni larghezza. */}
      <div className="adm-intervallo">
        <span className="adm-intervallo-etichetta">
          <FaRegCalendarAlt aria-hidden="true" /> Periodo
        </span>

        <div className="adm-intervallo-campo">
          <span className="adm-label">Dal</span>
          <CampoData
            valore={da}
            onChange={cambiaFiltro(setDa)}
            disabilitato={false}
            etichettaAria="Dal giorno"
            segnaposto="tutto quello che c'è"
          />
        </div>

        <div className="adm-intervallo-campo">
          <span className="adm-label">Al</span>
          <CampoData
            valore={a}
            onChange={cambiaFiltro(setA)}
            minimo={da || null}
            etichettaAria="Al giorno"
            segnaposto="fino a oggi"
          />
        </div>

        {(da || a) && (
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            onClick={() => { setPagina(1); setDa(""); setA(""); }}
          >
            <FaTimes /> Tutto il periodo
          </button>
        )}
      </div>

      {caricamento ? (
        <div className="adm-loading">
          <div className="adm-spinner" />
          <p>Caricamento del registro…</p>
        </div>
      ) : dati.attivita.length === 0 ? (
        <div className="adm-empty">
          <FaHistory className="adm-empty-icon" />
          <p>
            {cerca || tipo || utenteId || da || a
              ? "Nessuna operazione corrisponde a questi filtri."
              : "Il registro è vuoto: non è ancora stata fatta nessuna operazione."}
          </p>
        </div>
      ) : (
        <ul className="adm-registro">
          {dati.attivita.map((r) => (
            <li key={r.id} className={`adm-riga-registro ${tono(r.azione)}`}>
              <span className="adm-registro-quando">{quando(r.quando)}</span>

              <span className="adm-registro-chi">
                <FaUserCircle aria-hidden="true" />
                <span>{r.autore ?? "account cancellato"}</span>
              </span>

              <span className="adm-registro-cosa">
                {r.descrizione ?? r.azione}
                <span className="adm-registro-azione">{r.azione}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {!caricamento && (
        <Paginazione
          pagina={dati.pagina ?? pagina}
          pagine={dati.pagine}
          onCambia={setPagina}
          totale={dati.totale}
          nome={["operazione", "operazioni"]}
        />
      )}
    </div>
  );
}
