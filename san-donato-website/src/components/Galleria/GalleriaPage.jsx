import React, { useState } from 'react';
import { FaGift, FaFutbol, FaBasketballBall, FaVolleyballBall } from "react-icons/fa";
import '../../css/GalleriaPage.css';

const GalleriaPage = () => {
  const [ballIndex, setBallIndex] = useState(0);

  const balls = [
    <FaBasketballBall key="basket" />, 
    <FaVolleyballBall key="volley" />, 
    <FaFutbol key="calcio" />          
  ];

  // Cambia palla solo quando l'animazione completa un ciclo intero (esce dallo schermo)
  const handleAnimationRepeat = () => {
    setBallIndex((prevIndex) => (prevIndex + 1) % balls.length);
  };

  return (
    <div className="galleria-page-container">
      <div className="galleria-card">
        <div className="icon-wrapper">
          <FaGift className="surprise-icon" />
        </div>
        <h1 className="galleria-title">Galleria</h1>
        <p className="galleria-message">
          Questa pagina non è ancora pronta.. <br />
          sarà una sorpresa per il 2026!
        </p>
        
        {/* --- LOADER PALLA CHE RIMBALZA --- */}
        <div className="bounce-loader-container">
          <div className="floor-line"></div>
          
          {/* Wrapper che gestisce il movimento orizzontale (X) */}
          <div 
            className="moving-wrapper" 
            onAnimationIteration={handleAnimationRepeat}
          >
             {/* Icona che gestisce i rimbalzi (Y) e la rotazione */}
             <div className="bouncing-icon">
                {balls[ballIndex]}
             </div>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default GalleriaPage;