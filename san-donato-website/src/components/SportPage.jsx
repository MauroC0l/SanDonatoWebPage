import React, { useState } from "react";
import { 
  FaBasketballBall, 
  FaFutbol, 
  FaVolleyballBall, 
  FaMapMarkerAlt, 
  FaClock, 
  FaCalendarAlt,
  FaPhoneAlt,
  FaInfoCircle
} from "react-icons/fa";
import "../css/SportPage.css";

// IMPORTIAMO I DATI DAL JSON
// Assicurati che il percorso sia corretto rispetto a dove hai salvato il file json
import sportsData from "../data/SportPage.json"; 

import dynamicData from "../data/Data.json";


// MAPPA DELLE ICONE
// Il JSON contiene stringhe (es: "basket"), noi le associamo ai componenti React qui
const ICON_MAP = {
  basket: <FaBasketballBall />,
  calcio: <FaFutbol />,
  volley: <FaVolleyballBall />
};

export default function SportPage() {
  const [activeTab, setActiveTab] = useState("calcio"); // Default tab

  // Recupera i dati attivi dal file JSON importato
  const activeData = sportsData[activeTab];

  return (
    // Ho applicato la classe "sp-fade-in" suggerita per evitare il problema dello schermo bianco
    <div className="sp-page-wrapper sp-fade-in">
      
      {/* HEADER */}
      <header className="sp-header">
        <h1 className="sp-main-title">
          Stagione <span className="sp-highlight">{dynamicData.anno}</span>
        </h1>
        <p className="sp-subtitle">
          Scegli il tuo sport, trova la tua squadra, scendi in campo.
        </p>
      </header>

      {/* TABS NAVIGATION */}
      <div className="sp-tabs-container">
        <div className="sp-tabs-wrapper">
          {Object.keys(sportsData).map((key) => {
            const sport = sportsData[key];
            return (
              <button
                key={key}
                className={`sp-tab-button ${activeTab === key ? "active" : ""}`}
                onClick={() => setActiveTab(key)}
                style={{
                  "--tab-color": sport.color
                }}
              >
                {/* Usiamo la mappa per renderizzare l'icona corretta */}
                <span className="sp-tab-icon">{ICON_MAP[sport.iconKey]}</span>
                <span className="sp-tab-label">{sport.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="sp-content-area">
        
        {/* Intro Sport Selezionato */}
        <div className="sp-sport-intro sp-fade-in-up" key={`${activeTab}-intro`}>
          <h2 style={{ color: activeData.color }}>{activeData.title}</h2>
          <p>{activeData.description}</p>
          
          {/* Banner Volley Speciale (o qualsiasi sport con extraInfo) */}
          {activeData.extraInfo && (
             <div className="sp-alert-banner">
               <FaPhoneAlt />
               <div>
                 <strong>Info Utili:</strong>
                 <span>{activeData.extraInfo}</span>
               </div>
             </div>
          )}
        </div>

        {/* Griglia Orari */}
        <div className="sp-schedule-grid sp-fade-in-up" key={`${activeTab}-grid`}>
          {activeData.groups.map((group, index) => (
            <div 
              className="sp-card" 
              key={index}
              style={{ borderTopColor: activeData.color }}
            >
              <div className="sp-card-header">
                <h3 className="sp-group-name">{group.name}</h3>
                <span className="sp-group-badge">{group.years}</span>
              </div>
              
              <div className="sp-location-block">
                <FaMapMarkerAlt className="sp-icon-small" />
                <a 
                  href={`http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent(group.address)}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="sp-map-link"
                >
                  {group.location}
                  <small>{group.address}</small>
                </a>
              </div>

              <div className="sp-times-list">
                {group.times.map((time, tIndex) => (
                  <div className="sp-time-row" key={tIndex}>
                    <div className="sp-day">
                      <FaCalendarAlt className="sp-icon-tiny" /> {time.day}
                    </div>
                    <div className="sp-hour">
                      <FaClock className="sp-icon-tiny" /> {time.hours}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* FOOTER NOTE */}
      <div className="sp-footer-note">
        <FaInfoCircle /> 
        <p>
          Gli orari potrebbero subire variazioni. Per i gruppi non presenti in elenco, 
          contattare direttamente la segreteria o il responsabile tecnico.
        </p>
      </div>

    </div>
  );
}