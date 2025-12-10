import React from 'react';
import "../css/SponsorPage.css";
import sponsorsData from "../data/Sponsor.json";

export default function SponsorPage() {
  // Destrutturiamo i dati dal JSON
  const { header, sponsors } = sponsorsData;

  return (
    // Usa 'spn-fade-in' per evitare conflitti di animazione
    <div className="sponsor-page spn-fade-in">
      <div className="sponsor-container">
        
        <header className="sponsor-header">
          <h1 className="page-title">
            {header.titlePrefix} <span className="text-gradient">{header.titleHighlight}</span>
          </h1>
          <p className="page-subtitle">
            {header.subtitle}
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
                    loading="lazy"
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