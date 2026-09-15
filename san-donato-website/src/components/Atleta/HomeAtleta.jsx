import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHeartbeat, FaCalendarAlt, FaMapMarkerAlt, FaExclamationCircle,
  FaCheckCircle, FaArrowRight, FaHourglassHalf, FaTimesCircle, FaUsers
} from "react-icons/fa";
import { getCruscotto, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { statoCertificato, quantoManca } from "../../utils/certificato";
import { linkMappa } from "../../utils/linkMappa";
import "../../css/Admin.css";

const NOME_TIPO = {
  partita: "Partita",
  allenamento: "Allenamento",
  torneo: "Torneo",
  riunione: "Riunione",
  evento: "Evento"
};

/**
 * Cosa dire all'atleta sul suo certificato, per ogni stato possibile.
 *
 * Una tabella e non una fila di condizioni: quando gli stati sono passati
 * da quattro a sette — con il file mancante, il controllo in corso e il
 * rifiuto — i tre nuovi non comparivano da nessuna parte, e il riquadro
 * restava con la sola icona e il pulsante. Il ripiego in fondo fa sì che
 * un altro stato aggiunto domani dica comunque qualcosa.
 */
/**
 * Dove si va a compilare quello che manca.
 *
 * Da quando i recapiti hanno una pagina loro, "completala" non può
 * mandare tutti all'iscrizione: chi ha solo il telefono da scrivere ci
 * arriverebbe e non troverebbe la casella. Se manca solo roba da
 * contatti si va ai contatti, altrimenti all'iscrizione — che è dove
 * sta tutto il resto.
 */
const DAI_CONTATTI = ["un numero di telefono", "il contatto di un genitore"];

function doveSiCompila(manca) {
  const soloContatti = manca.length > 0 && manca.every((m) => DAI_CONTATTI.includes(m));
  return soloContatti ? "/area-riservata/contatti" : "/area-riservata/iscrizione";
}

function messaggioCertificato(cert) {
  const testi = {
    mancante: {
      titolo: "Non risulta nessun certificato medico",
      nota: "Senza non puoi allenarti né giocare. Appena ce l'hai, caricalo qui.",
      azione: "Carica il certificato"
    },
    senza_file: {
      titolo: "Manca la copia del certificato",
      nota: "Hai scritto la scadenza ma non hai ancora allegato il foglio: "
        + "finché la segreteria non lo vede, non risulti a posto.",
      azione: "Carica la copia"
    },
    da_controllare: {
      titolo: "Certificato consegnato, in attesa di controllo",
      nota: "La segreteria lo guarda appena può. Se c'è qualcosa che non va "
        + "te lo scrive qui, con il motivo.",
      azione: null
    },
    respinto: {
      titolo: "Il certificato è stato respinto",
      nota: "Nella pagina Iscrizione trovi scritto cosa non andava. "
        + "Finché non ne carichi uno nuovo non puoi scendere in campo.",
      azione: "Caricane un altro"
    },
    scaduto: {
      titolo: "Il tuo certificato medico è scaduto",
      nota: "Finché non lo rinnovi non puoi scendere in campo. Fissa la visita e caricalo qui.",
      azione: "Carica il nuovo"
    },
    in_scadenza: {
      titolo: `Il certificato medico scade ${quantoManca(cert.giorni)}`,
      nota: "Conviene prenotare la visita adesso: dopo la scadenza non potrai giocare.",
      azione: "Carica il nuovo"
    },
    valido: {
      titolo: "Certificato medico a posto",
      nota: `Controllato dalla segreteria. Scade ${quantoManca(cert.giorni)}.`,
      azione: null
    }
  };

  return testi[cert.chiave] ?? {
    titolo: cert.etichetta,
    nota: "Controlla la pagina Iscrizione per i dettagli.",
    azione: "Vai all'iscrizione"
  };
}

function quando(iso, conOra) {
  const d = new Date(iso);
  const giorno = d.toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long" });
  if (!conOra) return giorno;
  return `${giorno}, ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * La prima schermata di un atleta.
 *
 * Le tre cose che gli servono davvero, in quest'ordine: posso giocare (il
 * certificato), cosa devo fare (quello che manca all'iscrizione), quando si
 * gioca (i prossimi appuntamenti). Tutto il resto è a un clic di distanza.
 *
 * Deliberatamente senza tessere piene di numeri: a un ragazzo di quattordici
 * anni un cruscotto da ufficio non dice niente, mentre "il certificato scade
 * fra 12 giorni" sì.
 */
export default function HomeAtleta() {
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();

  const [dati, setDati] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");

  const [oggi] = useState(() => new Date());

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

    getCruscotto()
      .then((c) => {
        if (!attivo) return;
        setDati(c);
        setCaricamento(false);
      })
      .catch((err) => {
        if (!attivo) return;
        gestisciErrore(err);
        setCaricamento(false);
      });

    return () => { attivo = false; };
  }, [gestisciErrore]);

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Un momento…</p>
      </div>
    );
  }

  if (!dati) {
    return (
      <div className="adm-alert adm-alert-error" role="alert">
        <FaExclamationCircle /> <span>{errore || "Non riesco a leggere i tuoi dati."}</span>
      </div>
    );
  }

  const { appartenenza, manca, appuntamenti } = dati;
  const cert = statoCertificato(dati.certificatoScadenza, oggi, {
    fileCaricato: dati.certificatoCaricato,
    validazione: dati.certificatoStato
  });

  const messaggio = messaggioCertificato(cert);

  const inAttesa = appartenenza?.stato === "in_attesa";
  const respinta = appartenenza?.stato === "rifiutata";
  const inSquadra = appartenenza?.stato === "approvata";

  return (
    <div className="adm-page hom">
      <header className="hom-testa">
        <p className="hom-saluto">
          Ciao, <strong>{user?.name}</strong>
        </p>
        {inSquadra && (
          <p className="hom-ruolo">
            <FaUsers aria-hidden="true" /> {appartenenza.squadra}
          </p>
        )}
      </header>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {/* ---------- A che punto sei ---------- */}
      {inAttesa && (
        <div className="adm-alert adm-alert-info">
          <FaHourglassHalf />
          <span>
            La tua richiesta per {appartenenza.sportChiesto} è arrivata: adesso
            l&apos;allenatore o la segreteria devono assegnarti a una squadra.
            Appena succede, qui trovi allenamenti e partite.
          </span>
        </div>
      )}

      {respinta && (
        <div className="adm-alert adm-alert-error" role="status">
          <FaTimesCircle />
          <span>
            La richiesta per {appartenenza.sportChiesto} è stata respinta
            {appartenenza.motivoRifiuto ? `: ${appartenenza.motivoRifiuto}` : "."}
            {" "}Per rifarla, parlane con la segreteria.
          </span>
        </div>
      )}

      {inSquadra && (
        <>
          {/* ---------- Il certificato ---------- */}
          <section className={`hom-scadenza ${cert.classe}`}>
            <FaHeartbeat className="hom-scadenza-icona" aria-hidden="true" />

            <div className="hom-scadenza-testo">
              <p className="hom-scadenza-titolo">{messaggio.titolo}</p>
              <p className="hom-scadenza-nota">{messaggio.nota}</p>
            </div>

            {messaggio.azione && (
              <Link to="/area-riservata/iscrizione" className="adm-btn adm-btn-primary">
                {messaggio.azione}
              </Link>
            )}
          </section>

          {/* ---------- Cosa manca ---------- */}
          {manca.length > 0 ? (
            <div className="adm-alert adm-alert-info">
              <FaExclamationCircle />
              <span>
                Per completare l&apos;iscrizione manca ancora <strong>{manca.join(", ")}</strong>.
              </span>
              <Link to={doveSiCompila(manca)} className="adm-inline-link adm-inline-link-fine">
                Completala <FaArrowRight aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <p className="hom-tutto-bene">
              <FaCheckCircle aria-hidden="true" />
              La tua iscrizione è completa: hai consegnato tutto quello che serve.
            </p>
          )}

          {/* ---------- I prossimi appuntamenti ---------- */}
          <section className="adm-panel">
            <h2 className="adm-panel-title">
              <FaCalendarAlt aria-hidden="true" /> I tuoi prossimi appuntamenti
            </h2>

            {appuntamenti.length === 0 ? (
              <p className="adm-hint" style={{ marginTop: 0 }}>
                Niente in programma per ora. Li inserisce l&apos;allenatore: appena
                lo fa, compaiono qui.
              </p>
            ) : (
              <ul className="atl-eventi">
                {appuntamenti.map((e) => {
                  const mappa = linkMappa({
                    luogo: e.luogo,
                    latitudine: e.latitudine,
                    longitudine: e.longitudine
                  });

                  return (
                    <li key={e.id} className="atl-evento">
                      <div className="atl-evento-quando">
                        <span className="atl-evento-giorno">
                          {quando(e.inizio, false)}
                        </span>
                        {!e.tuttoIlGiorno && (
                          <span className="atl-evento-ora">
                            {new Date(e.inizio).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
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
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <Link to="/area-riservata/squadra" className="adm-btn adm-btn-ghost adm-btn-block">
              Vedi tutto il calendario della squadra <FaArrowRight aria-hidden="true" />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
