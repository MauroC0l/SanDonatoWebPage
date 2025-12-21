import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Button from "react-bootstrap/Button";
import { FaArrowLeft, FaExpand, FaTag } from "react-icons/fa";
import "../../css/NewsDetail.css";

export default function NewsDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const post = location.state?.post;
  
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") setIsLightboxOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  if (!post) {
    return (
      <div style={{ textAlign: "center", padding: "5rem" }}>
        <h3>Nessun dato disponibile</h3>
        <Button variant="outline-dark" onClick={() => navigate("/news")}>
          Torna alle news
        </Button>
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
              <span className="nd-meta-label">Autore</span>
              <span className="nd-meta-value">{post.author}</span>
            </div>
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