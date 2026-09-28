import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import { FaArrowLeft, FaArrowRight, FaExpand, FaTimes, FaRegClock } from "react-icons/fa";
import { getAllPosts, getPostById } from "../../api/API.mjs";
import SchedaNotizia from "./SchedaNotizia";
import BarraLettura from "./BarraLettura";
import Condividi from "./Condividi";
import {
  dataLunga, etichetteDi, minutiDiLettura, quando, soloTesto, sportVisibile
} from "./notizieUtili";
import "../../css/NewsPage.css";
import "../../css/NewsDetail.css";

/* Quante notizie propone la fila "Continua a leggere" in fondo */
const ALTRE = 4;

/* Un'immagine del corpo punta spesso alla sua versione grande: si apre
   quella nella finestra, e non la pagina dell'immagine in una scheda. */
const E_IMMAGINE = /\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i;

/**
 * Una notizia sola, per /news/:id.
 *
 * Rifatta come una pagina di rivista: la testata blu con la foto di
 * copertina sfocata dietro e il titolo gigante, la foto vera che sale sul
 * bordo, il testo in una colonna stretta (quella che si legge senza
 * perdere la riga), la barra di lettura in alto, i pulsanti per
 * condividere e in fondo le altre notizie.
 */
export default function NewsDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  /*
   * Cliccando una scheda il post arriva già pronto dal router, e la
   * testata si disegna subito. MA l'elenco non porta il testo completo
   * (getAllPosts non lo scarica, per non trasferire centinaia di kilobyte
   * a vuoto): senza una seconda richiesta la pagina mostrava solo il
   * sommario. Il post del router fa da anteprima, il corpo arriva sempre
   * dall'API. Su link diretto, preferito o ricarica lo stato è vuoto e si
   * aspetta l'API per tutto.
   */
  const statePost = location.state?.post;
  const hasStatePost = Boolean(statePost) && String(statePost.id) === String(id);
  const statoCompleto = hasStatePost && Boolean(statePost.content);

  // Si tiene traccia anche dell'id scaricato: così passando da una notizia
  // all'altra lo stato di caricamento si deriva senza resettarlo a mano.
  const [fetched, setFetched] = useState({ id: null, post: null });
  const [ingrandita, setIngrandita] = useState(null); // { src, alt } | null
  const [archivio, setArchivio] = useState([]);

  const isFetchedCurrent = String(fetched.id) === String(id);
  const post = statoCompleto
    ? statePost
    : (isFetchedCurrent && fetched.post) || (hasStatePost ? statePost : null);
  const loading = !hasStatePost && !isFetchedCurrent;
  const corpoInArrivo = hasStatePost && !statoCompleto && !isFetchedCurrent;

  const corpoRef = useRef(null);

  useEffect(() => {
    if (statoCompleto || !id) return undefined;
    let mounted = true;

    getPostById(id).then((found) => {
      if (mounted) setFetched({ id, post: found });
    });

    return () => { mounted = false; };
  }, [id, statoCompleto]);

  /* Le altre notizie per la fila in fondo. È la stessa richiesta
     dell'archivio, con la sua cache: chi arriva da /news non scarica
     niente di nuovo. Se non arriva, la fila semplicemente non c'è. */
  useEffect(() => {
    let mounted = true;
    getAllPosts()
      .then((tutte) => { if (mounted) setArchivio(tutte); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Ogni notizia si apre dall'inizio, non dallo scroll della pagina precedente
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [id]);

  /* La finestra della foto: Esc chiude, e la pagina sotto non scorre
     finché è aperta (sul telefono il dito trascinerebbe l'articolo). */
  useEffect(() => {
    if (!ingrandita) return undefined;
    const suTasto = (event) => {
      if (event.key === "Escape") setIngrandita(null);
    };
    const prima = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", suTasto);
    return () => {
      window.removeEventListener("keydown", suTasto);
      document.body.style.overflow = prima;
    };
  }, [ingrandita]);

  /* Le notizie "vicine": prima quelle con etichette in comune, poi lo
     stesso sport, a parità la più recente. Senza niente in comune restano
     le ultime uscite, che è comunque meglio di una fila vuota. */
  const altre = useMemo(() => {
    if (!post || archivio.length === 0) return [];
    const mie = new Set(etichetteDi(post).map((e) => String(e.id)));
    const punti = (n) => etichetteDi(n).filter((e) => mie.has(String(e.id))).length * 2
      + (post.sport && post.sport !== "Altro" && n.sport === post.sport ? 1 : 0);
    return archivio
      .filter((n) => String(n.id) !== String(post.id) && n.slug !== post.slug)
      .map((n) => ({ n, p: punti(n) }))
      .sort((x, y) => (y.p - x.p) || (quando(y.n) - quando(x.n)))
      .slice(0, ALTRE)
      .map(({ n }) => n);
  }, [post, archivio]);

  if (loading) {
    return (
      // Chiavi diverse per attesa, mancante e notizia: React altrimenti
      // riuserebbe gli stessi elementi, e l'osservatore del movimento (che
      // vede solo gli elementi nuovi) non farebbe mai comparire il testo.
      <div className="nzd nzd-attesa" aria-busy="true" key="attesa">
        <div className="nzd-eroe">
          <div className="mv-aurora" aria-hidden="true" />
          <div className="nzd-eroe-dentro">
            <span className="nzd-sagoma nzd-sagoma-corta" />
            <span className="nzd-sagoma nzd-sagoma-titolo" />
            <span className="nzd-sagoma nzd-sagoma-titolo nzd-sagoma-meta" />
            <p className="nzd-attesa-testo">Caricamento della notizia…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="nzd nzd-mancante" key="mancante">
        <div className="nzd-eroe">
          <div className="mv-aurora" aria-hidden="true" />
          <div className="nzd-eroe-dentro nzd-mancante-dentro" data-rivela>
            <span className="nzd-mancante-numero" aria-hidden="true">404</span>
            <h1 className="nzd-titolo nzd-titolo-piccolo">Notizia non trovata</h1>
            <p className="nzd-sommario">
              La notizia che stai cercando è stata rimossa o non esiste più.
            </p>
            {/* Un pulsante normale invece di quello di react-bootstrap: era
                l'unico componente rimasto di quella libreria in tutto il sito,
                e trascinarla dentro per una riga non aveva senso. */}
            <button type="button" className="nzd-bottone" data-magnete onClick={() => navigate("/news")}>
              <FaArrowLeft aria-hidden="true" /> Torna alle notizie
            </button>
          </div>
        </div>
      </div>
    );
  }

  const copertina = post.image;
  const titoloTesto = soloTesto(post.title).trim();
  const etichette = etichetteDi(post);
  const sport = post.sport && post.sport !== "Altro" ? sportVisibile(post.sport) : null;
  const corpo = post.content || post.preview;
  const minuti = minutiDiLettura(corpo);
  const autore = post.author || "Staff";

  /* Le foto dentro al testo si ingrandiscono con un tocco. Un solo
     ascoltatore sull'articolo invece di uno per immagine: il corpo è HTML
     del server, e le immagini dentro non sono elementi di React. */
  const suClicCorpo = (e) => {
    const img = e.target.closest?.("img");
    if (!img || !corpoRef.current?.contains(img)) return;
    const link = img.closest("a");
    if (link) {
      // Un'immagine che porta altrove (a un'altra pagina) resta un link
      if (!E_IMMAGINE.test(link.getAttribute("href") || "")) return;
      e.preventDefault();
      setIngrandita({ src: link.href, alt: img.alt });
      return;
    }
    setIngrandita({ src: img.currentSrc || img.src, alt: img.alt });
  };

  return (
    <>
      <BarraLettura bersaglio={corpoRef} />

      {/* La chiave cambia con la notizia: passando da una all'altra dalla
          fila in fondo, tutto ricompare come a pagina nuova. */}
      <div className="nzd" key={post.id}>

        {/* ---------- TESTATA ---------- */}
        <header className={`nzd-eroe${copertina ? " nzd-eroe-con-foto" : ""}`}>
          {copertina && (
            <div className="nzd-eroe-sfondo" data-parallasse="0.18" aria-hidden="true">
              <img src={copertina} alt="" />
            </div>
          )}
          <div className="nzd-eroe-velo" aria-hidden="true" />
          <div className="mv-aurora" aria-hidden="true" />
          <div className="nzd-eroe-griglia" aria-hidden="true" />
          {!copertina && (
            <span className="nzd-eroe-fantasma" data-parallasse="0.12" aria-hidden="true">NEWS</span>
          )}

          <div className="nzd-eroe-dentro">
            <nav className="nzd-briciole" aria-label="Percorso" data-rivela="sfuma">
              <Link to="/news" className="nzd-indietro">
                <FaArrowLeft aria-hidden="true" /> Tutte le notizie
              </Link>
            </nav>

            {(etichette.length > 0 || sport) && (
              <div className="nzd-etichette" data-rivela="sfuma">
                {etichette.map((e) => (
                  <span key={e.id} className="nzd-etichetta">{e.nome}</span>
                ))}
                {sport && <span className="nzd-etichetta nzd-etichetta-sport">{sport}</span>}
              </div>
            )}

            <h1
              className="nzd-titolo"
              data-rivela
              dangerouslySetInnerHTML={{ __html: post.title }}
            />

            {post.preview && post.content && (
              <p className="nzd-sommario" data-rivela>{post.preview}</p>
            )}

            <div className="nzd-meta" data-rivela>
              <span className="nzd-autore">
                <span className="nzd-autore-sigla" aria-hidden="true">{autore.trim().charAt(0).toUpperCase()}</span>
                <span>
                  <small>Scritto da</small>
                  {autore}
                </span>
              </span>
              <span className="nzd-meta-voce">
                <small>Pubblicato il</small>
                <time dateTime={post.dateISO || undefined}>{dataLunga(post)}</time>
              </span>
              {!corpoInArrivo && (
                <span className="nzd-meta-voce">
                  <small>Lettura</small>
                  <span><FaRegClock aria-hidden="true" /> {minuti} min</span>
                </span>
              )}
            </div>
          </div>
        </header>

        {/* ---------- LA FOTO ----------
            Sale sul bordo della testata. Compare la cornice, si inclina il
            pulsante: due transform su due elementi. */}
        {copertina && (
          <figure className="nzd-foto-cornice" data-rivela="zoom">
            <button
              type="button"
              className="nzd-foto"
              data-inclina="4"
              onClick={() => setIngrandita({ src: copertina, alt: post.imageAlt || titoloTesto })}
              aria-label="Ingrandisci la foto di copertina"
            >
              <img src={copertina} alt={post.imageAlt || titoloTesto} />
              <span className="nzd-foto-ingrandisci" aria-hidden="true">
                <FaExpand /> Ingrandisci
              </span>
            </button>
            {post.imageAlt && <figcaption>{post.imageAlt}</figcaption>}
          </figure>
        )}

        {/* ---------- IL TESTO ---------- */}
        <div className="nzd-lettura">
          <aside className="nzd-lato" aria-label="Condividi">
            <Condividi titolo={titoloTesto} verticale />
          </aside>

          <div className="nzd-colonna">
            {/* Il corpo non compare scorrendo: è lungo, e un blocco alto non
                deve mai restare nascosto in attesa di una soglia. */}
            {corpoInArrivo ? (
              <div className="nzd-corpo-attesa" aria-busy="true" aria-label="Caricamento del testo">
                {Array.from({ length: 7 }, (_, i) => <span key={i} />)}
              </div>
            ) : (
              <article
                ref={corpoRef}
                className="nzd-corpo"
                onClick={suClicCorpo}
                dangerouslySetInnerHTML={{ __html: corpo }}
              />
            )}

            <footer className="nzd-fine">
              <span className="nzd-fine-segno" aria-hidden="true">✦</span>
              <p className="nzd-fine-titolo">Passa la notizia a chi gioca con te.</p>
              <Condividi titolo={titoloTesto} />
            </footer>
          </div>
        </div>

        {/* ---------- CONTINUA A LEGGERE ---------- */}
        {altre.length > 0 && (
          <section className="nzd-altre" aria-labelledby="nzd-altre-titolo">
            <div className="nzd-altre-dentro">
              <div className="nzd-altre-testa">
                <div data-rivela>
                  <span className="nzd-occhiello">Dall'archivio</span>
                  <h2 id="nzd-altre-titolo" className="nzd-altre-titolo">
                    Continua a <span className="mv-testo-vivo">leggere.</span>
                  </h2>
                </div>
                <Link to="/news" className="nzd-bottone" data-magnete>
                  Tutte le notizie <FaArrowRight aria-hidden="true" />
                </Link>
              </div>

              {/* La chiave segue le notizie proposte: arrivano dopo la
                  pagina, e l'osservatore vede solo gli elementi nuovi. */}
              <div className="nzd-altre-fila" data-rivela-gruppo key={altre.map((n) => n.id).join("|")}>
                {altre.map((n) => <SchedaNotizia key={n.id} post={n} />)}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ---------- FOTO INGRANDITA ---------- */}
      {ingrandita && (
        <div
          className="nzd-finestra"
          role="dialog"
          aria-modal="true"
          aria-label="Foto ingrandita"
          onClick={() => setIngrandita(null)}
        >
          <button
            type="button"
            className="nzd-finestra-chiudi"
            aria-label="Chiudi"
            autoFocus
            onClick={() => setIngrandita(null)}
          >
            <FaTimes aria-hidden="true" />
          </button>
          <img
            src={ingrandita.src}
            alt={ingrandita.alt || "Foto ingrandita"}
            className="nzd-finestra-foto"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
