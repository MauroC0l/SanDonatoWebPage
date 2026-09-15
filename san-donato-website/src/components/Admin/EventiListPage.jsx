import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaPlus, FaPencilAlt, FaTrashAlt, FaExclamationCircle,
  FaCalendarAlt, FaMapMarkerAlt, FaTrophy, FaThLarge, FaBars, FaRegCalendarAlt
} from "react-icons/fa";
import { listEventi, listSquadre, deleteEvento, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { useDialoghi } from "../../context/dialoghi";
import Tendina from "./Tendina";
import Paginazione from "./Paginazione";
import ScambiaVista from "./ScambiaVista";
import CalendarioEventi from "./CalendarioEventi";
import { usePaginazione } from "../../hooks/usePaginazione";
import { useVista } from "../../hooks/useVista";
import "../../css/Admin.css";

/*
 * Tre modi di guardare le stesse date.
 *
 * La lista dice cosa viene dopo, la griglia fa vedere le squadre a colpo
 * d'occhio, il calendario risponde a "quel sabato siamo liberi?" — che è
 * la domanda di chi fissa un'amichevole, e sulle altre due si risponde
 * solo contando i giorni a mano.
 */
const VISTE = [
  { valore: "lista", etichetta: "Lista", Icona: FaBars },
  { valore: "griglia", etichetta: "Griglia", Icona: FaThLarge },
  { valore: "calendario", etichetta: "Calendario", Icona: FaRegCalendarAlt }
];

/** Il primo del mese in cui cade la data. */
function primoDelMese(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** I tre modi in cui si guarda un calendario: avanti, indietro, tutto. */
const PERIODI = [
  { chiave: "prossimi", etichetta: "In programma" },
  { chiave: "passati", etichetta: "Già svolti" },
  { chiave: "tutto", etichetta: "Tutti" },
  // Non un periodo ma uno stato: quelli che sul sito non si vedono ancora.
  // Sta con gli altri perche e la stessa domanda — "cosa sto guardando".
  { chiave: "programmati", etichetta: "Programmati" }
];

function intervalloDi(periodo) {
  const adesso = new Date();
  const unAnno = 365 * 24 * 60 * 60 * 1000;

  if (periodo === "prossimi") return { da: adesso, a: new Date(adesso.getTime() + unAnno) };
  // I programmati si cercano avanti e indietro: uno puo preparare anche il
  // resoconto di una partita gia giocata e mostrarlo lunedi.
  if (periodo === "programmati") return { da: new Date(adesso.getTime() - unAnno), a: new Date(adesso.getTime() + 2 * unAnno) };
  if (periodo === "passati") return { da: new Date(adesso.getTime() - unAnno), a: adesso };
  return { da: new Date(adesso.getTime() - 5 * unAnno), a: new Date(adesso.getTime() + unAnno) };
}

function dataLeggibile(iso, conOra = true) {
  const d = new Date(iso);
  const data = d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  if (!conOra) return data;
  return `${data} · ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
}

/* I tipi che stanno sotto "Partite". Deve combaciare con TIPI_PARTITA in
   server/eventi.js, che è quello che il server fa rispettare. */
const TIPI_PARTITA = ["partita", "torneo", "allenamento"];

/**
 * Una partita già giocata a cui manca qualcosa.
 *
 * Il risultato manca a tutti. I parziali no: senza set o senza quarti il
 * tabellino di una partita di pallavolo o di basket è a metà, mentre nel
 * calcio quasi nessuno li scrive — chiederli a tutti vorrebbe dire tenere
 * ogni partita di calcio segnata come incompleta per sempre.
 */
function daCompletare(e, adesso) {
  if (!["partita", "torneo"].includes(e.tipo)) return false;
  if (new Date(e.fine ?? e.inizio) > adesso) return false;

  if (!e.risultato) return true;
  return ["Pallavolo", "Basket", "Minivolley"].includes(e.sport) && !e.parziali;
}

/**
 * @param genere  "partite" oppure "eventi": cambia cosa si elenca, come si
 *                chiama e dove portano i collegamenti. Il calendario del
 *                sito resta uno solo.
 */
export default function EventiListPage({ genere = "partite" }) {
  const ePartite = genere === "partite";
  const sezione = ePartite ? "partite" : "eventi";
  const navigate = useNavigate();
  const { sessionExpired } = useAuth();
  const area = useArea();
  const { avvisa, conferma } = useDialoghi();

  const [eventi, setEventi] = useState([]);
  const [squadre, setSquadre] = useState([]);
  const [squadreAmmesse, setSquadreAmmesse] = useState(null);
  const [periodo, setPeriodo] = useState("prossimi");
  const [vista, setVista] = useVista("eventi", "lista", ["lista", "griglia", "calendario"]);
  const [squadraId, setSquadraId] = useState("");
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");

  // Fissato all'apertura: leggerlo mentre si disegna darebbe un risultato
  // diverso a ogni passaggio.
  const [adesso] = useState(() => new Date());

  // Il mese che il calendario sta mostrando. Vive qui e non dentro al
  // calendario perché decide anche COSA si va a chiedere al server.
  const [mese, setMese] = useState(() => primoDelMese(new Date()));

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

    /* Nel calendario il periodo non conta: quello che serve sono gli
       eventi del mese che si sta guardando, più i giorni delle settimane
       che sconfinano nei mesi vicini — la griglia li disegna comunque, e
       vuoti sarebbero una bugia. Sedici giorni di margine coprono i due
       sconfinamenti più lunghi possibili. */
    const { da, a } = vista === "calendario"
      ? {
        da: new Date(mese.getFullYear(), mese.getMonth(), -15),
        a: new Date(mese.getFullYear(), mese.getMonth() + 1, 15)
      }
      : intervalloDi(periodo);

    // Nessun setState prima della richiesta: aggiornare lo stato in modo
    // sincrono dentro un effetto costringe React a un secondo render
    // immediato. Cambiando filtro si continuano a vedere i risultati
    // precedenti finché non arrivano i nuovi, invece di uno sfarfallio.
    listEventi({
      da, a,
      squadraId: squadraId || undefined,
      programmati: vista !== "calendario" && periodo === "programmati"
    })
      .then((risultato) => {
        if (!attivo) return;
        // In "già svolti" i più recenti stanno in cima
        const ordinati = vista !== "calendario" && periodo === "passati"
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
  }, [periodo, squadraId, vista, mese, gestisciErrore]);

  /* Un coach vede nel filtro solo le proprie squadre: proporgli le altre
     significherebbe offrirgli un elenco che tornerà sempre vuoto. */
  const opzioniSquadra = useMemo(() => {
    const visibili = Array.isArray(squadreAmmesse)
      ? squadre.filter((s) => squadreAmmesse.includes(s.id))
      : squadre;

    return [
      { valore: "", etichetta: "Tutte le squadre" },
      ...[...visibili]
        .sort((a, b) => a.sport.localeCompare(b.sport) || a.nome.localeCompare(b.nome))
        .map((s) => ({
          valore: String(s.id),
          etichetta: s.nome,
          gruppo: s.sport === "Societa" ? "Società" : s.sport,
          colore: s.colore
        }))
    ];
  }, [squadre, squadreAmmesse]);

  /*
   * Partite ed eventi vivono nella stessa tabella e finiscono sullo stesso
   * calendario del sito: qui si separano solo per chi li amministra, che
   * compila due moduli diversi e cerca due cose diverse.
   */
  const dellaSezione = useMemo(
    () => eventi.filter((e) => TIPI_PARTITA.includes(e.tipo) === ePartite),
    [eventi, ePartite]
  );

  // Con 263 eventi in archivio, "Tutti" senza pagine e una schermata
  // lunghissima in cui non si trova niente.
  const { pagina, pagine, setPagina, visibili: dellaPagina, totale } = usePaginazione(dellaSezione, 20);

  const elimina = async (evento) => {
    const ok = await conferma({
      titolo: "Eliminare questo evento?",
      testo: `"${evento.titolo}" del ${dataLeggibile(evento.inizio, false)} sparisce `
        + "dal calendario del sito. Questa non si annulla.",
      conferma: "Elimina",
      pericolo: true
    });
    if (!ok) return;

    try {
      await deleteEvento(evento.id);
      setEventi((prima) => prima.filter((e) => e.id !== evento.id));
      avvisa("Evento eliminato.");
    } catch (err) {
      gestisciErrore(err);
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">{ePartite ? "Partite" : "Eventi"}</h1>
          <p className="adm-page-sub">
            {ePartite
              ? "Partite, tornei e allenamenti delle tue squadre: da qui finiscono nel calendario del sito."
              : "Assemblee, feste, chiusure della sede. Stesso calendario delle partite, modulo diverso."}
          </p>
        </div>

        <div className="adm-head-actions">
          <Link
            to={`${area}/${sezione}/${ePartite ? "nuova" : "nuovo"}`}
            className="adm-btn adm-btn-primary"
          >
            <FaPlus /> {ePartite ? "Nuova partita" : "Nuovo evento"}
          </Link>
        </div>
      </div>

      {/* Stessa barra dei filtri delle Notizie, con lo stesso stacco
          dall'elenco: prima le pillole toccavano la prima riga e si leggeva
          come se "In programma" fosse il titolo del primo evento. */}
      <div className="adm-toolbar">
        {/* Nel calendario il periodo lo sceglie il mese che si sta
            guardando: lasciare accese anche le pillole darebbe due comandi
            per la stessa cosa, che si contraddicono. */}
        {vista !== "calendario" && <div className="adm-chip-group">
          {PERIODI.map((p) => (
            <button
              key={p.chiave}
              type="button"
              className={`adm-chip ${periodo === p.chiave ? "is-active" : ""}`}
              onClick={() => setPeriodo(p.chiave)}
              aria-pressed={periodo === p.chiave}
            >
              {p.etichetta}
            </button>
          ))}
        </div>}

        <ScambiaVista vista={vista} onCambia={setVista} opzioni={VISTE} />

        <Tendina
          className="adm-filter-select"
          valore={squadraId}
          onChange={setSquadraId}
          opzioni={opzioniSquadra}
          segnaposto="Tutte le squadre"
          etichettaAria="Filtra per squadra"
        />
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
      ) : vista === "calendario" ? (
        <CalendarioEventi
          mese={mese}
          onCambiaMese={setMese}
          eventi={eventi}
          area={area}
          oggi={adesso}
          sezione={sezione}
        />
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
        <ul className={vista === "griglia" ? "adm-post-griglia" : "adm-post-list"}>
          {dellaPagina.map((evento) => (
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
                  {evento.visibileDal && new Date(evento.visibileDal) > adesso && (
                    <span className="adm-status adm-status-future">
                      Si vede dal {dataLeggibile(evento.visibileDal)}
                    </span>
                  )}
                  <span>{dataLeggibile(evento.inizio, !evento.tuttoIlGiorno)}</span>
                  {evento.luogo && <span><FaMapMarkerAlt /> {evento.luogo}</span>}
                  {evento.risultato && (
                    <span className="adm-risultato"><FaTrophy /> {evento.risultato}</span>
                  )}

                  {/* Giocata ma non ancora messa a verbale: è l'unica cosa
                      che chiede qualcosa a chi guarda questo elenco. */}
                  {daCompletare(evento, adesso) && (
                    <span className="adm-status adm-status-pending">Da completare</span>
                  )}
                </div>
              </div>

              <div className="adm-post-actions">
                <Link
                  to={`${area}/${sezione}/${evento.id}`}
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

      {/* Il calendario mostra un mese intero per definizione: paginarlo
          vorrebbe dire spezzare il mese, che è l'unica cosa che non deve
          succedere. */}
      {vista !== "calendario" && (
        <Paginazione
          pagina={pagina}
          pagine={pagine}
          onCambia={setPagina}
          totale={totale}
          nome={["evento", "eventi"]}
        />
      )}
    </div>
  );
}
