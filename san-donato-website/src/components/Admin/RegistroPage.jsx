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
import "../../css/admin/Sistema.css";

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

/** Solo l'ora: il giorno lo dice già il titolo del gruppo. */
function ora(iso) {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Il nome del giorno come lo si dice: "Oggi", "Ieri", "lunedì 22
 * settembre", con l'anno solo quando non è quello in corso.
 */
function nomeGiorno(iso) {
  const d = new Date(iso);
  const oggi = new Date();
  const ieri = new Date(oggi);
  ieri.setDate(oggi.getDate() - 1);

  if (d.toDateString() === oggi.toDateString()) return "Oggi";
  if (d.toDateString() === ieri.toDateString()) return "Ieri";

  const testo = d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== oggi.getFullYear() ? { year: "numeric" } : {})
  });
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

/**
 * Le righe raggruppate per giorno, nell'ordine in cui arrivano (dal più
 * recente). Una pagina può cominciare a metà di un giorno: il titolo si
 * ripete in cima alla pagina dopo, che è quello che ci si aspetta.
 */
function perGiorno(righe) {
  const gruppi = [];
  for (const r of righe) {
    const chiave = new Date(r.quando).toDateString();
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo?.chiave === chiave) ultimo.righe.push(r);
    else gruppi.push({ chiave, titolo: nomeGiorno(r.quando), righe: [r] });
  }
  return gruppi;
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
    <div className="adm-page reg-pagina">
      <div className="adm-page-head">
        <div className="reg-testa">
          <p className="adm-occhiello">Sistema</p>
          <h1 className="adm-page-title">Registro</h1>
          <p className="adm-page-sub">
            Chi ha fatto cosa, e quando: ogni operazione che cambia qualcosa
            lascia una riga qui. Non si modifica e non si cancella.
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
        <div aria-hidden="true">
          <span className="adm-sagoma adm-sagoma-titolo" />
          {[0, 1, 2, 3, 4].map((i) => <span key={i} className="adm-sagoma reg-sagoma" />)}
        </div>
      ) : dati.attivita.length === 0 ? (
        <div className="adm-vuoto-amico">
          <span className="adm-vuoto-icona"><FaHistory /></span>
          <h2>{cerca || tipo || utenteId || da || a ? "Nessuna operazione trovata" : "Il registro è vuoto"}</h2>
          <p>
            {cerca || tipo || utenteId || da || a
              ? "Nessuna operazione corrisponde a questi filtri: prova ad allargare il periodo o a togliere un filtro."
              : "Non è ancora stata fatta nessuna operazione. La prima modifica al sito comparirà qui."}
          </p>
        </div>
      ) : (
        <>
          {/* Cosa vogliono dire i colori, detto una volta sola sopra
              all'elenco: il colore da solo non basta a chi non lo distingue */}
          <p className="reg-legenda">
            <span className="reg-segno is-aggiunge" aria-hidden="true" /> aggiunto o pubblicato
            <span className="reg-segno is-toglie" aria-hidden="true" /> tolto o cancellato
          </p>

          {/* Divise per giorno, con il giorno scritto una volta sola in
              testa: la domanda è quasi sempre "cosa è successo martedì",
              e la data ripetuta su ogni riga si leggeva come rumore. */}
          {perGiorno(dati.attivita).map((giorno) => (
            <section key={giorno.chiave} className="reg-giorno">
              <h2 className="reg-giorno-titolo">{giorno.titolo}</h2>
              <ul className="adm-registro">
                {giorno.righe.map((r) => (
                  <li key={r.id} className={`adm-riga-registro reg-riga ${tono(r.azione)}`}>
                    <time className="adm-registro-quando" dateTime={r.quando} title={quando(r.quando)}>
                      {ora(r.quando)}
                    </time>

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
            </section>
          ))}
        </>
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
