import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCheck, FaTimes, FaExclamationCircle, FaUserCheck, FaSearch, FaUndo,
  FaEnvelope, FaCommentDots, FaClock
} from "react-icons/fa";
import {
  listIscrizioni, decidiIscrizione, riapriRichiesta, AuthError
} from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import Tendina from "./Tendina";
import Paginazione from "./Paginazione";
import { usePaginazione } from "../../hooks/usePaginazione";
import "../../css/Admin.css";
import "../../css/admin/Richieste.css";

/* Dalla più recente o dalla più vecchia: sono due domande diverse —
   "cosa è arrivato" e "cosa è rimasto indietro". */
const ORDINI = [
  { valore: "desc", etichetta: "Dalla più recente" },
  { valore: "asc", etichetta: "Chi aspetta da più tempo" }
];

const FILTRI = [
  { chiave: "in_attesa", etichetta: "Da decidere" },
  { chiave: "decise", etichetta: "Già decise" },
  { chiave: "tutte", etichetta: "Tutte" }
];

/* Fino a quante squadre si mostrano come pulsanti da toccare invece che in
   una tendina. Sei stanno in due righe anche sul telefono; di più
   diventerebbero un muro, e la tendina con la ricerca torna più comoda. */
const MAX_PULSANTI = 6;

/* Dopo quanti giorni una richiesta "aspetta da troppo" e lo si fa notare. */
const GIORNI_TROPPI = 14;

function giorniDa(iso) {
  return Math.floor((Date.now() - new Date(iso)) / 86400000);
}

/** Da quanto aspetta, in parole. */
function quando(iso) {
  const giorni = giorniDa(iso);
  if (giorni === 0) return "oggi";
  if (giorni === 1) return "ieri";
  if (giorni < 30) return `${giorni} giorni fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

/** La stessa cosa detta dal punto di vista di chi aspetta. */
function attesa(iso) {
  const giorni = giorniDa(iso);
  if (giorni === 0) return "Arrivata oggi";
  if (giorni === 1) return "Arrivata ieri";
  return `Aspetta da ${giorni} giorni`;
}

function dataEsatta(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit", month: "long", year: "numeric"
  });
}

function iniziali(r) {
  const da = [r.nome, r.cognome].filter(Boolean);
  const lettere = da.length ? da.map((p) => p[0]) : [r.email?.[0] ?? "?"];
  return lettere.join("").slice(0, 2).toUpperCase();
}

/**
 * La scelta della squadra, lì dove si decide.
 *
 * Con poche squadre sono pulsanti: si vedono tutte insieme e si sceglie con
 * un tocco, senza aprire niente. Con tante torna la tendina con la ricerca.
 */
function SceltaSquadra({ richiesta, proponibili, valore, onScegli, disabilitato }) {
  if (proponibili.length > MAX_PULSANTI) {
    return (
      <Tendina
        className="ric-tendina"
        valore={valore}
        onChange={onScegli}
        opzioni={proponibili.map((s) => ({
          valore: String(s.id),
          etichetta: s.nome,
          colore: s.colore
        }))}
        segnaposto="Scegli la squadra…"
        disabilitato={disabilitato}
        etichettaAria={`Squadra per ${richiesta.nomeCompleto}`}
      />
    );
  }

  return (
    <div className="ric-squadre" role="radiogroup" aria-label={`Squadra per ${richiesta.nomeCompleto}`}>
      {proponibili.map((s) => {
        const scelta = valore === String(s.id);
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={scelta}
            className={`ric-squadra ${scelta ? "is-scelta" : ""}`}
            onClick={() => onScegli(String(s.id))}
            disabled={disabilitato}
          >
            <span className="ric-squadra-segno" aria-hidden="true">
              {scelta && <FaCheck />}
            </span>
            {s.nome}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Le richieste: chi si è registrato e aspetta di essere messo in squadra.
 *
 * Decidere dev'essere un lavoro da due tocchi: si sceglie la squadra lì
 * sulla scheda e si preme "Metti in squadra". Prima serviva aprire una
 * tendina, premere "Inserisci" e poi confermare in una finestra: tre passi
 * per un gesto che la segreteria fa decine di volte a settembre. Adesso il
 * pulsante stesso dice cosa succede — "Metti in Allievi" — e la riga sotto
 * ricorda che l'account si attiva; la finestra di conferma non aggiungeva
 * niente che non fosse già scritto lì. Se c'è una squadra sola possibile,
 * è già scelta e basta un tocco.
 *
 * Il rifiuto invece chiede ancora il motivo in una finestra: è il caso
 * raro, ed è giusto che costi un passo in più.
 */
export default function IscrizioniPage() {
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();
  const { avvisa, conferma, chiediTesto } = useDialoghi();

  // Riaprire una richiesta respinta è un gradino sopra: solo segreteria e amministratori
  const puoRiaprire = (user?.capabilities ?? []).includes("iscrizioni.decidi_tutte");

  const [richieste, setRichieste] = useState([]);
  const [squadre, setSquadre] = useState([]);
  const [filtro, setFiltro] = useState("in_attesa");
  const [ricerca, setRicerca] = useState("");
  const [sport, setSport] = useState("");
  const [ordine, setOrdine] = useState("desc");
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(null);

  // Squadra scelta per ciascuna richiesta, prima di confermare
  const [scelte, setScelte] = useState({});

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    setErrore(err.message || "Operazione non riuscita.");
    avvisa(err.message || "Operazione non riuscita.", "errore");
  }, [navigate, sessionExpired, avvisa]);

  /* Si scarica sempre tutto e si filtra qui: le richieste sono poche
     centinaia, e passare da "da decidere" a "tutte" non deve costare
     un'altra attesa. */
  const carica = useCallback(() => {
    return listIscrizioni({ tutte: true })
      .then(({ richieste: elenco, squadreProponibili }) => {
        setRichieste(elenco);
        setSquadre(squadreProponibili);
        setCaricamento(false);
      })
      .catch((err) => {
        gestisciErrore(err);
        setCaricamento(false);
      });
  }, [gestisciErrore]);

  useEffect(() => { carica(); }, [carica]);

  /* Le squadre raggruppate per sport: a una richiesta di calcio si possono
     proporre solo le squadre di calcio. */
  const squadrePerSport = useMemo(() => {
    const gruppi = {};
    for (const s of squadre) (gruppi[s.sport] ??= []).push(s);
    return gruppi;
  }, [squadre]);

  const visibili = useMemo(() => {
    const cercato = ricerca.trim().toLowerCase();

    return richieste
      .filter((r) => {
        if (filtro === "in_attesa" && r.stato !== "in_attesa") return false;
        if (filtro === "decise" && r.stato === "in_attesa") return false;
        if (sport && r.sport !== sport) return false;
        if (!cercato) return true;
        return `${r.nomeCompleto} ${r.email} ${r.sport} ${r.squadra ?? ""}`
          .toLowerCase().includes(cercato);
      })
      /*
       * Dalla più recente, di solito.
       *
       * Chi decide guarda le ultime arrivate. Chi invece va a caccia di
       * quelle rimaste indietro — la domanda di settembre ancora ferma a
       * novembre — gira l'ordine, e quelle vengono in cima.
       */
      .sort((a, b) => (ordine === "desc"
        ? new Date(b.richiestaIl) - new Date(a.richiestaIl)
        : new Date(a.richiestaIl) - new Date(b.richiestaIl)));
  }, [richieste, filtro, ricerca, sport, ordine]);

  /* Gli sport su cui questa persona può decidere davvero: a un allenatore
     di pallavolo proporre "Calcio" vuol dire offrirgli un filtro che
     tornerà sempre vuoto. */
  const opzioniSport = useMemo(() => {
    const presenti = [...new Set(richieste.map((r) => r.sport).filter(Boolean))].sort();

    return [
      { valore: "", etichetta: "Tutti gli sport" },
      ...presenti.map((sp) => ({ valore: sp, etichetta: sp }))
    ];
  }, [richieste]);

  const inAttesa = useMemo(
    () => richieste.filter((r) => r.stato === "in_attesa"),
    [richieste]
  );

  // Chi aspetta da più tempo: lo si dice in cima, perché è quello da non dimenticare
  const giorniPiuVecchia = useMemo(
    () => inAttesa.reduce((max, r) => Math.max(max, giorniDa(r.richiestaIl)), 0),
    [inAttesa]
  );

  // Ogni scheda è alta: quindici per pagina riempiono uno schermo senza
  // costringere a scorrere all'infinito.
  const { pagina, pagine, setPagina, visibili: dellaPagina, totale } = usePaginazione(visibili, 15);

  /** La squadra scelta, o quella unica possibile già pronta. */
  const sceltaDi = (r, proponibili) => scelte[r.id]
    ?? (proponibili.length === 1 ? String(proponibili[0].id) : "");

  /* ---------- Decisioni ---------- */

  const accogli = async (richiesta, squadraScelta) => {
    const squadraId = Number(squadraScelta);

    if (!squadraId) {
      avvisa(`Scegli prima in quale squadra mettere ${richiesta.nomeCompleto}.`, "errore");
      return;
    }

    const squadra = squadre.find((s) => s.id === squadraId);

    setErrore("");
    setInCorso(richiesta.id);

    try {
      await decidiIscrizione({ id: richiesta.id, approvata: true, squadraId });
      avvisa(`Fatto: ${richiesta.nomeCompleto} è in ${squadra?.nome ?? "squadra"} e può già entrare.`);
      await carica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setInCorso(null);
    }
  };

  const respingi = async (richiesta) => {
    const motivo = await chiediTesto({
      titolo: `Rifiutare la richiesta di ${richiesta.nomeCompleto}?`,
      testo: "Il motivo è facoltativo, ma resta scritto: se poi la persona chiede "
        + "spiegazioni, chi risponde sa cosa dire.",
      etichetta: "Motivo",
      segnaposto: "Es. età non compatibile con le squadre disponibili",
      conferma: "Rifiuta",
      pericolo: true
    });

    // null significa "ho chiuso la finestra", stringa vuota "nessun motivo"
    if (motivo === null) return;

    setErrore("");
    setInCorso(richiesta.id);

    try {
      await decidiIscrizione({
        id: richiesta.id,
        approvata: false,
        motivo: motivo || undefined
      });
      avvisa(`Richiesta di ${richiesta.nomeCompleto} rifiutata.`, "info");
      await carica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setInCorso(null);
    }
  };

  /* Un "no" dato per sbaglio si rimedia: la richiesta torna fra quelle da
     decidere, come se fosse arrivata adesso. */
  const riapri = async (richiesta) => {
    const ok = await conferma({
      titolo: "Riaprire la richiesta?",
      testo: `La richiesta di ${richiesta.nomeCompleto} torna fra quelle da decidere `
        + "e il motivo del rifiuto viene cancellato.",
      conferma: "Riapri"
    });
    if (!ok) return;

    setErrore("");
    setInCorso(richiesta.id);

    try {
      await riapriRichiesta(richiesta.id);
      avvisa(`La richiesta di ${richiesta.nomeCompleto} è di nuovo da decidere.`);
      await carica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setInCorso(null);
    }
  };

  if (caricamento) {
    return (
      <div className="adm-page" aria-busy="true" aria-label="Caricamento delle richieste…">
        <div className="adm-sagoma adm-sagoma-titolo" />
        <div className="adm-sagoma adm-sagoma-riga" style={{ width: "min(100%, 26rem)" }} />
        <div className="ric-sagome">
          <div className="adm-sagoma ric-sagoma" />
          <div className="adm-sagoma ric-sagoma" />
          <div className="adm-sagoma ric-sagoma" />
        </div>
      </div>
    );
  }

  const quanti = inAttesa.length;

  return (
    <div className="adm-page ric">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">Richieste</h1>
          <p className="adm-page-sub">
            {quanti === 0
              ? "Nessuno sta aspettando una squadra."
              : quanti === 1
                ? "Una persona aspetta una squadra: finché non gliela assegni, non entra."
                : `${quanti} persone aspettano una squadra: finché non gliela assegni, non entrano.`}
            {quanti > 1 && giorniPiuVecchia >= GIORNI_TROPPI && (
              <> La più vecchia aspetta da {giorniPiuVecchia} giorni.</>
            )}
          </p>
        </div>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {quanti > 0 && filtro !== "decise" && (
        <p className="ric-come">
          <strong>Come si fa:</strong> scegli la squadra e tocca <em>Metti in squadra</em>.
          L&apos;account si attiva subito e la persona può entrare.
        </p>
      )}

      <div className="adm-toolbar">
        <div className="adm-chip-group">
          {FILTRI.map((f) => (
            <button
              key={f.chiave}
              type="button"
              className={`adm-chip ${filtro === f.chiave ? "is-active" : ""}`}
              onClick={() => setFiltro(f.chiave)}
              aria-pressed={filtro === f.chiave}
            >
              {f.etichetta}
              {f.chiave === "in_attesa" && quanti > 0 && (
                <span className="adm-chip-conteggio">{quanti}</span>
              )}
            </button>
          ))}
        </div>

        {/* Con uno sport solo il filtro non filtrerebbe niente */}
        {opzioniSport.length > 2 && (
          <Tendina
            className="adm-filter-select"
            valore={sport}
            onChange={setSport}
            opzioni={opzioniSport}
            segnaposto="Tutti gli sport"
            etichettaAria="Filtra per sport"
          />
        )}

        <Tendina
          className="adm-filter-select"
          valore={ordine}
          onChange={setOrdine}
          opzioni={ORDINI}
          etichettaAria="Ordine delle richieste"
        />

        <div className="adm-search">
          <FaSearch className="adm-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="adm-input"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca per nome, email o squadra…"
            aria-label="Cerca fra le richieste"
          />
        </div>
      </div>

      {visibili.length === 0 ? (
        ricerca || sport ? (
          <div className="adm-empty">
            <FaSearch className="adm-empty-icon" />
            <p>
              {ricerca
                ? `Nessuna richiesta corrisponde a "${ricerca}".`
                : "Nessuna richiesta per questo sport."}
            </p>
          </div>
        ) : (
          <div className="adm-vuoto-amico">
            <span className="adm-vuoto-icona"><FaUserCheck aria-hidden="true" /></span>
            <h2>{filtro === "in_attesa" ? "Nessuno aspetta una squadra" : "Nessuna richiesta qui"}</h2>
            <p>
              {filtro === "in_attesa"
                ? "Hai deciso tutto. Quando qualcuno si registra dal sito, la sua richiesta compare qui."
                : "Qui compaiono le richieste già messe in squadra o rifiutate."}
            </p>
            {filtro === "in_attesa" && richieste.length > quanti && (
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setFiltro("decise")}>
                Guarda quelle già decise
              </button>
            )}
          </div>
        )
      ) : (
        <ul className="ric-elenco">
          {dellaPagina.map((r) => {
            const occupata = inCorso === r.id;

            if (r.stato !== "in_attesa") {
              return (
                <RichiestaDecisa
                  key={r.id}
                  richiesta={r}
                  occupata={occupata}
                  onRiapri={puoRiaprire && r.stato === "rifiutata" ? () => riapri(r) : null}
                />
              );
            }

            const proponibili = squadrePerSport[r.sport] ?? [];
            const scelta = sceltaDi(r, proponibili);
            const squadraScelta = proponibili.find((s) => String(s.id) === scelta);
            const vecchia = giorniDa(r.richiestaIl) >= GIORNI_TROPPI;

            return (
              <li key={r.id} className={`ric-scheda ${occupata ? "is-busy" : ""}`}>
                <div className="ric-chi">
                  <span className="ric-iniziali" aria-hidden="true">{iniziali(r)}</span>
                  <div className="ric-chi-testo">
                    <h2 className="ric-nome">{r.nomeCompleto}</h2>
                    <p className="ric-righe">
                      <span className="adm-sport-tag">{r.sport}</span>
                      <span
                        className={`ric-attesa ${vecchia ? "is-vecchia" : ""}`}
                        title={`Richiesta del ${dataEsatta(r.richiestaIl)}`}
                      >
                        <FaClock aria-hidden="true" /> {attesa(r.richiestaIl)}
                      </span>
                    </p>
                    <a href={`mailto:${r.email}`} className="ric-email">
                      <FaEnvelope aria-hidden="true" /> {r.email}
                    </a>
                  </div>
                </div>

                {r.note && (
                  <p className="ric-nota">
                    <FaCommentDots aria-hidden="true" />
                    <span><strong>Ha scritto:</strong> {r.note}</span>
                  </p>
                )}

                <div className="ric-decisione">
                  {proponibili.length === 0 ? (
                    <p className="adm-hint ric-nessuna">
                      Nessuna squadra di {r.sport} fra quelle che gestisci: può
                      deciderla la segreteria.
                    </p>
                  ) : (
                    <>
                      <p className="ric-domanda">
                        {proponibili.length === 1 ? "Va in questa squadra:" : "In quale squadra?"}
                      </p>
                      <SceltaSquadra
                        richiesta={r}
                        proponibili={proponibili}
                        valore={scelta}
                        onScegli={(v) => setScelte((p) => ({ ...p, [r.id]: v }))}
                        disabilitato={occupata}
                      />
                    </>
                  )}

                  <div className="ric-bottoni">
                    <button
                      type="button"
                      className="adm-btn adm-btn-primary ric-metti"
                      onClick={() => accogli(r, scelta)}
                      disabled={occupata || !scelta}
                    >
                      <FaCheck aria-hidden="true" />
                      {occupata
                        ? "Un momento…"
                        : squadraScelta ? `Metti in ${squadraScelta.nome}` : "Metti in squadra"}
                    </button>

                    <button
                      type="button"
                      className="adm-btn adm-btn-ghost ric-rifiuta"
                      onClick={() => respingi(r)}
                      disabled={occupata}
                    >
                      <FaTimes aria-hidden="true" /> Rifiuta
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Paginazione
        pagina={pagina}
        pagine={pagine}
        onCambia={setPagina}
        totale={totale}
        nome={["richiesta", "richieste"]}
      />
    </div>
  );
}

/** Una richiesta già decisa: una riga compatta, con il rimedio se serve. */
function RichiestaDecisa({ richiesta: r, occupata, onRiapri }) {
  const accolta = r.stato === "approvata";

  return (
    <li className={`ric-scheda ric-decisa ${occupata ? "is-busy" : ""}`}>
      <div className="ric-chi">
        <span className="ric-iniziali is-spenta" aria-hidden="true">{iniziali(r)}</span>
        <div className="ric-chi-testo">
          <h2 className="ric-nome">{r.nomeCompleto}</h2>
          <p className="ric-righe">
            {accolta
              ? <span className="adm-status adm-status-publish">In {r.squadra}</span>
              : <span className="adm-status adm-status-respinta">Rifiutata</span>}
            <span className="adm-sport-tag">{r.sport}</span>
            <span className="ric-attesa" title={dataEsatta(r.decisaIl)}>
              {accolta ? "Messa in squadra" : "Rifiutata"} {r.decisaIl ? quando(r.decisaIl) : ""}
            </span>
          </p>
          {r.motivoRifiuto && (
            <p className="ric-motivo"><strong>Motivo:</strong> {r.motivoRifiuto}</p>
          )}
        </div>

        {onRiapri && (
          <button
            type="button"
            className="adm-btn adm-btn-ghost ric-riapri"
            onClick={onRiapri}
            disabled={occupata}
          >
            <FaUndo aria-hidden="true" /> Riapri
          </button>
        )}
      </div>
    </li>
  );
}
