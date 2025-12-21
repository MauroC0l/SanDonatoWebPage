import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Button from "react-bootstrap/Button";
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

  // --- LOGICA IMMAGINE ---
  // Determina quale immagine mostrare: quella del post o il placeholder
  const placeholderImage = "/logo-poli-sfondo.jpg";
  const displayImage = post.image || placeholderImage;
  const imageAltText = post.image ? post.title : "Placeholder Polisportiva";

  return (
    <>
      <div className="news-detail-page">
        {/* 1. IMMAGINE HERO (In alto, ora cliccabile e con placeholder se manca l'originale) */}
        <img 
          src={displayImage} 
          alt={imageAltText} 
          className="news-detail-hero" 
          onClick={() => setIsLightboxOpen(true)}
          title="Clicca per ingrandire a tutto schermo"
          style={{ cursor: "pointer" }} // Indica che è cliccabile
        />

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

        {/* SEZIONE RIMOSSA:
           L'allegato cliccabile in fondo alla pagina è stato rimosso come richiesto.
        */}

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
      {/* Mostra il lightbox se lo stato è true. Usa displayImage. */}
      {isLightboxOpen && (
        <div 
          className="news-lightbox-overlay" 
          onClick={() => setIsLightboxOpen(false)}
        >
          <button className="news-lightbox-close" aria-label="Chiudi">
            ✕
          </button>
          <img 
            src={displayImage} 
            alt="Ingrandimento notizia" 
            className="news-lightbox-image"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </>
  );
}