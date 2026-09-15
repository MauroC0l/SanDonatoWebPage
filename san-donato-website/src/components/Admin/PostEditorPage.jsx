import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  FaArrowLeft, FaSave, FaPaperPlane, FaImage, FaImages, FaTrashAlt, FaUpload,
  FaExclamationCircle, FaInfoCircle, FaExternalLinkAlt, FaClock, FaRegClock
} from "react-icons/fa";
import { getPost, createPost, updatePost, uploadMedia, AuthError } from "../../api/adminApi";
import { SPORT, CATEGORIE } from "../../api/API.mjs";
import { prepareImage, formatSize } from "../../utils/prepareImage";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { useDialoghi } from "../../context/dialoghi";
import RichTextEditor from "./RichTextEditor";
import Tendina from "./Tendina";
import CampoData from "./CampoData";
import SceltaDallaLibreria from "./SceltaDallaLibreria";
import "../../css/Admin.css";

const VUOTO = {
  title: "",
  content: "",
  excerpt: "",
  sport: "Altro",
  categoria: "altro",
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
const CAMPI_CONFRONTO = ["title", "content", "excerpt", "sport", "categoria", "featuredMediaId", "pubblicataIl"];

function uguali(a, b) {
  return CAMPI_CONFRONTO.every((c) => (a[c] ?? "") === (b[c] ?? ""));
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
          categoria: post.categoria || "altro",
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
      categoria: form.categoria,
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

      if (isNew) {
        // Da qui in poi i salvataggi sono aggiornamenti, non nuove notizie
        navigate(`${area}/notizie/${saved.id}`, { replace: true });
      }

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

  return (
    <div className="adm-page adm-editor-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <button type="button" className="adm-btn adm-btn-ghost" onClick={handleBack}>
            <FaArrowLeft /> Notizie
          </button>
          <h1 className="adm-page-title">
            {isNew ? "Nuova notizia" : "Modifica notizia"}
          </h1>
          {!isNew && (
            <span className={`adm-status adm-status-${form.status}`}>
              {programmata ? "Programmata" : isPublished ? "Pubblicata" : "Bozza"}
            </span>
          )}
          {dirty && <span className="adm-non-salvato">modifiche non salvate</span>}
        </div>

        <div className="adm-head-actions">
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
        </div>
      </div>

      {error && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{error}</span>
        </div>
      )}

      {programmata && (
        <div className="adm-alert adm-alert-info">
          <FaClock />
          <span>
            Questa notizia non è ancora sul sito: comparirà da sola{" "}
            <strong>{leggibile(form.pubblicataIl)}</strong>.
          </span>
        </div>
      )}

      <div className="adm-editor-grid">
        <div className="adm-editor-col">
          <label className="adm-field">
            <span className="adm-label">Titolo</span>
            <input
              type="text"
              className="adm-input adm-input-title"
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Es. Il Calcio Under 14 vince il derby"
              disabled={busy}
            />
          </label>

          {/* Lo sport era dedotto dal titolo, perché su WordPress non
              esisteva un campo: chi scriveva doveva infilare la parola
              "volley" nel titolo per finire nella sezione giusta. Ora si
              sceglie, e il titolo torna a essere solo un titolo. */}
          <div className="adm-field">
            <span className="adm-label">Sezione del sito</span>
            <Tendina
              valore={form.sport}
              onChange={(v) => update({ sport: v })}
              opzioni={opzioniSport}
              disabilitato={busy}
              etichettaAria="Sezione del sito"
            />
          </div>

          <div className="adm-sport-hint">
            <FaInfoCircle />
            <span>Comparirà nella sezione <strong>{form.sport}</strong> del sito.</span>
          </div>

          {/* La categoria è un'altra cosa dallo sport, e le due non si
              sostituiscono: una festa di Natale del settore calcio è
              "Calcio" per la sezione e "Feste ed eventi" per il
              contenuto. Tenerne una sola vorrebbe dire buttare via
              metà dell'informazione. */}
          <div className="adm-field">
            <span className="adm-label">Di cosa parla</span>
            <Tendina
              valore={form.categoria}
              onChange={(v) => update({ categoria: v })}
              opzioni={CATEGORIE}
              disabilitato={busy}
              etichettaAria="Categoria della notizia"
            />
          </div>

          <div className="adm-field">
            <span className="adm-label">Testo</span>
            <RichTextEditor
              value={form.content}
              onChange={(html) => update({ content: html })}
              onNormalizzato={allineaContenuto}
              disabled={busy}
            />
          </div>
        </div>

        <aside className="adm-editor-side">
          {/* ---------- Quando esce ---------- */}
          <section className="adm-panel">
            <h2 className="adm-panel-title">
              <FaRegClock aria-hidden="true" /> Quando esce
            </h2>

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
          </section>

          <section className="adm-panel">
            <h2 className="adm-panel-title">Immagine di copertina</h2>

            {form.image ? (
              <div className="adm-cover">
                <img src={form.image} alt="Anteprima della copertina" />
                <button
                  type="button"
                  className="adm-btn adm-btn-ghost adm-btn-block"
                  onClick={removeImage}
                  disabled={busy}
                >
                  <FaTrashAlt /> Rimuovi
                </button>
              </div>
            ) : (
              <div className="adm-cover-empty">
                <FaImage />
                <p>Nessuna immagine. Verrà usato il logo della Polisportiva.</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImagePick}
              hidden
            />
            <button
              type="button"
              className="adm-btn adm-btn-secondary adm-btn-block"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <FaUpload /> {uploading ? "Caricamento…" : form.image ? "Sostituisci dal computer" : "Carica dal computer"}
            </button>

            {/* La libreria per seconda ma ben visibile: chi ha la foto in
                mano carica, chi la sta cercando la trova già lì. */}
            <button
              type="button"
              className="adm-btn adm-btn-ghost adm-btn-block"
              onClick={() => setLibreriaAperta(true)}
              disabled={busy}
            >
              <FaImages /> Scegli dalla libreria
            </button>

            <p className="adm-hint">
              Le foto vengono ridotte e raddrizzate in automatico prima del caricamento.
            </p>
          </section>

          <section className="adm-panel">
            <h2 className="adm-panel-title">Riassunto</h2>
            <textarea
              className="adm-input adm-textarea"
              value={form.excerpt}
              onChange={(e) => update({ excerpt: e.target.value })}
              rows={5}
              maxLength={300}
              placeholder="Poche righe che compaiono nell'elenco delle notizie."
              disabled={busy}
            />
            <p className="adm-hint">
              {form.excerpt.length}/300 · Se lo lasci vuoto viene ricavato dall&apos;inizio del testo.
            </p>
          </section>

          {!isNew && isPublished && !programmata && (
            <Link to={`/news/${id}`} target="_blank" className="adm-btn adm-btn-ghost adm-btn-block">
              Vedi sul sito <FaExternalLinkAlt />
            </Link>
          )}

          {!canPublish && (
            <div className="adm-alert adm-alert-info">
              <FaInfoCircle />
              <span>
                Il tuo account può scrivere notizie ma non pubblicarle: verranno inviate
                in revisione a un amministratore.
              </span>
            </div>
          )}
        </aside>
      </div>
      {libreriaAperta && (
        <SceltaDallaLibreria
          onScegli={scegliDallaLibreria}
          onChiudi={() => setLibreriaAperta(false)}
        />
      )}
    </div>
  );
}
