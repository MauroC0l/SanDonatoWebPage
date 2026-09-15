import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCalendarAlt, FaMapMarkerAlt, FaTrophy, FaExclamationCircle,
  FaHourglassHalf, FaVideo
} from "react-icons/fa";
import { getProfilo, eventiDiSquadra, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { linkMappa } from "../../utils/linkMappa";
import "../../css/Admin.css";

/** Quanto avanti si guarda, e quanto indietro. */
const GIORNI_AVANTI = 120;
const GIORNI_INDIETRO = 60;

const NOME_TIPO = {
  partita: "Partita",
  allenamento: "Allenamento",
  torneo: "Torneo",
  riunione: "Riunione",
  evento: "Evento",
  altro: ""
};

function giorno(iso) {
  return new Date(iso).toLocaleDateString("it-IT", {
    weekday: "long", day: "2-digit", month: "long"
  });
}

function ora(iso) {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Un blocco di appuntamenti — quelli in programma, oppure quelli già svolti.
 *
 * Definito qui fuori e non dentro al componente: creato a ogni render, React
 * lo tratterebbe come un tipo nuovo ogni volta e rimonterebbe l'intero elenco
 * a ogni battuta, perdendo posizione dello scorrimento e stato interno.
 */
function Elenco({ titolo, voci, vuoto, passato = false, scorre = false }) {
  return (
    <section className="adm-panel">
      <h2 className="adm-panel-title">{titolo}</h2>

      {voci.length === 0 ? (
        <p className="adm-hint" style={{ marginTop: 0 }}>{vuoto}</p>
      ) : (
        <ul className={`atl-eventi ${scorre ? "atl-eventi-scorre" : ""}`}>
          {voci.map((e) => {
            const mappa = linkMappa({
              luogo: e.luogo,
              latitudine: e.latitudine,
              longitudine: e.longitudine
            });

            return (
              <li key={e.id} className={`atl-evento ${passato ? "is-passato" : ""}`}>
                <div className="atl-evento-quando">
                  <span className="atl-evento-giorno">{giorno(e.inizio)}</span>
                  {!e.tuttoIlGiorno && <span className="atl-evento-ora">{ora(e.inizio)}</span>}
                </div>

                <div className="atl-evento-cosa">
                  <span className="atl-evento-titolo">{e.titolo}</span>

                  <div className="atl-evento-meta">
                    {NOME_TIPO[e.tipo] && <span className="adm-sport-tag">{NOME_TIPO[e.tipo]}</span>}

                    {e.luogo && (
                      mappa ? (
                        <a href={mappa} target="_blank" rel="noreferrer" className="adm-inline-link">
                          <FaMapMarkerAlt aria-hidden="true" /> {e.luogo}
                        </a>
                      ) : (
                        <span><FaMapMarkerAlt aria-hidden="true" /> {e.luogo}</span>
                      )
                    )}

                    {e.risultato && (
                      <span className="adm-risultato"><FaTrophy aria-hidden="true" /> {e.risultato}</span>
                    )}

                    {e.diretta && !passato && (
                      <a href={e.diretta} target="_blank" rel="noreferrer" className="adm-inline-link">
                        <FaVideo aria-hidden="true" /> Diretta
                      </a>
                    )}
                  </div>

                  {e.descrizione && <p className="atl-evento-note">{e.descrizione}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Gli appuntamenti della propria squadra.
 *
 * Legge dall'API pubblica degli eventi, la stessa che alimenta il calendario
 * del sito: un atleta non ha il permesso di gestire gli eventi, e non deve
 * averlo per poterli guardare. Qui il calendario è solo ristretto alla sua
 * squadra e ridotto all'osso, perché la domanda è sempre la stessa —
 * quand'è il prossimo allenamento e dove si gioca domenica.
 */
export default function SquadraPage() {
  const navigate = useNavigate();
  const { sessionExpired } = useAuth();

  // Tutte le squadre di cui fa parte, e quale si sta guardando.
  const [squadre, setSquadre] = useState([]);
  const [sceltaId, setSceltaId] = useState(null);
  const [eventi, setEventi] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");

  const [adesso] = useState(() => new Date());

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    setErrore(err.message || "Caricamento non riuscito.");
  }, [navigate, sessionExpired]);

  // Le squadre si leggono una volta sola: cambiare quella guardata non
  // deve rifare il giro del profilo.
  useEffect(() => {
    let attivo = true;

    getProfilo()
      .then((profilo) => {
        if (!attivo) return;

        const sue = profilo.appartenenze ?? [];
        setSquadre(sue);
        setSceltaId(sue[0]?.squadraId ?? null);

        // Nessuna squadra: non c'è niente da caricare, e l'attesa finisce qui.
        if (sue.length === 0) setCaricamento(false);
      })
      .catch((err) => {
        if (!attivo) return;
        gestisciErrore(err);
        setCaricamento(false);
      });

    return () => { attivo = false; };
  }, [gestisciErrore]);

  useEffect(() => {
    if (!sceltaId) return;
    let attivo = true;

    eventiDiSquadra(sceltaId, {
      da: new Date(adesso.getTime() - GIORNI_INDIETRO * 86400000),
      a: new Date(adesso.getTime() + GIORNI_AVANTI * 86400000)
    })
      .then((elenco) => {
        if (!attivo) return;
        setEventi(elenco);
        setCaricamento(false);
      })
      .catch((err) => {
        if (!attivo) return;
        gestisciErrore(err);
        setCaricamento(false);
      });

    return () => { attivo = false; };
  }, [sceltaId, gestisciErrore, adesso]);

  /* Prossimi e passati separati, e i passati dal più recente: sono due
     domande diverse, "cosa devo fare" e "com'è andata". */
  const { prossimi, passati } = useMemo(() => {
    const limite = adesso.getTime();
    const avanti = [];
    const indietro = [];

    for (const e of eventi) {
      const fine = new Date(e.fine ?? e.inizio).getTime();
      (fine >= limite ? avanti : indietro).push(e);
    }

    indietro.reverse();
    return { prossimi: avanti, passati: indietro };
  }, [eventi, adesso]);

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento del calendario…</p>
      </div>
    );
  }

  const scelta = squadre.find((s) => s.squadraId === sceltaId) ?? squadre[0] ?? null;

  if (squadre.length === 0) {
    return (
      <div className="adm-page">
        <div className="adm-attesa">
          <FaHourglassHalf className="adm-attesa-icona" aria-hidden="true" />
          <h1 className="adm-attesa-titolo">Non hai ancora una squadra</h1>
          <p className="adm-attesa-testo">
            Appena l&apos;allenatore o la segreteria ti assegnano a una squadra,
            qui troverai allenamenti e partite.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">{scelta?.squadra ?? "La tua squadra"}</h1>
          <p className="adm-page-sub">
            {scelta?.sport
              ? `${scelta.sport} · allenamenti, partite e appuntamenti.`
              : "Allenamenti, partite e appuntamenti della tua squadra."}
          </p>
        </div>
      </div>

      {/* I pulsanti compaiono solo a chi ha più di una squadra: con una
          sola, una fila di scelte da cui non si può scegliere è rumore.
          Portano lo sport scritto perché è quello che distingue davvero —
          "Under 14" da solo non dice se è il volley o il calcio. */}
      {squadre.length > 1 && (
        <div className="atl-squadre" role="tablist" aria-label="Le tue squadre">
          {squadre.map((s) => {
            const attiva = s.squadraId === sceltaId;

            return (
              <button
                key={s.squadraId}
                type="button"
                role="tab"
                aria-selected={attiva}
                className={`atl-squadra ${attiva ? "is-attiva" : ""}`}
                onClick={() => { setCaricamento(true); setSceltaId(s.squadraId); }}
              >
                {s.colore && (
                  <span
                    className="tnd-pallino"
                    style={{ backgroundColor: s.colore }}
                    aria-hidden="true"
                  />
                )}
                <span className="atl-squadra-nome">{s.squadra}</span>
                <span className="atl-squadra-sport">{s.sport}</span>
              </button>
            );
          })}
        </div>
      )}

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {eventi.length === 0 ? (
        <div className="adm-empty">
          <FaCalendarAlt className="adm-empty-icon" />
          <p>
            Nessun appuntamento in calendario. Li inserisce l&apos;allenatore:
            appena lo fa, compaiono qui.
          </p>
        </div>
      ) : (
        <>
          <Elenco
            titolo="In programma"
            voci={prossimi}
            vuoto="Niente in programma nei prossimi mesi."
          />
          {/* I già svolti scorrono dentro al riquadro dopo i primi cinque:
              sono la parte che interessa meno — "com'è andata" contro
              "cosa devo fare" — e per intero spingevano il resto della
              pagina fuori dallo schermo. */}
          <Elenco
            titolo="Già svolti"
            voci={passati}
            vuoto="Niente negli ultimi due mesi."
            passato
            scorre
          />
        </>
      )}
    </div>
  );
}
