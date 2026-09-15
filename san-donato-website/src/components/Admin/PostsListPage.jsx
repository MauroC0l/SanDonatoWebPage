import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaPlus, FaSearch, FaPencilAlt, FaTrashAlt, FaExternalLinkAlt,
  FaExclamationCircle, FaInbox, FaImage, FaThLarge, FaBars
} from "react-icons/fa";
import { listPosts, trashPost, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { useDialoghi } from "../../context/dialoghi";
import { useVista } from "../../hooks/useVista";
import Tendina from "./Tendina";
import { CATEGORIE, NOME_CATEGORIA } from "../../api/API.mjs";
import ScambiaVista from "./ScambiaVista";
import "../../css/Admin.css";

/* Il filtro per categoria, con la voce che le tiene tutte in testa. */
const FILTRI_CATEGORIA = [
  { valore: "", etichetta: "Tutte le categorie" },
  ...CATEGORIE
];

/*
 * Le notizie hanno una copertina, ed è quella che si cerca quando si
 * rilegge l'archivio: la griglia la mostra grande, la lista sta dietro a
 * un'unghia. Nessuna delle due vince sempre — chi controlla gli stati
 * lavora meglio a lista — quindi si sceglie e il sito se lo ricorda.
 */
const VISTE = [
  { valore: "lista", etichetta: "Lista", Icona: FaBars },
  { valore: "griglia", etichetta: "Griglia", Icona: FaThLarge }
];

/**
 * I filtri dell'elenco.
 *
 * "Pubblicate" significa davvero online adesso, e "Programmate" le pubblicate
 * che devono ancora uscire: le due voci non si sovrappongono, così una
 * notizia si trova sempre sotto una sola di esse. Insieme alle bozze coprono
 * tutto quello che non è nel cestino, che è appunto "Tutte".
 */
const FILTERS = [
  { key: "publish,future,draft,pending", label: "Tutte" },
  { key: "publish", label: "Pubblicate" },
  { key: "future", label: "Programmate" },
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

/** Con l'ora: serve solo alle notizie programmate, dove il minuto conta. */
const formatDateOra = (iso) => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(date);
};

export default function PostsListPage() {
  const { sessionExpired } = useAuth();
  const area = useArea();
  const { avvisa, conferma } = useDialoghi();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(FILTERS[0].key);
  const [searchInput, setSearchInput] = useState("");
  const [vista, setVista] = useVista("notizie", "lista", ["lista", "griglia"]);
  const [categoria, setCategoria] = useState("");
  const [search, setSearch] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [busyId, setBusyId] = useState(null);

  // Identifica la richiesta in corso. Confrontandolo con quello dei dati già
  // ricevuti si ricava lo stato di caricamento, senza chiamare setState
  // dentro l'effect: così ogni cambio di filtro produce un solo render.
  const requestKey = `${status}|${search}|${categoria}|${page}|${reloadToken}`;

  const [data, setData] = useState({
    key: null, posts: [], total: 0, totalPages: 1, error: ""
  });

  const loading = data.key !== requestKey;
  const { posts, total, totalPages, error } = data;

  useEffect(() => {
    let mounted = true;

    listPosts({ search, status, categoria, page })
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
  }, [requestKey, search, status, categoria, page, sessionExpired, navigate]);

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
    const ok = await conferma({
      titolo: "Spostare nel cestino?",
      testo: `"${post.title || "(senza titolo)"}" sparisce dal sito, ma non viene cancellata: `
        + "si recupera rimettendola in bozza.",
      conferma: "Sposta nel cestino",
      pericolo: true
    });
    if (!ok) return;

    setBusyId(post.id);
    try {
      await trashPost(post.id);
      avvisa("Notizia spostata nel cestino.");
      reload();
    } catch (err) {
      if (err instanceof AuthError) {
        sessionExpired();
        navigate("/login", { replace: true });
        return;
      }
      avvisa(err.message || "Impossibile spostare la notizia nel cestino.", "errore");
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
        <Link to={`${area}/notizie/nuova`} className="adm-btn adm-btn-primary">
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

        <Tendina
          className="adm-filter-select"
          valore={categoria}
          onChange={(v) => { setPage(1); setCategoria(v); }}
          opzioni={FILTRI_CATEGORIA}
          segnaposto="Tutte le categorie"
          etichettaAria="Filtra per categoria"
        />

        <ScambiaVista
          vista={vista}
          onCambia={setVista}
          opzioni={VISTE}
        />

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
              : status === "future"
                // Un elenco vuoto qui non è una mancanza: vuol dire che non
                // c'è niente in attesa di uscire, che di solito va bene.
                ? "Nessuna notizia in attesa di uscire. Ne programmi una scegliendo "
                  + "una data nel riquadro \"Quando esce\" mentre la scrivi."
                : "Non ci sono ancora notizie in questa sezione."}
          </p>
          <Link to={`${area}/notizie/nuova`} className="adm-btn adm-btn-primary">
            {/* "Scrivi la prima" solo quando l'archivio è davvero vuoto: con
                un filtro addosso sarebbe falso, le notizie ci sono. */}
            <FaPlus /> {search || status !== FILTERS[0].key ? "Nuova notizia" : "Scrivi la prima"}
          </Link>
        </div>
      ) : (
        <ul className={vista === "griglia" ? "adm-post-griglia" : "adm-post-list"}>
          {posts.map(post => (
            <li key={post.id} className={`adm-post-row ${busyId === post.id ? "is-busy" : ""}`}>
              <div className="adm-post-thumb">
                {post.image
                  ? <img src={post.image} alt="" loading="lazy" />
                  : <span className="adm-thumb-empty"><FaImage /></span>}
              </div>

              <div className="adm-post-main">
                <Link to={`${area}/notizie/${post.id}`} className="adm-post-title">
                  {post.title || "(senza titolo)"}
                </Link>
                <div className="adm-post-meta">
                  <span className={`adm-status adm-status-${post.status}`}>
                    {STATUS_LABEL[post.status] || post.status}
                  </span>
                  <span className="adm-sport-tag">{post.sport}</span>
                  {/* La categoria solo quando c'è davvero: "Altro" è il
                      valore di chi non ha ancora scelto, e mostrarlo come
                      un'etichetta lo farebbe sembrare una scelta. */}
                  {post.categoria && post.categoria !== "altro" && (
                    <span className="adm-categoria-tag">
                      {NOME_CATEGORIA[post.categoria] ?? post.categoria}
                    </span>
                  )}
                  <span className="adm-post-date">
                    {/* Per una programmata la data è un appuntamento, non un
                        archivio: va letta con l'ora e introdotta da "esce". */}
                    {post.status === "future"
                      ? `esce il ${formatDateOra(post.dateISO)}`
                      : formatDate(post.dateISO)}
                  </span>
                  {post.authorName && <span className="adm-post-author">di {post.authorName}</span>}
                </div>
              </div>

              <div className="adm-post-actions">
                <Link
                  to={`${area}/notizie/${post.id}`}
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
