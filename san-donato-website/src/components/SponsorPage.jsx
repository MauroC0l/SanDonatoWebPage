import React from 'react';
import { FaArrowRight } from "react-icons/fa";
import "../css/SponsorPage.css";

// IMPORT DATI JSON
import sponsorsData from "../data/Sponsor.json";

export default function SponsorPage() {
  const { header, list } = sponsorsData;

  return (
    // Usa 'spn-fade-in' per un'animazione specifica che non confligge
    <div className="spn-page-wrapper spn-fade-in">
      <div className="spn-container">
        
        {/* HEADER */}
        <header className="spn-header">
          <h1 className="spn-title">
            {header.titlePrefix} <span className="spn-text-gradient">{header.titleHighlight}</span>
          </h1>
          <p className="spn-subtitle">
            {header.subtitle}
          </p>
          <div className="spn-divider"></div>
        </header>

        {/* GRIGLIA SPONSOR */}
        <div className="spn-grid">
          {list.map((sponsor, index) => (
            <a 
              key={index} 
              href={sponsor.link} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="spn-card"
              // Staggered animation: appaiono in sequenza
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="spn-card-content">
                <div className="spn-image-wrapper">
                  <img
                    src={sponsor.image}
                    alt={`Logo ${sponsor.name}`}
                    className="spn-image"
                    loading="lazy"
                  />
                </div>
                
                <div className="spn-meta">
                  <h3 className="spn-name">{sponsor.name}</h3>
                  <div className="spn-visit-link">
                    Visita Sito <FaArrowRight className="spn-icon-arrow" />
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