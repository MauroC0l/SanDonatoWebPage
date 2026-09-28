import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaPlus, FaSyncAlt, FaPencilAlt, FaSave, FaExternalLinkAlt, FaExclamationCircle,
  FaExclamationTriangle, FaCheckCircle, FaFolderOpen, FaTimes, FaChevronDown
} from "react-icons/fa";
import {
  getCalendariUfficiali, creaFonteCalendario, aggiornaFonteCalendario, eliminaFonteCalendario,
  aggiornaGironeCalendario, leggiCalendariOra, AuthError
} from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { useDialoghi } from "../../context/dialoghi";
import Tendina from "./Tendina";
import "../../css/Admin.css";
import "../../css/CalendariUfficiali.css";

/*
 * I calendari ufficiali: i tornei delle federazioni e i loro gironi.
 *
 * Qui si gestiscono le fonti — da quale cartella leggere, come ci chiama la
 * federazione — e si vede, torneo per torneo, in quali gironi gioca una
 * nostra squadra e quale. L'iscrizione di una squadra a un girone NON si fa
 * qui: si fa dalla pagina Squadre, nella riga "Calendario ufficiale" di
 * ciascuna squadra, perché è una proprietà della squadra. Qui la si legge.
 */

const formatoData = new Intl.DateTimeFormat("it-IT", {
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
});
const quando = (d) => (d ? formatoData.format(new Date(d)) : "—");

const NOME_SPORT = { Societa: "Società" };
const sportLeggibile = (s) => NOME_SPORT[s] ?? s;

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
      <h2 className="adm-panel-title">{titolo}</h2>

      <div className="adm-campi">
        <label className="adm-field">
          <span className="adm-label">Nome del torneo</span>
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
        <span>Leggi questo torneo ogni notte</span>
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
   Un girone del torneo
   ===================================================== */

function Girone({ g, area, occupato, onRinomina, onIgnora }) {
  const [nome, setNome] = useState(null); // null = non si sta rinominando

  const salva = async (e) => {
    e.preventDefault();
    const ok = await onRinomina(g, nome.trim());
    if (ok) setNome(null);
  };

  return (
    <li className={`adm-cal-girone ${g.ignorato ? "is-disattivato" : ""} ${occupato ? "is-busy" : ""}`}>
      <div className="adm-cal-girone-testo">
        {nome === null ? (
          <div className="adm-cal-girone-nome">
            <strong>{g.nome}</strong>
            {/* Con la scritta, non la sola matita: da sola non si notava */}
            <button
              type="button" className="adm-btn adm-btn-ghost adm-cal-rinomina"
              onClick={() => setNome(g.nomePersonale ?? g.nome)}
              aria-label={`Rinomina ${g.nome}`}
            >
              <FaPencilAlt /> Rinomina
            </button>
          </div>
        ) : (
          <form className="adm-cal-girone-modulo" onSubmit={salva}>
            <input
              type="text" className="adm-input" value={nome} maxLength={120} autoFocus
              placeholder={g.titolo || g.nomeFile}
              onChange={(e) => setNome(e.target.value)}
              aria-label="Nuovo nome del girone"
            />
            <button type="submit" className="adm-btn adm-btn-primary" disabled={occupato}>
              <FaSave /> Salva
            </button>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setNome(null)}>
              Annulla
            </button>
          </form>
        )}

        <span className="adm-hint">
          {g.nomePersonale && <>Nel foglio: {g.titolo || g.nomeFile} · </>}
          {g.nomeNelGirone} · {g.partite} partite
          {g.prossima ? ` · prossima ${quando(g.prossima)}` : ""}
        </span>
      </div>

      <div className="adm-cal-girone-squadra">
        {g.sparitoIl && <span className="adm-status adm-status-draft">Non più nella cartella</span>}

        {g.squadraId ? (
          <Link to={`${area}/squadre`} className="adm-chip adm-chip-squadra" title="L'iscrizione si cambia da Squadre">
            {g.squadraNome}
          </Link>
        ) : g.ignorato ? (
          <>
            <span className="adm-hint">Messo da parte</span>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => onIgnora(g, false)} disabled={occupato}>
              Riprendi
            </button>
          </>
        ) : (
          <>
            <span className="adm-status adm-status-draft">Nessuna squadra</span>
            <Link to={`${area}/squadre`} className="adm-btn adm-btn-ghost">Iscrivi da Squadre</Link>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => onIgnora(g, true)} disabled={occupato}>
              Non ci riguarda
            </button>
          </>
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
  const [nuova, setNuova] = useState(false);
  const [modifica, setModifica] = useState(null);
  const [salvataggio, setSalvataggio] = useState(false);
  const [inLettura, setInLettura] = useState(null); // "tutte" | id della fonte
  const [occupati, setOccupati] = useState(() => new Set());
  const [sportScelto, setSportScelto] = useState(""); // "" = tutti
  // Solo i tornei aperti o chiusi a mano: gli altri restano chiusi (apertoDiSolito)
  const [aperture, setAperture] = useState({});

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
        avvisa("Nessun torneo attivo da leggere.", "info");
      } else {
        const male = esiti.filter((e) => e.esito === "errore");
        avvisa(
          male.length
            ? `Lettura finita, ma ${male.length === 1 ? "un torneo non si è letto" : `${male.length} tornei non si sono letti`}: guarda il dettaglio qui sotto.`
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

  /* ---------- Tornei ---------- */

  const creaFonte = async (valori) => {
    setSalvataggio(true);
    try {
      const fonte = await creaFonteCalendario(valori);
      setNuova(false);
      avvisa(`Torneo "${fonte.nome}" aggiunto. Lo leggo subito, così vedi in quali gironi giochiamo.`);
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
      avvisa("Torneo aggiornato. I cambiamenti valgono dalla prossima lettura.");
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
      testo: "Non ha portato partite nel calendario: si toglie il torneo e l'elenco dei suoi gironi.",
      conferma: "Togli",
      pericolo: true
    });
    if (!ok) return;

    try {
      await eliminaFonteCalendario(fonte.id);
      avvisa(`"${fonte.nome}" tolto.`, "info");
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    }
  };

  /* ---------- Gironi ---------- */

  const rinomina = async (girone, nome) => {
    segnaOccupato(girone.id, true);
    try {
      await aggiornaGironeCalendario(girone.id, { nome: nome || null });
      avvisa(nome ? `Girone rinominato in "${nome}".` : "Il girone riprende il nome del foglio.");
      await ricarica();
      return true;
    } catch (err) {
      gestisciErrore(err);
      return false;
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
  const daAssegnare = (g) => !g.squadraId && !g.ignorato && !g.sparitoIl;
  const senzaSquadra = dati.gironi.filter(daAssegnare);

  /* Lo sport di un torneo non è un campo suo: viene dal formato dei file,
     che è di una federazione e di uno sport (lo stesso che il server usa
     per non collegare un girone di pallavolo a una squadra di calcio). */
  const sportDi = (fonte) => formatoDi(fonte.formato)?.sport ?? null;
  const sportPresenti = [...new Set(dati.fonti.map(sportDi).filter(Boolean))];
  // Se l'ultimo torneo di quello sport se n'è andato, il filtro torna su tutti
  const sportAttivo = sportPresenti.includes(sportScelto) ? sportScelto : "";
  const fontiVisibili = dati.fonti.filter((f) => !sportAttivo || sportDi(f) === sportAttivo);

  /* Tutti chiusi all'apertura della pagina, deciso dalla società il 28
     settembre 2026: la pagina serve a vedere a colpo d'occhio se ogni
     torneo si è letto, e i gironi si aprono quando servono. Quelli da
     assegnare li segnala comunque l'avviso in cima. */
  const apertoDiSolito = () => false;
  const apriChiudi = (id, aperto) => setAperture((prima) => ({ ...prima, [id]: !aperto }));

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">Calendari ufficiali</h1>
          <p className="adm-page-sub">
            I tornei delle federazioni, con i gironi in cui gioca una nostra squadra. Orari e
            risultati si aggiornano da soli ogni notte. Le squadre si iscrivono ai gironi dalla
            pagina Squadre.
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
            <FaPlus /> Nuovo torneo
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

      {senzaSquadra.length > 0 && (
        <p className="adm-cal-didascalia adm-cal-avviso">
          {senzaSquadra.length === 1
            ? "C'è un girone in cui risulta iscritta una squadra della Polisportiva, ma che non è ancora collegato a nessuna squadra del sito."
            : `Ci sono ${senzaSquadra.length} gironi in cui risulta iscritta una squadra della Polisportiva, ma che non sono ancora collegati a nessuna squadra del sito.`}
          {" "}Assegna a ciascuno la propria squadra da <Link to={`${area}/squadre`}>Squadre</Link>,
          nella riga &quot;Calendario ufficiale&quot;: da lì in poi le partite si aggiornano da sole
          (seguendo i calendari ufficiali). Se un girone non ci riguarda, premi &quot;Non ci riguarda&quot;.
        </p>
      )}

      {nuova && (
        <ModuloFonte
          titolo="Nuovo torneo"
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
          <h2>Nessun torneo</h2>
          <p>Aggiungi la cartella in cui la federazione pubblica i calendari dei gironi.</p>
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => setNuova(true)}>
            <FaPlus /> Nuovo torneo
          </button>
        </div>
      )}

      {sportPresenti.length > 0 && (
        <div className="adm-toolbar">
          <div className="adm-chip-group">
            {/* Filtro per sport: solo quelli di cui c'è almeno un torneo */}
            <button
              type="button"
              className={`adm-chip ${!sportAttivo ? "is-active" : ""}`}
              onClick={() => setSportScelto("")}
              aria-pressed={!sportAttivo}
            >
              Tutti
            </button>
            {sportPresenti.map((sport) => (
              <button
                key={sport}
                type="button"
                className={`adm-chip ${sportAttivo === sport ? "is-active" : ""}`}
                onClick={() => setSportScelto(sportAttivo === sport ? "" : sport)}
                aria-pressed={sportAttivo === sport}
              >
                {sportLeggibile(sport)}
              </button>
            ))}
          </div>
        </div>
      )}

      {fontiVisibili.map((fonte) => {
        /* In modifica il modulo prende il posto della sola intestazione: i
           gironi restano dentro alla scheda del torneo anche mentre la si
           modifica, invece di sparire finché non si salva. */
        const inModifica = modifica?.id === fonte.id;

        const esito = ESITI[inLettura === fonte.id ? "occupata" : fonte.esito];
        const errori = fonte.riepilogo?.errori ?? [];
        const suoi = dati.gironi.filter((g) => g.fonteId === fonte.id);
        const iscritte = suoi.filter((g) => g.squadraId).length;
        const aperto = aperture[fonte.id] ?? apertoDiSolito(suoi);
        const idGironi = `cal-gironi-${fonte.id}`;

        return (
          <section key={fonte.id} className={`adm-panel adm-cal-torneo ${fonte.attiva || inModifica ? "" : "is-disattivato"}`}>
            {/* L'intestazione e, alla sua destra, il pulsante che apre i
                gironi. Centrato sull'intestazione e non sulla scheda
                intera: la scheda si allunga quando si apre, l'intestazione
                no, e così il pulsante resta fermo dove lo si è premuto.
                C'è anche in modifica, quando il modulo prende il posto
                dell'intestazione: lì sta in alto, accanto al titolo. */}
            <div className={`adm-cal-testata ${inModifica ? "is-modulo" : ""}`}>
            <div className="adm-cal-testata-testo">
            {inModifica ? (
              <ModuloFonte
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
            ) : (<>
            <header className="adm-cal-fonte-testa">
              <h2 className="adm-cal-fonte-nome">{fonte.nome}</h2>
              <span className="adm-sport-tag">{formatoDi(fonte.formato)?.nome ?? fonte.formato}</span>
              {!fonte.attiva && <span className="adm-status adm-status-respinta">Non viene letto</span>}
              {esito && (
                <span className={`adm-status ${esito.classe}`}>
                  <esito.Icona aria-hidden="true" /> {esito.etichetta}
                </span>
              )}
            </header>

            <p className="adm-hint adm-cal-fonte-riga">
              {fonte.ultimaLettura ? `Letto ${quando(fonte.ultimaLettura)}` : "Mai letto"}
              {fonte.riepilogo && ` · ${raccontoLettura(fonte.riepilogo)}`}
            </p>
            </>)}
            </div>

            <button
              type="button" className={`adm-cal-apri ${aperto ? "is-aperto" : ""}`}
              aria-expanded={aperto} aria-controls={idGironi}
              aria-label={aperto ? "Nascondi i gironi" : "Mostra i gironi"}
              title={aperto ? "Nascondi i gironi" : "Mostra i gironi"}
              onClick={() => apriChiudi(fonte.id, aperto)}
            >
              <FaChevronDown className="adm-cal-freccia" aria-hidden="true" />
            </button>
            </div>

            {/* Fuori dall'intestazione: un elenco di file non letti è
                lungo, e il pulsante centrato su di esso scenderebbe a metà
                scheda */}
            {!inModifica && errori.length > 0 && (
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

            {/* Il cassetto dei gironi. Nascosti e non smontati: un girone a
                metà rinomina, chiuso e riaperto, ritrova il nome che si
                stava scrivendo. Da chiuso è "inert": resta nella pagina per
                l'animazione, ma né il tabulatore né un lettore di schermo ci
                entrano. (React 18 non conosce l'attributo: la stringa vuota
                lo accende, undefined lo toglie.) */}
            <div
              id={idGironi}
              className={`adm-cal-cassetto ${aperto ? "is-aperto" : ""}`}
              inert={aperto ? undefined : ""}
            >
            <div className="adm-cal-cassetto-dentro">
            <div className="adm-cal-cassetto-contenuto">
            <h3 className="adm-panel-title adm-cal-gironi-titolo">
              <span>Gironi con una nostra squadra · {suoi.length}</span>
              {suoi.length > 0 && <span className="adm-hint">({iscritte} con la squadra iscritta)</span>}
            </h3>

            {suoi.length === 0 ? (
              <p className="adm-hint">
                {fonte.ultimaLettura
                  ? "In nessun file di questo torneo compare una nostra squadra."
                  : "Premi \"Leggi adesso\" per vedere quali gironi contiene."}
              </p>
            ) : (
              <ul className="adm-cal-gironi">
                {suoi.map((g) => (
                  <Girone
                    key={g.id} g={g} area={area} occupato={occupati.has(g.id)}
                    onRinomina={rinomina} onIgnora={ignora}
                  />
                ))}
              </ul>
            )}
            </div>
            </div>
            </div>

            {!inModifica && <footer className="adm-cal-fonte-azioni">
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
                <button type="button" className="adm-btn adm-btn-ghost adm-btn-cancella" onClick={() => eliminaFonte(fonte)}>
                  <FaTimes /> Togli
                </button>
              )}
            </footer>}
          </section>
        );
      })}
    </div>
  );
}
