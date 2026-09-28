import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaSearch, FaRunning, FaExclamationCircle, FaHeartbeat,
  FaEuroSign, FaChevronRight, FaFileMedical, FaArrowRight,
  FaCheckCircle, FaHourglassHalf, FaHistory, FaTimes,
  FaUsers
} from "react-icons/fa";
import { listAtleti, listSquadre, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { useDialoghi } from "../../context/dialoghi";
import { useStagione } from "../../context/stagione";
import { euro } from "../../utils/soldi";
import { statoCertificato, quantoManca } from "../../utils/certificato";
import Tendina from "./Tendina";
import Paginazione from "./Paginazione";
import Ritratto from "./Ritratto";
import LinguetteFiltro from "./LinguetteFiltro";
import { usePaginazione } from "../../hooks/usePaginazione";
import "../../css/Admin.css";
import "../../css/Ritratto.css";
import "../../css/admin/Persone.css";

/**
 * I filtri: non "tutti i filtri possibili", ma le domande che la segreteria
 * si fa davvero aprendo questa pagina — chi non può giocare, chi sta per
 * non poterlo più, chi deve ancora versare. Ognuno porta il suo numero
 * (vedi LinguetteFiltro), e il tono dice quanto è urgente.
 *
 *   validare  solo a chi controlla i certificati
 *   conQuote  solo a chi tiene i conti: agli altri le quote non arrivano
 */
const FILTRI = [
  { chiave: "", etichetta: "Tutti" },
  { chiave: "cert_da_validare", etichetta: "Da controllare", conta: "daValidare", tono: "attenzione", validare: true },
  { chiave: "cert_scaduto", etichetta: "Certificato scaduto", conta: "scaduti", tono: "allarme" },
  { chiave: "cert_scadenza", etichetta: "In scadenza", conta: "inScadenza", tono: "attenzione" },
  { chiave: "quota_mancante", etichetta: "Quota da impostare", conta: "quotaMancante", tono: "attenzione", conQuote: true },
  { chiave: "quota_aperta", etichetta: "Quota da saldare", conta: "senzaQuota", conQuote: true },
  { chiave: "fratelli", etichetta: "Fratelli da controllare", conta: "fratelli", tono: "attenzione", conQuote: true },
  // Chi ha smesso durante la stagione: resta in elenco, ma va riconosciuto
  { chiave: "ritirati", etichetta: "Ritirati", conta: "ritirati" },
  // Non hanno rinnovato, o non hanno versato la prima metà
  { chiave: "abbandonati", etichetta: "Abbandonati", conta: "abbandonati" }
];

/**
 * Cosa dire quando un filtro non trova nessuno.
 *
 * "Nessuno corrisponde" è vero ma non aiuta: zero certificati scaduti è
 * una BUONA notizia, e merita di essere detta come tale.
 */
const VUOTO_FILTRO = {
  cert_da_validare: ["Nessun certificato da controllare", "Quando un atleta carica la copia, compare qui."],
  cert_scaduto: ["Nessun certificato scaduto", "Chi ha consegnato il certificato può scendere in campo."],
  cert_scadenza: ["Nessun certificato in scadenza", "Nel prossimo mese non scade niente."],
  quota_mancante: ["Tutti hanno una quota", "Non c'è nessuna tariffa da scegliere."],
  quota_aperta: ["Nessuna quota da saldare", "Chi ha una quota l'ha già versata tutta."],
  fratelli: ["Nessun fratello da controllare", "Le richieste della quota famiglia sono tutte decise."],
  ritirati: ["Nessun ritirato", "Nessuno ha smesso durante questa stagione."],
  abbandonati: ["Nessun abbandono", "Tutti gli iscritti risultano attivi."]
};

/**
 * Il colore del bordo di una riga: quanto quella persona chiede di essere
 * guardata. Scorrendo sessanta righe l'occhio si ferma sulle rosse senza
 * dover leggere le pastiglie una per una.
 */
function tonoRiga(a, { puoValidare, conQuote }) {
  if (a.ritirato || a.abbandonato) return "is-spenta";
  if (a.cert.chiave === "scaduto" || a.cert.chiave === "respinto") return "is-allarme";
  if (a.cert.chiave === "in_scadenza") return "is-attenzione";
  if (puoValidare && a.cert.chiave === "da_controllare") return "is-attenzione";
  if (conQuote && a.quotaStagionaleCentesimi == null) return "is-attenzione";
  return "";
}

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

/**
 * Quanto manca da versare, o null se la quota non è stata impostata.
 *
 * Sul DOVUTO e non sulla quota intera: chi si è ritirato prima di gennaio
 * deve solo la prima metà, e il conto lo fa il server.
 */
function daSaldare(atleta) {
  if (atleta.dovutoCentesimi == null) return null;
  return atleta.dovutoCentesimi - atleta.versatoCentesimi;
}

export default function AtletiPage() {
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();

  // Chi controlla i certificati: segreteria e amministratori.
  const puoValidare = (user?.capabilities ?? []).includes("certificato.registra");
  const area = useArea();
  const { avvisa } = useDialoghi();
  const { stagioneId, stagione: stagioneScelta, scegli: scegliStagione } = useStagione();
  const passata = Boolean(stagioneScelta && !stagioneScelta.inCorso);

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
    if (q.get("certificato") === "scaduto") return "cert_scaduto";
    if (q.get("certificato") === "in_scadenza") return "cert_scadenza";
    if (q.get("quota") === "mancante") return "quota_mancante";
    if (q.get("quota") === "aperta") return "quota_aperta";
    if (q.get("fratelli") === "da_controllare") return "fratelli";
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

    Promise.all([listAtleti({ stagioneId }), listSquadre()])
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
  }, [gestisciErrore, stagioneId]);

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
      if (filtro === "quota_mancante" && (a.quotaStagionaleCentesimi != null || a.ritirato || a.abbandonato)) return false;
      if (filtro === "ritirati" && !a.ritirato) return false;
      if (filtro === "abbandonati" && !a.abbandonato) return false;
      if (filtro === "fratelli" && !a.parentelaDaControllare) return false;

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
    const quotaMancante = conStato.filter((a) => a.quotaStagionaleCentesimi == null && !a.ritirato && !a.abbandonato).length;

    const ritirati = conStato.filter((a) => a.ritirato).length;
    const abbandonati = conStato.filter((a) => a.abbandonato).length;
    const fratelli = conStato.filter((a) => a.parentelaDaControllare).length;

    return {
      scaduti, inScadenza, senzaQuota, daIncassare, daValidare, quotaMancante,
      ritirati, abbandonati, fratelli
    };
  }, [conStato]);

  // Venticinque righe per pagina: con duecento atleti la pagina diventava
  // lunghissima e trovare qualcuno voleva dire scorrere alla cieca.
  const { pagina, pagine, setPagina, visibili: dellaPagina, totale } = usePaginazione(visibili, 25);

  if (caricamento) {
    /* La forma della pagina al posto della rotella: si sa già che arriva
       un elenco, e chi aspetta vede dove comparirà. */
    return (
      <div className="adm-page" aria-busy="true" aria-label="Caricamento degli atleti">
        <span className="adm-sagoma adm-sagoma-titolo" />
        <span className="adm-sagoma adm-sagoma-riga" style={{ width: "40%" }} />
        <span className="adm-sagoma adm-sagoma-scheda" />
        <span className="adm-sagoma adm-sagoma-scheda" />
        <span className="adm-sagoma adm-sagoma-scheda" />
      </div>
    );
  }

  // Cambiando domanda si riparte dalla prima pagina: restare a pagina 3 di
  // un elenco nuovo vorrebbe dire non vederne l'inizio.
  const cambiaFiltro = (chiave) => {
    setFiltro(chiave);
    setPagina(1);
  };

  const azzera = () => {
    cambiaFiltro("");
    setSquadraId("");
    setRicerca("");
  };

  /*
   * Le cose da sistemare, in ordine di urgenza, e solo quelle che ci sono.
   *
   * Sono i numeri del riepilogo, ma detti come compiti: "3 certificati da
   * controllare" invece di un 3 in un riquadro. Una tessera a zero sarebbe
   * rumore — se non c'è niente da fare lo si dice con una frase sola.
   * Toccarle accende il filtro corrispondente: il passo naturale dopo
   * averle lette.
   */
  const daFare = [
    puoValidare && riepilogo.daValidare > 0 && {
      filtro: "cert_da_validare",
      tono: "is-attenzione",
      Icona: FaFileMedical,
      titolo: riepilogo.daValidare === 1 ? "1 certificato da controllare" : `${riepilogo.daValidare} certificati da controllare`,
      testo: "Apri la copia caricata e accettala o respingila"
    },
    riepilogo.scaduti > 0 && {
      filtro: "cert_scaduto",
      tono: "is-allarme",
      Icona: FaHeartbeat,
      titolo: riepilogo.scaduti === 1 ? "1 certificato scaduto" : `${riepilogo.scaduti} certificati scaduti`,
      testo: "Non possono scendere in campo finché non lo rinnovano"
    },
    riepilogo.inScadenza > 0 && {
      filtro: "cert_scadenza",
      tono: "is-attenzione",
      Icona: FaHourglassHalf,
      titolo: riepilogo.inScadenza === 1 ? "1 certificato in scadenza" : `${riepilogo.inScadenza} certificati in scadenza`,
      testo: "Scadono entro un mese: conviene avvisarli ora"
    },
    conQuote && riepilogo.fratelli > 0 && {
      filtro: "fratelli",
      tono: "is-attenzione",
      Icona: FaUsers,
      titolo: riepilogo.fratelli === 1 ? "1 fratello da controllare" : `${riepilogo.fratelli} fratelli da controllare`,
      testo: "Apri la scheda e conferma o respingi la quota famiglia"
    },
    conQuote && riepilogo.quotaMancante > 0 && {
      filtro: "quota_mancante",
      tono: "is-attenzione",
      Icona: FaEuroSign,
      titolo: riepilogo.quotaMancante === 1 ? "1 quota da impostare" : `${riepilogo.quotaMancante} quote da impostare`,
      testo: "Scegli la tariffa: finché manca non possono pagare"
    },
    conQuote && riepilogo.senzaQuota > 0 && {
      filtro: "quota_aperta",
      tono: "",
      Icona: FaEuroSign,
      titolo: riepilogo.senzaQuota === 1 ? "1 quota da saldare" : `${riepilogo.senzaQuota} quote da saldare`,
      testo: `${euro(riepilogo.daIncassare)} ancora da incassare`
    }
  ].filter(Boolean);

  const voci = FILTRI
    .filter((f) => (!f.conQuote || conQuote) && (!f.validare || puoValidare))
    .map((f) => ({ ...f, conta: f.conta ? riepilogo[f.conta] : atleti.length }));

  const filtroAttivo = FILTRI.find((f) => f.chiave === filtro);
  const cercaQualcosa = Boolean(ricerca.trim() || squadraId);
  const filtrato = Boolean(filtro) || cercaQualcosa;
  // Il filtro da solo, senza ricerca: il vuoto è una notizia, non un errore
  const vuotoBuono = filtro && !cercaQualcosa ? VUOTO_FILTRO[filtro] : null;

  return (
    <div className="adm-page prs-pagina">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <p className="adm-occhiello">Persone</p>
          <h1 className="adm-page-title">Atleti</h1>
          <p className="adm-page-sub">
            {atleti.length === 0
              ? "Nessun atleta assegnato alle squadre che vedi."
              : `${atleti.length} ${atleti.length === 1 ? "persona" : "persone"} in squadra`}
            {atleti.length > 0 && (conQuote ? " · certificato medico e quota di ognuno." : " · chi può scendere in campo.")}
            {stagioneScelta && ` Stagione ${stagioneScelta.nome}.`}
          </p>
        </div>
      </div>

      {/* Una stagione passata: chi c'era allora e nelle squadre di allora */}
      {passata && (
        <div className="adm-alert adm-alert-info" role="status">
          <FaHistory aria-hidden="true" />
          <span>
            Stai guardando la stagione <strong>{stagioneScelta.nome}</strong>: chi c&apos;era
            e in quali squadre, con i conti di allora.{" "}
            <button type="button" className="adm-link-btn" onClick={() => scegliStagione(null)}>
              Torna alla stagione in corso
            </button>
          </span>
        </div>
      )}

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {/* ---------- Da sistemare ---------- */}
      {atleti.length > 0 && (
        daFare.length > 0 ? (
          <section className="adm-sezione prs-da-fare" aria-labelledby="atleti-da-fare">
            <div className="adm-sezione-testa">
              <div>
                <h2 className="adm-sezione-titolo" id="atleti-da-fare">
                  {passata ? "Com'era rimasta la stagione" : "Da sistemare"}
                </h2>
                <p className="adm-sezione-sotto">
                  Tocca una voce per vedere solo quelle persone.
                </p>
              </div>
            </div>

            <div className="adm-azioni-rapide">
              {daFare.map((d) => (
                <button
                  key={d.filtro}
                  type="button"
                  className={`adm-tessera-azione ${d.tono} ${filtro === d.filtro ? "is-scelta" : ""}`}
                  onClick={() => cambiaFiltro(filtro === d.filtro ? "" : d.filtro)}
                  aria-pressed={filtro === d.filtro}
                >
                  <span className="adm-tessera-icona"><d.Icona aria-hidden="true" /></span>
                  <span className="adm-tessera-titolo">{d.titolo}</span>
                  <span className="adm-tessera-testo">{d.testo}</span>
                  <FaArrowRight className="adm-tessera-freccia" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        ) : (
          <p className="prs-tutto-ok" role="status">
            <FaCheckCircle aria-hidden="true" />
            <span>
              <strong>Tutto in ordine.</strong>{" "}
              {conQuote
                ? "Nessun certificato scaduto o da controllare, e ogni quota è impostata."
                : "Nessun certificato scaduto o in scadenza."}
            </span>
          </p>
        )
      )}

      {/* ---------- Filtri e ricerca ---------- */}
      {atleti.length > 0 && (
        <div className="prs-filtri">
          <LinguetteFiltro
            voci={voci}
            attiva={filtro}
            onCambia={cambiaFiltro}
            etichetta="Quali atleti mostrare"
          />

          <div className="prs-cerca">
            <div className="adm-search">
              <FaSearch className="adm-search-icon" aria-hidden="true" />
              <input
                type="search"
                className="adm-input"
                value={ricerca}
                onChange={(e) => { setRicerca(e.target.value); setPagina(1); }}
                placeholder="Cerca per nome, email o squadra…"
                aria-label="Cerca fra gli atleti"
              />
            </div>

            <Tendina
              className="adm-filter-select"
              valore={squadraId}
              onChange={(v) => { setSquadraId(v); setPagina(1); }}
              opzioni={opzioniSquadra}
              segnaposto="Tutte le squadre"
              // Senza ricerca: la pagina ha già la sua casella di ricerca, e sul
              // telefono questa apriva la tastiera a ogni tocco della tendina
              cercabile={false}
              etichettaAria="Filtra per squadra"
            />
          </div>
        </div>
      )}

      {/* Quanti ne restano e come tornare a tutti: con un filtro acceso e
          una ricerca scritta, chi guarda deve sapere perché ne vede cinque
          e non sessanta. */}
      {filtrato && visibili.length > 0 && (
        <div className="prs-conteggio" role="status">
          <span>
            <strong>{visibili.length}</strong> {visibili.length === 1 ? "atleta" : "atleti"}
            {filtroAttivo?.chiave ? ` · ${filtroAttivo.etichetta.toLowerCase()}` : ""}
          </span>
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-piccolo" onClick={azzera}>
            <FaTimes aria-hidden="true" /> Mostra tutti
          </button>
        </div>
      )}

      {visibili.length === 0 ? (
        atleti.length === 0 ? (
          <div className="adm-vuoto-amico">
            <span className="adm-vuoto-icona"><FaRunning aria-hidden="true" /></span>
            <h2>Ancora nessun atleta</h2>
            <p>
              Quando accoglierai una richiesta di iscrizione, la persona
              comparirà qui con il suo certificato{conQuote ? " e la sua quota" : ""}.
            </p>
          </div>
        ) : (
          <div className="adm-vuoto-amico">
            <span className="adm-vuoto-icona">
              {vuotoBuono ? <FaCheckCircle aria-hidden="true" /> : <FaSearch aria-hidden="true" />}
            </span>
            <h2>{vuotoBuono ? vuotoBuono[0] : "Nessuno corrisponde"}</h2>
            <p>{vuotoBuono ? vuotoBuono[1] : "Prova a cercare in un altro modo, o togli i filtri."}</p>
            <button type="button" className="adm-btn adm-btn-primary" onClick={azzera}>
              Mostra tutti gli atleti
            </button>
          </div>
        )
      ) : (
        <ul className="adm-atleti prs-elenco">
          {dellaPagina.map((a) => {
            const anni = eta(a.dataNascita, oggi);

            return (
              <li key={a.utenteId}>
                <Link
                  to={`${area}/atleti/${a.utenteId}`}
                  className={`adm-atleta-riga prs-riga ${conQuote ? "" : "is-senza-quota"} ${tonoRiga(a, { puoValidare, conQuote })}`}
                >
                  <Ritratto
                    nome={a.nomeCompleto}
                    url={a.immagineUrl}
                    dimensione="m"
                  />

                  <div className="adm-atleta-chi">
                    <span className="adm-atleta-nome">
                      {a.nomeCompleto}
                      {a.ritirato && <span className="adm-badge-ritirato">Ritirato</span>}
                      {a.abbandonato && <span className="adm-badge-ritirato is-abbandonato">Abbandonato</span>}
                    </span>
                    <span className="adm-atleta-sotto">
                      {a.squadre.map((s) => s.nome).join(", ") || "nessuna squadra"}
                      {anni != null && ` · ${anni} anni`}
                    </span>
                  </div>

                  {/* Le due domande, ognuna col suo nome sopra: "Scaduto"
                      da solo non dice di cosa, e sul telefono le due
                      pastiglie una accanto all'altra si confondevano. */}
                  <div className="adm-atleta-cert prs-stato">
                    <span className="prs-stato-cosa">Certificato</span>
                    <span className={`adm-cert ${a.cert.classe}`}>
                      <FaHeartbeat aria-hidden="true" /> {a.cert.etichetta}
                    </span>
                    {a.cert.giorni != null && (
                      <span className="adm-atleta-nota">{quantoManca(a.cert.giorni)}</span>
                    )}
                    {/* "Manca la copia" lo dice già la pastiglia: la nota
                        serve solo quando la pastiglia parla d'altro */}
                    {a.certificatoScadenza && !a.certificatoCaricato && a.cert.chiave !== "senza_file" && (
                      <span className="adm-atleta-nota adm-atleta-nota-attenzione">
                        <FaFileMedical aria-hidden="true" /> file non caricato
                      </span>
                    )}
                  </div>

                  {conQuote && (
                    <div className="adm-atleta-quota prs-stato">
                      <span className="prs-stato-cosa">Quota</span>
                      {a.quotaStagionaleCentesimi == null ? (
                        <span className="prs-pastiglia is-attenzione">
                          <FaEuroSign aria-hidden="true" /> Da impostare
                        </span>
                      ) : (
                        <>
                          <span className={`prs-pastiglia ${a.manca > 0 ? "is-aperta" : "is-ok"}`}>
                            <FaEuroSign aria-hidden="true" />
                            {a.manca > 0 ? `${euro(a.manca)} da versare` : "Saldata"}
                          </span>
                          <span className="adm-atleta-nota">
                            {euro(a.versatoCentesimi)} di {euro(a.dovutoCentesimi)}
                            {a.dovutoCentesimi !== a.quotaStagionaleCentesimi && " (metà quota)"}
                          </span>
                        </>
                      )}
                    </div>
                  )}

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
