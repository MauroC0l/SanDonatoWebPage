import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaSave, FaExclamationCircle, FaCheckCircle, FaFileMedical, FaUpload,
  FaExternalLinkAlt, FaHourglassHalf, FaInfoCircle, FaTimesCircle, FaLock,
  FaArrowRight, FaArrowDown
} from "react-icons/fa";
import { getIscrizione, salvaIscrizione, uploadMedia, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import { statoCertificato, quantoManca } from "../../utils/certificato";
import { anni } from "../../utils/eta";
import RiquadroFratelli from "./RiquadroFratelli";
import RiquadroQuota from "./RiquadroQuota";
import Tendina from "../Admin/Tendina";
import CampoData from "../Admin/CampoData";
import CampoSuggerito from "../Admin/CampoSuggerito";
import { TAGLIE } from "../../data/luoghi";
import { NOMI_PROVINCE, comuniDi } from "../../utils/luoghi";
import "../../css/Admin.css";
import "../../css/Iscrizione.css";
import "../../css/AreaAtleta.css";

/* Le voci di "cosa manca" (le scrive il server) che non si compilano nel
   modulo: i recapiti hanno la loro pagina, il certificato il suo riquadro. */
const DAI_CONTATTI = ["un numero di telefono", "il contatto di un genitore"];
const DEL_CERTIFICATO = ["la scadenza del certificato medico", "la copia del certificato medico"];

/* La pastiglia accanto al titolo del certificato, detta in parole di chi
   lo deve portare e non con l'etichetta della segreteria. */
const STATO_CERTIFICATO = {
  mancante: { testo: "Da caricare", tono: "is-manca" },
  senza_file: { testo: "Manca la copia", tono: "is-manca" },
  da_controllare: { testo: "In controllo", tono: "is-attesa" },
  respinto: { testo: "Da rifare", tono: "is-allarme" },
  scaduto: { testo: "Scaduto", tono: "is-allarme" },
  in_scadenza: { testo: "Scade presto", tono: "is-manca" },
  valido: { testo: "A posto", tono: "is-ok" }
};

const TIPI_CERTIFICATO = [
  { valore: "", etichetta: "Non lo so" },
  {
    valore: "non_agonistico",
    etichetta: "Non agonistico",
    nota: "quello del medico di base, per chi non fa campionato"
  },
  {
    valore: "agonistico",
    etichetta: "Agonistico",
    nota: "con elettrocardiogramma, serve per i campionati"
  }
];

/*
 * I campi della scheda, nell'ordine in cui li chiede un modulo federale.
 *
 * "tipo" dice al modulo come disegnarli: date apre il calendario del sito,
 * suggerito apre l'elenco dei comuni o delle province, scelta è una
 * tendina chiusa. Senza, è una casella di testo.
 */
const GRUPPI = [
  {
    titolo: "Chi sei",
    campi: [
      { chiave: "dataNascita", etichetta: "Data di nascita", tipo: "date", obbligatorio: true },

      /* La provincia PRIMA del comune, e non per ordine alfabetico: scelta
         quella, i comuni proposti scendono da ottomila a qualche decina, e
         i sedici "San Giorgio" d'Italia diventano uno solo. */
      { chiave: "provinciaNascita", etichetta: "Provincia di nascita", tipo: "suggerito", elenco: "province", obbliga: true },
      { chiave: "luogoNascita", etichetta: "Comune di nascita", tipo: "suggerito", elenco: "comuni", dipendeDa: "provinciaNascita", obbligatorio: true },

      { chiave: "codiceFiscale", etichetta: "Codice fiscale", max: 16, maiuscolo: true, obbligatorio: true },
      { chiave: "tagliaMaglietta", etichetta: "Taglia della maglia", tipo: "scelta", elenco: "taglie" }
    ]
  },
  {
    titolo: "Dove abiti",
    sottotitolo: "Serve per i moduli federali, che lo chiedono per intero.",
    campi: [
      { chiave: "provincia", etichetta: "Provincia", tipo: "suggerito", elenco: "province", obbliga: true },
      { chiave: "citta", etichetta: "Comune", tipo: "suggerito", elenco: "comuni", dipendeDa: "provincia" },
      { chiave: "indirizzo", etichetta: "Via o piazza", max: 200, largo: true },
      { chiave: "civico", etichetta: "Numero civico", max: 20, stretto: true },
      { chiave: "cap", etichetta: "CAP", max: 5, stretto: true, numerico: true }
    ]
  }
];

/**
 * Da una data completa al giorno "2026-05-14", in ora locale.
 *
 * Le colonne sono "date" senza ora: passando per l'ora di Greenwich, il
 * primo gennaio diventa il 31 dicembre per mezzo mondo.
 */
function giornoLocale(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* Le taglie sono le uniche fisse: comuni e province si ricavano da quello
   che si è già scritto nel modulo. */
const OPZIONI_TAGLIA = TAGLIE.map((t) => ({ valore: t, etichetta: t }));


const VUOTO = {
  dataNascita: "", luogoNascita: "", provinciaNascita: "",
  codiceFiscale: "", tagliaMaglietta: "",
  indirizzo: "", civico: "", cap: "", citta: "", provincia: "",
  tipoCertificato: "", certificatoScadenza: "", note: ""
};

function daIscrizione(i) {
  return {
    dataNascita: i.dataNascita ?? "",
    luogoNascita: i.luogoNascita ?? "",
    provinciaNascita: i.provinciaNascita ?? "",
    codiceFiscale: i.codiceFiscale ?? "",
    tagliaMaglietta: i.tagliaMaglietta ?? "",
    indirizzo: i.indirizzo ?? "",
    civico: i.civico ?? "",
    cap: i.cap ?? "",
    citta: i.citta ?? "",
    provincia: i.provincia ?? "",
    tipoCertificato: i.tipoCertificato ?? "",
    certificatoScadenza: i.certificatoScadenza ?? "",
    note: i.note ?? ""
  };
}

/**
 * L'iscrizione compilata da chi si iscrive.
 *
 * Prima questi dati li batteva la segreteria, leggendo moduli di carta o
 * email: qui li scrive direttamente chi li ha, e il certificato medico lo
 * carica chi ce l'ha in mano. Quello che NON si può toccare da qui è la
 * quota e i versamenti — quelli restano i conti della società.
 *
 * La stessa schermata la aprono due persone diverse:
 *
 *   - un atleta, da /area-riservata/iscrizione. Ha la sezione "Quota"
 *     tutta sua, e il certificato medico glielo chiediamo;
 *   - un allenatore, da /coach/iscrizione. È un iscritto anche lui e versa
 *     la sua quota, ma non scende in campo: niente certificato, e la quota
 *     compare qui perché nella sua area non c'è nessun'altra pagina che
 *     gliela mostri.
 *
 * Le due differenze non si decidono guardando il ruolo dell'account — un
 * allenatore può giocare in prima squadra — ma quello che risponde il
 * server, che sa chi ha una squadra e chi no.
 */
export default function IscrizionePage() {
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();
  const { avvisa } = useDialoghi();

  const [iscrizione, setIscrizione] = useState(null);
  const [form, setForm] = useState(VUOTO);
  const [caricamento, setCaricamento] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [caricandoFile, setCaricandoFile] = useState(false);
  const [errore, setErrore] = useState("");

  const inputFile = useRef(null);
  const [oggi] = useState(() => new Date());

  const inAttesa = user?.stato === "in_attesa";
  const location = useLocation();

  /* Porta a un riquadro del modulo e lo accende un attimo: sul telefono si
     arriva a metà di una pagina lunga, e bisogna capire dove guardare. */
  const vaiA = useCallback((id) => {
    const riquadro = document.getElementById(id);
    if (!riquadro) return;
    const piano = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    riquadro.scrollIntoView({ behavior: piano ? "auto" : "smooth", block: "start" });
    riquadro.classList.remove("aa-evidenzia");
    // Rilegge lo stile, così l'animazione riparte anche al secondo tocco
    void riquadro.offsetWidth;
    riquadro.classList.add("aa-evidenzia");
  }, []);

  /* Dalla home si arriva con "#certificato" o "#dati": appena il modulo
     c'è, si scende lì invece di lasciare la pagina in cima. */
  useEffect(() => {
    if (caricamento || !location.hash) return;
    const id = location.hash.slice(1);
    const tempo = setTimeout(() => vaiA(id), 60);
    return () => clearTimeout(tempo);
  }, [caricamento, location.hash, vaiA]);

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    setErrore(err.message || "Operazione non riuscita.");
    avvisa(err.message || "Operazione non riuscita.", "errore");
  }, [navigate, sessionExpired, avvisa]);

  const carica = useCallback(() => {
    return getIscrizione()
      .then((i) => {
        setIscrizione(i);
        setForm(daIscrizione(i));
        setCaricamento(false);
      })
      .catch((err) => {
        gestisciErrore(err);
        setCaricamento(false);
      });
  }, [gestisciErrore]);

  useEffect(() => { carica(); }, [carica]);

  const salva = async (evento) => {
    evento.preventDefault();
    setErrore("");
    setSalvataggio(true);

    try {
      const aggiornata = await salvaIscrizione({
        dataNascita: form.dataNascita || null,
        luogoNascita: form.luogoNascita,
        provinciaNascita: form.provinciaNascita,
        codiceFiscale: form.codiceFiscale,
        tagliaMaglietta: form.tagliaMaglietta,
        indirizzo: form.indirizzo,
        civico: form.civico,
        cap: form.cap,
        citta: form.citta,
        provincia: form.provincia,
        tipoCertificato: form.tipoCertificato || null,
        certificatoScadenza: form.certificatoScadenza || null,
        note: form.note
      });

      setIscrizione(aggiornata);
      setForm(daIscrizione(aggiornata));
      avvisa(
        aggiornata.manca.length === 0
          ? "Iscrizione completa. La segreteria vede i tuoi dati."
          : "Dati salvati."
      );
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  const caricaCertificato = async (evento) => {
    const file = evento.target.files?.[0];
    evento.target.value = "";
    if (!file) return;

    setErrore("");
    setCaricandoFile(true);

    try {
      // Nessun alleggerimento: un certificato è un PDF o una scansione, e
      // ricomprimerlo rischia di renderlo illeggibile proprio dove conta.
      const salvato = await uploadMedia(file, {
        title: `Certificato medico — ${user?.name ?? "atleta"}`,
        cartella: "certificati",
        tag: ["certificato"]
      });

      setIscrizione(await salvaIscrizione({ certificatoMediaId: salvato.id }));
      avvisa("Certificato caricato. Grazie.");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setCaricandoFile(false);
    }
  };

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento dell&apos;iscrizione…</p>
      </div>
    );
  }

  if (inAttesa) {
    return (
      <div className="adm-page">
        <div className="adm-attesa">
          <FaHourglassHalf className="adm-attesa-icona" aria-hidden="true" />
          <h1 className="adm-attesa-titolo">Prima serve una squadra</h1>
          <p className="adm-attesa-testo">
            L&apos;iscrizione si compila dopo che l&apos;allenatore o la
            segreteria ti hanno assegnato a una squadra. Stanno decidendo:
            appena lo fanno, questa pagina si apre.
          </p>
        </div>
      </div>
    );
  }

  const cert = statoCertificato(iscrizione?.certificatoScadenza, oggi, {
    fileCaricato: Boolean(iscrizione?.certificatoMediaId),
    validazione: iscrizione?.certificatoStato
  });

  /*
   * A chi non gioca il certificato non si chiede, e il riquadro non si
   * disabilita: sparisce. Un pannello grigio con dentro un pulsante spento
   * è una domanda in più — "questo dovrei compilarlo?" — a cui la risposta
   * è no.
   *
   * Il valore lo decide il server: qui il confronto è con false perché una
   * risposta vecchia, senza quel campo, deve continuare a chiederlo.
   */
  const certificatoRichiesto = iscrizione?.certificatoRichiesto !== false;

  /*
   * La quota dentro a questa pagina solo a chi non ce l'ha altrove.
   *
   * L'atleta ha la sezione "Quota" tutta sua, con lo storico dei
   * versamenti: ripeterla qui vorrebbe dire la stessa cifra in due posti,
   * e due posti sono due occasioni di dire cose diverse. Nell'area di chi
   * allena quella sezione non c'è, e la sua quota deve pur comparire da
   * qualche parte.
   */
  const quotaQui = user?.role !== "atleta";

  /* Senza certificato e senza squadre la colonna di destra resterebbe
     vuota: in quel caso il modulo si prende tutta la larghezza invece di
     lasciare mezza pagina bianca. */
  const conLato = certificatoRichiesto || Boolean(iscrizione?.gioca);

  /* Il permesso lo decide il server ed è lì che conta: qui serve solo a
     non far compilare campi che verrebbero poi rifiutati. */
  const permesso = iscrizione?.certificatoModificabile ?? { si: true };
  const bloccato = !permesso.si;

  /*
   * C'è davvero qualcosa da salvare?
   *
   * Un pulsante "Salva" sempre acceso su una pagina che si apre solo per
   * controllare i propri dati chiede di premerlo, e chi lo preme non sa
   * mai se ha cambiato qualcosa. Compare quando serve e sparisce quando
   * non serve più: così la sua presenza è essa stessa l'avviso che ci
   * sono modifiche non salvate.
   */
  const originale = iscrizione ? daIscrizione(iscrizione) : VUOTO;
  const sporco = Object.keys(VUOTO).some((c) => (form[c] ?? "") !== (originale[c] ?? ""));
  const manca = iscrizione?.manca ?? [];
  const completa = manca.length === 0;

  /* Contatti e certificato hanno un posto loro: l'avviso in cima porta lì.
     La pagina dei contatti c'è solo nell'area dell'atleta: a chi allena
     la voce resta scritta, senza collegamento. */
  const conContatti = user?.role === "atleta";
  const dovePorta = (voce) => {
    if (DAI_CONTATTI.includes(voce)) return conContatti ? "contatti" : null;
    if (DEL_CERTIFICATO.includes(voce)) return certificatoRichiesto ? "certificato" : null;
    return "dati";
  };

  /* Lo stato di ogni sezione, accanto al titolo: si vede dall'alto quale
     è a posto e quale no, senza leggere le caselle una per una. Si guarda
     il modulo com'è adesso, non com'era salvato: la pastiglia diventa
     verde mentre si scrive, e la barra in fondo ricorda di salvare. */
  const [gruppoDati, gruppoCasa] = GRUPPI;
  const datiCompleti = gruppoDati.campi.every((c) => !c.obbligatorio || form[c.chiave]);

  const statoCert = STATO_CERTIFICATO[cert.chiave] ?? STATO_CERTIFICATO.mancante;
  const certDaCaricare = !iscrizione?.certificatoUrl
    || cert.chiave === "respinto" || cert.chiave === "scaduto";

  /* Una casella del modulo, come la chiede la sua riga in GRUPPI */
  const casella = (c) => (
    <label
      className={`adm-field ${c.largo ? "adm-campo-largo" : ""} ${c.stretto ? "adm-campo-stretto" : ""}`}
      key={c.chiave}
    >
      <span className="adm-label">
        {c.etichetta}

        {/* L'asterisco su quello che serve per completare l'iscrizione:
            senza, l'unico modo di scoprire cosa manca era l'avviso in
            cima, che lo dice però a cose fatte. */}
        {c.obbligatorio && (
          <span className="adm-obbligatorio" title="Serve per completare l'iscrizione">*</span>
        )}

        {/* L'età non è un campo: si ricava dalla data, e chiederla a parte
            vorrebbe dire due dati che si contraddicono il giorno del
            compleanno. */}
        {c.chiave === "dataNascita" && anni(form.dataNascita) != null && (
          <span className="adm-eta">{anni(form.dataNascita)} anni</span>
        )}
      </span>

      {/* Il calendario è quello del sito e non quello del browser: quello
          cambia forma su ogni sistema, non si può vestire, e su Firefox
          per Windows è una cosa che nessuno trova. */}
      {c.tipo === "date" ? (
        <CampoData
          valore={form[c.chiave] ? `${form[c.chiave]}T00:00:00` : ""}
          onChange={(v) => setForm({
            ...form,
            [c.chiave]: v ? giornoLocale(v) : ""
          })}
          disabilitato={salvataggio}
          etichettaAria={c.etichetta}
        />
      ) : c.tipo === "suggerito" ? (
        <CampoSuggerito
          valore={form[c.chiave]}
          onChange={(v) => setForm({ ...form, [c.chiave]: v })}
          opzioni={c.elenco === "province"
            ? NOMI_PROVINCE
            : comuniDi(form[c.dipendeDa])}
          obbligaScelta={Boolean(c.obbliga)}
          disabilitato={salvataggio}
          etichettaAria={c.etichetta}
          segnaposto={c.dipendeDa && !form[c.dipendeDa]
            ? "Scegli prima la provincia"
            : "Scrivi e scegli…"}
        />
      ) : c.tipo === "scelta" ? (
        <Tendina
          valore={form[c.chiave]}
          onChange={(v) => setForm({ ...form, [c.chiave]: v })}
          opzioni={OPZIONI_TAGLIA}
          disabilitato={salvataggio}
          etichettaAria={c.etichetta}
          segnaposto="Scegli…"
        />
      ) : (
        <input
          type={c.tipo ?? "text"}
          className="adm-input"
          value={form[c.chiave]}
          maxLength={c.max}
          inputMode={c.numerico ? "numeric" : undefined}
          autoCapitalize={c.maiuscolo ? "characters" : undefined}
          onChange={(e) => setForm({
            ...form,
            [c.chiave]: c.maiuscolo ? e.target.value.toUpperCase() : e.target.value
          })}
          disabled={salvataggio}
        />
      )}
    </label>
  );

  return (
    <div className="adm-page adm-editor-page aa-pagina">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">La tua iscrizione</h1>
          <p className="adm-page-sub">
            Questi dati li legge la segreteria. Puoi correggerli quando vuoi.
          </p>
        </div>

        {/* Sul computer il pulsante sta anche qui in alto; sul telefono
            solo nella barra attaccata in fondo, che si raggiunge col
            pollice (vedi AreaAtleta.css). */}
        {(sporco || salvataggio) && (
          <div className="adm-head-actions aa-solo-grande">
            <button
              type="submit"
              form="modulo-iscrizione"
              className="adm-btn adm-btn-primary"
              disabled={salvataggio}
            >
              <FaSave /> {salvataggio ? "Salvataggio…" : "Salva le modifiche"}
            </button>
          </div>
        )}
      </div>

      {/* Dove si gioca, in cima: è la prima cosa che dice "sei dei nostri",
          e prima stava in fondo alla colonna di lato, dove nessuno guardava. */}
      {(iscrizione?.appartenenze ?? []).length > 0 && (
        <div className="isc-squadre" aria-label="Le tue squadre">
          <span className="isc-squadre-etichetta">Sei iscritto a</span>
          {iscrizione.appartenenze.map((a) => (
            <span className="isc-squadra" key={a.squadraId}>
              <span className="isc-squadra-punto" style={{ background: a.colore || undefined }} aria-hidden="true" />
              <strong>{a.squadra}</strong>
              {a.sport && <span className="isc-squadra-sport">{a.sport}</span>}
            </span>
          ))}
        </div>
      )}

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {/* Cosa manca: una voce per cosa, e ognuna porta dove la si compila.
          Prima era una frase sola con cinque cose separate da virgole, e
          sul telefono restava da cercare dove fosse ciascuna. */}
      {completa ? (
        <div className="adm-alert adm-alert-success">
          <FaCheckCircle />
          <span>
            L&apos;iscrizione è completa: hai consegnato tutto quello che serve.
          </span>
        </div>
      ) : (
        <div className="aa-manca" role="status">
          <p className="aa-manca-titolo">
            <FaInfoCircle aria-hidden="true" />
            {manca.length === 1
              ? "Per completare l'iscrizione manca una cosa"
              : `Per completare l'iscrizione mancano ${manca.length} cose`}
          </p>
          <ul className="aa-manca-voci">
            {manca.map((voce) => {
              const dove = dovePorta(voce);
              const testo = voce.charAt(0).toUpperCase() + voce.slice(1);

              return (
                <li key={voce}>
                  {dove === "contatti" ? (
                    <Link to="/area-riservata/contatti" className="aa-manca-voce">
                      {testo} <FaArrowRight aria-hidden="true" />
                    </Link>
                  ) : dove ? (
                    <button type="button" className="aa-manca-voce" onClick={() => vaiA(dove)}>
                      {testo} <FaArrowDown aria-hidden="true" />
                    </button>
                  ) : (
                    <span className="aa-manca-voce">{testo}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* La quota in cima e a tutta larghezza, come nella pagina che gli
          atleti hanno a parte: è la prima cosa che si viene a controllare,
          più dell'indirizzo che si è già scritto tre mesi fa. */}
      {quotaQui && <RiquadroQuota iscrizione={iscrizione} />}

      <p className="aa-legenda">
        <span className="adm-obbligatorio" aria-hidden="true">*</span>
        {" "}= serve per completare l&apos;iscrizione. Il resto è facoltativo, ma aiuta.
      </p>

      <form id="modulo-iscrizione" onSubmit={salva}>
        <div className={`isc-griglia ${conLato ? "" : "isc-griglia-sola"}`}>
          <div className="isc-colonna">

            {/* Tre riquadri numerati invece di un "Modulo" solo: una
                domanda per volta — chi sei, dove abiti, cosa dobbiamo
                sapere — si compila anche a pezzi, fra una cosa e l'altra. */}
            <section className="adm-panel" id="dati" aria-labelledby="isc-titolo-dati">
              <h2 className="adm-panel-title aa-sezione-titolo" id="isc-titolo-dati">
                <span className={`aa-numero ${datiCompleti ? "is-fatto" : ""}`} aria-hidden="true">1</span>
                {gruppoDati.titolo}
                <span className={`aa-stato ${datiCompleti ? "is-ok" : "is-manca"}`}>
                  {datiCompleti ? <><FaCheckCircle aria-hidden="true" /> Completo</> : "Manca qualcosa"}
                </span>
              </h2>
              <p className="aa-sezione-sotto">Come sui documenti.</p>

              <div className="adm-campi">{gruppoDati.campi.map(casella)}</div>
            </section>

            <section className="adm-panel" aria-labelledby="isc-titolo-casa">
              <h2 className="adm-panel-title aa-sezione-titolo" id="isc-titolo-casa">
                <span className="aa-numero" aria-hidden="true">2</span>
                {gruppoCasa.titolo}
              </h2>
              {gruppoCasa.sottotitolo && (
                <p className="aa-sezione-sotto">{gruppoCasa.sottotitolo}</p>
              )}

              <div className="adm-campi">{gruppoCasa.campi.map(casella)}</div>
            </section>

            <section className="adm-panel" aria-labelledby="isc-titolo-note">
              <h2 className="adm-panel-title aa-sezione-titolo" id="isc-titolo-note">
                <span className="aa-numero" aria-hidden="true">3</span>
                C&apos;è qualcosa che dovremmo sapere?
              </h2>

              <label className="adm-field">
                <span className="adm-label">
                  Allergie, terapie, infortuni <em>(facoltativo)</em>
                </span>
                <textarea
                  className="adm-input adm-textarea"
                  rows={3}
                  value={form.note}
                  maxLength={2000}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Per esempio: allergia alle api, porta sempre lo spray per l'asma…"
                  disabled={salvataggio}
                />
                <span className="adm-hint">
                  Lo leggono la segreteria e chi ti allena, per sapere come
                  comportarsi se succede qualcosa.
                </span>
              </label>
            </section>
          </div>

          {conLato && (
          <aside className="isc-lato">
            {certificatoRichiesto && (
            <section className="adm-panel" id="certificato" aria-labelledby="isc-titolo-cert">
              <h2 className="adm-panel-title aa-sezione-titolo" id="isc-titolo-cert">
                <span className={`aa-numero ${cert.chiave === "valido" ? "is-fatto" : ""}`} aria-hidden="true">4</span>
                Certificato medico
                <span className={`aa-stato ${statoCert.tono}`}>{statoCert.testo}</span>
              </h2>

              {iscrizione?.certificatoScadenza && (
                <p className={`adm-cert adm-cert-grande ${cert.classe}`}>
                  {cert.etichetta}
                  {cert.giorni != null && (
                    <span className="adm-cert-nota">{quantoManca(cert.giorni)}</span>
                  )}
                </p>
              )}

              {/* Il controllo riguarda il file che hai caricato, non la
                  data: una scadenza scritta a mano non è qualcosa che la
                  segreteria possa approvare. Un foglio in corso di validità
                  può comunque essere sbagliato, e finché non l'hanno
                  guardato non sei a posto. */}
              {iscrizione?.certificatoMediaId && (
                <div className={`adm-validazione is-${iscrizione.certificatoStato}`}>
                  <span className="adm-validazione-stato">
                    {iscrizione.certificatoStato === "valido"
                      && <><FaCheckCircle aria-hidden="true" /> Controllato dalla segreteria</>}
                    {iscrizione.certificatoStato === "da_validare"
                      && <><FaHourglassHalf aria-hidden="true" /> In attesa del controllo</>}
                    {iscrizione.certificatoStato === "rifiutato"
                      && <><FaTimesCircle aria-hidden="true" /> Respinto: va rifatto</>}
                  </span>

                  {iscrizione.certificatoMotivo && (
                    <span className="adm-validazione-motivo">{iscrizione.certificatoMotivo}</span>
                  )}
                </div>
              )}

              {bloccato && (
                <p className="adm-hint adm-bloccato">
                  <FaLock aria-hidden="true" /> {permesso.motivo}
                </p>
              )}

              {/* Il file prima di tipo e scadenza: è la cosa che conta, ed
                  è quella che una famiglia ha in mano — la foto del foglio
                  del medico. Il pulsante è arancione finché manca. */}
              <div className="adm-cert-file">
                {iscrizione?.certificatoUrl ? (
                  <a
                    href={iscrizione.certificatoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="adm-btn adm-btn-ghost adm-btn-block"
                  >
                    <FaFileMedical /> Vedi quello che hai caricato <FaExternalLinkAlt />
                  </a>
                ) : (
                  <p className="adm-hint" style={{ marginTop: 0 }}>
                    Va bene una foto ben leggibile o il PDF che ti ha dato il
                    medico.
                  </p>
                )}

                <input
                  ref={inputFile}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  hidden
                  onChange={caricaCertificato}
                />
                <button
                  type="button"
                  className={`adm-btn adm-btn-block ${certDaCaricare && !bloccato ? "adm-btn-arancio" : "adm-btn-secondary"}`}
                  onClick={() => inputFile.current?.click()}
                  disabled={caricandoFile || salvataggio || bloccato}
                >
                  <FaUpload />
                  {caricandoFile
                    ? "Caricamento…"
                    : iscrizione?.certificatoUrl ? "Carica quello nuovo" : "Carica il certificato"}
                </button>
                <p className="adm-hint">
                  Il file parte appena lo scegli, non serve premere Salva.
                </p>
              </div>

              <div className="adm-field">
                <span className="adm-label">
                  Quando scade
                  <span className="adm-obbligatorio" title="Serve per completare l'iscrizione">*</span>
                </span>
                <CampoData
                  valore={form.certificatoScadenza ? `${form.certificatoScadenza}T00:00:00` : ""}
                  onChange={(v) => setForm({
                    ...form,
                    certificatoScadenza: v ? giornoLocale(v) : ""
                  })}
                  disabilitato={salvataggio || bloccato}
                  etichettaAria="Scadenza del certificato"
                />
              </div>

              <div className="adm-field">
                <span className="adm-label">Che tipo è</span>
                <Tendina
                  valore={form.tipoCertificato}
                  onChange={(v) => setForm({ ...form, tipoCertificato: v })}
                  opzioni={TIPI_CERTIFICATO}
                  disabilitato={salvataggio || bloccato}
                  etichettaAria="Tipo di certificato"
                />
              </div>
            </section>
            )}

            {/* Il codice fiscale del fratello o della sorella, sotto al
                certificato: è una richiesta sulla quota, non un dato del
                modulo, e sta di lato come il certificato. Solo a chi gioca:
                un allenatore ha la sua quota. */}
            {iscrizione?.gioca && (
              <RiquadroFratelli
                fratelli={iscrizione?.fratelli ?? []}
                onAggiornati={(elenco) => setIscrizione({ ...iscrizione, fratelli: elenco })}
                onErrore={(err) => { if (err instanceof AuthError) gestisciErrore(err); }}
              />
            )}
          </aside>
          )}
        </div>

        {/* Salva sempre a portata: sul telefono la barra resta attaccata
            in fondo mentre si scorre il modulo, sul computer chiude la
            pagina. Compare solo quando c'è qualcosa da salvare — la sua
            presenza è già l'avviso — e "Annulla" rimette com'era. */}
        {(sporco || salvataggio) && (
          <div className="adm-barra-azioni-fissa">
            <span className="aa-barra-nota">
              <FaInfoCircle aria-hidden="true" /> Hai modifiche non salvate
            </span>
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              onClick={() => setForm(originale)}
              disabled={salvataggio}
            >
              Annulla
            </button>
            <button type="submit" className="adm-btn adm-btn-primary" disabled={salvataggio}>
              <FaSave /> {salvataggio ? "Salvataggio…" : "Salva"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
