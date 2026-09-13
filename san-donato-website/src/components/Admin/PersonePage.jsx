import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUserPlus, FaExclamationCircle, FaCheckCircle, FaUsers,
  FaTimes, FaPlus, FaClock, FaSearch
} from "react-icons/fa";
import {
  listUtenti, createUtente, updateUtente, listSquadre,
  associaSquadra, dissociaSquadra, AuthError
} from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import "../../css/Admin.css";

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
    spiegazione: "Vede tutti gli iscritti e assegna le squadre. Non tocca notizie ed eventi."
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

const STATI = [
  { valore: "", etichetta: "Tutti" },
  { valore: "attivo", etichetta: "Attivi" },
  { valore: "in_attesa", etichetta: "In attesa" },
  { valore: "sospeso", etichetta: "Sospesi" }
];

export default function PersonePage() {
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();

  const [persone, setPersone] = useState([]);
  const [squadre, setSquadre] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [avviso, setAvviso] = useState("");
  const [nuovo, setNuovo] = useState(null);

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
  }, [navigate, sessionExpired]);

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

  /* ---------- Azioni ---------- */

  const cambiaRuolo = async (persona, ruolo) => {
    setErrore("");
    try {
      await updateUtente({ id: persona.id, ruolo });
      setAvviso(`${persona.nomeCompleto} ora è ${RUOLI.find((r) => r.valore === ruolo).etichetta.toLowerCase()}.`);
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    }
  };

  const cambiaStato = async (persona) => {
    setErrore("");
    try {
      const sospeso = persona.stato === "sospeso";

      await updateUtente({ id: persona.id, stato: sospeso ? "attivo" : "sospeso" });
      setAvviso(
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

  const dissocia = async (persona, squadraId) => {
    setErrore("");
    try {
      await dissociaSquadra(persona.id, squadraId);
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

      setAvviso(
        `Account creato per ${nuovo.email}. Comunica la password a voce o ` +
        "con un canale sicuro: non viene inviata da sola."
      );
      setNuovo(null);
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    }
  };

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento delle persone…</p>
      </div>
    );
  }

  const cercato = ricerca.trim().toLowerCase();

  const visibili = persone.filter((p) => {
    if (filtroRuolo && p.ruolo !== filtroRuolo) return false;
    if (filtroStato && p.stato !== filtroStato) return false;
    if (!cercato) return true;

    // Si cerca anche fra le squadre: "chi c'è negli Allievi" è una domanda
    // che ci si fa più spesso di quanto sembri.
    return (
      p.nomeCompleto.toLowerCase().includes(cercato) ||
      p.email.toLowerCase().includes(cercato) ||
      p.squadre.some((s) => s.nome.toLowerCase().includes(cercato))
    );
  });

  const filtrato = Boolean(cercato || filtroRuolo || filtroStato);

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">Persone</h1>
          <p className="adm-page-sub">
            {filtrato
              ? `${visibili.length} di ${persone.length}`
              : `${persone.length} account`}
            {" "}· ruoli e squadre. In fondo all&apos;elenco chi non entra da tempo.
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

      {avviso && (
        <div className="adm-alert adm-alert-success" role="status">
          <FaCheckCircle /> <span>{avviso}</span>
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

            <label className="adm-field">
              <span className="adm-label">Ruolo</span>
              <select
                className="adm-input adm-select"
                value={nuovo.ruolo}
                onChange={(e) => setNuovo({ ...nuovo, ruolo: e.target.value })}
              >
                {RUOLI.map((r) => (
                  <option key={r.valore} value={r.valore}>{r.etichetta}</option>
                ))}
              </select>
            </label>
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
      <div className="adm-filters">
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

        <select
          className="adm-input adm-select adm-filter-select"
          value={filtroRuolo}
          onChange={(e) => setFiltroRuolo(e.target.value)}
          aria-label="Filtra per ruolo"
        >
          <option value="">Tutti i ruoli</option>
          {RUOLI.map((r) => (
            <option key={r.valore} value={r.valore}>{r.etichetta}</option>
          ))}
        </select>

        <div className="adm-chip-group">
          {STATI.map((s) => (
            <button
              key={s.valore}
              type="button"
              className={`adm-chip ${filtroStato === s.valore ? "is-active" : ""}`}
              onClick={() => setFiltroStato(s.valore)}
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
        <ul className="adm-post-list">
          {visibili.map((persona) => {
            const accesso = quandoAccesso(persona.ultimoAccesso);
            const seStesso = persona.id === user?.id;
            const puoAvereSquadre = GESTISCE_SQUADRE.includes(persona.ruolo);

            return (
              <li key={persona.id} className={`adm-post-row ${persona.stato === "sospeso" ? "is-disattivato" : ""}`}>
                <div className="adm-post-main">
                  <span className="adm-post-title">
                    {persona.nomeCompleto}
                    {seStesso && <span className="adm-role-tag">tu</span>}
                    {persona.stato === "sospeso" && (
                      <span className="adm-role-tag adm-tag-spento">sospeso</span>
                    )}
                    {persona.stato === "in_attesa" && (
                      <span className="adm-role-tag">aspetta una squadra</span>
                    )}
                  </span>

                  <div className="adm-post-meta">
                    <span>{persona.email}</span>
                    <span className={accesso.allarme ? "adm-accesso-vecchio" : ""}>
                      <FaClock /> {accesso.testo}
                    </span>
                  </div>

                  {puoAvereSquadre && (
                    <div className="adm-squadre-riga">
                      {persona.squadre.map((s) => (
                        <span key={s.id} className="adm-chip adm-chip-squadra">
                          {s.nome}
                          <button
                            type="button"
                            onClick={() => dissocia(persona, s.id)}
                            title={`Togli ${persona.nomeCompleto} da ${s.nome}`}
                          >
                            <FaTimes />
                          </button>
                        </span>
                      ))}

                      <select
                        className="adm-input adm-select adm-select-mini"
                        value=""
                        onChange={(e) => associa(persona, e.target.value)}
                      >
                        <option value="">+ squadra…</option>
                        {squadre
                          .filter((s) => !persona.squadre.some((p) => p.id === s.id))
                          .map((s) => (
                            <option key={s.id} value={s.id}>{s.nome}</option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="adm-post-actions">
                  <select
                    className="adm-input adm-select adm-select-mini"
                    value={persona.ruolo}
                    onChange={(e) => cambiaRuolo(persona, e.target.value)}
                    disabled={seStesso}
                    title={seStesso ? "Non puoi cambiare il tuo stesso ruolo" : "Ruolo"}
                  >
                    {RUOLI.map((r) => (
                      <option key={r.valore} value={r.valore}>{r.etichetta}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="adm-btn adm-btn-ghost"
                    onClick={() => cambiaStato(persona)}
                    disabled={seStesso}
                    title={seStesso ? "Non puoi disattivare il tuo account" : ""}
                  >
                    {persona.stato === "sospeso" ? "Riammetti" : "Sospendi"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
