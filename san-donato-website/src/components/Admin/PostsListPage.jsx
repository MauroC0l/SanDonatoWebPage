import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaPlus, FaSearch, FaPencilAlt, FaTrashAlt, FaExternalLinkAlt,
  FaExclamationCircle, FaInbox, FaImage
} from "react-icons/fa";
import { listPosts, trashPost, AuthError } from "../../api/adminApi";
import { detectSport } from "../../api/API.mjs";
import { useAuth } from "../../context/auth";
import "../../css/Admin.css";

const FILTERS = [
  { key: "publish,draft,pending", label: "Tutte" },
  { key: "publish", label: "Pubblicate" },
  { key: "draft,pending", label: "Bozze" }
];

const STATUS_LABEL = {
  publish: "Pubblicata",
  draft: "Bozza",
  pending: "In revisione",
  future: "Programmata",
  private: "Privata"
};

const formatDate = (iso) => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit", month: "long", year: "numeric"
  }).format(date);
};

export default function PostsListPage() {
  const { sessionExpired } = useAuth();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(FILTERS[0].key);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [busyId, setBusyId] = useState(null);

  // Identifica la richiesta in corso. Confrontandolo con quello dei dati già
  // ricevuti si ricava lo stato di caricamento, senza chiamare setState
  // dentro l'effect: così ogni cambio di filtro produce un solo render.
  const requestKey = `${status}|${search}|${page}|${reloadToken}`;

  const [data, setData] = useState({
    key: null, posts: [], total: 0, totalPages: 1, error: ""
  });

  const loading = data.key !== requestKey;
  const { posts, total, totalPages, error } = data;

  useEffect(() => {
    let mounted = true;

    listPosts({ search, status, page })
      .then(result => {
        if (mounted) setData({ key: requestKey, ...result, error: "" });
      })
      .catch(err => {
        if (!mounted) return;
        if (err instanceof AuthError) {
          sessionExpired();
          navigate("/login", { replace: true });
          return;
        }
        setData({
          key: requestKey,
          posts: [], total: 0, totalPages: 1,
          error: err.message || "Impossibile caricare le notizie."
        });
      });

    return () => { mounted = false; };
  }, [requestKey, search, status, page, sessionExpired, navigate]);

  const reload = useCallback(() => setReloadToken(t => t + 1), []);

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleFilter = (key) => {
    setPage(1);
    setStatus(key);
  };

  const handleTrash = async (post) => {
    const confirmed = window.confirm(
      `Spostare "${post.title}" nel cestino?\n\nLa notizia sparisce dal sito ma resta recuperabile.`
    );
    if (!confirmed) return;

    setBusyId(post.id);
    try {
      await trashPost(post.id);
      reload();
    } catch (err) {
      if (err instanceof AuthError) {
        sessionExpired();
        navigate("/login", { replace: true });
        return;
      }
      setData(prev => ({
        ...prev,
        error: err.message || "Impossibile spostare la notizia nel cestino."
      }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div>
          <h1 className="adm-page-title">Notizie</h1>
          <p className="adm-page-sub">
            {loading ? "Caricamento…" : `${total} ${total === 1 ? "notizia" : "notizie"}`}
          </p>
        </div>
        <Link to="/admin/nuova" className="adm-btn adm-btn-primary">
          <FaPlus /> Nuova notizia
        </Link>
      </div>

      <div className="adm-toolbar">
        <div className="adm-filters" role="group" aria-label="Filtra per stato">
          {FILTERS.map(filter => (
            <button
              key={filter.key}
              type="button"
              className={`adm-chip ${status === filter.key ? "is-active" : ""}`}
              onClick={() => handleFilter(filter.key)}
              aria-pressed={status === filter.key}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <form className="adm-search" onSubmit={handleSearch} role="search">
          <FaSearch className="adm-search-icon" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cerca nel titolo o nel testo…"
            aria-label="Cerca fra le notizie"
          />
          <button type="submit" className="adm-btn adm-btn-ghost">Cerca</button>
        </form>
      </div>

      {error && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle />
          <span>{error}</span>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={reload}>Riprova</button>
        </div>
      )}

      {loading ? (
        <div className="adm-loading">
          <div className="adm-spinner" />
          <p>Caricamento delle notizie…</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="adm-empty">
          <FaInbox className="adm-empty-icon" />
          <h2>Nessuna notizia trovata</h2>
          <p>
            {search
              ? `Nessun risultato per "${search}".`
              : "Non ci sono ancora notizie in questa sezione."}
          </p>
          <Link to="/admin/nuova" className="adm-btn adm-btn-primary">
            <FaPlus /> Scrivi la prima
          </Link>
        </div>
      ) : (
        <ul className="adm-post-list">
          {posts.map(post => (
            <li key={post.id} className={`adm-post-row ${busyId === post.id ? "is-busy" : ""}`}>
              <div className="adm-post-thumb">
                {post.image
                  ? <img src={post.image} alt="" loading="lazy" />
                  : <span className="adm-thumb-empty"><FaImage /></span>}
              </div>

              <div className="adm-post-main">
                <Link to={`/admin/modifica/${post.id}`} className="adm-post-title">
                  {post.title || "(senza titolo)"}
                </Link>
                <div className="adm-post-meta">
                  <span className={`adm-status adm-status-${post.status}`}>
                    {STATUS_LABEL[post.status] || post.status}
                  </span>
                  <span className="adm-sport-tag">{detectSport(post.title)}</span>
                  <span className="adm-post-date">{formatDate(post.dateISO)}</span>
                  {post.authorName && <span className="adm-post-author">di {post.authorName}</span>}
                </div>
              </div>

              <div className="adm-post-actions">
                <Link
                  to={`/admin/modifica/${post.id}`}
                  className="adm-icon-btn"
                  title="Modifica"
                  aria-label={`Modifica ${post.title}`}
                >
                  <FaPencilAlt />
                </Link>
                {post.status === "publish" && (
                  <Link
                    to={`/news/${post.id}`}
                    target="_blank"
                    className="adm-icon-btn"
                    title="Vedi sul sito"
                    aria-label={`Vedi ${post.title} sul sito`}
                  >
                    <FaExternalLinkAlt />
                  </Link>
                )}
                <button
                  type="button"
                  className="adm-icon-btn adm-icon-danger"
                  onClick={() => handleTrash(post)}
                  disabled={busyId === post.id}
                  title="Sposta nel cestino"
                  aria-label={`Sposta ${post.title} nel cestino`}
                >
                  <FaTrashAlt />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && totalPages > 1 && (
        <nav className="adm-pagination" aria-label="Pagine">
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Precedente
          </button>
          <span className="adm-page-indicator">Pagina {page} di {totalPages}</span>
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Successiva
          </button>
        </nav>
      )}
    </div>
  );
}
