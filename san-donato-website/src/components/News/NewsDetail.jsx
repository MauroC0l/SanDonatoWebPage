import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FaArrowLeft, FaExpand, FaTag } from "react-icons/fa";
import { getPostById } from "../../api/API.mjs";
import "../../css/NewsDetail.css";

export default function NewsDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  // Cliccando una card il post arriva già pronto dal router.
  // Su link diretto, preferito o refresh lo stato è vuoto: va recuperato dall'API,
  // altrimenti nessuna notizia sarebbe condivisibile.
  const statePost = location.state?.post;
  const hasStatePost = statePost && String(statePost.id) === String(id);

  // Si tiene traccia anche dell'id scaricato: così passando da una notizia
  // all'altra lo stato di caricamento si deriva senza resettarlo a mano.
  const [fetched, setFetched] = useState({ id: null, post: null });
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const isFetchedCurrent = String(fetched.id) === String(id);
  const post = hasStatePost ? statePost : (isFetchedCurrent ? fetched.post : null);
  const loading = !hasStatePost && !isFetchedCurrent;

  useEffect(() => {
    if (hasStatePost || !id) return;

    let mounted = true;

    getPostById(id).then(found => {
      if (mounted) setFetched({ id, post: found });
    });

    return () => { mounted = false; };
  }, [id, hasStatePost]);

  // Ogni notizia si apre dall'inizio, non dallo scroll della pagina precedente
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [id]);

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") setIsLightboxOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  if (loading) {
    return (
      <div className="nd-status-wrapper">
        <div className="nd-loader"></div>
        <p>Caricamento della notizia…</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="nd-status-wrapper">
        <h3>Notizia non trovata</h3>
        <p>La notizia che stai cercando è stata rimossa o non esiste più.</p>
        {/* Un pulsante normale invece di quello di react-bootstrap: era
            l'unico componente rimasto di quella libreria in tutto il sito,
            e trascinarla dentro per una riga non aveva senso. */}
        <button type="button" className="nd-torna" onClick={() => navigate("/news")}>
          Torna alle notizie
        </button>
      </div>
    );
  }

  const placeholderImage = "/logo-poli-sfondo.jpg";
  const displayImage = post.image || placeholderImage;
  const tags = post.tags || ["Polisportiva", "News", "Aggiornamenti"];

  return (
    <>
      <div className="nd-wrapper nd-fade-in">
        
        {/* --- HEADER (Titolo e Meta) --- 
            Questo rimane a larghezza intera sopra tutto 
        */}
        <header className="nd-header">
          <div className="nd-tags-wrapper">
            {tags.map((tag, index) => (
              <span key={index} className="nd-tag">
                <FaTag size={10} /> {tag}
              </span>
            ))}
          </div>

          <h1 
            className="nd-title" 
            dangerouslySetInnerHTML={{ __html: post.title }} 
          />

          <div className="nd-meta-data">
            <div className="nd-meta-item">
              <span className="nd-meta-label">Pubblicato il</span>
              <span className="nd-meta-value">{post.date}</span>
            </div>
          </div>
        </header>

        {/* --- CONTAINER ARTICOLO --- 
            Qui avviene la magia del wrapping 
        */}
        <div className="nd-article-container">
          
          {/* IMMAGINE FLOAT A DESTRA
              Deve essere posizionata PRIMA del testo nel codice HTML
              per far sì che il float funzioni correttamente.
          */}
          <div className="nd-float-visual">
            <div className="nd-image-wrapper" onClick={() => setIsLightboxOpen(true)}>
              <img 
                src={displayImage} 
                alt={post.title} 
                className="nd-main-image"
              />
              <div className="nd-image-overlay">
                <FaExpand /> Ingrandisci
              </div>
            </div>
            {/* Didascalia opzionale */}
            <span className="nd-image-caption">Galleria Immagini</span>
          </div>

          {/* TESTO ARTICOLO
              Fluirà a sinistra dell'immagine e poi sotto di essa.
          */}
          <article 
            className="nd-content-body"
            dangerouslySetInnerHTML={{ __html: post.content || post.preview }}
          />
        </div>

        {/* --- FOOTER --- */}
        <footer className="nd-footer-action">
          <button
            className="nd-btn-back"
            onClick={() => navigate("/news")}
          >
            <FaArrowLeft /> Torna alla lista
          </button>
        </footer>

      </div>

      {/* --- LIGHTBOX --- */}
      {isLightboxOpen && (
        <div 
          className="nd-lightbox-overlay" 
          onClick={() => setIsLightboxOpen(false)}
        >
          <button className="nd-lightbox-close" aria-label="Chiudi">✕</button>
          <img 
            src={displayImage} 
            alt="Ingrandimento" 
            className="nd-lightbox-image"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </>
  );
}