import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Button from "react-bootstrap/Button";
import "../css/NewsDetail.css";

export default function NewsDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const post = location.state?.post;
  
  // Stato per gestire l'apertura del Lightbox
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Gestione tasto ESC per chiudere il lightbox
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  if (!post) {
    return (
      <div className="news-detail-page" style={{ textAlign: "center" }}>
        <h3 style={{ color: "#ff4500" }}>Nessun dato disponibile</h3>
        <p>Torna alla lista per selezionare una notizia.</p>
        <Button
          variant="secondary"
          onClick={() => navigate("/news")}
          className="mt-3"
        >
          ← Torna alle news
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="news-detail-page">
        {/* 1. IMMAGINE HERO (In alto, estetica) */}
        {post.image && (
          <img 
            src={post.image} 
            alt={post.title} 
            className="news-detail-hero" 
          />
        )}

        {/* Titolo e Meta Info */}
        <h2 
          className="news-detail-title" 
          dangerouslySetInnerHTML={{ __html: post.title }} 
        />

        <div className="news-detail-meta">
          <span>{post.author}</span>
          <span>•</span>
          <span>{post.date}</span>
        </div>

        {/* Contenuto Testuale */}
        <div
          className="news-detail-content"
          dangerouslySetInnerHTML={{ __html: post.content || post.preview }}
        />

        {/* 2. IMMAGINE CLICCABILE (Miniatura al 25%) */}
        {post.image && (
          <div 
            className="news-image-preview-container" 
            onClick={() => setIsLightboxOpen(true)}
          >
            <img 
              src={post.image} 
              alt="Clicca per ingrandire" 
              className="news-detail-image-preview" 
              title="Clicca per visualizzare a tutto schermo"
            />
            <div className="news-image-caption">
              🔍 Ingrandisci allegato
            </div>
          </div>
        )}

        <div className="news-detail-footer">
          <Button
            variant="secondary"
            onClick={() => navigate("/news")}
          >
            ← Torna alla lista
          </Button>
        </div>
      </div>

      {/* --- LIGHTBOX MODAL --- */}
      {isLightboxOpen && post.image && (
        <div 
          className="news-lightbox-overlay" 
          onClick={() => setIsLightboxOpen(false)}
        >
          <button className="news-lightbox-close" aria-label="Chiudi">
            ✕
          </button>
          <img 
            src={post.image} 
            alt="Ingrandimento notizia" 
            className="news-lightbox-image"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </>
  );
}