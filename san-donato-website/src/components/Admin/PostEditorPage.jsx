import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  FaArrowLeft, FaSave, FaPaperPlane, FaImage, FaTrashAlt,
  FaExclamationCircle, FaCheckCircle, FaInfoCircle, FaExternalLinkAlt
} from "react-icons/fa";
import { getPost, createPost, updatePost, uploadMedia, AuthError } from "../../api/adminApi";
import { SPORT } from "../../api/API.mjs";
import { prepareImage, formatSize } from "../../utils/prepareImage";
import { useAuth } from "../../context/auth";
import RichTextEditor from "./RichTextEditor";
import "../../css/Admin.css";

const EMPTY = {
  title: "",
  content: "",
  excerpt: "",
  sport: "Altro",
  status: "draft",
  featuredMediaId: 0,
  image: null
};

export default function PostEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef(null);

  const canPublish = user?.canPublish !== false;

  /* ---------- Caricamento ---------- */

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    getPost(id)
      .then(post => {
        if (!mounted) return;
        setForm({
          title: post.title,
          content: post.content,
          excerpt: post.excerpt,
          sport: post.sport || "Altro",
          status: post.status,
          featuredMediaId: post.featuredMediaId,
          image: post.image
        });
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
    setDirty(true);
    setNotice("");
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
      const media = await uploadMedia(optimized, { title: form.title || file.name });
      update({ featuredMediaId: media.id, image: media.url });
      setNotice(
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
      setError(err.message || "Caricamento dell'immagine non riuscito.");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => update({ featuredMediaId: 0, image: null });

  /* ---------- Salvataggio ---------- */

  const save = async (status) => {
    if (!form.title.trim()) {
      setError("Il titolo è obbligatorio.");
      return;
    }

    setError("");
    setNotice("");
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      content: form.content,
      excerpt: form.excerpt.trim(),
      sport: form.sport,
      status,
      featuredMediaId: form.featuredMediaId
    };

    try {
      const saved = isNew
        ? await createPost(payload)
        : await updatePost(id, payload);

      setForm(prev => ({ ...prev, status: saved.status }));
      setDirty(false);

      if (isNew) {
        // Da qui in poi i salvataggi sono aggiornamenti, non nuove notizie
        navigate(`/admin/modifica/${saved.id}`, {
          replace: true,
          state: { justCreated: status }
        });
        return;
      }

      setNotice(
        status === "publish"
          ? "Notizia pubblicata: è online sul sito."
          : "Bozza salvata. Non è visibile sul sito."
      );
    } catch (err) {
      if (err instanceof AuthError) {
        sessionExpired();
        navigate("/login", { replace: true });
        return;
      }
      setError(err.message || "Salvataggio non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (dirty && !window.confirm("Ci sono modifiche non salvate. Uscire comunque?")) return;
    navigate("/admin");
  };

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento della notizia…</p>
      </div>
    );
  }

  const isPublished = form.status === "publish";
  const busy = saving || uploading;

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
              {isPublished ? "Pubblicata" : "Bozza"}
            </span>
          )}
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
            {saving ? "Salvataggio…" : canPublish ? (isPublished ? "Aggiorna" : "Pubblica") : "Invia in revisione"}
          </button>
        </div>
      </div>

      {error && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="adm-alert adm-alert-success" role="status">
          <FaCheckCircle /> <span>{notice}</span>
          {!isNew && isPublished && (
            <Link to={`/news/${id}`} target="_blank" className="adm-inline-link">
              Vedi sul sito <FaExternalLinkAlt />
            </Link>
          )}
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
          <label className="adm-field">
            <span className="adm-label">Sezione del sito</span>
            <select
              className="adm-input adm-select"
              value={form.sport}
              onChange={(e) => update({ sport: e.target.value })}
              disabled={busy}
            >
              {SPORT.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <div className="adm-sport-hint">
            <FaInfoCircle />
            <span>Comparirà nella sezione <strong>{form.sport}</strong> del sito.</span>
          </div>

          <div className="adm-field">
            <span className="adm-label">Testo</span>
            <RichTextEditor
              value={form.content}
              onChange={(html) => update({ content: html })}
              disabled={busy}
            />
          </div>
        </div>

        <aside className="adm-editor-side">
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
              {uploading ? "Caricamento…" : form.image ? "Sostituisci immagine" : "Scegli immagine"}
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
    </div>
  );
}
