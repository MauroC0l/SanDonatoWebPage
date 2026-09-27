import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaExclamationCircle, FaLayerGroup, FaRunning, FaArrowUp, FaArrowDown
} from "react-icons/fa";
import { listStagioni, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { useDialoghi } from "../../context/dialoghi";
import { useStagione } from "../../context/stagione";
import { euro } from "../../utils/soldi";
import "../../css/Admin.css";

/**
 * Le stagioni una accanto all'altra: quanti iscritti, quanti rinnovi, quanti
 * soldi entrati e quanti mancano.
 *
 * La stagione in corso in cima e più grande: è quella che si segue giorno
 * per giorno. Sotto, le passate, per il confronto — "quest'anno abbiamo più
 * o meno ragazzi?" è la prima domanda di ogni assemblea.
 *
 * I numeri li calcola il server da quello che ogni stagione ha scritto, non
 * da come sono le squadre oggi (server/riepilogo-stagioni.js).
 */

function Numero({ valore, testo, tono = "" }) {
  return (
    <div className={`adm-stg-numero ${tono}`}>
      <span className="adm-stg-cifra">{valore}</span>
      <span className="adm-stg-testo">{testo}</span>
    </div>
  );
}

/** +3 / −5 rispetto alla stagione prima, o niente se non c'è con cosa confrontare. */
function Variazione({ ora, prima }) {
  if (prima == null) return null;
  const d = ora - prima;
  if (d === 0) return <span className="adm-stg-var">come la stagione prima</span>;
  const Icona = d > 0 ? FaArrowUp : FaArrowDown;
  return (
    <span className={`adm-stg-var ${d > 0 ? "is-su" : "is-giu"}`}>
      <Icona aria-hidden="true" /> {Math.abs(d)} rispetto alla stagione prima
    </span>
  );
}

function SchedaStagione({ s, prima, onApri }) {
  const q = s.quote;
  const percento = q.dovuto > 0 ? Math.min(100, Math.round((q.versato / q.dovuto) * 100)) : 0;

  return (
    <section className={`adm-panel adm-stg ${s.inCorso ? "is-in-corso" : ""}`}>
      <header className="adm-stg-testa">
        <h2 className="adm-stg-nome">
          Stagione {s.nome}
          {s.inCorso && <span className="adm-status adm-status-publish">In corso</span>}
        </h2>
        <button type="button" className="adm-btn adm-btn-secondary" onClick={() => onApri(s)}>
          <FaRunning /> Atleti di questa stagione
        </button>
      </header>

      <div className="adm-stg-griglia">
        <div className="adm-stg-blocco">
          <h3 className="adm-stg-titolo">Iscritti</h3>
          <div className="adm-stg-numeri">
            <Numero valore={s.atleti} testo="atleti in squadra" />
            <Numero valore={s.primeIscrizioni} testo="prime iscrizioni" />
            <Numero valore={s.rinnovi} testo="rinnovi" />
            <Numero valore={s.ritirati} testo="ritirati" tono={s.ritirati ? "is-attenzione" : ""} />
            <Numero valore={s.allenatori} testo="allenatori con quota" />
          </div>
          <Variazione ora={s.atleti} prima={prima?.atleti} />

          {s.perSport.length > 0 && (
            <ul className="adm-stg-sport">
              {s.perSport.map((p) => (
                <li key={p.sport}><strong>{p.quanti}</strong> {p.sport}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="adm-stg-blocco">
          <h3 className="adm-stg-titolo">Quote</h3>
          <div className="adm-stg-numeri">
            <Numero valore={euro(q.versato)} testo="incassati" />
            <Numero valore={euro(q.residuo)} testo="ancora da incassare" tono={q.residuo ? "is-attenzione" : ""} />
            <Numero valore={q.saldate} testo="quote saldate" />
            <Numero valore={q.senzaQuota} testo="senza quota" tono={q.senzaQuota ? "is-attenzione" : ""} />
          </div>

          <div
            className="adm-stg-barra"
            role="img"
            aria-label={`Incassato il ${percento}% di ${euro(q.dovuto)}`}
          >
            <span style={{ width: `${percento}%` }} />
          </div>
          <span className="adm-hint">
            {percento}% di {euro(q.dovuto)} dovuti
            {s.inCorso && " (le seconde metà di chi si è ritirato prima di gennaio non contano)"}
          </span>
        </div>
      </div>
    </section>
  );
}

export default function StagioniPage() {
  const navigate = useNavigate();
  const area = useArea();
  const { sessionExpired } = useAuth();
  const { avvisa } = useDialoghi();
  const { scegli } = useStagione();

  const [stagioni, setStagioni] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");

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
    listStagioni()
      .then((elenco) => {
        if (!attivo) return;
        setStagioni(elenco);
        setCaricamento(false);
      })
      .catch((err) => {
        if (!attivo) return;
        gestisciErrore(err);
        setCaricamento(false);
      });
    return () => { attivo = false; };
  }, [gestisciErrore]);

  // Aprire gli atleti di una stagione vuol dire sceglierla in alto
  const apri = (s) => {
    scegli(s.id);
    navigate(`${area}/atleti`);
  };

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento delle stagioni…</p>
      </div>
    );
  }

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">Stagioni</h1>
          <p className="adm-page-sub">
            Dal 1° luglio al 30 giugno. Iscritti e quote di ogni stagione, com&apos;erano allora.
          </p>
        </div>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {stagioni.length === 0 ? (
        <div className="adm-empty">
          <FaLayerGroup className="adm-empty-icon" />
          <p>Nessuna stagione ancora: la prima nasce con il primo iscritto.</p>
        </div>
      ) : (
        <div className="adm-stg-elenco">
          {stagioni.map((s, i) => (
            <SchedaStagione key={s.id} s={s} prima={stagioni[i + 1] ?? null} onApri={apri} />
          ))}
        </div>
      )}
    </div>
  );
}
