import React from 'react';
import "../css/SponsorPage.css";

export default function SponsorPage() {
  const sponsors = [
    { name: "Arcobaleno", image: "/immaginiSponsor/ARCOBALENO.jpg", link: "https://cooparcobaleno.net/" },
    { name: "Brillo", image: "/immaginiSponsor/BRILLO.png", link: "https://brillodetergenza.it/" },
    { name: "Da Michi", image: "/immaginiSponsor/DA MICHI.png", link: "https://ristorantepizzeriadamichi.it/" },
    { name: "Disgelo", image: "/immaginiSponsor/DISGELO.png", link: "https://www.ildisgelo.it/" },
    { name: "GMT", image: "/immaginiSponsor/GMT.png", link: "https://www.ingrossobiancheriagmt.com/" },
    { name: "La Tosca", image: "/immaginiSponsor/LA TOSCA.png", link: "https://www.gelaterialatosca.it/" },
    { name: "Tecnorete", image: "/immaginiSponsor/tecnorete.png", link: "https://www.tecnorete.it/" },
    { name: "Zoe Home Studio", image: "/immaginiSponsor/zhs.png", link: "https://www.zoehomestudio.it/" },
  ];

  return (
    <div className="sponsor-page fade-in">
      <div className="sponsor-container">
        <header className="sponsor-header">
          <h1 className="page-title">
            I Nostri <span className="text-gradient">Partner</span>
          </h1>
          <p className="page-subtitle">
            Realtà d'eccellenza che sostengono il nostro progetto.
          </p>
        </header>

        <div className="sponsor-grid">
          {sponsors.map((sponsor, index) => (
            <a 
              key={index} 
              href={sponsor.link} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="sponsor-card"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="card-content">
                <div className="image-wrapper">
                  <img
                    src={sponsor.image}
                    alt={`Logo ${sponsor.name}`}
                    className="sponsor-image"
                  />
                </div>
                <div className="sponsor-meta">
                  <h3 className="sponsor-name">{sponsor.name}</h3>
                  <div className="visit-arrow">
                    Visita <span className="arrow">→</span>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}