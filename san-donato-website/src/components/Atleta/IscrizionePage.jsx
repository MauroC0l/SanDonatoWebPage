import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSave, FaExclamationCircle, FaCheckCircle, FaFileMedical, FaUpload,
  FaExternalLinkAlt, FaHourglassHalf, FaClipboardCheck, FaInfoCircle,
  FaTimesCircle, FaLock
} from "react-icons/fa";
import { getIscrizione, salvaIscrizione, uploadMedia, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import { statoCertificato, quantoManca } from "../../utils/certificato";
import { anni } from "../../utils/eta";
import Tendina from "../Admin/Tendina";
import CampoData from "../Admin/CampoData";
import CampoSuggerito from "../Admin/CampoSuggerito";
import { TAGLIE } from "../../data/luoghi";
import { NOMI_PROVINCE, comuniDi } from "../../utils/luoghi";
import "../../css/Admin.css";
import "../../css/Iscrizione.css";

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
    titolo: "I tuoi dati",
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
      { chiave: "cap", etichetta: "CAP", max: 5, stretto: true }
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


  return (
    <div className="adm-page adm-editor-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">La tua iscrizione</h1>
          <p className="adm-page-sub">
            Questi dati li legge la segreteria. Puoi correggerli quando vuoi.
          </p>
        </div>

        {(sporco || salvataggio) && (
          <div className="adm-head-actions">
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

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {/* Cosa manca, detto in una riga sola e senza rimproveri: è una lista
          di cose da fare, non un elenco di mancanze. */}
      {completa ? (
        <div className="adm-alert adm-alert-success">
          <FaCheckCircle />
          <span>
            L&apos;iscrizione è completa: hai consegnato tutto quello che serve.
          </span>
        </div>
      ) : (
        <div className="adm-alert adm-alert-info">
          <FaInfoCircle />
          <span>
            Per completare l&apos;iscrizione manca ancora{" "}
            <strong>{manca.join(", ")}</strong>.
          </span>
        </div>
      )}


      <form id="modulo-iscrizione" onSubmit={salva}>
        <div className="isc-griglia">
          <div className="isc-colonna">
            <section className="adm-panel">
              <h2 className="adm-panel-title">
                <FaClipboardCheck aria-hidden="true" /> Modulo
              </h2>

              {GRUPPI.map((gruppo) => (
                <fieldset className="adm-gruppo" key={gruppo.titolo}>
                  <legend className="adm-gruppo-titolo">{gruppo.titolo}</legend>
                  {gruppo.sottotitolo && (
                    <p className="adm-hint" style={{ marginTop: 0 }}>{gruppo.sottotitolo}</p>
                  )}

                  <div className="adm-campi">
                    {gruppo.campi.map((c) => (
                      <label
                        className={`adm-field ${c.largo ? "adm-campo-largo" : ""} ${c.stretto ? "adm-campo-stretto" : ""}`}
                        key={c.chiave}
                      >
                        <span className="adm-label">
                          {c.etichetta}

                          {/* L'asterisco su quello che serve per completare
                              l'iscrizione: senza, l'unico modo di scoprire
                              cosa manca era l'avviso in cima, che lo dice
                              pero a cose fatte. */}
                          {c.obbligatorio && (
                            <span className="adm-obbligatorio" title="Serve per completare l'iscrizione">*</span>
                          )}

                          {/* L'età non è un campo: si ricava dalla data, e
                              chiederla a parte vorrebbe dire due dati che
                              si contraddicono il giorno del compleanno. */}
                          {c.chiave === "dataNascita" && anni(form.dataNascita) != null && (
                            <span className="adm-eta">{anni(form.dataNascita)} anni</span>
                          )}
                        </span>

                        {/* Il calendario è quello del sito e non quello del
                            browser: quello cambia forma su ogni sistema, non
                            si può vestire, e su Firefox per Windows è una
                            cosa che nessuno trova. */}
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
                            onChange={(e) => setForm({
                              ...form,
                              [c.chiave]: c.maiuscolo ? e.target.value.toUpperCase() : e.target.value
                            })}
                            disabled={salvataggio}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}

              <label className="adm-field">
                <span className="adm-label">
                  C&apos;è qualcosa che dovremmo sapere? <em>(facoltativo)</em>
                </span>
                <textarea
                  className="adm-input adm-textarea"
                  rows={2}
                  value={form.note}
                  maxLength={2000}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Allergie, terapie in corso, infortuni recenti…"
                  disabled={salvataggio}
                />
                <span className="adm-hint">
                  Lo leggono la segreteria e chi ti allena, per sapere come
                  comportarsi se succede qualcosa.
                </span>
              </label>
            </section>

          </div>

          <aside className="isc-lato">
            <section className="adm-panel">
              <h2 className="adm-panel-title">
                <FaFileMedical aria-hidden="true" /> Certificato medico
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

              <div className="adm-field">
                <span className="adm-label">Quando scade</span>
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
                    Non hai ancora caricato la copia. Va bene una foto ben
                    leggibile o il PDF che ti ha dato il medico.
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
                  className="adm-btn adm-btn-secondary adm-btn-block"
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
            </section>

            {(iscrizione?.appartenenze ?? []).length > 0 && (
              <section className="adm-panel">
                <h2 className="adm-panel-title">Sei iscritto a</h2>

                {/* Una riga per squadra, con lo sport: chi ne ha due deve
                    vederle entrambe, e "Under 14" da solo non dice se è il
                    volley o il calcio. */}
                {iscrizione.appartenenze.map((a) => (
                  <p className="adm-esito-riga adm-esito-ok" key={a.squadraId}>
                    <FaCheckCircle aria-hidden="true" />
                    <span>
                      <strong>{a.squadra}</strong>
                      {a.sport && ` — ${a.sport}`}
                    </span>
                  </p>
                ))}
              </section>
            )}

          </aside>
        </div>
      </form>
    </div>
  );
}
