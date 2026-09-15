import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus, FaPencilAlt, FaSave, FaTimes, FaUsers, FaRunning,
  FaExclamationCircle, FaSitemap, FaThLarge, FaBars
} from "react-icons/fa";
import {
  listSquadreConGestori, creaSquadra, aggiornaSquadra,
  listUtenti, associaSquadra, dissociaSquadra, AuthError
} from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import Tendina from "./Tendina";
import ScambiaVista from "./ScambiaVista";
import { useVista } from "../../hooks/useVista";
import "../../css/Admin.css";

/*
 * Due modi di guardare le squadre.
 *
 * In lista ogni scheda si apre per intero, con allenatori e comandi: è la
 * vista di chi sta sistemando qualcosa. A griglia ci stanno venti squadre
 * in una schermata, ed è la vista di chi sta cercando quale aprire.
 */
const VISTE = [
  { valore: "lista", etichetta: "Lista", Icona: FaBars },
  { valore: "griglia", etichetta: "Griglia", Icona: FaThLarge }
];

const SPORT = [
  { valore: "Calcio", etichetta: "Calcio" },
  { valore: "Pallavolo", etichetta: "Pallavolo" },
  { valore: "Basket", etichetta: "Basket" },
  { valore: "Societa", etichetta: "Società", nota: "non è uno sport: gli appuntamenti sociali" }
];

const NOME_SPORT = { Societa: "Società" };
const sportLeggibile = (s) => NOME_SPORT[s] ?? s;

/** Un colore di partenza per una squadra nuova, diverso per sport. */
const COLORE_PREDEFINITO = {
  Calcio: "#2e7d32",
  Pallavolo: "#1565c0",
  Basket: "#c0392b",
  Societa: "#6b7280"
};

/* Chi può gestire una squadra: un atleta associato non ne ricaverebbe
   alcun permesso, e proporlo sarebbe una promessa non mantenuta. */
const GESTISCE = ["coach", "editor", "admin"];

/**
 * Le squadre: crearle, rinominarle, affidarle, metterle in pensione.
 *
 * Era l'ultimo pezzo che nessuno poteva toccare dal sito. Le venti squadre
 * esistenti sono arrivate da uno script di semina, e aggiungerne una voleva
 * dire aprire il database: l'unica cosa del pannello per cui serviva
 * qualcuno che sapesse scrivere SQL.
 *
 * Non si cancella niente da qui. Una squadra che non esiste più si
 * disattiva: sparisce dalle tendine e dai filtri, ma le sue partite restano
 * nel calendario e i suoi iscritti nella loro storia.
 */
export default function SquadrePage() {
  const navigate = useNavigate();
  const { sessionExpired } = useAuth();
  const { avvisa, conferma } = useDialoghi();

  const [squadre, setSquadre] = useState([]);
  const [persone, setPersone] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [salvataggio, setSalvataggio] = useState(false);

  const [nuova, setNuova] = useState(null);
  const [modifica, setModifica] = useState(null);
  const [mostraSpente, setMostraSpente] = useState(false);
  const [vista, setVista] = useVista("squadre", "lista", ["lista", "griglia"]);

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
    return Promise.all([listSquadreConGestori(), listUtenti()])
      .then(([elenco, utenti]) => {
        setSquadre(elenco);
        setPersone(utenti.filter((u) => GESTISCE.includes(u.ruolo)));
        setCaricamento(false);
      })
      .catch((err) => {
        gestisciErrore(err);
        setCaricamento(false);
      });
  }, [gestisciErrore]);

  useEffect(() => { ricarica(); }, [ricarica]);

  /* ---------- Creazione ---------- */

  const crea = async (evento) => {
    evento.preventDefault();
    setErrore("");
    setSalvataggio(true);

    try {
      await creaSquadra({
        nome: nuova.nome.trim(),
        sport: nuova.sport,
        colore: nuova.colore
      });
      avvisa(`Squadra "${nuova.nome.trim()}" creata.`);
      setNuova(null);
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  /* ---------- Modifica ---------- */

  const apriModifica = (s) => setModifica({
    id: s.id,
    nome: s.nome,
    sport: s.sport,
    colore: s.colore ?? COLORE_PREDEFINITO[s.sport] ?? "#6b7280"
  });

  const salvaModifica = async (evento) => {
    evento.preventDefault();
    setErrore("");
    setSalvataggio(true);

    try {
      await aggiornaSquadra(modifica.id, {
        nome: modifica.nome.trim(),
        sport: modifica.sport,
        colore: modifica.colore
      });
      avvisa("Squadra aggiornata.");
      setModifica(null);
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  const cambiaStato = async (s) => {
    const spegnere = s.attiva;

    const ok = await conferma({
      titolo: spegnere ? `Disattivare "${s.nome}"?` : `Riattivare "${s.nome}"?`,
      testo: spegnere
        ? "Sparisce dalle tendine e dai filtri, e non le si possono più assegnare "
          + "iscritti. Le partite già inserite restano nel calendario del sito, e "
          + `i suoi ${s.atleti} iscritti restano dove sono.`
        : "Torna a comparire ovunque, e le si possono assegnare nuovi iscritti.",
      conferma: spegnere ? "Disattiva" : "Riattiva",
      pericolo: spegnere
    });
    if (!ok) return;

    try {
      await aggiornaSquadra(s.id, { attiva: !s.attiva });
      avvisa(spegnere ? `"${s.nome}" disattivata.` : `"${s.nome}" riattivata.`, "info");
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    }
  };

  /* ---------- Gestori ---------- */

  const affida = async (squadraId, utenteId) => {
    if (!utenteId) return;
    try {
      await associaSquadra(Number(utenteId), squadraId);
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    }
  };

  const togli = async (squadra, gestore) => {
    const ok = await conferma({
      titolo: `Togliere ${gestore.nomeCompleto} da ${squadra.nome}?`,
      testo: "Smetterà di poterne gestire eventi e materiale. Gli eventi già "
        + "inseriti restano nel calendario.",
      conferma: "Togli",
      pericolo: true
    });
    if (!ok) return;

    try {
      await dissociaSquadra(gestore.id, squadra.id);
      avvisa(`${gestore.nomeCompleto} non gestisce più ${squadra.nome}.`, "info");
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    }
  };

  /* ---------- Raggruppamento ---------- */

  const perSport = useMemo(() => {
    const visibili = mostraSpente ? squadre : squadre.filter((s) => s.attiva);
    const gruppi = new Map();

    for (const s of visibili) {
      if (!gruppi.has(s.sport)) gruppi.set(s.sport, []);
      gruppi.get(s.sport).push(s);
    }
    return [...gruppi];
  }, [squadre, mostraSpente]);

  const spente = useMemo(() => squadre.filter((s) => !s.attiva).length, [squadre]);

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento delle squadre…</p>
      </div>
    );
  }

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">Squadre</h1>
          <p className="adm-page-sub">
            {squadre.length} squadre · chi le allena e quanti ne fanno parte.
            Una squadra non si cancella: si disattiva, e la sua storia resta.
          </p>
        </div>

        <div className="adm-head-actions">
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            onClick={() => setNuova({ nome: "", sport: "Calcio", colore: COLORE_PREDEFINITO.Calcio })}
          >
            <FaPlus /> Nuova squadra
          </button>
        </div>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {nuova && (
        <form className="adm-panel adm-nuovo-utente" onSubmit={crea}>
          <h2 className="adm-panel-title">Nuova squadra</h2>

          <div className="adm-campi">
            <label className="adm-field">
              <span className="adm-label">Nome</span>
              <input
                type="text"
                className="adm-input"
                value={nuova.nome}
                onChange={(e) => setNuova({ ...nuova, nome: e.target.value })}
                placeholder="Es. Calcio Under 15"
                maxLength={80}
                required
                autoFocus
                disabled={salvataggio}
              />
            </label>

            <div className="adm-field">
              <span className="adm-label">Sport</span>
              <Tendina
                valore={nuova.sport}
                onChange={(v) => setNuova({
                  ...nuova,
                  sport: v,
                  // Il colore segue lo sport finché non lo si tocca a mano:
                  // così le squadre di uno stesso sport nascono simili.
                  colore: COLORE_PREDEFINITO[v] ?? nuova.colore
                })}
                opzioni={SPORT}
                disabilitato={salvataggio}
                etichettaAria="Sport della squadra"
              />
            </div>

            <label className="adm-field">
              <span className="adm-label">Colore nel calendario</span>
              <span className="adm-colore-riga">
                <input
                  type="color"
                  className="adm-colore"
                  value={nuova.colore}
                  onChange={(e) => setNuova({ ...nuova, colore: e.target.value })}
                  disabled={salvataggio}
                  aria-label="Colore della squadra"
                />
                <span className="adm-colore-codice">{nuova.colore}</span>
              </span>
            </label>
          </div>

          <div className="adm-head-actions">
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setNuova(null)}>
              Annulla
            </button>
            <button type="submit" className="adm-btn adm-btn-primary" disabled={salvataggio}>
              <FaPlus /> {salvataggio ? "Creazione…" : "Crea"}
            </button>
          </div>
        </form>
      )}

      <div className="adm-toolbar">
        {spente > 0 ? (
          <div className="adm-chip-group">
            <button
              type="button"
              className={`adm-chip ${mostraSpente ? "is-active" : ""}`}
              onClick={() => setMostraSpente((v) => !v)}
              aria-pressed={mostraSpente}
            >
              {mostraSpente ? "Nascondi le disattivate" : `Mostra anche le disattivate (${spente})`}
            </button>
          </div>
        ) : <span />}

        <ScambiaVista vista={vista} onCambia={setVista} opzioni={VISTE} />
      </div>

      {perSport.map(([sport, elenco]) => (
        <section key={sport} className="adm-gruppo-squadre">
          <h2 className="adm-gruppo-titolo">
            <FaSitemap aria-hidden="true" /> {sportLeggibile(sport)}
          </h2>

          <ul className={vista === "griglia" ? "adm-schede adm-schede-griglia" : "adm-schede"}>
            {elenco.map((s) => {
              const inModifica = modifica?.id === s.id;

              return (
                <li key={s.id} className={`adm-scheda ${s.attiva ? "" : "is-disattivato"}`}>
                  {inModifica ? (
                    <form onSubmit={salvaModifica}>
                      <div className="adm-campi">
                        <label className="adm-field">
                          <span className="adm-label">Nome</span>
                          <input
                            type="text"
                            className="adm-input"
                            value={modifica.nome}
                            onChange={(e) => setModifica({ ...modifica, nome: e.target.value })}
                            maxLength={80}
                            required
                            autoFocus
                            disabled={salvataggio}
                          />
                        </label>

                        <div className="adm-field">
                          <span className="adm-label">Sport</span>
                          <Tendina
                            valore={modifica.sport}
                            onChange={(v) => setModifica({ ...modifica, sport: v })}
                            opzioni={SPORT}
                            disabilitato={salvataggio || s.atleti > 0}
                            etichettaAria="Sport della squadra"
                          />
                          {s.atleti > 0 && (
                            <span className="adm-hint">
                              Non si cambia: ha {s.atleti} iscritti accolti come{" "}
                              {sportLeggibile(s.sport)}.
                            </span>
                          )}
                        </div>

                        <label className="adm-field">
                          <span className="adm-label">Colore</span>
                          <span className="adm-colore-riga">
                            <input
                              type="color"
                              className="adm-colore"
                              value={modifica.colore}
                              onChange={(e) => setModifica({ ...modifica, colore: e.target.value })}
                              disabled={salvataggio}
                              aria-label="Colore della squadra"
                            />
                            <span className="adm-colore-codice">{modifica.colore}</span>
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
                    <>
                      <header className="adm-scheda-testa">
                        <span
                          className="adm-squadra-colore"
                          style={{ backgroundColor: s.colore || "#999" }}
                          aria-hidden="true"
                        />
                        <h3 className="adm-scheda-nome">{s.nome}</h3>

                        <span className="adm-sport-tag">
                          <FaRunning aria-hidden="true" /> {s.atleti} iscritti
                        </span>

                        {!s.attiva && (
                          <span className="adm-status adm-status-respinta">Disattivata</span>
                        )}
                      </header>

                      <div className="adm-squadre-riga">
                        <span className="adm-dato-etichetta">
                          <FaUsers aria-hidden="true" /> Chi la gestisce
                        </span>

                        {s.gestori.length === 0 && (
                          <span className="adm-hint">Nessuno. Gli eventi li può inserire solo un amministratore.</span>
                        )}

                        {s.gestori.map((g) => (
                          <span key={g.id} className="adm-chip adm-chip-squadra">
                            {g.nomeCompleto}
                            <button
                              type="button"
                              onClick={() => togli(s, g)}
                              title={`Togli ${g.nomeCompleto} da ${s.nome}`}
                            >
                              <FaTimes />
                            </button>
                          </span>
                        ))}

                        <Tendina
                          className="tnd-mini"
                          valore=""
                          onChange={(v) => affida(s.id, v)}
                          opzioni={persone
                            .filter((p) => !s.gestori.some((g) => g.id === p.id))
                            .map((p) => ({
                              valore: String(p.id),
                              etichetta: p.nomeCompleto,
                              nota: p.email
                            }))}
                          segnaposto="+ affida a…"
                          vuoto="Nessun altro allenatore o redattore."
                          etichettaAria={`Affida ${s.nome} a qualcuno`}
                        />
                      </div>

                      <footer className="adm-scheda-azioni">
                        <button
                          type="button"
                          className="adm-btn adm-btn-ghost"
                          onClick={() => apriModifica(s)}
                        >
                          <FaPencilAlt /> Modifica
                        </button>

                        <button
                          type="button"
                          className="adm-btn adm-btn-ghost"
                          onClick={() => cambiaStato(s)}
                        >
                          {s.attiva ? "Disattiva" : "Riattiva"}
                        </button>
                      </footer>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
