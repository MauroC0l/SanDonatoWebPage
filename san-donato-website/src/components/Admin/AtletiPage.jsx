import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaSearch, FaRunning, FaExclamationCircle, FaHeartbeat,
  FaEuroSign, FaChevronRight, FaFileMedical
} from "react-icons/fa";
import { listAtleti, listSquadre, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { useDialoghi } from "../../context/dialoghi";
import { euro } from "../../utils/soldi";
import { statoCertificato, quantoManca } from "../../utils/certificato";
import Tendina from "./Tendina";
import Paginazione from "./Paginazione";
import Ritratto from "./Ritratto";
import { usePaginazione } from "../../hooks/usePaginazione";
import "../../css/Admin.css";
import "../../css/Ritratto.css";

/**
 * I filtri rapidi: non "tutti i filtri possibili", ma le tre domande che la
 * segreteria si fa davvero aprendo questa pagina — chi non può giocare, chi
 * sta per non poterlo più, chi deve ancora versare.
 */
const FILTRI = [
  { chiave: "", etichetta: "Tutti" },
  { chiave: "cert_scaduto", etichetta: "Certificato scaduto" },
  { chiave: "cert_scadenza", etichetta: "In scadenza" },
  // Solo per chi tiene i conti: agli altri le quote non arrivano nemmeno.
  { chiave: "quota_aperta", etichetta: "Quota da saldare", conQuote: true }
];

function eta(dataNascita, oggi) {
  if (!dataNascita) return null;
  const n = new Date(`${dataNascita}T00:00:00`);
  let anni = oggi.getFullYear() - n.getFullYear();
  const compiuti =
    oggi.getMonth() > n.getMonth() ||
    (oggi.getMonth() === n.getMonth() && oggi.getDate() >= n.getDate());
  if (!compiuti) anni -= 1;
  return anni;
}

/** Quanto manca da versare, o null se la quota non è stata impostata. */
function daSaldare(atleta) {
  if (atleta.quotaStagionaleCentesimi == null) return null;
  return atleta.quotaStagionaleCentesimi - atleta.versatoCentesimi;
}

export default function AtletiPage() {
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();

  // Chi controlla i certificati: segreteria e amministratori.
  const puoValidare = (user?.capabilities ?? []).includes("certificato.registra");
  const area = useArea();
  const { avvisa } = useDialoghi();

  const [atleti, setAtleti] = useState([]);
  const [squadre, setSquadre] = useState([]);
  const [squadreAmmesse, setSquadreAmmesse] = useState(null);

  /**
   * Se le quote arrivano o no.
   *
   * Lo dice il server, non il ruolo letto qui: a un allenatore quei numeri
   * non vengono proprio mandati, e disegnare colonne che resterebbero vuote
   * sarebbe solo un modo di far sembrare rotta la pagina.
   */
  const [conQuote, setConQuote] = useState(true);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");

  const [ricerca, setRicerca] = useState("");
  const [squadraId, setSquadraId] = useState("");
  const [filtro, setFiltro] = useState(() => {
    /* Il filtro può arrivare dall'indirizzo: le tessere del cruscotto
       portano qui con la domanda già impostata, invece di scaricare su chi
       arriva il compito di ritrovarsela fra sei riquadri. */
    const q = new URLSearchParams(window.location.search);
    if (q.get("certificato") === "da_validare") return "cert_da_validare";
    if (q.get("quota") === "mancante") return "quota_mancante";
    if (q.get("quota") === "aperta") return "quota_aperta";
    return "";
  });

  /**
   * Il giorno di riferimento, fissato una volta all'apertura della pagina.
   *
   * Leggere l'orologio mentre si disegna darebbe al componente un risultato
   * diverso a ogni passaggio; e nessuno tiene aperto questo elenco tanto a
   * lungo da vedere cambiare la data sotto i propri occhi.
   */
  const [oggi] = useState(() => new Date());

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

    Promise.all([listAtleti(), listSquadre()])
      .then(([{ atleti: elenco, squadreAmmesse: ammesse, conQuote: quote }, elencoSquadre]) => {
        if (!attivo) return;
        setAtleti(elenco);
        setSquadreAmmesse(ammesse);
        setConQuote(quote);
        setSquadre(elencoSquadre);
        setCaricamento(false);
      })
      .catch((err) => {
        if (!attivo) return;
        gestisciErrore(err);
        setCaricamento(false);
      });

    return () => { attivo = false; };
  }, [gestisciErrore]);

  /* Un allenatore vede nel filtro solo le proprie squadre: le altre gli
     tornerebbero sempre vuote. */
  const opzioniSquadra = useMemo(() => {
    const visibili = Array.isArray(squadreAmmesse)
      ? squadre.filter((s) => squadreAmmesse.includes(s.id))
      : squadre.filter((s) => s.sport !== "Societa");

    return [
      { valore: "", etichetta: "Tutte le squadre" },
      ...[...visibili]
        .sort((a, b) => a.sport.localeCompare(b.sport) || a.nome.localeCompare(b.nome))
        .map((s) => ({
          valore: String(s.id),
          etichetta: s.nome,
          gruppo: s.sport,
          colore: s.colore
        }))
    ];
  }, [squadre, squadreAmmesse]);

  /* Lo stato del certificato si calcola una volta sola per atleta: serve
     sia al filtro sia alla riga, e rifarlo due volte a testa su duecento
     persone è lavoro buttato. */
  const conStato = useMemo(
    () => atleti.map((a) => ({
      ...a,
      cert: statoCertificato(a.certificatoScadenza, oggi, {
        fileCaricato: a.certificatoCaricato,
        validazione: a.certificatoStato
      }),
      manca: daSaldare(a)
    })),
    [atleti, oggi]
  );

  const visibili = useMemo(() => {
    const cercato = ricerca.trim().toLowerCase();

    return conStato.filter((a) => {
      if (squadraId && !a.squadre.some((s) => String(s.id) === squadraId)) return false;

      if (filtro === "cert_scaduto" && a.cert.chiave !== "scaduto") return false;
      if (filtro === "cert_scadenza" && a.cert.chiave !== "in_scadenza") return false;
      if (filtro === "quota_aperta" && !(a.manca > 0)) return false;
      if (filtro === "cert_da_validare" && !(a.certificatoStato === "da_validare" && a.certificatoCaricato)) return false;
      if (filtro === "quota_mancante" && a.quotaStagionaleCentesimi != null) return false;

      if (!cercato) return true;
      return `${a.nomeCompleto} ${a.email} ${a.squadre.map((s) => s.nome).join(" ")}`
        .toLowerCase().includes(cercato);
    });
  }, [conStato, ricerca, squadraId, filtro]);

  /* Il riepilogo in cima: sono i numeri che si vanno a cercare comunque,
     contati sull'elenco intero e non su quello filtrato. */
  const riepilogo = useMemo(() => {
    const scaduti = conStato.filter((a) => a.cert.chiave === "scaduto").length;
    const inScadenza = conStato.filter((a) => a.cert.chiave === "in_scadenza").length;
    const senzaQuota = conStato.filter((a) => a.manca > 0).length;
    const daIncassare = conStato.reduce((s, a) => s + (a.manca > 0 ? a.manca : 0), 0);

    /* Consegnati e mai guardati: serve il FILE, non la scadenza. Una data
       battuta a mano dall'atleta non è un documento da approvare, e chi
       l'ha scritta senza allegare niente rientra nel conto di chi il
       certificato non l'ha consegnato. */
    const daValidare = conStato.filter(
      (a) => a.certificatoStato === "da_validare" && a.certificatoCaricato
    ).length;

    /* Chi non ha ancora una quota decisa: non compare né fra chi deve dei
       soldi né fra chi è a posto, e resta fermo finché la segreteria non
       ci pensa. */
    const quotaMancante = conStato.filter((a) => a.quotaStagionaleCentesimi == null).length;

    return { scaduti, inScadenza, senzaQuota, daIncassare, daValidare, quotaMancante };
  }, [conStato]);

  // Venticinque righe per pagina: con duecento atleti la pagina diventava
  // lunghissima e trovare qualcuno voleva dire scorrere alla cieca.
  const { pagina, pagine, setPagina, visibili: dellaPagina, totale } = usePaginazione(visibili, 25);

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento degli atleti…</p>
      </div>
    );
  }

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">Atleti</h1>
          <p className="adm-page-sub">
            {atleti.length === 0
              ? "Nessun atleta assegnato alle squadre che vedi."
              : `${atleti.length} ${atleti.length === 1 ? "persona" : "persone"} in squadra`}
            {conQuote ? " · certificato medico, quote e versamenti." : " · certificato medico e stato dell iscrizione."}
          </p>
        </div>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {atleti.length > 0 && (
        <div className="adm-riepilogo">
          <button
            type="button"
            className={`adm-riquadro ${filtro === "cert_scaduto" ? "is-active" : ""} ${riepilogo.scaduti ? "is-allarme" : ""}`}
            onClick={() => setFiltro(filtro === "cert_scaduto" ? "" : "cert_scaduto")}
          >
            <span className="adm-riquadro-numero">{riepilogo.scaduti}</span>
            <span className="adm-riquadro-testo">certificati scaduti</span>
          </button>

          <button
            type="button"
            className={`adm-riquadro ${filtro === "cert_scadenza" ? "is-active" : ""} ${riepilogo.inScadenza ? "is-attenzione" : ""}`}
            onClick={() => setFiltro(filtro === "cert_scadenza" ? "" : "cert_scadenza")}
          >
            <span className="adm-riquadro-numero">{riepilogo.inScadenza}</span>
            <span className="adm-riquadro-testo">in scadenza entro un mese</span>
          </button>

          {/* Solo a chi li controlla: a un allenatore questo numero non dice
              niente che possa risolvere lui. */}
          {puoValidare && (
            <button
              type="button"
              className={`adm-riquadro ${filtro === "cert_da_validare" ? "is-active" : ""} ${riepilogo.daValidare ? "is-attenzione" : ""}`}
              onClick={() => setFiltro(filtro === "cert_da_validare" ? "" : "cert_da_validare")}
            >
              <span className="adm-riquadro-numero">{riepilogo.daValidare}</span>
              <span className="adm-riquadro-testo">certificati da controllare</span>
            </button>
          )}

          {conQuote && <button
            type="button"
            className={`adm-riquadro ${filtro === "quota_aperta" ? "is-active" : ""}`}
            onClick={() => setFiltro(filtro === "quota_aperta" ? "" : "quota_aperta")}
          >
            <span className="adm-riquadro-numero">{riepilogo.senzaQuota}</span>
            <span className="adm-riquadro-testo">quote da saldare</span>
          </button>}

          {conQuote && <button
            type="button"
            className={`adm-riquadro ${filtro === "quota_mancante" ? "is-active" : ""} ${riepilogo.quotaMancante ? "is-attenzione" : ""}`}
            onClick={() => setFiltro(filtro === "quota_mancante" ? "" : "quota_mancante")}
          >
            <span className="adm-riquadro-numero">{riepilogo.quotaMancante}</span>
            <span className="adm-riquadro-testo">quote da impostare</span>
          </button>}

          {conQuote && (
            <div className="adm-riquadro adm-riquadro-statico">
              <span className="adm-riquadro-numero">{euro(riepilogo.daIncassare)}</span>
              <span className="adm-riquadro-testo">ancora da incassare</span>
            </div>
          )}
        </div>
      )}

      <div className="adm-toolbar">
        <div className="adm-chip-group">
          {FILTRI.filter((f) => !f.conQuote || conQuote).map((f) => (
            <button
              key={f.chiave || "tutti"}
              type="button"
              className={`adm-chip ${filtro === f.chiave ? "is-active" : ""}`}
              onClick={() => setFiltro(f.chiave)}
              aria-pressed={filtro === f.chiave}
            >
              {f.etichetta}
            </button>
          ))}
        </div>

        <Tendina
          className="adm-filter-select"
          valore={squadraId}
          onChange={setSquadraId}
          opzioni={opzioniSquadra}
          segnaposto="Tutte le squadre"
          etichettaAria="Filtra per squadra"
        />

        <div className="adm-search">
          <FaSearch className="adm-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="adm-input"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca per nome, email o squadra…"
            aria-label="Cerca fra gli atleti"
          />
        </div>
      </div>

      {visibili.length === 0 ? (
        <div className="adm-empty">
          <FaRunning className="adm-empty-icon" />
          <p>
            {atleti.length === 0
              ? "Quando accoglierai una richiesta di iscrizione, la persona comparirà qui."
              : "Nessuno corrisponde a questi filtri."}
          </p>
        </div>
      ) : (
        <ul className="adm-atleti">
          {dellaPagina.map((a) => {
            const anni = eta(a.dataNascita, oggi);

            return (
              <li key={a.utenteId}>
                <Link to={`${area}/atleti/${a.utenteId}`} className="adm-atleta-riga">
                  <Ritratto
                    nome={a.nomeCompleto}
                    url={a.immagineUrl}
                    dimensione="m"
                  />

                  <div className="adm-atleta-chi">
                    <span className="adm-atleta-nome">{a.nomeCompleto}</span>
                    <span className="adm-atleta-sotto">
                      {a.squadre.map((s) => s.nome).join(", ")}
                      {anni != null && ` · ${anni} anni`}
                    </span>
                  </div>

                  <div className="adm-atleta-cert">
                    <span className={`adm-cert ${a.cert.classe}`}>
                      <FaHeartbeat aria-hidden="true" /> {a.cert.etichetta}
                    </span>
                    {a.cert.giorni != null && (
                      <span className="adm-atleta-nota">{quantoManca(a.cert.giorni)}</span>
                    )}
                    {a.certificatoScadenza && !a.certificatoCaricato && (
                      <span className="adm-atleta-nota adm-atleta-nota-attenzione">
                        <FaFileMedical aria-hidden="true" /> file non caricato
                      </span>
                    )}
                  </div>

                  {conQuote && <div className="adm-atleta-quota">
                    {a.quotaStagionaleCentesimi == null ? (
                      <span className="adm-atleta-nota">quota non impostata</span>
                    ) : (
                      <>
                        <span className={`adm-quota ${a.manca > 0 ? "is-aperta" : "is-saldata"}`}>
                          <FaEuroSign aria-hidden="true" />
                          {a.manca > 0 ? `${euro(a.manca)} da versare` : "Saldata"}
                        </span>
                        <span className="adm-atleta-nota">
                          {euro(a.versatoCentesimi)} di {euro(a.quotaStagionaleCentesimi)}
                        </span>
                      </>
                    )}
                  </div>}

                  <FaChevronRight className="adm-atleta-freccia" aria-hidden="true" />
                </Link>
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
        nome={["atleta", "atleti"]}
      />
    </div>
  );
}
