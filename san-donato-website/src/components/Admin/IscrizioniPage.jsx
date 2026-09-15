import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCheck, FaTimes, FaExclamationCircle, FaUserCheck, FaSearch
} from "react-icons/fa";
import { listIscrizioni, decidiIscrizione, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import Tendina from "./Tendina";
import Paginazione from "./Paginazione";
import { usePaginazione } from "../../hooks/usePaginazione";
import "../../css/Admin.css";

/* Dalla più recente o dalla più vecchia: sono due domande diverse —
   "cosa è arrivato" e "cosa è rimasto indietro". */
const ORDINI = [
  { valore: "desc", etichetta: "Dalla più recente" },
  { valore: "asc", etichetta: "Dalla meno recente" }
];

/** Da quanto aspetta, in parole. */
function quando(iso) {
  const giorni = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (giorni === 0) return "oggi";
  if (giorni === 1) return "ieri";
  if (giorni < 30) return `${giorni} giorni fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function dataEsatta(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit", month: "long", year: "numeric"
  });
}

const FILTRI = [
  { chiave: "in_attesa", etichetta: "Da decidere" },
  { chiave: "decise", etichetta: "Già decise" },
  { chiave: "tutte", etichetta: "Tutte" }
];

/** Una voce "etichetta / valore" della scheda. */
function Dato({ etichetta, children, titolo }) {
  return (
    <div className="adm-dato" title={titolo}>
      <dt className="adm-dato-etichetta">{etichetta}</dt>
      <dd className="adm-dato-valore">{children}</dd>
    </div>
  );
}

export default function IscrizioniPage() {
  const navigate = useNavigate();
  const { sessionExpired } = useAuth();
  const { avvisa, conferma, chiediTesto } = useDialoghi();

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
    () => richieste.filter((r) => r.stato === "in_attesa").length,
    [richieste]
  );

  // Ogni scheda è alta: quindici per pagina riempiono uno schermo senza
  // costringere a scorrere all'infinito.
  const { pagina, pagine, setPagina, visibili: dellaPagina, totale } = usePaginazione(visibili, 15);

  /* ---------- Decisioni ---------- */

  const accogli = async (richiesta) => {
    const squadraId = Number(scelte[richiesta.id]);

    if (!squadraId) {
      avvisa(`Scegli in quale squadra inserire ${richiesta.nomeCompleto}.`, "errore");
      return;
    }

    const squadra = squadre.find((s) => s.id === squadraId);

    // Una conferma perché l'accoglimento attiva l'account e non si annulla
    // con un clic: la persona da quel momento entra.
    const ok = await conferma({
      titolo: "Inserire in squadra?",
      testo: `${richiesta.nomeCompleto} entra in ${squadra?.nome ?? "questa squadra"} `
        + "e il suo account si attiva: da quel momento può accedere all'area riservata.",
      conferma: "Inserisci"
    });
    if (!ok) return;

    setErrore("");
    setInCorso(richiesta.id);

    try {
      await decidiIscrizione({ id: richiesta.id, approvata: true, squadraId });
      avvisa(`${richiesta.nomeCompleto} è in ${squadra?.nome ?? "squadra"}.`);
      await carica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setInCorso(null);
    }
  };

  const respingi = async (richiesta) => {
    const motivo = await chiediTesto({
      titolo: `Respingere ${richiesta.nomeCompleto}?`,
      testo: "Il motivo è facoltativo, ma resta scritto: se poi la persona chiede "
        + "spiegazioni, chi risponde sa cosa dire.",
      etichetta: "Motivo",
      segnaposto: "Es. età non compatibile con le squadre disponibili",
      conferma: "Respingi",
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
      avvisa(`Richiesta di ${richiesta.nomeCompleto} respinta.`, "info");
      await carica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setInCorso(null);
    }
  };

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento delle richieste…</p>
      </div>
    );
  }

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">Richieste</h1>
          <p className="adm-page-sub">
            {inAttesa === 0
              ? "Nessuno sta aspettando una squadra."
              : inAttesa === 1
                ? "Una persona aspetta una squadra. Finché non gliela assegni, non entra."
                : `${inAttesa} persone aspettano una squadra. Finché non gliela assegni, non entrano.`}
          </p>
        </div>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
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
              {f.chiave === "in_attesa" && inAttesa > 0 && (
                <span className="adm-chip-conteggio">{inAttesa}</span>
              )}
            </button>
          ))}
        </div>

        <Tendina
          className="adm-filter-select"
          valore={sport}
          onChange={setSport}
          opzioni={opzioniSport}
          segnaposto="Tutti gli sport"
          etichettaAria="Filtra per sport"
        />

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
        <div className="adm-empty">
          <FaUserCheck className="adm-empty-icon" />
          <p>
            {ricerca
              ? `Nessuna richiesta corrisponde a "${ricerca}".`
              : filtro === "in_attesa"
                ? "Nessuno sta aspettando."
                : "Nessuna richiesta in questa sezione."}
          </p>
        </div>
      ) : (
        <ul className="adm-schede">
          {dellaPagina.map((r) => {
            const proponibili = squadrePerSport[r.sport] ?? [];
            const occupata = inCorso === r.id;

            return (
              <li key={r.id} className={`adm-scheda ${occupata ? "is-busy" : ""}`}>
                <header className="adm-scheda-testa">
                  <h2 className="adm-scheda-nome">{r.nomeCompleto}</h2>

                  {r.stato === "in_attesa" && (
                    <span className="adm-status adm-status-draft">Da decidere</span>
                  )}
                  {r.stato === "approvata" && (
                    <span className="adm-status adm-status-publish">In {r.squadra}</span>
                  )}
                  {r.stato === "rifiutata" && (
                    <span className="adm-status adm-status-respinta">Respinta</span>
                  )}
                </header>

                {/* Tutti i dati nella stessa griglia, etichetta sopra e valore
                    sotto. Prima la data della richiesta era l'unica voce con
                    un'icona davanti e senza etichetta, e stonava in mezzo
                    alle altre come una riga di un altro elenco. */}
                <dl className="adm-scheda-dati">
                  <Dato etichetta="Sport">
                    <span className="adm-sport-tag">{r.sport}</span>
                  </Dato>

                  <Dato etichetta="Email">
                    <a href={`mailto:${r.email}`} className="adm-email">{r.email}</a>
                  </Dato>

                  <Dato etichetta="Richiesta" titolo={dataEsatta(r.richiestaIl)}>
                    {quando(r.richiestaIl)}
                  </Dato>

                  {r.stato !== "in_attesa" && (
                    <Dato etichetta="Decisa" titolo={dataEsatta(r.decisaIl)}>
                      {r.decisaIl ? quando(r.decisaIl) : "—"}
                    </Dato>
                  )}
                </dl>

                {r.note && (
                  <p className="adm-nota-richiesta">
                    <strong>Ha scritto:</strong> {r.note}
                  </p>
                )}

                {r.motivoRifiuto && (
                  <p className="adm-nota-richiesta adm-nota-rifiuto">
                    <strong>Respinta:</strong> {r.motivoRifiuto}
                  </p>
                )}

                {r.stato === "in_attesa" && (
                  <footer className="adm-scheda-azioni">
                    {proponibili.length === 0 ? (
                      <span className="adm-hint">
                        Nessuna squadra di {r.sport} fra quelle che gestisci.
                      </span>
                    ) : (
                      <Tendina
                        className="adm-scheda-squadra"
                        valore={scelte[r.id] ?? ""}
                        onChange={(v) => setScelte((p) => ({ ...p, [r.id]: v }))}
                        opzioni={proponibili.map((s) => ({
                          valore: String(s.id),
                          etichetta: s.nome,
                          colore: s.colore
                        }))}
                        segnaposto="Scegli la squadra…"
                        disabilitato={occupata}
                        etichettaAria={`Squadra per ${r.nomeCompleto}`}
                      />
                    )}

                    <button
                      type="button"
                      className="adm-btn adm-btn-primary"
                      onClick={() => accogli(r)}
                      disabled={occupata || proponibili.length === 0}
                    >
                      <FaCheck /> Inserisci
                    </button>

                    <button
                      type="button"
                      className="adm-btn adm-btn-ghost"
                      onClick={() => respingi(r)}
                      disabled={occupata}
                    >
                      <FaTimes /> Respingi
                    </button>
                  </footer>
                )}
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
