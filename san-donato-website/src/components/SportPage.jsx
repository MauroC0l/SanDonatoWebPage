import { useState } from "react";
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

// --- DATA STRUCTURE (Dati estratti dalle immagini 2025-2026) ---
const SPORTS_DATA = {
  basket: {
    title: "Basket",
    color: "#ff6600",
    icon: <FaBasketballBall />,
    description: "Passione, tecnica e gioco di squadra. Dalla formazione Under 19 agli Open.",
    groups: [
      {
        name: "Open Maschile",
        years: "Adulti",
        location: "Palestra Cartiera",
        address: "Via Fossano 8, Torino",
        times: [
          { day: "Lunedì", hours: "20:30 - 22:30" },
          { day: "Venerdì", hours: "20:30 - 22:30" }
        ]
      },
      {
        name: "U19 Maschile",
        years: "Under 19",
        location: "Palestra Cartiera",
        address: "Via Fossano 8, Torino",
        times: [
          { day: "Lunedì", hours: "19:00 - 22:00" },
          { day: "Venerdì", hours: "17:00 - 18:30" }
        ]
      }
    ]
  },
  calcio: {
    title: "Calcio",
    color: "#0056d6", // Blu Istituzionale
    icon: <FaFutbol />,
    description: "Dai primi calci alla Prima Squadra. Tre sedi dedicate per ogni fascia d'età.",
    groups: [
      {
        name: "Prima Squadra",
        years: "Adulti",
        location: "Campo Borgo Vittoria",
        address: "Via Paolo Veronese 173/A, Torino",
        times: [
          { day: "Martedì", hours: "21:00 - 23:00" },
          { day: "Giovedì", hours: "21:00 - 23:00" }
        ]
      },
      {
        name: "Over 18 CSI",
        years: "Adulti",
        location: "Campo Borgo Vittoria",
        address: "Via Paolo Veronese 173/A, Torino",
        times: [
          { day: "Lunedì", hours: "20:00 - 22:00" },
          { day: "Mercoledì", hours: "20:00 - 22:00" }
        ]
      },
      {
        name: "Annate 2007-2009",
        years: "Giovani",
        location: "Campo Borgo Vittoria",
        address: "Via Paolo Veronese 173/A, Torino",
        times: [
          { day: "Martedì", hours: "18:30 - 20:30" },
          { day: "Giovedì", hours: "18:30 - 20:30" }
        ]
      },
      {
        name: "Annate 2010-2011",
        years: "Calcio a 11",
        location: "Campo Borgo Vittoria",
        address: "Via Paolo Veronese 173/A, Torino",
        times: [
          { day: "Martedì", hours: "17:00 - 19:00" },
          { day: "Giovedì", hours: "17:00 - 19:00" }
        ]
      },
      {
        name: "Annate 2012-2013",
        years: "Calcio a 11 / Esordienti",
        location: "Campo Borgo Vittoria",
        address: "Via Paolo Veronese 173/A, Torino",
        times: [
          { day: "Martedì", hours: "17:00 - 19:00" },
          { day: "Giovedì", hours: "17:00 - 19:00" }
        ]
      },
      {
        name: "Annate 2013-2014",
        years: "Calcio a 7",
        location: "Campo Sant'Alfonso",
        address: "Via Netro 3, Torino",
        times: [
          { day: "Lunedì", hours: "19:15 - 21:15" },
          { day: "Giovedì", hours: "19:15 - 21:15" }
        ]
      },
      {
        name: "Annate 2015-2016",
        years: "Calcio a 7",
        location: "Campo Sant'Alfonso",
        address: "Via Netro 3, Torino",
        times: [
          { day: "Lunedì", hours: "16:45 - 18:45" },
          { day: "Giovedì", hours: "16:45 - 18:45" }
        ]
      },
      {
        name: "Annate 2017-2018",
        years: "Scuola Calcio PRO",
        location: "Campo Sant'Alfonso",
        address: "Via Netro 3, Torino",
        times: [
          { day: "Mercoledì", hours: "17:15 - 19:15" }
        ]
      },
      {
        name: "Annate 2018-2019",
        years: "Scuola Calcio START",
        location: "Sede Oratorio S. Donato",
        address: "Via Le Chiuse 20/A, Torino",
        times: [
          { day: "Mercoledì", hours: "17:15 - 19:15" }
        ]
      }
    ]
  },
  volley: {
    title: "Volley",
    color: "#ff6600",
    icon: <FaVolleyballBall />,
    description: "Dal Minivolley alle Eccellenze. [cite_start]Unisciti a noi per la stagione 2025-2026[cite: 3].",
    extraInfo: "Ricerca atlete per rinforzare organici 2025/26. Contattare Davide: 328-3922664",
    groups: [
      {
        name: "Misto Adulti (UISP/League)",
        years: "Adulti",
        location: "Palestra Cartiera",
        address: "Via Fossano 8, Torino",
        times: [
          { day: "Martedì", hours: "21:00 - 23:00" },
          { day: "Giovedì", hours: "21:00 - 23:00" }
        ]
      },
      {
        name: "Eccellenza \"A\"",
        years: "Femminile",
        location: "Palestra Cartiera",
        address: "Via Fossano 8, Torino",
        times: [
          { day: "Lunedì", hours: "20:00 - 22:00" },
          { day: "Giovedì", hours: "20:00 - 22:00" }
        ]
      },
      {
        name: "Eccellenza \"B\"",
        years: "Femminile",
        location: "Palestra Cartiera",
        address: "Via Fossano 8, Torino",
        times: [
          { day: "Mercoledì", hours: "21:00 - 23:00" },
          { day: "Venerdì", hours: "21:00 - 23:00" }
        ]
      },
      {
        name: "U18 Femminile",
        years: "Nate 2008/09/10",
        location: "Palestra Cartiera",
        address: "Via Fossano 8, Torino",
        times: [
          { day: "Mercoledì", hours: "19:00 - 21:00" },
          { day: "Venerdì", hours: "18:30 - 20:30" }
        ]
      },
      {
        name: "U17 Femminile",
        years: "Nate 2009/10",
        location: "Palestra Cartiera",
        address: "Via Fossano 8, Torino",
        times: [
          { day: "Martedì", hours: "18:00 - 20:00" },
          { day: "Giovedì", hours: "18:00 - 20:00" }
        ]
      },
      {
        name: "U15 Femminile",
        years: "Nate 2011/12",
        location: "Palestra Cartiera",
        address: "Via Fossano 8, Torino",
        times: [
          { day: "Lunedì", hours: "18:00 - 20:00" },
          { day: "Giovedì", hours: "18:00 - 20:00" }
        ]
      },
      {
        name: "U14 Femminile",
        years: "Nate 2012/13",
        location: "Palestra Cartiera",
        address: "Via Fossano 8, Torino",
        times: [
          { day: "Lunedì", hours: "17:00 - 19:00" },
          { day: "Mercoledì", hours: "17:00 - 19:00" }
        ]
      }
    ]
  }
};

export default function SportPage() {
  const [activeTab, setActiveTab] = useState("calcio"); // Default tab

  const activeData = SPORTS_DATA[activeTab];

  return (
    <div className="sp-page-wrapper fade-in">
      
      {/* HEADER */}
      <header className="sp-header">
        <h1 className="sp-main-title">
          Stagione <span className="sp-highlight">2025/2026</span>
        </h1>
        <p className="sp-subtitle">
          Scegli il tuo sport, trova la tua squadra, scendi in campo.
        </p>
      </header>

      {/* TABS NAVIGATION */}
      <div className="sp-tabs-container">
        <div className="sp-tabs-wrapper">
          {Object.keys(SPORTS_DATA).map((key) => (
            <button
              key={key}
              className={`sp-tab-button ${activeTab === key ? "active" : ""}`}
              onClick={() => setActiveTab(key)}
              style={{
                "--tab-color": SPORTS_DATA[key].color
              }}
            >
              <span className="sp-tab-icon">{SPORTS_DATA[key].icon}</span>
              <span className="sp-tab-label">{SPORTS_DATA[key].title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="sp-content-area">
        
        {/* Intro Sport Selezionato */}
        <div className="sp-sport-intro fade-in-up" key={`${activeTab}-intro`}>
          <h2 style={{ color: activeData.color }}>{activeData.title}</h2>
          <p>{activeData.description}</p>
          
          {/* Banner Volley Speciale */}
          {activeTab === 'volley' && (
             <div className="sp-alert-banner">
               <FaPhoneAlt />
               <div>
                 <strong>Vuoi giocare con noi?</strong>
                 <span>{activeData.extraInfo}</span>
               </div>
             </div>
          )}
        </div>

        {/* Griglia Orari */}
        <div className="sp-schedule-grid fade-in-up" key={`${activeTab}-grid`}>
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
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(group.address)}`} 
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
          Gli orari potrebbero subire variazioni. Per i gruppi Minivolley e Under 12/13 Volley non presenti in elenco, 
          [cite_start]contattare direttamente la segreteria o il responsabile tecnico[cite: 3].
        </p>
      </div>

    </div>
  );
}