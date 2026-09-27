import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaPlus, FaSyncAlt, FaPencilAlt, FaSave, FaExternalLinkAlt, FaExclamationCircle,
  FaExclamationTriangle, FaCheckCircle, FaLink, FaHistory, FaCalendarTimes, FaFolderOpen
} from "react-icons/fa";
import {
  getCalendariUfficiali, creaFonteCalendario, aggiornaFonteCalendario, eliminaFonteCalendario,
  aggiornaGironeCalendario, leggiCalendariOra, deleteEvento, AuthError
} from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { useDialoghi } from "../../context/dialoghi";
import Tendina from "./Tendina";
import "../../css/Admin.css";

/*
 * Le partite ufficiali, dalla federazione al calendario del sito.
 *
 * La lettura la fa il server ogni notte; qui l'amministratore decide le tre
 * cose che il server non può indovinare: DA DOVE leggere (le fonti), A
 * QUALE SQUADRA appartiene ogni girone, e cosa fare delle partite che la
 * federazione ha tolto. L'ordine della pagina è quello dell'urgenza: prima
 * ciò che aspetta una decisione, poi le fonti, poi il racconto di cosa è
 * cambiato.
 */

const formatoData = new Intl.DateTimeFormat("it-IT", {
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
});
const formatoGiorno = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });

const quando = (d) => (d ? formatoData.format(new Date(d)) : "—");
const giorno = (d) => (d ? formatoGiorno.format(new Date(d)) : "—");

const righe = (testo) => testo.split("\n").map((r) => r.trim()).filter(Boolean);

const ESITI = {
  ok: { etichetta: "Letta", classe: "adm-status-publish", Icona: FaCheckCircle },
  avvisi: { etichetta: "Letta con avvisi", classe: "adm-status-draft", Icona: FaExclamationTriangle },
  errore: { etichetta: "Non letta", classe: "adm-status-respinta", Icona: FaExclamationCircle },
  occupata: { etichetta: "In lettura", classe: "adm-status-pending", Icona: FaSyncAlt }
};

/* La prima fonte di una stagione nasce già compilata con quello che vale
   quasi sempre: resta da incollare la cartella. */
const FONTE_NUOVA = {
  nome: "",
  formato: "uisp_pallavolo",
  cartella: "",
  nomiNostri: "Pol. San Donato\nPolisportiva San Donato",
  palestreCasa: "Cartiera\nVia Fossano 8",
  attiva: true
};

function Dato({ etichetta, children }) {
  return (
    <div className="adm-dato">
      <dt className="adm-dato-etichetta">{etichetta}</dt>
      <dd className="adm-dato-valore">{children}</dd>
    </div>
  );
}

/** Il racconto di una lettura in una riga: quanti file, quante partite, cosa è cambiato. */
function raccontoLettura(r) {
  if (!r) return null;
  if (r.messaggio) return r.messaggio;

  const pezzi = [`${r.letti}/${r.fogli} file letti`, `${r.gironi} gironi nostri`, `${r.partite} partite`];
  const cambi = [
    r.nuove && `${r.nuove} nuove`,
    r.spostate && `${r.spostate} spostate`,
    r.risultati && `${r.risultati} risultati`,
    r.modificate && `${r.modificate} aggiornate`,
    r.sparite && `${r.sparite} sparite`,
    r.ricomparse && `${r.ricomparse} ricomparse`
  ].filter(Boolean);

  return `${pezzi.join(" · ")}${cambi.length ? ` — ${cambi.join(", ")}` : " — nessun cambiamento"}`;
}

/* =====================================================
   Modulo di una fonte
   ===================================================== */

function ModuloFonte({ iniziale, formati, onSalva, onAnnulla, salvataggio, titolo }) {
  const [f, setF] = useState(iniziale);
  const aggiorna = (campi) => setF((prima) => ({ ...prima, ...campi }));

  const invia = (e) => {
    e.preventDefault();
    onSalva({
      nome: f.nome.trim(),
      formato: f.formato,
      cartella: f.cartella.trim(),
      nomiNostri: righe(f.nomiNostri),
      palestreCasa: righe(f.palestreCasa),
      attiva: f.attiva
    });
  };

  const formato = formati.find((x) => x.codice === f.formato);

  return (
    <form className="adm-panel adm-cal-modulo" onSubmit={invia}>
      {titolo && <h2 className="adm-panel-title">{titolo}</h2>}

      <div className="adm-campi">
        <label className="adm-field">
          <span className="adm-label">Nome</span>
          <input
            type="text" className="adm-input" value={f.nome} maxLength={120} required autoFocus
            placeholder="Il nome della cartella, es. UISP Giovanili Torneo Autunno 2026"
            onChange={(e) => aggiorna({ nome: e.target.value })} disabled={salvataggio}
          />
        </label>

        <div className="adm-field">
          <span className="adm-label">Formato</span>
          <Tendina
            valore={f.formato}
            onChange={(v) => aggiorna({ formato: v })}
            opzioni={formati.map((x) => ({ valore: x.codice, etichetta: x.nome, nota: x.sport }))}
            disabilitato={salvataggio}
            etichettaAria="Formato dei file"
          />
          {formato && <span className="adm-hint">{formato.descrizione}</span>}
        </div>
      </div>

      <label className="adm-field">
        <span className="adm-label">Cartella Google Drive</span>
        <input
          type="text" className="adm-input" value={f.cartella} required
          placeholder="https://drive.google.com/drive/folders/…"
          onChange={(e) => aggiorna({ cartella: e.target.value })} disabled={salvataggio}
        />
        <span className="adm-hint">
          Il collegamento che pubblica la federazione. La cartella deve essere aperta a
          chiunque abbia il link: il sito la legge senza account.
        </span>
      </label>

      <div className="adm-due-colonne">
        <label className="adm-field">
          <span className="adm-label">Come ci chiama la federazione</span>
          <textarea
            className="adm-input adm-textarea" rows={3} value={f.nomiNostri} required
            onChange={(e) => aggiorna({ nomiNostri: e.target.value })} disabled={salvataggio}
          />
          <span className="adm-hint">
            Un nome per riga. Basta l&apos;inizio: &quot;Pol. San Donato&quot; trova anche
            &quot;Pol. San Donato Rossa&quot;. Maiuscole e punti non contano.
          </span>
        </label>

        <label className="adm-field">
          <span className="adm-label">Dove giochiamo in casa</span>
          <textarea
            className="adm-input adm-textarea" rows={3} value={f.palestreCasa}
            onChange={(e) => aggiorna({ palestreCasa: e.target.value })} disabled={salvataggio}
          />
          <span className="adm-hint">
            Un pezzo del nome o dell&apos;indirizzo per riga. È in casa solo la partita che si
            gioca qui, anche se la squadra ospitante siamo noi. Vuoto: vale l&apos;ordine del foglio.
          </span>
        </label>
      </div>

      <label className="adm-check">
        <input
          type="checkbox" checked={f.attiva}
          onChange={(e) => aggiorna({ attiva: e.target.checked })} disabled={salvataggio}
        />
        <span className="adm-check-box" aria-hidden="true" />
        <span>Leggi questa fonte ogni notte</span>
      </label>

      <div className="adm-scheda-azioni adm-cal-azioni-modulo">
        <button type="button" className="adm-btn adm-btn-ghost" onClick={onAnnulla} disabled={salvataggio}>
          Annulla
        </button>
        <button type="submit" className="adm-btn adm-btn-primary" disabled={salvataggio}>
          <FaSave /> {salvataggio ? "Salvataggio…" : "Salva"}
        </button>
      </div>
    </form>
  );
}

/* =====================================================
   Un girone
   ===================================================== */

function Girone({ g, opzioniSquadre, occupato, onCollega, onIgnora }) {
  return (
    <li className={`adm-scheda adm-cal-girone ${g.ignorato ? "is-disattivato" : ""} ${occupato ? "is-busy" : ""}`}>
      <header className="adm-scheda-testa">
        <h3 className="adm-scheda-nome">{g.titolo || g.nomeFile}</h3>
        {g.sparitoIl && (
          <span className="adm-status adm-status-draft" title={`Dal ${giorno(g.sparitoIl)}`}>
            Non più nella cartella
          </span>
        )}
      </header>

      <dl className="adm-scheda-dati">
        <Dato etichetta="Nel foglio">{g.nomeNelGirone}</Dato>
        <Dato etichetta="File">{g.nomeFile}</Dato>
        <Dato etichetta="Partite">{g.partite}</Dato>
        <Dato etichetta="Prossima">{g.prossima ? quando(g.prossima) : "—"}</Dato>
      </dl>

      {g.avversari.length > 0 && (
        <p className="adm-hint">Contro {g.avversari.join(", ")}{g.partite > g.avversari.length ? "…" : ""}</p>
      )}

      <div className="adm-scheda-azioni">
        <div className="adm-scheda-squadra">
          <Tendina
            valore={g.squadraId ? String(g.squadraId) : ""}
            onChange={(v) => v && onCollega(g, Number(v))}
            opzioni={opzioniSquadre}
            segnaposto={g.squadraId ? undefined : "Collega a una squadra…"}
            disabilitato={occupato}
            etichettaAria={`Squadra del sito per ${g.titolo || g.nomeFile}`}
          />
        </div>

        {!g.squadraId && (
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => onIgnora(g, !g.ignorato)} disabled={occupato}>
            {g.ignorato ? "Riprendi" : "Non ci riguarda"}
          </button>
        )}
      </div>
    </li>
  );
}

/* =====================================================
   La pagina
   ===================================================== */

export default function CalendariUfficialiPage() {
  const navigate = useNavigate();
  const area = useArea();
  const { sessionExpired } = useAuth();
  const { avvisa, conferma } = useDialoghi();

  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState("");
  const [salvataggio, setSalvataggio] = useState(false);
  const [inLettura, setInLettura] = useState(null); // "tutte" | id della fonte
  const [occupati, setOccupati] = useState(() => new Set());
  const [nuova, setNuova] = useState(false);
  const [modifica, setModifica] = useState(null);
  const [mostraIgnorati, setMostraIgnorati] = useState(false);

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
    return getCalendariUfficiali()
      .then((risposta) => {
        setDati(risposta);
        setErrore("");
      })
      .catch(gestisciErrore);
  }, [gestisciErrore]);

  useEffect(() => { ricarica(); }, [ricarica]);

  const segnaOccupato = (id, si) => setOccupati((prima) => {
    const dopo = new Set(prima);
    if (si) dopo.add(id); else dopo.delete(id);
    return dopo;
  });

  /* ---------- Lettura ---------- */

  const leggi = async (fonte) => {
    setInLettura(fonte ? fonte.id : "tutte");
    try {
      const esiti = await leggiCalendariOra(fonte?.id);
      if (!esiti.length) {
        avvisa("Nessuna fonte attiva da leggere.", "info");
      } else {
        const male = esiti.filter((e) => e.esito === "errore");
        avvisa(
          male.length
            ? `Lettura finita, ma ${male.length === 1 ? "una fonte non si è letta" : `${male.length} fonti non si sono lette`}: guarda il dettaglio qui sotto.`
            : `Lettura finita. ${raccontoLettura(esiti[0].riepilogo)}`,
          male.length ? "errore" : undefined
        );
      }
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setInLettura(null);
    }
  };

  /* ---------- Fonti ---------- */

  const creaFonte = async (valori) => {
    setSalvataggio(true);
    try {
      const fonte = await creaFonteCalendario(valori);
      setNuova(false);
      avvisa(`Fonte "${fonte.nome}" aggiunta. La leggo subito, così vedi cosa contiene.`);
      await ricarica();
      await leggi(fonte);
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  const salvaFonte = async (valori) => {
    setSalvataggio(true);
    try {
      await aggiornaFonteCalendario(modifica.id, valori);
      setModifica(null);
      avvisa("Fonte aggiornata. I cambiamenti valgono dalla prossima lettura.");
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  const accendiSpegni = async (fonte) => {
    const spegnere = fonte.attiva;
    const ok = await conferma({
      titolo: spegnere ? `Smettere di leggere "${fonte.nome}"?` : `Riprendere a leggere "${fonte.nome}"?`,
      testo: spegnere
        ? "Le sue partite restano nel calendario così come sono, ma non si aggiornano più: "
          + "né orari né risultati. È quello che si fa a fine stagione."
        : "Da stanotte le sue partite tornano ad aggiornarsi.",
      conferma: spegnere ? "Disattiva" : "Riattiva",
      pericolo: spegnere
    });
    if (!ok) return;

    try {
      await aggiornaFonteCalendario(fonte.id, { attiva: !fonte.attiva });
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    }
  };

  const eliminaFonte = async (fonte) => {
    const ok = await conferma({
      titolo: `Togliere "${fonte.nome}"?`,
      testo: "Non ha portato partite nel calendario: si toglie la fonte e l'elenco dei suoi gironi.",
      conferma: "Togli",
      pericolo: true
    });
    if (!ok) return;

    try {
      await eliminaFonteCalendario(fonte.id);
      avvisa(`"${fonte.nome}" tolta.`, "info");
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    }
  };

  /* ---------- Gironi ---------- */

  const collega = async (girone, squadraId) => {
    if (squadraId === girone.squadraId) return;
    const squadra = dati.squadre.find((s) => s.id === squadraId);

    if (girone.squadraId) {
      const ok = await conferma({
        titolo: `Spostare il girone su ${squadra?.nome}?`,
        testo: `Le ${girone.partite} partite di "${girone.nomeNelGirone}" passano dal calendario di `
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
          ? `Collegato a ${squadra?.nome}: ${conto.nuove} partite sono entrate nel suo calendario.`
          : `Collegato a ${squadra?.nome}.`
      );
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      segnaOccupato(girone.id, false);
    }
  };

  /* Scollegare toglie le partite dal calendario: prima di farlo va detto
     cosa si perde, e cosa invece torna collegando di nuovo. */
  const scollega = async (girone) => {
    const aggiunte = girone.conAggiunte > 0
      ? ` Di queste, ${girone.conAggiunte === 1 ? "una ha" : `${girone.conAggiunte} hanno`} marcatori, diretta, `
        + "note o foto aggiunti a mano, che andranno persi."
      : "";

    const ok = await conferma({
      titolo: `Scollegare il girone da ${girone.squadraNome}?`,
      testo: `Le sue ${girone.nelCalendario} partite escono dal calendario di ${girone.squadraNome}.${aggiunte} `
        + "Il girone torna fra quelli da collegare: collegandolo di nuovo le partite ufficiali tornano subito.",
      conferma: "Scollega",
      pericolo: true
    });
    if (!ok) return;

    segnaOccupato(girone.id, true);
    try {
      const { conto } = await aggiornaGironeCalendario(girone.id, { squadraId: null });
      avvisa(`Girone scollegato: ${conto?.tolte ?? 0} partite tolte dal calendario.`, "info");
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      segnaOccupato(girone.id, false);
    }
  };

  const ignora = async (girone, ignorato) => {
    segnaOccupato(girone.id, true);
    try {
      await aggiornaGironeCalendario(girone.id, { ignorato });
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      segnaOccupato(girone.id, false);
    }
  };

  /* ---------- Partite sparite ---------- */

  const togliSparita = async (partita) => {
    const ok = await conferma({
      titolo: `Togliere "${partita.titolo}" dal calendario?`,
      testo: "La federazione non la elenca più. Dal sito è già sparita; qui la si toglie anche "
        + "dal pannello. Se ricomparisse nel calendario ufficiale, tornerà da sola.",
      conferma: "Togli",
      pericolo: true
    });
    if (!ok) return;

    try {
      await deleteEvento(partita.id);
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    }
  };

  /* ---------- Raggruppamenti ---------- */

  const opzioniSquadre = useMemo(() => (dati?.squadre ?? [])
    .filter((s) => s.sport !== "Societa")
    .map((s) => ({ valore: String(s.id), etichetta: s.nome, nota: s.sport })), [dati]);

  // Per i gironi già collegati c'è anche la strada indietro
  const opzioniCollegato = useMemo(() => [
    { valore: "nessuna", etichetta: "Nessuna squadra", nota: "torna da collegare" },
    ...opzioniSquadre
  ], [opzioniSquadre]);

  const daCollegare = useMemo(
    () => (dati?.gironi ?? []).filter((g) => !g.squadraId && !g.ignorato && !g.sparitoIl),
    [dati]
  );

  if (!dati) {
    return errore ? (
      <div className="adm-page">
        <div className="adm-alert adm-alert-error" role="alert"><FaExclamationCircle /> <span>{errore}</span></div>
      </div>
    ) : (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento dei calendari…</p>
      </div>
    );
  }

  const formatoDi = (codice) => dati.formati.find((f) => f.codice === codice);
  const letturaInCorso = inLettura !== null;

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">Calendari ufficiali</h1>
          <p className="adm-page-sub">
            Le partite delle federazioni entrano da sole nel calendario del sito, ogni notte.
            Orari, campi e risultati li decide il calendario ufficiale.
          </p>
        </div>

        <div className="adm-head-actions">
          <button
            type="button" className="adm-btn adm-btn-ghost"
            onClick={() => leggi(null)} disabled={letturaInCorso || !dati.fonti.some((f) => f.attiva)}
          >
            <FaSyncAlt className={inLettura === "tutte" ? "adm-gira" : ""} />
            {inLettura === "tutte" ? " Lettura…" : " Aggiorna ora"}
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => setNuova(true)} disabled={nuova}>
            <FaPlus /> Nuova fonte
          </button>
        </div>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {!dati.letturaNotturna && (
        <div className="adm-alert adm-alert-warn">
          <FaExclamationTriangle />
          <span>
            <strong>La lettura notturna è spenta</strong>: sul server manca la variabile CRON_SECRET.
            Finché non c&apos;è, i calendari si aggiornano solo con &quot;Aggiorna ora&quot;.
          </span>
        </div>
      )}

      {nuova && (
        <ModuloFonte
          titolo="Nuova fonte"
          iniziale={FONTE_NUOVA}
          formati={dati.formati}
          salvataggio={salvataggio}
          onSalva={creaFonte}
          onAnnulla={() => setNuova(false)}
        />
      )}

      {dati.fonti.length === 0 && !nuova && (
        <div className="adm-empty">
          <FaFolderOpen className="adm-empty-icon" aria-hidden="true" />
          <h2>Nessuna fonte</h2>
          <p>Aggiungi la cartella in cui la federazione pubblica i calendari dei gironi.</p>
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => setNuova(true)}>
            <FaPlus /> Nuova fonte
          </button>
        </div>
      )}

      {/* ---------- Da decidere ---------- */}

      {daCollegare.length > 0 && (
        <section className="adm-cal-sezione">
          <h2 className="adm-gruppo-titolo"><FaLink aria-hidden="true" /> Gironi da collegare ({daCollegare.length})</h2>
          <p className="adm-cal-didascalia">
            Ecco i gironi in cui risulta iscritta una squadra della Polisportiva. Assegnare a
            ciascun girone la propria squadra, da lì in poi si aggiornano da sole (seguendo i
            calendari ufficiali). Se un girone non ci riguarda, premi &quot;Non ci riguarda&quot;.
          </p>
          <ul className="adm-schede">
            {daCollegare.map((g) => (
              <Girone
                key={g.id} g={g} opzioniSquadre={opzioniSquadre} occupato={occupati.has(g.id)}
                onCollega={collega} onIgnora={ignora}
              />
            ))}
          </ul>
        </section>
      )}

      {dati.sparite.length > 0 && (
        <section className="adm-cal-sezione">
          <h2 className="adm-gruppo-titolo">
            <FaCalendarTimes aria-hidden="true" /> Partite tolte dal calendario ufficiale ({dati.sparite.length})
          </h2>
          <p className="adm-hint adm-cal-spiega">
            La federazione non le elenca più: dal sito sono già sparite. Se è un rinvio senza data
            torneranno da sole; se sono cancellate davvero, toglile anche da qui.
          </p>
          <ul className="adm-schede">
            {dati.sparite.map((p) => (
              <li key={p.id} className="adm-scheda adm-cal-riga">
                <div className="adm-cal-riga-testo">
                  <strong>{p.titolo}</strong>
                  <span className="adm-hint">
                    {p.squadra} · era il {quando(p.inizio)} · sparita il {giorno(p.sparitaIl)}
                  </span>
                </div>
                <div className="adm-cal-riga-azioni">
                  <Link to={`${area}/partite/${p.id}`} className="adm-btn adm-btn-ghost">Apri</Link>
                  <button type="button" className="adm-btn adm-btn-ghost" onClick={() => togliSparita(p)}>
                    Togli
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- Fonti ---------- */}

      {dati.fonti.map((fonte) => {
        const esito = ESITI[inLettura === fonte.id ? "occupata" : fonte.esito];
        const suoi = dati.gironi.filter((g) => g.fonteId === fonte.id);
        const collegati = suoi.filter((g) => g.squadraId);
        const ignorati = suoi.filter((g) => !g.squadraId && g.ignorato);
        const errori = fonte.riepilogo?.errori ?? [];

        if (modifica?.id === fonte.id) {
          return (
            <ModuloFonte
              key={fonte.id}
              titolo={`Modifica "${fonte.nome}"`}
              iniziale={{
                nome: fonte.nome,
                formato: fonte.formato,
                cartella: fonte.indirizzo,
                nomiNostri: fonte.nomiNostri.join("\n"),
                palestreCasa: fonte.palestreCasa.join("\n"),
                attiva: fonte.attiva
              }}
              formati={dati.formati}
              salvataggio={salvataggio}
              onSalva={salvaFonte}
              onAnnulla={() => setModifica(null)}
            />
          );
        }

        return (
          <section key={fonte.id} className={`adm-panel adm-cal-fonte ${fonte.attiva ? "" : "is-disattivato"}`}>
            <header className="adm-scheda-testa">
              <h2 className="adm-scheda-nome">{fonte.nome}</h2>
              <span className="adm-sport-tag">{formatoDi(fonte.formato)?.nome ?? fonte.formato}</span>
              {!fonte.attiva && <span className="adm-status adm-status-respinta">Non viene letta</span>}
              {esito && (
                <span className={`adm-status ${esito.classe}`}>
                  <esito.Icona aria-hidden="true" /> {esito.etichetta}
                </span>
              )}
            </header>

            <dl className="adm-scheda-dati">
              <Dato etichetta="Ultima lettura">{fonte.ultimaLettura ? quando(fonte.ultimaLettura) : "mai"}</Dato>
              <Dato etichetta="Partite nel calendario">{fonte.partite}</Dato>
              <Dato etichetta="Ci chiama">{fonte.nomiNostri.join(", ")}</Dato>
              <Dato etichetta="In casa">{fonte.palestreCasa.join(", ") || "ordine del foglio"}</Dato>
            </dl>

            {fonte.riepilogo && <p className="adm-hint">{raccontoLettura(fonte.riepilogo)}</p>}

            {errori.length > 0 && (
              <div className="adm-alert adm-alert-warn adm-cal-errori">
                <FaExclamationTriangle />
                <div>
                  <strong>{errori.length === 1 ? "Un file non si è letto" : `${errori.length} file non si sono letti`}</strong>
                  {" "}— le loro partite restano come all&apos;ultima lettura riuscita.
                  <ul>
                    {errori.map((e) => <li key={e.file}><strong>{e.file}</strong>: {e.errore}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {collegati.length > 0 && (
              <div className="adm-tabella-scorrevole">
                <table className="adm-tabella adm-cal-tabella">
                  <thead>
                    <tr><th>Girone</th><th>Nel foglio</th><th>Partite</th><th>Prossima</th><th>Squadra del sito</th></tr>
                  </thead>
                  <tbody>
                    {collegati.map((g) => (
                      <tr key={g.id} className={occupati.has(g.id) ? "is-busy" : ""}>
                        <td>
                          {g.titolo || g.nomeFile}
                          {g.sparitoIl && <span className="adm-hint"> · non più nella cartella</span>}
                        </td>
                        <td>{g.nomeNelGirone}</td>
                        <td>{g.partite}</td>
                        <td>{g.prossima ? quando(g.prossima) : "—"}</td>
                        <td className="adm-cal-cella-squadra">
                          {/* Sovrapposta: dentro alla tabella, che scorre in
                              orizzontale, il menu aperto la deformava tutta */}
                          <Tendina
                            className="tnd-mini"
                            sovrapposta
                            valore={String(g.squadraId)}
                            onChange={(v) => {
                              if (v === "nessuna") scollega(g);
                              else if (v) collega(g, Number(v));
                            }}
                            opzioni={opzioniCollegato}
                            disabilitato={occupati.has(g.id)}
                            etichettaAria={`Squadra del sito per ${g.titolo || g.nomeFile}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {ignorati.length > 0 && (
              <div className="adm-cal-ignorati">
                <button type="button" className="adm-chip" onClick={() => setMostraIgnorati((v) => !v)} aria-pressed={mostraIgnorati}>
                  {mostraIgnorati ? "Nascondi" : "Mostra"} i gironi messi da parte ({ignorati.length})
                </button>
                {mostraIgnorati && (
                  <ul className="adm-schede">
                    {ignorati.map((g) => (
                      <Girone
                        key={g.id} g={g} opzioniSquadre={opzioniSquadre} occupato={occupati.has(g.id)}
                        onCollega={collega} onIgnora={ignora}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}

            <footer className="adm-scheda-azioni">
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => leggi(fonte)} disabled={letturaInCorso}>
                <FaSyncAlt className={inLettura === fonte.id ? "adm-gira" : ""} />
                {inLettura === fonte.id ? " Lettura…" : " Leggi adesso"}
              </button>
              <a href={fonte.indirizzo} target="_blank" rel="noreferrer" className="adm-btn adm-btn-ghost">
                <FaExternalLinkAlt /> Cartella
              </a>
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setModifica(fonte)}>
                <FaPencilAlt /> Modifica
              </button>
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => accendiSpegni(fonte)}>
                {fonte.attiva ? "Disattiva" : "Riattiva"}
              </button>
              {fonte.partite === 0 && (
                <button type="button" className="adm-btn adm-btn-ghost" onClick={() => eliminaFonte(fonte)}>
                  Togli
                </button>
              )}
            </footer>
          </section>
        );
      })}

      {/* ---------- Cosa è cambiato ---------- */}

      {dati.variazioni.length > 0 && (
        <section className="adm-cal-sezione">
          <h2 className="adm-gruppo-titolo"><FaHistory aria-hidden="true" /> Ultime variazioni</h2>
          <ul className="adm-panel adm-cal-variazioni">
            {dati.variazioni.map((v) => (
              <li key={v.id}>
                <time className="adm-hint" dateTime={v.quando}>{quando(v.quando)}</time>
                <span>
                  {v.oggettoTipo === "evento" && v.oggettoId
                    ? <Link to={`${area}/partite/${v.oggettoId}`}>{v.descrizione}</Link>
                    : v.descrizione}
                  {v.autore && v.autore !== "Calendario ufficiale" && (
                    <span className="adm-hint"> · {v.autore}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="adm-hint">
            Tutto resta anche nel <Link to={`${area}/registro`}>registro delle attività</Link>.
          </p>
        </section>
      )}
    </div>
  );
}
