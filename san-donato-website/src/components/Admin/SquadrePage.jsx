import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus, FaPencilAlt, FaSave, FaTimes, FaUsers, FaRunning,
  FaExclamationCircle, FaSitemap, FaThLarge, FaBars, FaLink, FaCalendarCheck
} from "react-icons/fa";
import {
  listSquadreConGestori, creaSquadra, aggiornaSquadra, eliminaSquadra,
  listUtenti, associaSquadra, dissociaSquadra,
  getCalendariUfficiali, aggiornaGironeCalendario, AuthError
} from "../../api/adminApi";
import FontiCalendari from "./FontiCalendari";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import Tendina from "./Tendina";
import ScambiaVista from "./ScambiaVista";
import { useVista } from "../../hooks/useVista";
import { indirizziCalendario } from "../../utils/calendarioSquadra";
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
  const { user, sessionExpired } = useAuth();
  const { avvisa, conferma } = useDialoghi();

  // I calendari ufficiali stanno qui, sulle squadre, per chi li può gestire
  const conCalendari = (user?.capabilities ?? []).includes("calendari.gestisci");
  const [calendari, setCalendari] = useState(null);
  const [occupati, setOccupati] = useState(() => new Set());

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
    return Promise.all([
      listSquadreConGestori(),
      listUtenti(),
      conCalendari ? getCalendariUfficiali() : null
    ])
      .then(([elenco, utenti, statoCalendari]) => {
        setSquadre(elenco);
        setPersone(utenti.filter((u) => GESTISCE.includes(u.ruolo)));
        setCalendari(statoCalendari);
        setCaricamento(false);
      })
      .catch((err) => {
        gestisciErrore(err);
        setCaricamento(false);
      });
  }, [gestisciErrore, conCalendari]);

  useEffect(() => { ricarica(); }, [ricarica]);

  /* ---------- Calendari ufficiali ---------- */

  const segnaOccupato = (id, si) => setOccupati((prima) => {
    const dopo = new Set(prima);
    if (si) dopo.add(id); else dopo.delete(id);
    return dopo;
  });

  /* I gironi di una squadra, e quelli che le si possono collegare: i liberi,
     e quelli di un'altra squadra — che la seguono con marcatori e foto,
     senza perdere niente. Quelli messi da parte no: prima si riprendono. */
  const gironiDi = (squadraId) => (calendari?.gironi ?? []).filter((g) => g.squadraId === squadraId);

  const collegabiliA = (squadraId) => (calendari?.gironi ?? [])
    .filter((g) => g.squadraId !== squadraId && !g.ignorato && !g.sparitoIl)
    .map((g) => ({
      valore: String(g.id),
      etichetta: g.titolo || g.nomeFile,
      nota: g.squadraId
        ? `ora in ${g.squadraNome}`
        : `${g.nomeNelGirone} · ${g.partite} partite`
    }));

  const collega = async (girone, squadraId) => {
    const squadra = squadre.find((s) => s.id === squadraId);

    if (girone.squadraId) {
      const ok = await conferma({
        titolo: `Spostare il girone su ${squadra?.nome}?`,
        testo: `Le sue ${girone.nelCalendario} partite passano dal calendario di `
          + `${girone.squadraNome} a quello di ${squadra?.nome}, con marcatori e foto già inseriti.`,
        conferma: "Sposta"
      });
      if (!ok) return;
    }

    segnaOccupato(girone.id, true);
    try {
      const { conto } = await aggiornaGironeCalendario(girone.id, { squadraId });
      avvisa(
        conto?.nuove
          ? `Calendario collegato a ${squadra?.nome}: ${conto.nuove} partite sono entrate nel suo calendario.`
          : `Calendario collegato a ${squadra?.nome}.`
      );
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      segnaOccupato(girone.id, false);
    }
  };

  /* Scollegare toglie le partite dal calendario della squadra: va detto
     cosa si perde, e cosa invece torna collegando di nuovo. */
  const scollega = async (girone) => {
    const aggiunte = girone.conAggiunte > 0
      ? ` Di queste, ${girone.conAggiunte === 1 ? "una ha" : `${girone.conAggiunte} hanno`} marcatori, diretta, `
        + "note o foto aggiunti a mano, che andranno persi."
      : "";

    const ok = await conferma({
      titolo: `Scollegare il calendario da ${girone.squadraNome}?`,
      testo: `Le sue ${girone.nelCalendario} partite escono dal calendario di ${girone.squadraNome}.${aggiunte} `
        + "Il girone torna fra quelli da assegnare: collegandolo di nuovo le partite ufficiali tornano subito.",
      conferma: "Scollega",
      pericolo: true
    });
    if (!ok) return;

    segnaOccupato(girone.id, true);
    try {
      const { conto } = await aggiornaGironeCalendario(girone.id, { squadraId: null });
      avvisa(`Calendario scollegato: ${conto?.tolte ?? 0} partite tolte dal calendario.`, "info");
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      segnaOccupato(girone.id, false);
    }
  };

  /* ---------- Cancellazione ----------
     Solo di una squadra vuota: senza partite, iscritti né gironi. Le altre
     si disattivano, e il server lo ricontrolla comunque. */
  const siCancella = (s) => s.atleti === 0 && s.eventi === 0 && gironiDi(s.id).length === 0;

  const cancella = async (s) => {
    const ok = await conferma({
      titolo: `Cancellare "${s.nome}"?`,
      testo: "Non ha partite, iscritti né calendari ufficiali: sparisce del tutto, "
        + "anche dalle tendine. Chi la gestiva smette di gestirla.",
      conferma: "Cancella",
      pericolo: true
    });
    if (!ok) return;

    try {
      await eliminaSquadra(s.id);
      avvisa(`"${s.nome}" cancellata.`, "info");
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    }
  };

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

  /* Il link da mandare alle famiglie, sul gruppo della squadra: chi lo apre
     abbona il calendario, e le partite spostate si spostano anche sul suo
     telefono. */
  const copiaCalendario = async (s) => {
    const { https } = indirizziCalendario(s.id);
    try {
      await navigator.clipboard.writeText(https);
      avvisa(`Link del calendario di ${s.nome} copiato: incollalo dove lo leggono le famiglie.`);
    } catch {
      avvisa(`Copia non riuscita. Il link è ${https}`, "info", { permanente: true });
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
            {squadre.length} squadre · chi le allena, quanti ne fanno parte e da quale
            calendario ufficiale arrivano le partite. Si cancella solo una squadra vuota:
            le altre si disattivano, e la loro storia resta.
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

      {calendari && (
        <FontiCalendari
          dati={calendari}
          opzioniSquadre={squadre
            .filter((s) => s.attiva && s.sport !== "Societa")
            .map((s) => ({ valore: String(s.id), etichetta: s.nome, nota: s.sport }))}
          onCollega={collega}
          onCambio={ricarica}
          onErrore={gestisciErrore}
          occupati={occupati}
        />
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

                      {/* Il calendario ufficiale della squadra: i gironi della
                          federazione da cui arrivano le sue partite. Stesso
                          gesto di "affida a…": una tendina per aggiungere, una
                          × per togliere. I calendari di società non ne hanno. */}
                      {calendari && s.sport !== "Societa" && (
                        <div className="adm-squadre-riga">
                          <span className="adm-dato-etichetta">
                            <FaCalendarCheck aria-hidden="true" /> Calendario ufficiale
                          </span>

                          {gironiDi(s.id).length === 0 && (
                            <span className="adm-hint">Nessuno: le partite si inseriscono a mano.</span>
                          )}

                          {gironiDi(s.id).map((g) => (
                            <span
                              key={g.id}
                              className={`adm-chip adm-chip-squadra adm-chip-girone ${occupati.has(g.id) ? "is-busy" : ""}`}
                              title={`${g.nomeFile} · ${g.nomeNelGirone}`}
                            >
                              {g.titolo || g.nomeFile}
                              <span className="adm-chip-nota">{g.partite} partite</span>
                              <button
                                type="button"
                                onClick={() => scollega(g)}
                                title={`Scollega da ${s.nome}`}
                                disabled={occupati.has(g.id)}
                              >
                                <FaTimes />
                              </button>
                            </span>
                          ))}

                          <Tendina
                            className="tnd-mini"
                            sovrapposta
                            valore=""
                            onChange={(v) => {
                              const girone = calendari.gironi.find((g) => String(g.id) === v);
                              if (girone) collega(girone, s.id);
                            }}
                            opzioni={collegabiliA(s.id)}
                            segnaposto="+ collega un girone…"
                            vuoto="Nessun girone da collegare: aggiungi una fonte qui sopra."
                            etichettaAria={`Collega un calendario ufficiale a ${s.nome}`}
                          />
                        </div>
                      )}

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
                          onClick={() => copiaCalendario(s)}
                          title="Il calendario della squadra, da abbonare con Google o Apple"
                        >
                          <FaLink /> Link calendario
                        </button>

                        <button
                          type="button"
                          className="adm-btn adm-btn-ghost"
                          onClick={() => cambiaStato(s)}
                        >
                          {s.attiva ? "Disattiva" : "Riattiva"}
                        </button>

                        {siCancella(s) && (
                          <button
                            type="button"
                            className="adm-btn adm-btn-ghost adm-btn-pericolo"
                            onClick={() => cancella(s)}
                            title="Si cancella solo una squadra senza partite, iscritti né calendari"
                          >
                            Cancella
                          </button>
                        )}
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
