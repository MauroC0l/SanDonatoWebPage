import { useEffect, useRef, useState } from "react";
import {
  FaSave, FaExclamationCircle, FaPlus, FaTimes, FaUserCircle, FaHome,
  FaPhoneAlt, FaUsers
} from "react-icons/fa";
import { salvaSchedaAtleta, AuthError } from "../../api/adminApi";
import { anni } from "../../utils/eta";
import { cifreTelefono, propsTelefono } from "../../utils/telefono";
import { TAGLIE } from "../../data/luoghi";
import { NOMI_PROVINCE, comuniDi } from "../../utils/luoghi";
import Tendina from "./Tendina";
import CampoData from "./CampoData";
import CampoSuggerito from "./CampoSuggerito";

/*
 * I campi, negli stessi gruppi e nello stesso ordine delle pagine
 * Iscrizione e Contatti dell'atleta.
 *
 * Chi corregge un dato ha spesso davanti il modulo di carta o la persona al
 * telefono che detta: trovare le caselle dove le trova lei vuol dire poter
 * dire "la seconda riga, sotto al comune" e capirsi.
 *
 * La provincia viene PRIMA del comune, come dall'altra parte: scelta
 * quella, i comuni proposti scendono da ottomila a qualche decina.
 */
const GRUPPI = [
  {
    chiave: "persona",
    titolo: "I suoi dati",
    Icona: FaUserCircle,
    campi: [
      { chiave: "dataNascita", etichetta: "Data di nascita", tipo: "date" },
      { chiave: "provinciaNascita", etichetta: "Provincia di nascita", tipo: "suggerito", elenco: "province" },
      { chiave: "luogoNascita", etichetta: "Comune di nascita", tipo: "suggerito", elenco: "comuni", dipendeDa: "provinciaNascita" },
      { chiave: "codiceFiscale", etichetta: "Codice fiscale", max: 16, maiuscolo: true },
      { chiave: "tagliaMaglietta", etichetta: "Taglia della maglia", tipo: "taglia" }
    ]
  },
  {
    chiave: "residenza",
    titolo: "La residenza",
    Icona: FaHome,
    campi: [
      { chiave: "provincia", etichetta: "Provincia", tipo: "suggerito", elenco: "province" },
      { chiave: "citta", etichetta: "Comune", tipo: "suggerito", elenco: "comuni", dipendeDa: "provincia" },
      { chiave: "indirizzo", etichetta: "Via o piazza", max: 200, largo: true },
      { chiave: "civico", etichetta: "Numero civico", max: 20 },
      { chiave: "cap", etichetta: "CAP", max: 5, cifre: true }
    ]
  }
];

const TUTORI = [
  { prefisso: "tutore", titolo: "Chi chiamare per primo" },
  { prefisso: "tutore2", titolo: "Se non risponde" }
];

const CAMPI_TUTORE = [
  { suffisso: "Nome", etichetta: "Nome e cognome", max: 120 },
  { suffisso: "Parentela", etichetta: "Chi è", tipo: "scelta" },
  { suffisso: "Telefono", etichetta: "Telefono", tipo: "tel" },
  { suffisso: "Email", etichetta: "Email", max: 255, tipo: "email" }
];

const OPZIONI_PARENTELA = [
  "Madre", "Padre", "Nonna", "Nonno", "Zia", "Zio",
  "Sorella", "Fratello", "Tutore", "Altro"
].map((v) => ({ valore: v, etichetta: v }));

/** Tutti i campi che questo modulo manda: gli stessi che il server accetta. */
const CAMPI = [
  "dataNascita", "luogoNascita", "provinciaNascita", "codiceFiscale", "tagliaMaglietta",
  "telefono", "indirizzo", "civico", "citta", "provincia", "cap",
  "tutoreNome", "tutoreParentela", "tutoreTelefono", "tutoreEmail",
  "tutore2Nome", "tutore2Parentela", "tutore2Telefono", "tutore2Email"
];

const TELEFONI = ["telefono", "tutoreTelefono", "tutore2Telefono"];

function daAtleta(a) {
  const letto = {};
  for (const c of CAMPI) letto[c] = a?.[c] ?? "";
  // "345 1234567" salvato prima della regola delle sole cifre si mostra
  // già pulito: è quello che il server salverebbe comunque.
  for (const c of TELEFONI) letto[c] = cifreTelefono(letto[c]);
  return letto;
}

function giornoLocale(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/*
 * Un errore del server, portato accanto alla casella che lo riguarda.
 *
 * Il server scrive "cap: Il CAP ha cinque cifre." — il nome tecnico del
 * campo davanti. Da lì si capisce dove metterlo, e il nome tecnico non lo
 * legge nessuno. Il controllo del codice fiscale non ha il prefisso (lo fa
 * il server a parte, dopo lo schema): si riconosce dalle parole.
 */
function leggiErrore(messaggio) {
  const trovato = /^([a-zA-Z0-9]+): (.+)$/.exec(messaggio ?? "");
  if (trovato && CAMPI.includes(trovato[1])) return { campo: trovato[1], testo: trovato[2] };
  if (/codice fiscale/i.test(messaggio ?? "")) return { campo: "codiceFiscale", testo: messaggio };
  return { campo: null, testo: messaggio || "Salvataggio non riuscito." };
}

/**
 * Il modulo con cui la segreteria corregge i dati di un iscritto.
 *
 * Fino al 28 settembre 2026 anagrafica e recapiti li scriveva solo
 * l'interessato: la società ha cambiato regola, perché chi consegna il
 * modulo di carta in sede o detta un numero al telefono si aspetta che
 * lo scriva chi l'ha davanti. Lo apre chi ha "anagrafica.modifica"
 * (amministratore e segreteria); gli stessi controlli della pagina
 * dell'atleta li rifà il server.
 *
 * Si manda solo quello che è cambiato. Non per risparmio: un CAP storto
 * salvato anni fa non deve impedire di correggere un telefono.
 *
 * Note e certificato non ci sono: le note le scrive la famiglia, il
 * certificato ha il suo riquadro con la sua trafila.
 */
export default function ModificaAnagrafica({
  // L'id dell'account, quello dell'indirizzo della scheda
  id,
  atleta,
  // Il gruppo da mostrare per primo: chi arriva da Contatti cerca i numeri
  partenza = null,
  puoCambiareAccount = false,
  onSalvato,
  onAnnulla,
  onSessioneScaduta
}) {
  const [form, setForm] = useState(() => daAtleta(atleta));
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState(null);
  const [secondoChiesto, setSecondoChiesto] = useState(false);
  const riquadroErrore = useRef(null);

  useEffect(() => {
    const piano = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const gruppo = document.getElementById(`anag-${partenza ?? "persona"}`);
    // Il primo gruppo è già in cima: si scorre al titolo del modulo, che
    // dice di chi sono i dati che si stanno correggendo
    const dove = !partenza || partenza === "persona" ? document.getElementById("anag-modulo") : gruppo;
    dove?.scrollIntoView({ behavior: piano ? "auto" : "smooth", block: "start" });
    // Il fuoco sul gruppo e non sulla sua prima casella: la prima è la data
    // di nascita, che col fuoco apre il calendario sopra a tutto il resto.
    gruppo?.focus({ preventScroll: true });
  }, [partenza]);

  const originale = daAtleta(atleta);
  const cambiati = CAMPI.filter((c) => (form[c] ?? "") !== (originale[c] ?? ""));
  const sporco = cambiati.length > 0;

  const eta = anni(form.dataNascita);
  const minore = eta != null && eta < 18;

  const mostraSecondo = secondoChiesto
    || CAMPI_TUTORE.some((c) => form[`tutore2${c.suffisso}`]);

  const cambia = (chiave, valore) => {
    setForm((f) => ({ ...f, [chiave]: valore }));
    // L'errore di quella casella sparisce appena la si tocca
    if (errore?.campo === chiave) setErrore(null);
  };

  const togliSecondo = () => {
    setSecondoChiesto(false);
    setForm((f) => ({ ...f, tutore2Nome: "", tutore2Parentela: "", tutore2Telefono: "", tutore2Email: "" }));
  };

  const salva = async (evento) => {
    evento.preventDefault();
    if (!sporco) return;
    setErrore(null);
    setSalvataggio(true);

    try {
      // Vuoto vuol dire "cancellato": null, perché una stringa vuota il
      // controllo del codice fiscale la leggerebbe come sedici caratteri mancanti.
      const dati = Object.fromEntries(cambiati.map((c) => [c, form[c] === "" ? null : form[c]]));
      const aggiornato = await salvaSchedaAtleta(id, dati);
      onSalvato(aggiornato);
    } catch (err) {
      if (err instanceof AuthError) {
        onSessioneScaduta?.();
        return;
      }
      setErrore(leggiErrore(err.message));
      requestAnimationFrame(() => riquadroErrore.current?.focus());
    } finally {
      setSalvataggio(false);
    }
  };

  /* Taglie e parentele sono elenchi fissi, ma un valore scritto a mano
     prima che lo fossero deve restare fra le scelte: sparirebbe dalla
     tendina, e salvando qualcos'altro si perderebbe senza che nessuno
     l'abbia deciso. */
  const conQuelloDiPrima = (opzioni, chiave) => {
    const prima = originale[chiave];
    const manca = prima && !opzioni.some((o) => o.valore === prima);
    return [
      opzioni[0],
      ...(manca ? [{ valore: prima, etichetta: prima, nota: "scritto prima" }] : []),
      ...opzioni.slice(1)
    ];
  };

  const opzioniTaglia = conQuelloDiPrima(
    [{ valore: "", etichetta: "Non indicata" }, ...TAGLIE.map((t) => ({ valore: t, etichetta: t }))],
    "tagliaMaglietta"
  );

  const erroreDi = (chiave) => (errore?.campo === chiave ? (
    <span className="prs-errore-campo" role="alert">
      <FaExclamationCircle aria-hidden="true" /> {errore.testo}
    </span>
  ) : null);

  const casella = (c) => (
    <label
      className={`adm-field ${c.largo ? "adm-campo-largo" : ""} ${errore?.campo === c.chiave ? "is-errore" : ""}`}
      key={c.chiave}
    >
      <span className="adm-label">
        {c.etichetta}
        {c.chiave === "dataNascita" && eta != null && <span className="adm-eta">{eta} anni</span>}
      </span>

      {c.tipo === "date" ? (
        <CampoData
          valore={form[c.chiave] ? `${form[c.chiave]}T00:00:00` : ""}
          onChange={(v) => cambia(c.chiave, v ? giornoLocale(v) : "")}
          disabilitato={salvataggio}
          etichettaAria={c.etichetta}
        />
      ) : c.tipo === "suggerito" ? (
        /* Senza l'obbligo di scegliere dall'elenco, a differenza della
           pagina dell'atleta: qui si correggono anche dati vecchi — "TO"
           al posto di "Torino", un comune estero — e un campo che li
           svuota da solo costringerebbe a riscriverli senza averlo chiesto. */
        <CampoSuggerito
          valore={form[c.chiave]}
          onChange={(v) => cambia(c.chiave, v)}
          opzioni={c.elenco === "province" ? NOMI_PROVINCE : comuniDi(form[c.dipendeDa])}
          disabilitato={salvataggio}
          etichettaAria={c.etichetta}
          segnaposto={c.dipendeDa && !form[c.dipendeDa] ? "Scegli prima la provincia" : "Scrivi e scegli…"}
        />
      ) : c.tipo === "taglia" ? (
        <Tendina
          valore={form[c.chiave]}
          onChange={(v) => cambia(c.chiave, v)}
          opzioni={opzioniTaglia}
          disabilitato={salvataggio}
          etichettaAria={c.etichetta}
          segnaposto="Non indicata"
        />
      ) : (
        <input
          type="text"
          className="adm-input"
          value={form[c.chiave]}
          maxLength={c.max}
          inputMode={c.cifre ? "numeric" : undefined}
          autoCapitalize={c.maiuscolo ? "characters" : undefined}
          autoComplete="off"
          onChange={(e) => cambia(
            c.chiave,
            c.maiuscolo ? e.target.value.toUpperCase()
              : c.cifre ? e.target.value.replace(/\D/g, "")
                : e.target.value
          )}
          disabled={salvataggio}
          aria-invalid={errore?.campo === c.chiave || undefined}
        />
      )}
      {erroreDi(c.chiave)}
    </label>
  );

  return (
    <form id="anag-modulo" className="prs-anag prs-ancora" onSubmit={salva}>
      <div className="prs-anag-testa">
        <h2 className="prs-anag-titolo">Correggi i dati di {atleta.nomeCompleto}</h2>
        <p className="adm-hint">
          Le correzioni si vedono subito anche nella sua area. Si salva solo
          quello che cambi; il resto rimane com&apos;è.
        </p>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert" tabIndex={-1} ref={riquadroErrore}>
          <FaExclamationCircle aria-hidden="true" />
          <span>
            {errore.campo ? "Non salvato: " : ""}{errore.testo}
          </span>
        </div>
      )}

      {GRUPPI.map((g) => (
        <section className="adm-panel prs-ancora" id={`anag-${g.chiave}`} key={g.chiave} tabIndex={-1}>
          <h3 className="adm-panel-title"><g.Icona aria-hidden="true" /> {g.titolo}</h3>

          {/* Nome e cognome stanno sull'account, non sulla scheda: si
              leggono qui perché chi corregge vuole vedere tutto insieme,
              ma si cambiano da Utenti, dove si cambia anche l'email. */}
          {g.chiave === "persona" && (
            <div className="adm-campi">
              <label className="adm-field">
                <span className="adm-label">Nome</span>
                <input type="text" className="adm-input" value={atleta.nome ?? ""} readOnly disabled />
              </label>
              <label className="adm-field">
                <span className="adm-label">Cognome</span>
                <input type="text" className="adm-input" value={atleta.cognome ?? ""} readOnly disabled />
              </label>
              <p className="adm-hint prs-anag-nota adm-campo-largo">
                {puoCambiareAccount
                  ? "Nome e cognome sono dati dell'account: si cambiano da Utenti, con \"Modifica i dati\"."
                  : "Nome e cognome sono dati dell'account: li corregge un amministratore da Utenti."}
              </p>
            </div>
          )}

          <div className="adm-campi">{g.campi.map(casella)}</div>
        </section>
      ))}

      <section className="adm-panel prs-ancora" id="anag-contatti" tabIndex={-1}>
        <h3 className="adm-panel-title"><FaPhoneAlt aria-hidden="true" /> Contatti</h3>
        <div className="adm-campi">
          <label className={`adm-field ${errore?.campo === "telefono" ? "is-errore" : ""}`}>
            <span className="adm-label">Cellulare</span>
            <input
              className="adm-input"
              {...propsTelefono(form.telefono, (v) => cambia("telefono", v))}
              disabled={salvataggio}
              aria-invalid={errore?.campo === "telefono" || undefined}
            />
            {erroreDi("telefono")}
          </label>
          <label className="adm-field">
            <span className="adm-label">Email</span>
            <input type="email" className="adm-input" value={atleta.email ?? ""} readOnly disabled />
            <span className="adm-hint">
              È quella con cui entra nel sito: {puoCambiareAccount ? "si cambia da Utenti." : "la cambia un amministratore da Utenti."}
            </span>
          </label>
        </div>
      </section>

      <section className="adm-panel prs-ancora" id="anag-tutori" tabIndex={-1}>
        <h3 className="adm-panel-title"><FaUsers aria-hidden="true" /> Genitore o tutore</h3>
        <p className="adm-hint" style={{ marginTop: 0 }}>
          {minore
            ? "È minorenne: nome e telefono di un adulto servono per completare l'iscrizione."
            : "Non è obbligatorio, ma è il primo numero che si cerca quando succede qualcosa."}
        </p>

        {TUTORI.map((t, indice) => {
          if (indice > 0 && !mostraSecondo) return null;
          return (
            <div className="prs-anag-tutore" key={t.prefisso}>
              <div className="prs-anag-tutore-testa">
                <span className="prs-contatto-titolo">{t.titolo}</span>
                {indice > 0 && (
                  <button type="button" className="adm-btn adm-btn-ghost adm-btn-piccolo" onClick={togliSecondo} disabled={salvataggio}>
                    <FaTimes aria-hidden="true" /> Togli
                  </button>
                )}
              </div>
              <div className="adm-campi">
                {CAMPI_TUTORE.map((c) => {
                  const chiave = `${t.prefisso}${c.suffisso}`;
                  const aria = `${c.etichetta} (${t.titolo})`;
                  return (
                    <label className={`adm-field ${errore?.campo === chiave ? "is-errore" : ""}`} key={chiave}>
                      <span className="adm-label">{c.etichetta}</span>
                      {c.tipo === "scelta" ? (
                        <Tendina
                          valore={form[chiave]}
                          onChange={(v) => cambia(chiave, v)}
                          opzioni={conQuelloDiPrima([{ valore: "", etichetta: "Non indicato" }, ...OPZIONI_PARENTELA], chiave)}
                          disabilitato={salvataggio}
                          etichettaAria={aria}
                          segnaposto="Scegli…"
                        />
                      ) : c.tipo === "tel" ? (
                        <input
                          className="adm-input"
                          {...propsTelefono(form[chiave], (v) => cambia(chiave, v))}
                          disabled={salvataggio}
                          aria-label={aria}
                          aria-invalid={errore?.campo === chiave || undefined}
                        />
                      ) : (
                        <input
                          type={c.tipo ?? "text"}
                          className="adm-input"
                          value={form[chiave]}
                          maxLength={c.max}
                          autoComplete="off"
                          onChange={(e) => cambia(chiave, e.target.value)}
                          disabled={salvataggio}
                          aria-label={aria}
                          aria-invalid={errore?.campo === chiave || undefined}
                        />
                      )}
                      {erroreDi(chiave)}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!mostraSecondo && (
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            onClick={() => setSecondoChiesto(true)}
            disabled={salvataggio}
          >
            <FaPlus aria-hidden="true" /> Aggiungi un altro contatto
          </button>
        )}
      </section>

      {/* Sempre visibile, a differenza della barra della scheda: qui si è
          entrati apposta per modificare, e "Annulla" è anche l'unico modo
          di tornare alla scheda senza salvare. */}
      <div className="adm-barra-azioni-fissa prs-salva" role="region" aria-label="Salva le correzioni">
        <span className="prs-salva-testo">
          {sporco
            ? (cambiati.length === 1 ? "Un dato cambiato." : `${cambiati.length} dati cambiati.`)
            : "Nessuna modifica per ora."}
        </span>
        <button type="button" className="adm-btn adm-btn-ghost" onClick={onAnnulla} disabled={salvataggio}>
          Annulla
        </button>
        <button type="submit" className="adm-btn adm-btn-primary" disabled={salvataggio || !sporco}>
          <FaSave /> {salvataggio ? "Salvataggio…" : "Salva"}
        </button>
      </div>
    </form>
  );
}
