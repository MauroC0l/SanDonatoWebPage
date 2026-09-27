import { useState } from "react";
import {
  FaPlus, FaSyncAlt, FaPencilAlt, FaSave, FaExternalLinkAlt, FaExclamationCircle,
  FaExclamationTriangle, FaCheckCircle, FaCalendarCheck
} from "react-icons/fa";
import {
  creaFonteCalendario, aggiornaFonteCalendario, eliminaFonteCalendario,
  aggiornaGironeCalendario, leggiCalendariOra
} from "../../api/adminApi";
import { useDialoghi } from "../../context/dialoghi";
import Tendina from "./Tendina";

/*
 * Le fonti dei calendari ufficiali, in cima alla pagina Squadre.
 *
 * Era una pagina a sé, "Calendari ufficiali". È stata unita alle squadre
 * perché la domanda che conta — quale girone è di quale squadra — è una
 * proprietà della squadra: il collegamento si fa dalla riga "Calendario
 * ufficiale" di ciascuna squadra, qui sotto. Qui resta quello che non è di
 * nessuna squadra in particolare: da quali cartelle leggere, come sono
 * andate le letture, e i gironi trovati che nessuno ha ancora assegnato.
 */

const formatoData = new Intl.DateTimeFormat("it-IT", {
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
});
const quando = (d) => (d ? formatoData.format(new Date(d)) : "—");

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
    <form className="adm-cal-modulo" onSubmit={invia}>
      <h3 className="adm-panel-title">{titolo}</h3>

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
   Il riquadro
   ===================================================== */

/**
 * @param dati            la risposta di GET /api/admin/calendari
 * @param opzioniSquadre  le squadre a cui si può assegnare un girone
 * @param onCollega       (girone, squadraId) => …, lo stesso della riga di ogni squadra
 * @param onCambio        da chiamare dopo ogni modifica, per ricaricare la pagina
 * @param onErrore        gestione degli errori della pagina
 */
export default function FontiCalendari({ dati, opzioniSquadre, onCollega, onCambio, onErrore, occupati }) {
  const { avvisa, conferma } = useDialoghi();

  const [nuova, setNuova] = useState(false);
  const [modifica, setModifica] = useState(null);
  const [salvataggio, setSalvataggio] = useState(false);
  const [inLettura, setInLettura] = useState(null); // "tutte" | id della fonte
  const [mostraIgnorati, setMostraIgnorati] = useState(false);

  const letturaInCorso = inLettura !== null;
  const formatoDi = (codice) => dati.formati.find((f) => f.codice === codice);

  const daCollegare = dati.gironi.filter((g) => !g.squadraId && !g.ignorato && !g.sparitoIl);
  const ignorati = dati.gironi.filter((g) => !g.squadraId && g.ignorato);

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
      await onCambio();
    } catch (err) {
      onErrore(err);
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
      avvisa(`Fonte "${fonte.nome}" aggiunta. La leggo subito, così vedi quali gironi contiene.`);
      await onCambio();
      await leggi(fonte);
    } catch (err) {
      onErrore(err);
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
      await onCambio();
    } catch (err) {
      onErrore(err);
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
      await onCambio();
    } catch (err) {
      onErrore(err);
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
      await onCambio();
    } catch (err) {
      onErrore(err);
    }
  };

  const ignora = async (girone, ignorato) => {
    try {
      await aggiornaGironeCalendario(girone.id, { ignorato });
      await onCambio();
    } catch (err) {
      onErrore(err);
    }
  };

  return (
    <section className="adm-panel adm-cal-pannello">
      <header className="adm-cal-testa">
        <h2 className="adm-gruppo-titolo">
          <FaCalendarCheck aria-hidden="true" /> Calendari ufficiali
        </h2>
        <div className="adm-cal-testa-azioni">
          <button
            type="button" className="adm-btn adm-btn-ghost"
            onClick={() => leggi(null)} disabled={letturaInCorso || !dati.fonti.some((f) => f.attiva)}
          >
            <FaSyncAlt className={inLettura === "tutte" ? "adm-gira" : ""} />
            {inLettura === "tutte" ? " Lettura…" : " Aggiorna ora"}
          </button>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setNuova(true)} disabled={nuova}>
            <FaPlus /> Nuova fonte
          </button>
        </div>
      </header>

      <p className="adm-hint adm-cal-spiega">
        Le cartelle in cui le federazioni pubblicano i calendari. Ogni notte il sito le rilegge
        e aggiorna da solo orari e risultati delle partite. Il calendario di ciascuna squadra si
        sceglie dalla sua riga &quot;Calendario ufficiale&quot;, qui sotto.
      </p>

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
        <p className="adm-hint">
          Nessuna fonte. Aggiungi la cartella in cui la federazione pubblica i calendari dei gironi.
        </p>
      )}

      {/* ---------- Le fonti ---------- */}
      <ul className="adm-cal-fonti">
        {dati.fonti.map((fonte) => {
          if (modifica?.id === fonte.id) {
            return (
              <li key={fonte.id}>
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
              </li>
            );
          }

          const esito = ESITI[inLettura === fonte.id ? "occupata" : fonte.esito];
          const errori = fonte.riepilogo?.errori ?? [];

          return (
            <li key={fonte.id} className={`adm-cal-fonte ${fonte.attiva ? "" : "is-disattivato"}`}>
              <div className="adm-cal-fonte-testa">
                <strong className="adm-cal-fonte-nome">{fonte.nome}</strong>
                <span className="adm-sport-tag">{formatoDi(fonte.formato)?.nome ?? fonte.formato}</span>
                {!fonte.attiva && <span className="adm-status adm-status-respinta">Non viene letta</span>}
                {esito && (
                  <span className={`adm-status ${esito.classe}`}>
                    <esito.Icona aria-hidden="true" /> {esito.etichetta}
                  </span>
                )}
              </div>

              <p className="adm-hint adm-cal-fonte-riga">
                {fonte.ultimaLettura ? `Letta ${quando(fonte.ultimaLettura)}` : "Mai letta"}
                {fonte.riepilogo && ` · ${raccontoLettura(fonte.riepilogo)}`}
              </p>

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

              <div className="adm-cal-fonte-azioni">
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
              </div>
            </li>
          );
        })}
      </ul>

      {/* ---------- Gironi che nessuno ha ancora assegnato ---------- */}
      {daCollegare.length > 0 && (
        <div className="adm-cal-sezione">
          <h3 className="adm-panel-title">Gironi da assegnare ({daCollegare.length})</h3>
          <p className="adm-cal-didascalia">
            Ecco i gironi in cui risulta iscritta una squadra della Polisportiva. Assegnare a
            ciascun girone la propria squadra, da lì in poi si aggiornano da sole (seguendo i
            calendari ufficiali). Se un girone non ci riguarda, premi &quot;Non ci riguarda&quot;.
          </p>

          <ul className="adm-cal-gironi">
            {daCollegare.map((g) => (
              <li key={g.id} className={`adm-cal-girone-libero ${occupati.has(g.id) ? "is-busy" : ""}`}>
                <div className="adm-cal-girone-testo">
                  <strong>{g.titolo || g.nomeFile}</strong>
                  <span className="adm-hint">
                    {g.nomeNelGirone} · {g.partite} partite
                    {g.prossima ? ` · prossima ${quando(g.prossima)}` : ""}
                  </span>
                </div>
                <div className="adm-cal-girone-azioni">
                  <Tendina
                    className="tnd-mini"
                    sovrapposta
                    valore=""
                    onChange={(v) => v && onCollega(g, Number(v))}
                    opzioni={opzioniSquadre}
                    segnaposto="Assegna a…"
                    disabilitato={occupati.has(g.id)}
                    etichettaAria={`Squadra per ${g.titolo || g.nomeFile}`}
                  />
                  <button type="button" className="adm-btn adm-btn-ghost" onClick={() => ignora(g, true)}>
                    Non ci riguarda
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ignorati.length > 0 && (
        <div className="adm-cal-ignorati">
          <button type="button" className="adm-chip" onClick={() => setMostraIgnorati((v) => !v)} aria-pressed={mostraIgnorati}>
            {mostraIgnorati ? "Nascondi" : "Mostra"} i gironi messi da parte ({ignorati.length})
          </button>
          {mostraIgnorati && (
            <ul className="adm-cal-gironi">
              {ignorati.map((g) => (
                <li key={g.id} className="adm-cal-girone-libero is-disattivato">
                  <div className="adm-cal-girone-testo">
                    <strong>{g.titolo || g.nomeFile}</strong>
                    <span className="adm-hint">{g.nomeNelGirone} · {g.partite} partite</span>
                  </div>
                  <button type="button" className="adm-btn adm-btn-ghost" onClick={() => ignora(g, false)}>
                    Riprendi
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
