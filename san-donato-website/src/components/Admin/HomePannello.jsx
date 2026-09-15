import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaUserCheck, FaHeartbeat, FaEuroSign, FaCalendarAlt, FaNewspaper,
  FaTrophy, FaExclamationCircle, FaCheckCircle, FaArrowRight, FaClock,
  FaCheckDouble, FaTag, FaRunning
} from "react-icons/fa";
import { getCruscotto, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { euro } from "../../utils/soldi";
import "../../css/Admin.css";

/* Dove sta un appuntamento nel pannello: sbagliando sezione, un allenatore
   finirebbe su una pagina che non ha il permesso di aprire. */
const SEZIONE_DI = {
  partita: "partite",
  torneo: "partite",
  allenamento: "partite"
};

const NOME_RUOLO = {
  admin: "Amministratore",
  segreteria: "Segreteria",
  editor: "Redattore",
  coach: "Allenatore"
};

function giornoEora(iso, conOra) {
  const d = new Date(iso);
  const giorno = d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short" });
  if (!conOra) return giorno;
  return `${giorno} · ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * Un gruppo di tessere con il suo titolo.
 *
 * Definito qui fuori e non dentro al componente: creato a ogni disegno,
 * React lo tratterebbe come un tipo nuovo ogni volta e rifarebbe da capo
 * tutte le tessere che contiene.
 */
function Gruppo({ titolo, icona: Icona, children }) {
  return (
    <section className="hom-gruppo">
      <h2 className="hom-gruppo-titolo">
        <Icona aria-hidden="true" /> {titolo}
      </h2>
      <div className="hom-tessere">{children}</div>
    </section>
  );
}

/** Una tessera con un numero e dove andare a sistemarlo. */
function Tessera({ icona: Icona, valore, etichetta, a, tono = "" }) {
  const dentro = (
    <>
      <span className="hom-tessera-icona"><Icona aria-hidden="true" /></span>
      <span className="hom-tessera-numero">{valore}</span>
      <span className="hom-tessera-testo">{etichetta}</span>
    </>
  );

  // Senza destinazione resta un riquadro da leggere, non un pulsante finto
  return a
    ? <Link to={a} className={`hom-tessera ${tono}`}>{dentro}</Link>
    : <div className={`hom-tessera ${tono}`}>{dentro}</div>;
}

/**
 * La prima schermata di chi amministra qualcosa.
 *
 * Prima entrando si finiva dritti su un elenco — le notizie per un redattore,
 * gli eventi per un allenatore — e toccava scoprire da soli se ci fosse
 * qualcosa da fare. Qui la pagina risponde alla domanda vera, che è sempre
 * la stessa: c'è qualcosa che aspetta me?
 *
 * Quello che compare dipende dalle capacità, non dal nome del ruolo: la
 * risposta arriva già composta dal server, e qui si disegna soltanto.
 */
export default function HomePannello() {
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();
  const area = useArea();

  // Chi controlla i certificati: segreteria e amministratori.
  const puoValidare = (user?.capabilities ?? []).includes("certificato.registra");

  const [dati, setDati] = useState(null);
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
        <FaExclamationCircle /> <span>{errore || "Non riesco a leggere la situazione."}</span>
      </div>
    );
  }

  /*
   * Niente più elenco di avvisi qui sopra.
   *
   * C'era una riga per ogni cosa in sospeso — "38 persone aspettano di
   * essere messe in squadra" — sopra alle tessere che dicevano gli stessi
   * numeri due centimetri più in basso. Due volte la stessa informazione,
   * di cui una scritta in modo da sembrare urgente: le tessere bastano, e
   * si leggono in un colpo d'occhio invece che una frase per volta.
   */

  return (
    <div className="adm-page hom">
      <header className="hom-testa">
        <p className="hom-saluto">
          Ciao, <strong>{user?.name}</strong>
        </p>
        <p className="hom-ruolo">{NOME_RUOLO[user?.role] ?? user?.role}</p>
      </header>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}


      {/* ---------- I numeri, divisi per argomento ----------

          Erano tutti in una fila sola: nove tessere di fila, e per trovare
          quella che si cercava si leggevano le etichette una per una.
          Divise per argomento si salta direttamente al gruppo giusto — e
          un gruppo che non riguarda chi guarda non compare affatto. */}

      {(dati.richieste !== undefined || dati.certificati || dati.iscritti !== undefined) && (
        <Gruppo titolo="Atleti e iscrizioni" icona={FaUserCheck}>
          {dati.richieste !== undefined && (
            <Tessera
              icona={FaUserCheck}
              valore={dati.richieste}
              etichetta="richieste da decidere"
              a={`${area}/richieste`}
              tono={dati.richieste > 0 ? "is-attenzione" : ""}
            />
          )}

          {dati.iscritti !== undefined && (
            <Tessera
              icona={FaRunning}
              valore={dati.iscritti}
              etichetta="atleti in squadra"
              a={`${area}/atleti`}
            />
          )}

          {dati.certificati && (
            <>
              <Tessera
                icona={FaHeartbeat}
                valore={dati.certificati.scaduti}
                etichetta="certificati scaduti"
                a={`${area}/atleti`}
                tono={dati.certificati.scaduti > 0 ? "is-allarme" : ""}
              />
              <Tessera
                icona={FaClock}
                valore={dati.certificati.inScadenza}
                etichetta="in scadenza entro un mese"
                a={`${area}/atleti`}
                tono={dati.certificati.inScadenza > 0 ? "is-attenzione" : ""}
              />

              {/* Solo a chi li controlla davvero: a un allenatore questo
                  numero non dice niente che possa risolvere lui. */}
              {dati.certificati.daValidare !== undefined && puoValidare && (
                <Tessera
                  icona={FaCheckDouble}
                  valore={dati.certificati.daValidare}
                  etichetta="certificati da controllare"
                  a={`${area}/atleti?certificato=da_validare`}
                  tono={dati.certificati.daValidare > 0 ? "is-attenzione" : ""}
                />
              )}
            </>
          )}
        </Gruppo>
      )}

      {dati.quote && (
        <Gruppo titolo="Quote" icona={FaEuroSign}>
          <Tessera
            icona={FaEuroSign}
            valore={euro(dati.quote.daIncassare)}
            etichetta={`da incassare da ${dati.quote.quanti} iscritti`}
            a={`${area}/atleti?quota=aperta`}
          />
          <Tessera
            icona={FaTag}
            valore={dati.quote.senzaQuota}
            etichetta="quote da impostare"
            a={`${area}/atleti?quota=mancante`}
            tono={dati.quote.senzaQuota > 0 ? "is-attenzione" : ""}
          />
        </Gruppo>
      )}

      {dati.risultatiMancanti !== undefined && (
        <Gruppo titolo="Partite ed eventi" icona={FaCalendarAlt}>
          <Tessera
            icona={FaTrophy}
            valore={dati.risultatiMancanti}
            etichetta="risultati da inserire"
            a={`${area}/partite`}
            tono={dati.risultatiMancanti > 0 ? "is-attenzione" : ""}
          />
        </Gruppo>
      )}

      {dati.notizie && (
        <Gruppo titolo="Notizie" icona={FaNewspaper}>
          <Tessera
            icona={FaNewspaper}
            valore={dati.notizie.bozze}
            etichetta="bozze da finire"
            a={`${area}/notizie`}
          />
          <Tessera
            icona={FaClock}
            valore={dati.notizie.programmate}
            etichetta="notizie programmate"
            a={`${area}/notizie`}
          />
          <Tessera
            icona={FaCheckDouble}
            valore={dati.notizie.online}
            etichetta="online sul sito"
            a={`${area}/notizie`}
          />
        </Gruppo>
      )}

      {/* ---------- Prossimi appuntamenti ---------- */}
      {dati.prossimi && (
        <section className="adm-panel">
          <h2 className="adm-panel-title">
            <FaCalendarAlt aria-hidden="true" /> I prossimi appuntamenti
          </h2>

          {dati.prossimi.length === 0 ? (
            <p className="adm-hint" style={{ marginTop: 0 }}>
              Niente in calendario. <Link to={`${area}/partite/nuova`} className="adm-inline-link">
                Aggiungi un evento
              </Link>
            </p>
          ) : (
            <ul className="hom-eventi">
              {dati.prossimi.map((e) => (
                <li key={e.id}>
                  <Link to={`${area}/${SEZIONE_DI[e.tipo] ?? "eventi"}/${e.id}`} className="hom-evento">
                    <span
                      className="hom-evento-colore"
                      style={{ backgroundColor: e.colore || "#999" }}
                      aria-hidden="true"
                    />
                    <span className="hom-evento-quando">
                      {giornoEora(e.inizio, !e.tuttoIlGiorno)}
                    </span>
                    <span className="hom-evento-titolo">{e.titolo}</span>
                    <span className="hom-evento-squadra">{e.squadra}</span>
                    {e.visibileDal && new Date(e.visibileDal) > adesso && (
                      <span className="adm-status adm-status-future">Non ancora sul sito</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
