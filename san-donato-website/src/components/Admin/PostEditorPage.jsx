import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  FaArrowLeft, FaSave, FaPaperPlane, FaImage, FaImages, FaTrashAlt, FaUpload,
  FaExclamationCircle, FaInfoCircle, FaExternalLinkAlt, FaRegClock, FaTags
} from "react-icons/fa";
import { getPost, createPost, updatePost, uploadMedia, listEtichette, AuthError } from "../../api/adminApi";
import { SPORT } from "../../api/API.mjs";
import { prepareImage, formatSize } from "../../utils/prepareImage";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { useDialoghi } from "../../context/dialoghi";
import RichTextEditor from "./RichTextEditor";
import Tendina from "./Tendina";
import CampoData from "./CampoData";
import SceltaDallaLibreria from "./SceltaDallaLibreria";
import GestioneEtichette from "./GestioneEtichette";
import "../../css/Admin.css";
import "../../css/admin/Notizie.css";

const VUOTO = {
  title: "",
  content: "",
  excerpt: "",
  sport: "Altro",
  // Gli identificativi delle etichette scelte
  etichette: [],
  status: "draft",
  featuredMediaId: 0,
  image: null,

  // Vuoto significa "quando premo pubblica". Valorizzato, è la data di uscita.
  pubblicataIl: null,

  /**
   * Chi scrive ha scelto di decidere lui la data di uscita.
   *
   * È la posizione del selettore, non un confronto con l'orologio: "adesso"
   * cambia a ogni istante, e leggerlo mentre si disegna la pagina darebbe un
   * risultato diverso a ogni passaggio senza che nulla sia cambiato. Se la
   * data scelta è già passata la notizia esce subito — lo decide il server —
   * ma il selettore resta dov'è, invece di saltare da solo sull'altra voce
   * mentre si sta ancora scrivendo la data.
   */
  programmata: false
};

/** I campi che, cambiando, valgono come "modifica non salvata". */
const CAMPI_CONFRONTO = ["title", "content", "excerpt", "sport", "etichette", "featuredMediaId", "pubblicataIl"];

/* Le etichette sono un elenco: si confrontano ordinate, perché sceglierle
   in un altro ordine non è una modifica. */
const confrontabile = (v) => (Array.isArray(v) ? [...v].sort((x, y) => x - y).join(",") : (v ?? ""));

function uguali(a, b) {
  return CAMPI_CONFRONTO.every((c) => confrontabile(a[c]) === confrontabile(b[c]));
}

function leggibile(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("it-IT", {
    weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit"
  });
}

/** Fra un quarto d'ora, arrotondato: un valore di partenza sensato. */
function fraPoco() {
  const d = new Date(Date.now() + 15 * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString();
}

export default function PostEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();
  const area = useArea();
  const { avvisa, conferma } = useDialoghi();

  const [form, setForm] = useState(VUOTO);
  const [libreriaAperta, setLibreriaAperta] = useState(false);

  /**
   * Com'era la notizia l'ultima volta che è stata salvata (o caricata).
   *
   * "Ci sono modifiche non salvate" si RICAVA dal confronto con questo, non è
   * più una spia che si accende al primo onChange. Prima bastava che un campo
   * ricevesse lo stesso identico valore che aveva già — cosa che l'editor di
   * testo fa da solo appena si monta, riscrivendo l'HTML a modo suo — perché
   * la spia restasse accesa, e uscire dalla pagina chiedesse conferma a chi
   * non aveva toccato nulla.
   */
  const [base, setBase] = useState(VUOTO);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const canPublish = user?.canPublish !== false;
  const dirty = !uguali(form, base);

  /* ---------- Caricamento ---------- */

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    getPost(id)
      .then(post => {
        if (!mounted) return;
        const caricata = {
          title: post.title,
          content: post.content,
          excerpt: post.excerpt,
          sport: post.sport || "Altro",
          etichette: (post.etichette ?? []).map((e) => e.id),
          status: post.status,
          featuredMediaId: post.featuredMediaId,
          image: post.image,
          pubblicataIl: post.pubblicataIl ?? null,
          programmata: post.status === "future"
        };
        setForm(caricata);
        setBase(caricata);
        setLoading(false);
      })
      .catch(err => {
        if (!mounted) return;
        if (err instanceof AuthError) {
          sessionExpired();
          navigate("/login", { replace: true });
          return;
        }
        setError(err.message || "Impossibile caricare la notizia.");
        setLoading(false);
      });

    return () => { mounted = false; };
  }, [id, isNew, navigate, sessionExpired]);

  /* ---------- Avviso di uscita con modifiche non salvate ---------- */

  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = useCallback((patch) => {
    setForm(prev => ({ ...prev, ...patch }));
    setError("");
  }, []);

  /**
   * L'editor di testo dichiara come ha riscritto il contenuto appena
   * caricato: è quello il testo di partenza, non quello arrivato dal
   * database. Va allineato anche il riferimento, o il confronto segnerebbe
   * una modifica che nessuno ha fatto.
   */
  const allineaContenuto = useCallback((html) => {
    setForm(prev => (prev.content === html ? prev : { ...prev, content: html }));
    setBase(prev => (prev.content === html ? prev : { ...prev, content: html }));
  }, []);

  /* ---------- Immagine di copertina ---------- */

  const handleImagePick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // permette di riselezionare lo stesso file
    if (!file) return;

    setError("");
    setUploading(true);
    try {
      const optimized = await prepareImage(file);
      const media = await uploadMedia(optimized, {
        title: form.title || file.name,
        cartella: "notizie",
        tag: ["copertina"]
      });
      update({ featuredMediaId: media.id, image: media.url });
      avvisa(
        optimized.size < file.size
          ? `Immagine caricata e alleggerita da ${formatSize(file.size)} a ${formatSize(optimized.size)}.`
          : "Immagine caricata."
      );
    } catch (err) {
      if (err instanceof AuthError) {
        sessionExpired();
        navigate("/login", { replace: true });
        return;
      }
      avvisa(err.message || "Caricamento dell'immagine non riuscito.", "errore");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => update({ featuredMediaId: 0, image: null });

  /**
   * Una copertina presa dalla libreria invece che dal disco.
   *
   * Non si ricarica niente: si punta a un file che c'è già. È il motivo
   * per cui la stessa foto della squadra smette di esistere in tre copie,
   * una per ogni volta che qualcuno l'ha riscelta dal telefono.
   */
  const scegliDallaLibreria = (file) => {
    if (!file) return;
    update({ featuredMediaId: file.id, image: file.url });
    setLibreriaAperta(false);
  };

  /**
   * Torna a "esce subito".
   *
   * Se la notizia era già uscita, la data originale si rimette: toglierla
   * significherebbe far risalire un articolo di tre anni fa in cima
   * all'elenco solo perché è stato corretto un refuso.
   */
  const subito = () => {
    const originale = base.pubblicataIl;
    const giaUscita = originale && new Date(originale).getTime() <= Date.now();
    update({ pubblicataIl: giaUscita ? originale : null, programmata: false });
  };

  /* ---------- Salvataggio ---------- */

  const save = async (status) => {
    if (!form.title.trim()) {
      setError("Il titolo è obbligatorio.");
      avvisa("Manca il titolo.", "errore");
      return;
    }

    setError("");
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      content: form.content,
      excerpt: form.excerpt.trim(),
      sport: form.sport,
      etichette: form.etichette,
      status,
      featuredMediaId: form.featuredMediaId,

      /**
       * La data parte solo se c'è, e solo pubblicando.
       *
       * Mandarla vuota NON significa "pubblica adesso": significa cancellare
       * la data, e una notizia senza data di uscita sparisce dal sito, perché
       * è proprio quella che il sito guarda per decidere cosa mostrare. Non
       * mandandola affatto, il server mette l'ora corrente alla prima
       * pubblicazione e lascia stare quella già scritta in tutti gli altri casi.
       */
      ...(status === "publish" && form.pubblicataIl ? { pubblicataIl: form.pubblicataIl } : {})
    };

    try {
      const saved = isNew
        ? await createPost(payload)
        : await updatePost(id, payload);

      const salvata = {
        ...form,
        title: payload.title,
        excerpt: payload.excerpt,
        status: saved.status,
        pubblicataIl: saved.pubblicataIl ?? form.pubblicataIl,
        programmata: saved.status === "future"
      };
      setForm(salvata);
      setBase(salvata);

      /* Pubblicata (o programmata, o mandata in revisione): il lavoro su
         questa notizia è finito, e si torna all'elenco. Una bozza invece
         resta aperta, perché la si sta ancora scrivendo. */
      const finita = status === "publish";

      if (isNew && !finita) {
        // Da qui in poi i salvataggi sono aggiornamenti, non nuove notizie
        navigate(`${area}/notizie/${saved.id}`, { replace: true });
      }
      if (finita) navigate(`${area}/notizie`);

      if (saved.inviataInRevisione) {
        avvisa("Inviata in revisione: un amministratore la pubblicherà.", "info");
      } else if (saved.status === "future") {
        avvisa(`Programmata: esce ${leggibile(saved.pubblicataIl)}.`);
      } else if (status === "publish") {
        avvisa("Notizia pubblicata: è online sul sito.");
      } else {
        avvisa("Bozza salvata. Non è visibile sul sito.");
      }
    } catch (err) {
      if (err instanceof AuthError) {
        sessionExpired();
        navigate("/login", { replace: true });
        return;
      }
      setError(err.message || "Salvataggio non riuscito.");
      avvisa(err.message || "Salvataggio non riuscito.", "errore");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = async () => {
    if (dirty) {
      const ok = await conferma({
        titolo: "Uscire senza salvare?",
        testo: "Le modifiche fatte da quando hai aperto la notizia andranno perse.",
        conferma: "Esci senza salvare",
        annulla: "Resta qui",
        pericolo: true
      });
      if (!ok) return;
    }
    navigate(`${area}/notizie`);
  };

  /* ---------- Etichette ---------- */

  const [tutteEtichette, setTutteEtichette] = useState([]);
  const [gestioneAperta, setGestioneAperta] = useState(false);
  const puoPubblicare = (user?.capabilities ?? []).includes("notizie.pubblica");

  const caricaEtichette = useCallback(() => listEtichette()
    .then((elenco) => {
      setTutteEtichette(elenco);
      /* Un'etichetta cancellata nella finestra sparisce anche da questa
         notizia: tenerla vorrebbe dire mandare al server un numero che
         non esiste più. */
      const esistenti = new Set(elenco.map((e) => e.id));
      setForm((f) => (f.etichette.every((id) => esistenti.has(id))
        ? f
        : { ...f, etichette: f.etichette.filter((id) => esistenti.has(id)) }));
    })
    .catch(() => {}), []);

  useEffect(() => { caricaEtichette(); }, [caricaEtichette]);

  const opzioniEtichette = useMemo(
    () => tutteEtichette.map((e) => ({ valore: e.id, etichetta: e.nome })),
    [tutteEtichette]
  );

  const opzioniSport = useMemo(
    () => SPORT.map((s) => ({ valore: s, etichetta: s })),
    []
  );

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento della notizia…</p>
      </div>
    );
  }

  const programmata = form.status === "future";
  const isPublished = form.status === "publish" || programmata;
  const busy = saving || uploading;
  // Radio "a una data che scelgo io": è la scelta di chi scrive, non un
  // confronto con l'orologio. Se la data scelta è già passata la notizia esce
  // subito: lo dice il testo sotto al campo, e il server fa il resto.
  const nelFuturo = form.programmata;

  const etichettaPubblica = !canPublish
    ? "Invia in revisione"
    : nelFuturo
      ? "Programma"
      : isPublished ? "Aggiorna" : "Pubblica";

  /* A che punto è la notizia, detto in una riga: è la prima cosa che
     chiede chi riapre un articolo ("ma è già online?"). */
  const statoDetto = isNew || (!isPublished && form.status !== "pending")
    ? { classe: "adm-status-draft", nome: "Bozza", testo: "Non è visibile sul sito finché non la pubblichi." }
    : form.status === "pending"
      ? { classe: "adm-status-pending", nome: "In revisione", testo: "Aspetta che un amministratore la pubblichi." }
      : programmata
        ? { classe: "adm-status-future", nome: "Programmata", testo: `Esce da sola ${leggibile(form.pubblicataIl)}.` }
        : { classe: "adm-status-publish", nome: "Pubblicata", testo: "È online sul sito." };

  /* I due pulsanti, uguali nel riquadro a lato (computer) e nella barra
     in fondo (telefono): scritti una volta sola, perché due copie prima o
     poi finiscono per dire cose diverse. */
  const pulsanti = (
    <>
      <button
        type="button"
        className="adm-btn adm-btn-ghost"
        onClick={() => save("draft")}
        disabled={busy}
      >
        <FaSave /> Salva bozza
      </button>
      <button
        type="button"
        className="adm-btn adm-btn-primary"
        onClick={() => save(canPublish ? "publish" : "pending")}
        disabled={busy}
      >
        <FaPaperPlane />
        {saving ? "Salvataggio…" : etichettaPubblica}
      </button>
    </>
  );

  return (
    <div className="adm-page adm-editor-page ntz-editor">
      <header className="ntz-editor-testa">
        <button type="button" className="ntz-indietro" onClick={handleBack}>
          <FaArrowLeft aria-hidden="true" /> Tutte le notizie
        </button>
        <div className="ntz-editor-titolo">
          <h1 className="adm-page-title">
            {isNew ? "Nuova notizia" : "Modifica notizia"}
          </h1>
          {dirty && <span className="adm-non-salvato">modifiche non salvate</span>}
        </div>
      </header>

      {error && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{error}</span>
        </div>
      )}

      <div className="adm-editor-grid ntz-editor-griglia">
        {/* ---------- Il foglio: solo titolo e testo ----------
            Tutto il resto (sport, etichette, copertina, data) sta nella
            colonna accanto: mentre si scrive si guarda il testo, e basta. */}
        <div className="ntz-foglio">
          <label className="ntz-titolo-campo">
            <span className="adm-solo-lettori">Titolo</span>
            {/* Un'area di testo e non un campo di una riga: un titolo
                lungo sul telefono si legge per intero, andando a capo,
                invece di scorrere di lato nascosto. L'invio non va a capo:
                un titolo è una riga sola, anche quando se ne vedono due. */}
            <textarea
              rows={1}
              value={form.title}
              onChange={(e) => update({ title: e.target.value.replace(/\s*\n+\s*/g, " ") })}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              placeholder="Scrivi il titolo…"
              disabled={busy}
              aria-invalid={error === "Il titolo è obbligatorio." || undefined}
            />
          </label>

          <RichTextEditor
            value={form.content}
            onChange={(html) => update({ content: html })}
            onNormalizzato={allineaContenuto}
            disabled={busy}
          />
        </div>

        <aside className="adm-editor-side ntz-lato">
          {/* ---------- Pubblicazione ---------- */}
          <section className="adm-panel ntz-pannello-pubblica">
            <h2 className="adm-panel-title">
              <FaPaperPlane aria-hidden="true" /> Pubblicazione
            </h2>

            <p className="ntz-stato">
              <span className={`adm-status ${statoDetto.classe}`}>{statoDetto.nome}</span>
              <span>{statoDetto.testo}</span>
            </p>

            <fieldset className="ntz-uscita">
              <legend className="adm-label"><FaRegClock aria-hidden="true" /> Quando esce</legend>

              <div className="adm-scelta-uscita">
                <label className="adm-check">
                  <input
                    type="radio"
                    name="uscita"
                    checked={!nelFuturo}
                    onChange={subito}
                    disabled={busy}
                  />
                  <span className="adm-check-box adm-check-tondo" aria-hidden="true" />
                  <span>{isPublished && !programmata ? "Lascia la data di uscita" : "Appena la pubblico"}</span>
                </label>

                <label className="adm-check">
                  <input
                    type="radio"
                    name="uscita"
                    checked={nelFuturo}
                    onChange={() => update({ pubblicataIl: fraPoco(), programmata: true })}
                    disabled={busy}
                  />
                  <span className="adm-check-box adm-check-tondo" aria-hidden="true" />
                  <span>A una data che scelgo io</span>
                </label>
              </div>

              {nelFuturo ? (
                <>
                  <CampoData
                    valore={form.pubblicataIl}
                    onChange={(v) => update({ pubblicataIl: v || null })}
                    conOra
                    disabilitato={busy}
                    etichettaAria="Data di uscita"
                  />
                  <p className="adm-hint">
                    Resta invisibile sul sito e compare da sola a quest&apos;ora:
                    nessuno deve ricordarsi di tornare a pubblicarla. Con una data
                    già passata esce subito, ma porta la data che hai scritto.
                  </p>
                </>
              ) : (
                form.pubblicataIl && (
                  <p className="adm-hint">Uscita il {leggibile(form.pubblicataIl)}.</p>
                )
              )}
            </fieldset>

            {!canPublish && (
              <p className="ntz-nota-revisione">
                <FaInfoCircle aria-hidden="true" />
                <span>
                  Il tuo account può scrivere notizie ma non pubblicarle: con
                  &quot;Invia in revisione&quot; la passi a un amministratore.
                </span>
              </p>
            )}

            <div className="ntz-pulsanti-lato">{pulsanti}</div>

            {!isNew && isPublished && !programmata && (
              <Link to={`/news/${id}`} target="_blank" className="adm-inline-link ntz-vedi">
                Vedi sul sito <FaExternalLinkAlt aria-hidden="true" />
              </Link>
            )}
          </section>

          {/* ---------- Dove compare ---------- */}
          <section className="adm-panel">
            <h2 className="adm-panel-title">
              <FaTags aria-hidden="true" /> Dove compare
            </h2>

            {/* Lo sport era dedotto dal titolo, perché su WordPress non
                esisteva un campo: chi scriveva doveva infilare la parola
                "volley" nel titolo per finire nella sezione giusta. Ora si
                sceglie, e il titolo torna a essere solo un titolo. */}
            <div className="adm-field">
              <span className="adm-label">Sport</span>
              <Tendina
                valore={form.sport}
                onChange={(v) => update({ sport: v })}
                opzioni={opzioniSport}
                disabilitato={busy}
                etichettaAria="Sport a cui collegare la notizia"
              />
              <span className="adm-hint">
                Compare nella sezione <strong>{form.sport}</strong> del sito.
              </span>
            </div>

            {/* La categoria è un'altra cosa dallo sport, e le due non si
                sostituiscono: una festa di Natale del settore calcio è
                "Calcio" per la sezione e "Feste ed eventi" per il
                contenuto. Tenerne una sola vorrebbe dire buttare via
                metà dell'informazione. */}
            <div className="adm-field ntz-campo-ultimo">
              <div className="adm-label-riga">
                <span className="adm-label">Etichette</span>
                <button
                  type="button"
                  className="adm-inline-link ntz-gestisci"
                  onClick={() => setGestioneAperta(true)}
                  disabled={busy}
                >
                  Gestisci etichette
                </button>
              </div>
              <Tendina
                multipla
                valore={form.etichette}
                onChange={(v) => update({ etichette: v })}
                opzioni={opzioniEtichette}
                disabilitato={busy}
                segnaposto={opzioniEtichette.length ? "Scegli una o più etichette…" : "Nessuna etichetta: creane una con Gestisci etichette"}
                etichettaAria="Etichette della notizia"
              />
            </div>
          </section>

          {/* ---------- Copertina ---------- */}
          <section className="adm-panel">
            <h2 className="adm-panel-title">
              <FaImage aria-hidden="true" /> Immagine di copertina
            </h2>

            {form.image ? (
              <div className="adm-cover ntz-copertina">
                <img src={form.image} alt="Anteprima della copertina" />
                <button
                  type="button"
                  className="adm-icon-btn adm-icon-danger ntz-copertina-togli"
                  onClick={removeImage}
                  disabled={busy}
                  title="Togli la copertina"
                  aria-label="Togli la copertina"
                >
                  <FaTrashAlt />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="adm-cover-empty ntz-copertina-vuota"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <FaUpload aria-hidden="true" />
                <strong>Carica una foto</strong>
                <span>Senza, sul sito compare il logo della Polisportiva.</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImagePick}
              hidden
            />
            <div className="ntz-copertina-azioni">
              {form.image && (
                <button
                  type="button"
                  className="adm-btn adm-btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  <FaUpload /> {uploading ? "Caricamento…" : "Sostituisci"}
                </button>
              )}

              {/* La libreria per seconda ma ben visibile: chi ha la foto in
                  mano carica, chi la sta cercando la trova già lì. */}
              <button
                type="button"
                className="adm-btn adm-btn-ghost"
                onClick={() => setLibreriaAperta(true)}
                disabled={busy}
              >
                <FaImages /> Scegli dalla libreria
              </button>
            </div>

            <p className="adm-hint">
              {uploading
                ? "Caricamento della foto…"
                : "Le foto vengono ridotte e raddrizzate in automatico prima del caricamento."}
            </p>
          </section>

          {/* ---------- Riassunto ---------- */}
          <section className="adm-panel">
            <h2 className="adm-panel-title">Riassunto</h2>
            <textarea
              className="adm-input adm-textarea"
              value={form.excerpt}
              onChange={(e) => update({ excerpt: e.target.value })}
              rows={4}
              maxLength={300}
              placeholder="Poche righe che compaiono nell'elenco delle notizie."
              disabled={busy}
              aria-label="Riassunto"
            />
            <p className="adm-hint">
              {form.excerpt.length}/300 · Facoltativo: se lo lasci vuoto viene ricavato dall&apos;inizio del testo.
            </p>
          </section>
        </aside>
      </div>

      {/* Sul telefono i pulsanti restano attaccati in basso mentre si
          scrive: il riquadro "Pubblicazione" lì sta sotto al testo, e per
          salvare bisognerebbe scorrere fino in fondo. */}
      <div className="adm-barra-azioni-fissa ntz-barra-telefono">{pulsanti}</div>

      {gestioneAperta && (
        <GestioneEtichette
          puoModificare={puoPubblicare}
          onChiudi={() => { setGestioneAperta(false); caricaEtichette(); }}
        />
      )}

      {libreriaAperta && (
        <SceltaDallaLibreria
          onScegli={scegliDallaLibreria}
          onChiudi={() => setLibreriaAperta(false)}
        />
      )}
    </div>
  );
}
