import React from 'react';
import { Link } from 'react-router-dom';
import { FaHouse, FaTriangleExclamation } from "react-icons/fa6";
import "../css/NotFoundPage.css";

export default function NotFoundPage() {
  return (
    <div className="nfp-root">
      {/* Background Shapes */}
      <div className="nfp-bg-shape shape-1"></div>
      <div className="nfp-bg-shape shape-2"></div>

      <div className="nfp-content-card">
        
        <h1 className="nfp-title-glitch" data-text="404">
          404
        </h1>
        
        <h2 className="nfp-subtitle">
          Pagina non trovata
        </h2>
        
        <p className="nfp-description">
          Ci scusiamo per l'inconveniente. La risorsa che stai cercando potrebbe essere stata rimossa, rinominata o non è momentaneamente disponibile.
        </p>

        <Link to="/" className="nfp-home-btn">
          <FaHouse /> Torna alla Home
        </Link>
      </div>
    </div>
  );
}