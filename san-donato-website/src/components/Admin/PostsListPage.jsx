import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaPlus, FaSearch, FaPencilAlt, FaTrashAlt, FaExternalLinkAlt,
  FaExclamationCircle, FaImage, FaThLarge, FaBars, FaUndo, FaDumpster,
  FaNewspaper, FaRegClock, FaRegEdit, FaCheckCircle, FaLayerGroup
} from "react-icons/fa";
import {
  listPosts, trashPost, restorePost, deletePostForever, svuotaCestinoNotizie,
  listEtichette, AuthError
} from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { useDialoghi } from "../../context/dialoghi";
import { useVista } from "../../hooks/useVista";
import Tendina from "./Tendina";
import ScambiaVista from "./ScambiaVista";
import "../../css/Admin.css";
import "../../css/admin/Notizie.css";


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
  { key: "publish,future,draft,pending", label: "Tutte", Icona: FaLayerGroup },
  { key: "publish", label: "Pubblicate", Icona: FaCheckCircle },
  { key: "future", label: "Programmate", Icona: FaRegClock },
  { key: "draft,pending", label: "Bozze", Icona: FaRegEdit },
  /* Il cestino: le notizie tolte dal sito, che si possono ripristinare o
     cancellare per sempre. È l'unico posto dove si vedono. */
  { key: "trash", label: "Cestino", Icona: FaTrashAlt }
];

const STATUS_LABEL = {
  publish: "Pubblicata",
  draft: "Bozza",
  pending: "In revisione",
  future: "Programmata",
  trash: "Nel cestino",
  private: "Privata"
};

const GIORNO = 24 * 60 * 60 * 1000;

/**
 * Da quanti giorni una notizia è nel cestino, e fra quanti sparisce.
 * "adesso" arriva da fuori, fissato all'apertura della pagina: leggere
 * l'orologio mentre si disegna darebbe un numero diverso a ogni passaggio.
 */
function tempoNelCestino(post, adesso, giorniCestino) {
  const dal = new Date(post.cestinataIl || post.modified).getTime();
  if (isNaN(dal)) return null;
  const da = Math.max(0, Math.floor((adesso - dal) / GIORNO));
  return { da, mancano: Math.max(0, giorniCestino - da) };
}

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
  const { user, sessionExpired } = useAuth();
  /* Cancellare per sempre prima dei 30 giorni: solo amministratore e
     segreteria (28 settembre 2026). Gli altri ripristinano e aspettano. */
  const puoEliminare = (user?.capabilities ?? []).includes("notizie.elimina");
  const area = useArea();
  const { avvisa, conferma } = useDialoghi();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(FILTERS[0].key);
  const [searchInput, setSearchInput] = useState("");
  const [vista, setVista] = useVista("notizie", "lista", ["lista", "griglia"]);
  const [etichetta, setEtichetta] = useState("");
  const [opzioniEtichette, setOpzioniEtichette] = useState([{ valore: "", etichetta: "Tutte le etichette" }]);
  const nelCestino = status === "trash";
  const [search, setSearch] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [busyId, setBusyId] = useState(null);

  // Identifica la richiesta in corso. Confrontandolo con quello dei dati già
  // ricevuti si ricava lo stato di caricamento, senza chiamare setState
  // dentro l'effect: così ogni cambio di filtro produce un solo render.
  const requestKey = `${status}|${search}|${etichetta}|${page}|${reloadToken}`;

  const [data, setData] = useState({
    key: null, posts: [], total: 0, totalPages: 1, giorniCestino: 30, error: ""
  });
  const [adesso] = useState(() => Date.now());

  const loading = data.key !== requestKey;
  const { posts, total, totalPages, giorniCestino, error } = data;

  useEffect(() => {
    let mounted = true;

    listPosts({ search, status, etichetta, page })
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
  }, [requestKey, search, status, etichetta, page, sessionExpired, navigate]);

  // Le etichette per il filtro: una lettura sola, all'apertura
  useEffect(() => {
    listEtichette()
      .then((elenco) => setOpzioniEtichette([
        { valore: "", etichetta: "Tutte le etichette" },
        ...elenco.map((e) => ({ valore: String(e.id), etichetta: e.nome }))
      ]))
      .catch(() => {});
  }, []);

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

  /* Un'azione su una notizia, con lo stesso trattamento degli errori per
     tutte: sessione scaduta all'accesso, il resto in un avviso. */
  const suNotizia = async (post, azione, riuscita, fallita) => {
    setBusyId(post?.id ?? "tutte");
    try {
      await azione();
      avvisa(riuscita);
      reload();
    } catch (err) {
      if (err instanceof AuthError) {
        sessionExpired();
        navigate("/login", { replace: true });
        return;
      }
      avvisa(err.message || fallita, "errore");
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = (post) => suNotizia(
    post, () => restorePost(post.id),
    "Notizia ripristinata: è tornata fra le bozze.", "Ripristino non riuscito."
  );

  const handleDeleteForever = async (post) => {
    const ok = await conferma({
      titolo: "Cancellare per sempre?",
      testo: `"${post.title || "(senza titolo)"}" viene cancellata definitivamente e non si potrà più recuperare.`,
      conferma: "Cancella per sempre",
      pericolo: true
    });
    if (!ok) return;
    suNotizia(post, () => deletePostForever(post.id), "Notizia cancellata per sempre.", "Cancellazione non riuscita.");
  };

  const handleSvuota = async () => {
    const ok = await conferma({
      titolo: "Svuotare il cestino?",
      testo: `${total === 1 ? "La notizia nel cestino viene cancellata" : `Le ${total} notizie nel cestino vengono cancellate`} per sempre, e non si potranno più recuperare.`,
      conferma: "Svuota il cestino",
      pericolo: true
    });
    if (!ok) return;
    suNotizia(null, () => svuotaCestinoNotizie(), "Cestino svuotato.", "Non è stato possibile svuotare il cestino.");
  };

  const handleTrash = async (post) => {
    const ok = await conferma({
      titolo: "Spostare nel cestino?",
      testo: `"${post.title || "(senza titolo)"}" sparisce dal sito, ma non viene cancellata: `
        + "la ritrovi nel Cestino, qui fra i filtri, e da lì la puoi ripristinare.",
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

  // Il pulsante del vuoto: "Scrivi la prima" solo quando l'archivio è
  // davvero vuoto; con un filtro addosso sarebbe falso, le notizie ci sono.
  const archivioVuoto = !search && !etichetta && status === FILTERS[0].key;

  return (
    <div className="adm-page ntz-pagina">
      <header className="adm-page-head ntz-testa">
        <div>
          <p className="adm-occhiello">Comunicazione</p>
          <h1 className="adm-page-title">Notizie</h1>
          <p className="adm-page-sub">
            {loading
              ? "Caricamento…"
              : nelCestino
                ? `${total} ${total === 1 ? "notizia" : "notizie"} nel cestino`
                : `${total} ${total === 1 ? "notizia" : "notizie"} · scrivi, programma e pubblica sul sito`}
          </p>
        </div>
        {/* "Nuova notizia" c'è sempre, anche nel cestino: è il gesto per cui
            si entra qui nove volte su dieci. Svuotare il cestino sta dentro
            al cestino, accanto alla spiegazione dei trenta giorni. */}
        <Link to={`${area}/notizie/nuova`} className="adm-btn adm-btn-primary ntz-nuova">
          <FaPlus /> Nuova notizia
        </Link>
      </header>

      {/* Gli stati come linguette su una riga sola: sul telefono scorrono
          di lato invece di andare a capo su tre righe. Il cestino in fondo
          e staccato, perché non è un tipo di notizia ma un posto. */}
      <nav className="ntz-linguette" aria-label="Filtra per stato">
        {FILTERS.map(({ key, label, Icona }) => (
          <button
            key={key}
            type="button"
            className={`ntz-linguetta ${key === "trash" ? "is-cestino" : ""} ${status === key ? "is-active" : ""}`}
            onClick={() => handleFilter(key)}
            aria-pressed={status === key}
          >
            <Icona aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>

      <div className="ntz-strumenti">
        <form className="adm-search ntz-cerca" onSubmit={handleSearch} role="search">
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

        <Tendina
          className="adm-filter-select ntz-etichetta"
          valore={etichetta}
          onChange={(v) => { setPage(1); setEtichetta(v); }}
          opzioni={opzioniEtichette}
          segnaposto="Tutte le etichette"
          etichettaAria="Filtra per etichetta"
        />

        <ScambiaVista
          vista={vista}
          onCambia={setVista}
          opzioni={VISTE}
        />
      </div>

      {nelCestino && (
        <div className="ntz-cestino-avviso" role="status">
          <span className="ntz-cestino-icona" aria-hidden="true"><FaTrashAlt /></span>
          <p>
            Qui le notizie restano <strong>{giorniCestino} giorni</strong>, poi si cancellano
            da sole. Fino ad allora, <strong>Ripristina</strong> le rimette fra le bozze.
            {!puoEliminare && " Cancellarle prima lo possono fare solo amministratore e segreteria."}
          </p>
          {total > 0 && puoEliminare && (
            <button
              type="button"
              className="adm-btn adm-btn-cancella"
              onClick={handleSvuota}
              disabled={busyId != null}
            >
              <FaDumpster /> Svuota il cestino
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle />
          <span>{error}</span>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={reload}>Riprova</button>
        </div>
      )}

      {loading ? (
        /* Sagome al posto della rotella: la pagina ha già la sua forma e
           quando le notizie arrivano non salta niente. */
        <ul className="adm-post-list" aria-hidden="true">
          {[0, 1, 2].map((i) => <li key={i} className="adm-sagoma ntz-sagoma" />)}
        </ul>
      ) : posts.length === 0 ? (
        <div className="adm-vuoto-amico">
          <span className="adm-vuoto-icona">{nelCestino ? <FaTrashAlt /> : <FaNewspaper />}</span>
          <h2>
            {search
              ? "Nessuna notizia trovata"
              : nelCestino
                ? "Il cestino è vuoto"
                : status === "future"
                  ? "Niente in programma"
                  : archivioVuoto ? "Ancora nessuna notizia" : "Qui non c'è niente"}
          </h2>
          <p>
            {search
              ? `Nessun risultato per "${search}". Prova con un'altra parola.`
              : nelCestino
                ? "Le notizie che togli dal sito passano di qui, e per un mese si possono ancora ripristinare."
                : status === "future"
                  // Un elenco vuoto qui non è una mancanza: vuol dire che non
                  // c'è niente in attesa di uscire, che di solito va bene.
                  ? "Nessuna notizia in attesa di uscire. Ne programmi una scegliendo "
                    + "una data nel riquadro \"Quando esce\" mentre la scrivi."
                  : archivioVuoto
                    ? "Una partita vinta, una festa, un avviso alle famiglie: scrivilo qui e compare sul sito."
                    : "Non ci sono notizie con questi filtri."}
          </p>
          {!nelCestino && (
            <Link to={`${area}/notizie/nuova`} className="adm-btn adm-btn-primary">
              <FaPlus /> {archivioVuoto ? "Scrivi la prima" : "Nuova notizia"}
            </Link>
          )}
        </div>
      ) : (
        <ul className={vista === "griglia" ? "adm-post-griglia ntz-griglia" : "adm-post-list ntz-lista"}>
          {posts.map(post => (
            <li key={post.id} className={`adm-post-row ntz-riga ${busyId === post.id ? "is-busy" : ""}`}>
              <div className="adm-post-thumb">
                {post.image
                  ? <img src={post.image} alt="" loading="lazy" />
                  : <span className="adm-thumb-empty"><FaImage /></span>}
              </div>

              <div className="adm-post-main">
                {/* Nel cestino il titolo non porta all'editor: una notizia
                    cestinata si ripristina, non si corregge. */}
                {nelCestino ? (
                  <span className="adm-post-title">{post.title || "(senza titolo)"}</span>
                ) : (
                  <Link to={`${area}/notizie/${post.id}`} className="adm-post-title">
                    {post.title || "(senza titolo)"}
                  </Link>
                )}
                <div className="adm-post-meta">
                  {!nelCestino && (
                    <span className={`adm-status adm-status-${post.status}`}>
                      {STATUS_LABEL[post.status] || post.status}
                    </span>
                  )}
                  <span className="adm-sport-tag">{post.sport}</span>
                  {(post.etichette ?? []).map((e) => (
                    <span className="adm-categoria-tag" key={e.id}>{e.nome}</span>
                  ))}
                </div>
                <p className="ntz-quando">
                  {/* Per una programmata la data è un appuntamento, non un
                      archivio: va letta con l'ora e introdotta da "esce". */}
                  {post.status === "trash"
                    ? <GiorniNelCestino tempo={tempoNelCestino(post, adesso, giorniCestino)} />
                    : post.status === "future"
                      ? <><FaRegClock aria-hidden="true" /> esce il {formatDateOra(post.dateISO)}</>
                      : formatDate(post.dateISO)}
                  {post.authorName && <span className="adm-post-author"> · di {post.authorName}</span>}
                </p>
              </div>

              {nelCestino ? (
              <div className="adm-post-actions">
                {/* Con la scritta e non solo l'icona: è il gesto che si
                    viene a fare nel cestino, e deve vedersi al primo colpo */}
                <button
                  type="button"
                  className="adm-btn adm-btn-secondary"
                  onClick={() => handleRestore(post)}
                  disabled={busyId != null}
                  title="Torna fra le bozze"
                  aria-label={`Ripristina ${post.title}`}
                >
                  <FaUndo /> Ripristina
                </button>
                {puoEliminare && (
                  <button
                    type="button"
                    className="adm-icon-btn adm-icon-danger"
                    onClick={() => handleDeleteForever(post)}
                    disabled={busyId != null}
                    title="Cancella per sempre"
                    aria-label={`Cancella per sempre ${post.title}`}
                  >
                    <FaTrashAlt />
                  </button>
                )}
              </div>
              ) : (
              <div className="adm-post-actions">
                {/* "Modifica" scritto: una matita sola non dice a tutti
                    che è da lì che si corregge la notizia. */}
                <Link
                  to={`${area}/notizie/${post.id}`}
                  className="adm-btn adm-btn-ghost ntz-modifica"
                  aria-label={`Modifica ${post.title}`}
                >
                  <FaPencilAlt /> Modifica
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
              )}
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

/**
 * "Nel cestino da 12 giorni · si cancella fra 18": il secondo numero
 * diventa rosso negli ultimi cinque giorni, quando è ora di decidere.
 */
function GiorniNelCestino({ tempo }) {
  if (!tempo) return "nel cestino";
  const { da, mancano } = tempo;
  const quando = da === 0 ? "da oggi" : da === 1 ? "da 1 giorno" : `da ${da} giorni`;
  return (
    <>
      nel cestino {quando} ·{" "}
      <span className={`adm-cestino-mancano ${mancano <= 5 ? "is-vicino" : ""}`}>
        {mancano === 0 ? "si cancella stanotte" : mancano === 1 ? "si cancella fra 1 giorno" : `si cancella fra ${mancano} giorni`}
      </span>
    </>
  );
}
