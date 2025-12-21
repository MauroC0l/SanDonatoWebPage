import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Button from "react-bootstrap/Button";
import { FaArrowLeft, FaExpand, FaTag } from "react-icons/fa";
import "../../css/NewsDetail.css";

export default function NewsDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const post = location.state?.post;
  
  // Stato per gestire l'apertura del Lightbox
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Gestione tasto ESC per chiudere il lightbox
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") setIsLightboxOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  if (!post) {
    return (
      <div className="nd-error-container">
        <h3>Nessun dato disponibile</h3>
        <p>Torna alla lista per selezionare una notizia.</p>
        <Button variant="outline-secondary" onClick={() => navigate("/news")}>
          ← Torna alle news
        </Button>
      </div>
    );
  }

  // --- LOGICA IMMAGINE ---
  const placeholderImage = "/logo-poli-sfondo.jpg";
  const displayImage = post.image || placeholderImage;
  const imageAltText = post.image ? post.title : "Placeholder Polisportiva";
  
  // --- LOGICA TAG ---
  const tags = post.tags || ["Polisportiva", "News", "Aggiornamenti"];

  return (
    <>
      <div className="nd-wrapper nd-fade-in">
        
        {/* --- COLONNA TESTO (Sinistra Desktop) --- */}
        <div className="nd-column-text">
          
          {/* Header Notizia */}
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

            {/* Blocco Metadati Moderno */}
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

          {/* Contenuto Articolo */}
          <article 
            className="nd-content-body"
            dangerouslySetInnerHTML={{ __html: post.content || post.preview }}
          />

          {/* Footer Navigazione */}
          <footer className="nd-footer-action">
            <button
              className="nd-btn-back"
              onClick={() => navigate("/news")}
            >
              <FaArrowLeft /> Torna alla lista
            </button>
          </footer>
        </div>

        {/* --- COLONNA VISIVA (Destra Desktop - Ora ridotta) --- */}
        <div className="nd-column-visual">
          <div className="nd-image-wrapper" onClick={() => setIsLightboxOpen(true)}>
            <img 
              src={displayImage} 
              alt={imageAltText} 
              className="nd-main-image"
            />
            <div className="nd-image-overlay">
              <FaExpand /> Ingrandisci
            </div>
          </div>
          <p className="nd-image-caption">Galleria Immagini</p>
        </div>

      </div>

      {/* --- LIGHTBOX MODAL --- */}
      {isLightboxOpen && (
        <div 
          className="nd-lightbox-overlay" 
          onClick={() => setIsLightboxOpen(false)}
        >
          <button className="nd-lightbox-close" aria-label="Chiudi">✕</button>
          <img 
            src={displayImage} 
            alt="Ingrandimento notizia" 
            className="nd-lightbox-image"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </>
  );
}