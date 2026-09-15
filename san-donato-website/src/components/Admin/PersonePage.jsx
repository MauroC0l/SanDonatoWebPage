import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUserPlus, FaExclamationCircle, FaCheckCircle, FaUsers,
  FaTimes, FaPlus, FaSearch, FaPencilAlt, FaKey, FaSave, FaChevronDown, FaUndo
} from "react-icons/fa";
import {
  listUtenti, createUtente, updateUtente, listSquadre,
  associaSquadra, dissociaSquadra, riapriRichiesta, AuthError
} from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import Tendina from "./Tendina";
import Paginazione from "./Paginazione";
import { usePaginazione } from "../../hooks/usePaginazione";
import Ritratto from "./Ritratto";
import "../../css/Admin.css";
import "../../css/Ritratto.css";

/**
 * Tutti i ruoli che si possono assegnare dal pannello.
 *
 * L'elenco deve restare allineato a quello del server
 * (server/autorizzazioni.js): un ruolo che compare qui ma non lì viene
 * accettato dal modulo e poi rifiutato al salvataggio.
 */
const RUOLI = [
  {
    valore: "admin",
    etichetta: "Amministratore",
    spiegazione: "Gestisce tutto: notizie, eventi, persone e ruoli."
  },
  {
    valore: "segreteria",
    etichetta: "Segreteria",
    spiegazione: "Iscritti, quote e certificati. Non tocca notizie ed eventi."
  },
  {
    valore: "editor",
    etichetta: "Redattore",
    spiegazione: "Notizie, più gli eventi delle squadre a cui è associato."
  },
  {
    valore: "coach",
    etichetta: "Allenatore",
    spiegazione: "Eventi e materiale delle proprie squadre, e decide chi ci entra."
  },
  {
    valore: "atleta",
    etichetta: "Atleta",
    spiegazione: "I propri dati e il calendario della squadra."
  }
];

const NOME_RUOLO = Object.fromEntries(RUOLI.map((r) => [r.valore, r.etichetta]));

// Chi può essere associato a una squadra: la segreteria no, decide su
// tutte senza gestirne alcuna.
const GESTISCE_SQUADRE = ["admin", "editor", "coach"];

function quandoAccesso(iso) {
  if (!iso) return { testo: "Mai entrato", allarme: true };

  const giorni = Math.floor((Date.now() - new Date(iso)) / 86400000);
  const data = new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit", month: "short", year: "numeric"
  });

  if (giorni === 0) return { testo: "Oggi", allarme: false };
  if (giorni === 1) return { testo: "Ieri", allarme: false };
  if (giorni < 60) return { testo: `${giorni} giorni fa`, allarme: false };

  // Oltre due mesi vale la pena accorgersene: o l'account non serve,
  // o la persona non è mai riuscita a usarlo.
  return { testo: `${data} (${Math.floor(giorni / 30)} mesi fa)`, allarme: true };
}

function dataBreve(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

/*
 * "Respinti" non è uno stato dell'account: in tabella quelle persone sono
 * "in_attesa" come chi aspetta ancora una risposta. La differenza sta
 * sull'ultima richiesta di iscrizione, e per chi guarda è enorme — uno
 * aspetta, l'altro si è già sentito dire di no e non ha modo di riprovare.
 */
const STATI = [
  { valore: "", etichetta: "Tutti" },
  { valore: "attivo", etichetta: "Attivi" },
  { valore: "in_attesa", etichetta: "In attesa" },
  { valore: "respinto", etichetta: "Respinti" },
  { valore: "sospeso", etichetta: "Sospesi" }
];

/**
 * Vero se questa persona è ferma per un rifiuto.
 *
 * Serve anche che l'account non sia attivo. Nel flusso vero le due cose
 * vanno insieme — un rifiuto lascia l'account "in_attesa" — ma chi è già
 * dentro a una squadra e si è visto respingere la domanda per un SECONDO
 * sport non è bloccato da niente: scrivergli "richiesta respinta" accanto
 * ad "Attivo" direbbe due cose che si contraddicono.
 */
function eRespinto(persona) {
  return persona.richiesta?.stato === "rifiutata" && persona.stato !== "attivo";
}

/** Una voce "etichetta / valore" della scheda. */
function Dato({ etichetta, children }) {
  return (
    <div className="adm-dato">
      <dt className="adm-dato-etichetta">{etichetta}</dt>
      <dd className="adm-dato-valore">{children}</dd>
    </div>
  );
}

export default function PersonePage() {
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();

  // Segreteria e amministratori: sono i due ruoli con "iscrizioni.decidi_tutte".
  const decideIscrizioni = (user?.capabilities ?? []).includes("iscrizioni.decidi_tutte");
  const { avvisa, conferma, chiediTesto } = useDialoghi();

  const [persone, setPersone] = useState([]);
  const [squadre, setSquadre] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [nuovo, setNuovo] = useState(null);

  /** L'account che si sta modificando, con i campi in corso di scrittura. */
  // Quale scheda e aperta: una sola per volta, perche aprirle tutte
  // riporterebbe alla pagina lunghissima di prima.
  const [apertaId, setApertaId] = useState(null);

  const [modifica, setModifica] = useState(null);
  const [salvataggio, setSalvataggio] = useState(false);

  // Ricerca e filtri lavorano sui dati già scaricati: con qualche centinaio
  // di persone chiedere al server a ogni lettera sarebbe uno spreco, e la
  // risposta arriverebbe più lenta di quanto si digita.
  const [ricerca, setRicerca] = useState("");
  const [filtroRuolo, setFiltroRuolo] = useState("");
  const [filtroStato, setFiltroStato] = useState("");

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    setErrore(err.message || "Operazione non riuscita.");
    avvisa(err.message || "Operazione non riuscita.", "errore");
  }, [navigate, sessionExpired, avvisa]);

  const ricarica = useCallback(() => {
    // Promise.all e non due await in fila: le due richieste sono
    // indipendenti, e in sequenza costerebbero il doppio dell'attesa.
    return Promise.all([listUtenti(), listSquadre()])
      .then(([elencoPersone, elencoSquadre]) => {
        setPersone(elencoPersone);
        setSquadre(elencoSquadre);
        setCaricamento(false);
      })
      .catch((err) => {
        gestisciErrore(err);
        setCaricamento(false);
      });
  }, [gestisciErrore]);

  // L'effetto non tocca lo stato in modo sincrono: gli aggiornamenti
  // avvengono solo quando le richieste tornano.
  useEffect(() => { ricarica(); }, [ricarica]);

  /* ---------- Modifica dei dati ---------- */

  const apriModifica = (persona) => setModifica({
    id: persona.id,
    nome: persona.nome ?? "",
    cognome: persona.cognome ?? "",
    email: persona.email
  });

  const salvaModifica = async (evento) => {
    evento.preventDefault();
    setErrore("");
    setSalvataggio(true);

    try {
      await updateUtente({
        id: modifica.id,
        nome: modifica.nome.trim(),
        cognome: modifica.cognome.trim(),
        email: modifica.email.trim().toLowerCase()
      });
      avvisa("Dati aggiornati.");
      setModifica(null);
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  const nuovaPassword = async (persona) => {
    const password = await chiediTesto({
      titolo: `Nuova password per ${persona.nomeCompleto}`,
      testo: "Almeno 10 caratteri. Gliela dovrai consegnare a voce o su un canale "
        + "sicuro: il sito non la manda a nessuno. Al primo accesso dovrà cambiarla.",
      etichetta: "Password provvisoria",
      monolinea: true,
      obbligatorio: true,
      conferma: "Imposta",
      massimo: 200
    });
    if (password === null) return;

    if (password.length < 10) {
      avvisa("La password deve avere almeno 10 caratteri.", "errore");
      return;
    }

    try {
      await updateUtente({ id: persona.id, password });
      // Permanente: dentro c'è una password da copiare, e un avviso che
      // sparisce da solo dopo quattro secondi se la porterebbe via.
      avvisa(
        `Password di ${persona.nomeCompleto}: ${password} — consegnagliela adesso.`,
        "ok",
        { permanente: true }
      );
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    }
  };

  /* ---------- Ruolo, stato, squadre ---------- */

  const cambiaRuolo = async (persona, ruolo) => {
    if (ruolo === persona.ruolo) return;

    const nuovoRuolo = RUOLI.find((r) => r.valore === ruolo);

    // Cambiare ruolo cambia cosa quella persona può fare sul sito: chi
    // diventa amministratore da quel momento tocca tutto. Una tendina che lo
    // fa al primo clic, senza chiedere, è troppo facile da sfiorare.
    const ok = await conferma({
      titolo: `Rendere ${persona.nomeCompleto} ${nuovoRuolo.etichetta.toLowerCase()}?`,
      testo: nuovoRuolo.spiegazione,
      conferma: "Cambia il ruolo",
      pericolo: ruolo === "admin"
    });
    if (!ok) return;

    setErrore("");
    try {
      await updateUtente({ id: persona.id, ruolo });
      avvisa(`${persona.nomeCompleto} ora è ${nuovoRuolo.etichetta.toLowerCase()}.`);
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    }
  };

  const cambiaStato = async (persona) => {
    const sospeso = persona.stato === "sospeso";

    const ok = await conferma({
      titolo: sospeso ? "Riammettere questa persona?" : "Sospendere questo account?",
      testo: sospeso
        ? `${persona.nomeCompleto} torna a poter entrare nell'area riservata.`
        : `${persona.nomeCompleto} non potrà più entrare e le sue sessioni aperte `
          + "cadono subito. Quello che ha scritto resta al suo posto, con il suo nome.",
      conferma: sospeso ? "Riammetti" : "Sospendi",
      pericolo: !sospeso
    });
    if (!ok) return;

    setErrore("");
    try {
      await updateUtente({ id: persona.id, stato: sospeso ? "attivo" : "sospeso" });
      avvisa(
        sospeso
          ? `${persona.nomeCompleto} può entrare di nuovo.`
          : `${persona.nomeCompleto} non può più entrare. Le sue notizie restano.`
      );
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    }
  };

  const associa = async (persona, squadraId) => {
    if (!squadraId) return;
    setErrore("");
    try {
      await associaSquadra(persona.id, Number(squadraId));
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    }
  };

  const dissocia = async (persona, squadra) => {
    const ok = await conferma({
      titolo: `Togliere ${persona.nomeCompleto} da ${squadra.nome}?`,
      testo: "Smetterà di poterne gestire eventi e materiale. Gli eventi già "
        + "inseriti restano nel calendario.",
      conferma: "Togli",
      pericolo: true
    });
    if (!ok) return;

    setErrore("");
    try {
      await dissociaSquadra(persona.id, squadra.id);
      avvisa(`${persona.nomeCompleto} non gestisce più ${squadra.nome}.`, "info");
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    }
  };

  const creaPersona = async (evento) => {
    evento.preventDefault();
    setErrore("");

    try {
      await createUtente({
        email: nuovo.email.trim().toLowerCase(),
        ruolo: nuovo.ruolo,
        nome: nuovo.nome.trim() || undefined,
        cognome: nuovo.cognome.trim() || undefined,
        password: nuovo.password
      });

      avvisa(
        `Account creato per ${nuovo.email}, password "${nuovo.password}". ` +
        "Comunicagliela a voce o su un canale sicuro: il sito non la manda.",
        "ok",
        { permanente: true }
      );
      setNuovo(null);
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    }
  };

  /**
   * Rimette in coda la richiesta di chi è stato respinto.
   *
   * È l'unica via d'uscita per quell'account: con l'email già presa non
   * ci si può registrare una seconda volta, quindi senza questo pulsante
   * un "no" dato per sbaglio è definitivo.
   */
  const riabilita = async (persona) => {
    const ok = await conferma({
      titolo: `Riaprire la richiesta di ${persona.nomeCompleto}?`,
      testo: `Torna fra quelle da decidere, per ${persona.richiesta.sport}, e il `
        + "motivo del rifiuto viene cancellato. Del rifiuto resta traccia nel registro.",
      conferma: "Riapri"
    });
    if (!ok) return;

    try {
      await riapriRichiesta(persona.richiesta.id);
      await ricarica();
      avvisa(`La richiesta di ${persona.nomeCompleto} è di nuovo in attesa.`);
    } catch (err) {
      gestisciErrore(err);
    }
  };

  /* ---------- Filtri ---------- */

  const visibili = useMemo(() => {
    const cercato = ricerca.trim().toLowerCase();

    return persone.filter((p) => {
      if (filtroRuolo && p.ruolo !== filtroRuolo) return false;

      if (filtroStato === "respinto") {
        if (!eRespinto(p)) return false;
      } else if (filtroStato === "in_attesa") {
        // "In attesa" vuol dire che una risposta deve ancora arrivare: chi
        // se l'è già sentita dire di no ha una voce sua.
        if (p.stato !== "in_attesa" || eRespinto(p)) return false;
      } else if (filtroStato && p.stato !== filtroStato) {
        return false;
      }
      if (!cercato) return true;

      // Si cerca anche fra le squadre: "chi c'è negli Allievi" è una domanda
      // che ci si fa più spesso di quanto sembri.
      return (
        p.nomeCompleto.toLowerCase().includes(cercato) ||
        p.email.toLowerCase().includes(cercato) ||
        p.squadre.some((s) => s.nome.toLowerCase().includes(cercato))
      );
    });
  }, [persone, ricerca, filtroRuolo, filtroStato]);

  const opzioniSquadra = useMemo(() => [...squadre]
    .sort((a, b) => a.sport.localeCompare(b.sport) || a.nome.localeCompare(b.nome)),
    [squadre]);

  const { pagina, pagine, setPagina, visibili: dellaPagina, totale } = usePaginazione(visibili, 25);

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento delle persone…</p>
      </div>
    );
  }

  const filtrato = Boolean(ricerca.trim() || filtroRuolo || filtroStato);

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">Utenti</h1>
          <p className="adm-page-sub">
            {filtrato
              ? `${visibili.length} di ${persone.length}`
              : `${persone.length} account`}
            {" "}· chi entra nel sito, con che ruolo e su quali squadre.
            In fondo all&apos;elenco chi non entra da tempo.
          </p>
        </div>

        <div className="adm-head-actions">
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            onClick={() => setNuovo({ email: "", ruolo: "coach", nome: "", cognome: "", password: "" })}
          >
            <FaUserPlus /> Nuovo account
          </button>
        </div>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {nuovo && (
        <form className="adm-panel adm-nuovo-utente" onSubmit={creaPersona}>
          <h2 className="adm-panel-title">Nuovo account</h2>

          <div className="adm-due-colonne">
            <label className="adm-field">
              <span className="adm-label">Email</span>
              <input
                type="email"
                className="adm-input"
                value={nuovo.email}
                onChange={(e) => setNuovo({ ...nuovo, email: e.target.value })}
                required
                autoFocus
              />
            </label>

            <div className="adm-field">
              <span className="adm-label">Ruolo</span>
              <Tendina
                valore={nuovo.ruolo}
                onChange={(v) => setNuovo({ ...nuovo, ruolo: v })}
                opzioni={RUOLI.map((r) => ({
                  valore: r.valore,
                  etichetta: r.etichetta,
                  // La spiegazione dentro alla tendina, non sotto: si legge
                  // mentre si sceglie, che è quando serve.
                  nota: r.spiegazione
                }))}
                etichettaAria="Ruolo del nuovo account"
              />
            </div>
          </div>

          <div className="adm-due-colonne">
            <label className="adm-field">
              <span className="adm-label">Nome</span>
              <input
                type="text"
                className="adm-input"
                value={nuovo.nome}
                onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })}
              />
            </label>

            <label className="adm-field">
              <span className="adm-label">Cognome</span>
              <input
                type="text"
                className="adm-input"
                value={nuovo.cognome}
                onChange={(e) => setNuovo({ ...nuovo, cognome: e.target.value })}
              />
            </label>
          </div>

          <label className="adm-field">
            <span className="adm-label">Password provvisoria</span>
            <input
              type="text"
              className="adm-input"
              value={nuovo.password}
              onChange={(e) => setNuovo({ ...nuovo, password: e.target.value })}
              minLength={10}
              required
            />
            <span className="adm-hint">
              Almeno 10 caratteri. È in chiaro apposta: va copiata e consegnata,
              e la persona potrà farsela cambiare.
            </span>
          </label>

          <p className="adm-hint">{RUOLI.find((r) => r.valore === nuovo.ruolo)?.spiegazione}</p>

          <div className="adm-head-actions">
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setNuovo(null)}>
              Annulla
            </button>
            <button type="submit" className="adm-btn adm-btn-primary">
              <FaPlus /> Crea
            </button>
          </div>
        </form>
      )}

      {/* Con centocinquanta righe, trovare una persona scorrendo è una
          piccola tortura. La ricerca lavora sui dati già in pagina. */}
      <div className="adm-toolbar">
        <div className="adm-search">
          <FaSearch className="adm-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="adm-input"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca per nome, email o squadra…"
            aria-label="Cerca fra le persone"
          />
        </div>

        <Tendina
          className="adm-filter-select"
          valore={filtroRuolo}
          onChange={setFiltroRuolo}
          opzioni={[
            { valore: "", etichetta: "Tutti i ruoli" },
            ...RUOLI.map((r) => ({ valore: r.valore, etichetta: r.etichetta }))
          ]}
          segnaposto="Tutti i ruoli"
          etichettaAria="Filtra per ruolo"
        />

        <div className="adm-chip-group">
          {STATI.map((s) => (
            <button
              key={s.valore}
              type="button"
              className={`adm-chip ${filtroStato === s.valore ? "is-active" : ""}`}
              onClick={() => setFiltroStato(s.valore)}
              aria-pressed={filtroStato === s.valore}
            >
              {s.etichetta}
            </button>
          ))}
        </div>
      </div>

      {visibili.length === 0 ? (
        <div className="adm-empty">
          <FaUsers className="adm-empty-icon" />
          <p>
            {persone.length === 0
              ? "Nessun account."
              : "Nessuno corrisponde a questa ricerca."}
          </p>
        </div>
      ) : (
        <div className="adm-tabella-scorrevole">
          <table className="adm-tabella">
            <thead>
              <tr>
                <th scope="col">Persona</th>
                <th scope="col">Ruolo</th>
                <th scope="col">Stato</th>
                <th scope="col">Ultimo accesso</th>
                <th scope="col" className="adm-col-azioni">
                  <span className="adm-solo-lettori">Azioni</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {dellaPagina.map((persona) => {
                const accesso = quandoAccesso(persona.ultimoAccesso);
                const seStesso = persona.id === user?.id;
                const puoAvereSquadre = GESTISCE_SQUADRE.includes(persona.ruolo);
                const inModifica = modifica?.id === persona.id;
                const aperta = apertaId === persona.id || inModifica;

                return [
                  <tr
                    key={persona.id}
                    className={`adm-riga ${aperta ? "is-aperta" : ""} ${persona.stato === "sospeso" ? "is-spento" : ""}`}
                  >
                    {/* Foto a sinistra del nome: in un elenco di
                        centocinquanta account si scorre con l'occhio, e una
                        colonna di sole parole obbliga a leggerle tutte. */}
                    <td className="adm-cella-persona">
                      <Ritratto
                        nome={persona.nomeCompleto}
                        url={persona.immagineUrl}
                        dimensione="s"
                      />

                      <span className="adm-cella-testi">
                        <span className="adm-cella-nome">
                          {persona.nomeCompleto}
                          {seStesso && <span className="adm-role-tag adm-tag-ok">tu</span>}
                        </span>
                        <a href={`mailto:${persona.email}`} className="adm-cella-email">
                          {persona.email}
                        </a>
                      </span>
                    </td>

                    <td>
                      <span className="adm-role-tag">
                        {NOME_RUOLO[persona.ruolo] ?? persona.ruolo}
                      </span>
                    </td>

                    <td>
                      {persona.stato === "sospeso" && (
                        <span className="adm-status adm-status-respinta">Sospeso</span>
                      )}
                      {persona.stato === "in_attesa" && !eRespinto(persona) && (
                        <span className="adm-status adm-status-draft">In attesa</span>
                      )}
                      {eRespinto(persona) && (
                        <span
                          className="adm-status adm-status-respinta"
                          title={persona.richiesta.motivoRifiuto || "Nessun motivo indicato"}
                        >
                          Richiesta respinta
                        </span>
                      )}
                      {persona.stato === "attivo" && !persona.deveCambiarePassword && (
                        <span className="adm-status adm-status-publish">Attivo</span>
                      )}
                      {persona.deveCambiarePassword && (
                        <span className="adm-status adm-status-pending" title="Deve ancora scegliere una password sua">
                          Password da cambiare
                        </span>
                      )}
                    </td>

                    <td className={accesso.allarme ? "adm-accesso-vecchio" : ""}>
                      {accesso.testo}
                    </td>

                    <td className="adm-col-azioni">
                      <button
                        type="button"
                        className="adm-icon-btn adm-utente-apri"
                        onClick={() => { setModifica(null); setApertaId(aperta ? null : persona.id); }}
                        aria-expanded={aperta}
                        aria-label={`${aperta ? "Chiudi" : "Apri"} la scheda di ${persona.nomeCompleto}`}
                        title={aperta ? "Chiudi" : "Apri"}
                      >
                        <FaChevronDown />
                      </button>
                    </td>
                  </tr>,

                  /* La riga dei dettagli è una riga a sé che occupa tutte le
                     colonne: dentro a una cella della riga principale la
                     tabella si deformerebbe, e ogni scheda aperta cambierebbe
                     la larghezza delle colonne di tutte le altre. */
                  aperta && (
                    <tr key={`${persona.id}-dettaglio`} className="adm-riga-dettaglio">
                      <td colSpan={5}>
                        {inModifica ? (
                          <form onSubmit={salvaModifica}>
                            <div className="adm-campi">
                              <label className="adm-field">
                                <span className="adm-label">Nome</span>
                                <input
                                  type="text"
                                  className="adm-input"
                                  value={modifica.nome}
                                  maxLength={80}
                                  onChange={(e) => setModifica({ ...modifica, nome: e.target.value })}
                                  autoFocus
                                  disabled={salvataggio}
                                />
                              </label>

                              <label className="adm-field">
                                <span className="adm-label">Cognome</span>
                                <input
                                  type="text"
                                  className="adm-input"
                                  value={modifica.cognome}
                                  maxLength={80}
                                  onChange={(e) => setModifica({ ...modifica, cognome: e.target.value })}
                                  disabled={salvataggio}
                                />
                              </label>

                              <label className="adm-field adm-campo-largo">
                                <span className="adm-label">Email</span>
                                <input
                                  type="email"
                                  className="adm-input"
                                  value={modifica.email}
                                  maxLength={255}
                                  onChange={(e) => setModifica({ ...modifica, email: e.target.value })}
                                  required
                                  disabled={salvataggio}
                                />
                                <span className="adm-hint">
                                  È anche il nome con cui entra: cambiandola, il prossimo
                                  accesso va fatto con quella nuova.
                                </span>
                              </label>
                            </div>

                            <div className="adm-scheda-azioni">
                              <button
                                type="button"
                                className="adm-btn adm-btn-ghost"
                                onClick={() => setModifica(null)}
                                disabled={salvataggio}
                              >
                                Annulla
                              </button>
                              <button type="submit" className="adm-btn adm-btn-primary" disabled={salvataggio}>
                                <FaSave /> {salvataggio ? "Salvataggio…" : "Salva"}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="adm-dettaglio-griglia">
                            <div className="adm-dettaglio-parte">
                              <span className="adm-dato-etichetta">Ruolo</span>
                              <Tendina
                                className="adm-tendina-ruolo"
                                valore={persona.ruolo}
                                onChange={(v) => cambiaRuolo(persona, v)}
                                opzioni={RUOLI.map((r) => ({
                                  valore: r.valore,
                                  etichetta: r.etichetta,
                                  nota: r.spiegazione
                                }))}
                                disabilitato={seStesso}
                                etichettaAria={`Ruolo di ${persona.nomeCompleto}`}
                              />
                              <span className="adm-hint">
                                Account creato il {dataBreve(persona.creatoIl)}.
                              </span>
                            </div>

                            {puoAvereSquadre && (
                              <div className="adm-dettaglio-parte">
                                <span className="adm-dato-etichetta">Squadre che gestisce</span>

                                <div className="adm-squadre-riga">
                                  {persona.squadre.map((s) => (
                                    <span key={s.id} className="adm-chip adm-chip-squadra">
                                      {s.nome}
                                      <button
                                        type="button"
                                        onClick={() => dissocia(persona, s)}
                                        title={`Togli ${persona.nomeCompleto} da ${s.nome}`}
                                      >
                                        <FaTimes />
                                      </button>
                                    </span>
                                  ))}

                                  {/* La tendina resta sempre sul segnaposto:
                                      non mostra una scelta, esegue un'azione. */}
                                  <Tendina
                                    className="tnd-mini"
                                    valore=""
                                    onChange={(v) => associa(persona, v)}
                                    opzioni={opzioniSquadra
                                      .filter((s) => !persona.squadre.some((p) => p.id === s.id))
                                      .map((s) => ({
                                        valore: String(s.id),
                                        etichetta: s.nome,
                                        gruppo: s.sport === "Societa" ? "Società" : s.sport,
                                        colore: s.colore
                                      }))}
                                    segnaposto="+ squadra…"
                                    vuoto="Già in tutte le squadre."
                                    etichettaAria={`Aggiungi una squadra a ${persona.nomeCompleto}`}
                                  />
                                </div>
                              </div>
                            )}

                            <div className="adm-dettaglio-parte adm-dettaglio-azioni">
                              <span className="adm-dato-etichetta">Azioni</span>

                              <div className="adm-scheda-azioni">
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-ghost"
                                  onClick={() => apriModifica(persona)}
                                >
                                  <FaPencilAlt /> Modifica i dati
                                </button>

                                <button
                                  type="button"
                                  className="adm-btn adm-btn-ghost"
                                  onClick={() => nuovaPassword(persona)}
                                >
                                  <FaKey /> Nuova password
                                </button>

                                <button
                                  type="button"
                                  className="adm-btn adm-btn-ghost"
                                  onClick={() => cambiaStato(persona)}
                                  disabled={seStesso}
                                  title={seStesso ? "Non puoi disattivare il tuo account" : ""}
                                >
                                  {persona.stato === "sospeso" ? "Riammetti" : "Sospendi"}
                                </button>

                                {/* Solo a chi decide sulle iscrizioni:
                                    annullare il no di qualcun altro sta un
                                    gradino sopra all'amministrazione di un
                                    account. */}
                                {eRespinto(persona) && decideIscrizioni && (
                                  <button
                                    type="button"
                                    className="adm-btn adm-btn-secondary"
                                    onClick={() => riabilita(persona)}
                                  >
                                    <FaUndo /> Riapri la richiesta
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      <Paginazione
        pagina={pagina}
        pagine={pagine}
        onCambia={setPagina}
        totale={totale}
        nome={["account", "account"]}
      />
    </div>
  );
}
