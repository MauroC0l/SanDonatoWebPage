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

  const handleAnimationRepeat = (e) => {
    if (e.animationName === 'moveLeftToRight') {
      setBallIndex((prevIndex) => (prevIndex + 1) % balls.length);
    }
  };

  return (
    <div className="galleria-page-container">
      {/* Macchie di colore che si muovono piano dietro alla scheda: la
          pagina è un "arriva presto", e un fondo vivo lo dice meglio di
          un grigio fermo. */}
      <div className="mv-aurora" aria-hidden="true" />
      <div className="galleria-card" data-inclina="5">
        <div className="icon-wrapper">
          <FaGift className="surprise-icon" />
        </div>
        <h1 className="galleria-title">Galleria</h1>
        <p className="galleria-message">
          Questa pagina non è ancora pronta.. <br />
          sarà una sorpresa per il 2027!
        </p>
        
        {/* --- LOADER PALLA CHE RIMBALZA --- */}
        <div className="bounce-loader-container">
          <div className="floor-line"></div>
          
          {/* Wrapper Movimento Orizzontale */}
          <div 
            className="moving-wrapper" 
            onAnimationIteration={handleAnimationRepeat}
          >
             {/* Wrapper Movimento Verticale */}
             <div className="bouncing-wrapper">
                
                {/* Icona Rotazione */}
                <div className="spinning-icon">
                   {balls[ballIndex]}
                </div>

             </div>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default GalleriaPage;