import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AboutSection from "./AboutSection";
import { getLatestPostsByCategory } from "../../api/API.mjs";
import { FaCalendarAlt, FaMapMarkerAlt, FaClock, FaArrowRight, FaYoutube, FaCircle, FaNewspaper } from "react-icons/fa";
import "../../css/HomePage.css";

export default function HomePage() {
  const [latestNews, setLatestNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // --- DATI SIMULATI: CALENDARIO ---
  const upcomingEvents = [
    { id: 1, day: "24", month: "SET", title: "Open Day Minivolley", time: "17:00", location: "Palestra Cartiera", category: "Volley" },
    { id: 2, day: "28", month: "SET", title: "Prima Squadra Calcio vs Real Torino", time: "20:30", location: "Campo Borgo Vittoria", category: "Calcio" },
    { id: 3, day: "02", month: "OTT", title: "Basket U19 - Amichevole", time: "18:30", location: "Palestra Cartiera", category: "Basket" },
    { id: 4, day: "15", month: "OTT", title: "Festa di Inizio Stagione", time: "19:00", location: "Sede PSD", category: "Evento" },
  ];

  // Helper per creare date di test relative a "oggi" (solo per demo)
  const today = new Date();
  const getTestDate = (hoursOffset) => {
    const d = new Date(today);
    d.setHours(today.getHours() + hoursOffset); 
    return d.toISOString(); // Formato ISO per simulare DB
  };

  // --- DATI SIMULATI: DIRETTE (Con Date ISO Reali) ---
  const liveMatches = [
    { 
      id: 101, 
      teamA: "PSD Volley", 
      teamB: "Lasalliano", 
      matchDate: getTestDate(0), // Inizia ORA (quindi LIVE)
    },
    { 
      id: 102, 
      teamA: "PSD Calcio", 
      teamB: "Real Torino", 
      matchDate: getTestDate(2), // Tra 2 ore (UPCOMING)
    },
  ];

  // --- LOGICA STATUS PARTITA ---
  // Ritorna: "LIVE", "UPCOMING", "ENDED"
  const getMatchStatus = (matchDateISO) => {
    const now = new Date();
    const matchTime = new Date(matchDateISO);
    
    // Differenza in minuti
    const diffMs = matchTime - now;
    const diffMinutes = Math.floor(diffMs / 1000 / 60);

    // Regola: 
    // - Se manca meno di 30 min all'inizio (diffMinutes <= 30) E non è finita da troppo (es. -120 min), è LIVE.
    // - Nota: Se diffMinutes è negativo, la partita è già iniziata.
    
    if (diffMinutes <= 30 && diffMinutes > -150) { 
        return "LIVE"; // Da 30 min prima a 2.5 ore dopo l'inizio
    } else if (diffMinutes > 30) {
        return "UPCOMING";
    } else {
        return "ENDED";
    }
  };

  // Helper per formattare l'orario (es. 20:30)
  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // --- FETCH NEWS ---
  useEffect(() => {
    let mounted = true;
    async function fetchNews() {
      try {
        const grouped = await getLatestPostsByCategory();
        let allNews = [];
        
        if (grouped) {
            Object.values(grouped).forEach(categoryNews => {
                if (Array.isArray(categoryNews)) {
                    allNews = [...allNews, ...categoryNews];
                }
            });
        }

        // Ordina per ID decrescente
        allNews.sort((a, b) => b.id - a.id);

        // Prendi le prime 5
        const top5News = allNews.slice(0, 5); 

        if (mounted) {
          setLatestNews(top5News);
          setLoading(false);
        }
      } catch (err) {
        console.error("Errore fetch news:", err);
        if (mounted) setLoading(false);
      }
    }
    fetchNews();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="hp-root">
      <AboutSection />

      <div className="hp-main-container">
        
        <div className="hp-grid-layout">
            
            {/* 🔴 COLONNA 1: LIVE MATCHES */}
            <aside className="hp-col hp-col-live">
              <div className="column-header">
                <h3 className="col-title text-danger">
                  <FaCircle className="live-pulse-icon" /> Dirette
                </h3>
              </div>
              
              <div className="live-list">
                {liveMatches.map((match) => {
                  const status = getMatchStatus(match.matchDate);
                  // Se la partita è finita, potremmo decidere di non mostrarla o mostrarla diversamente.
                  // Qui la mostriamo comunque per demo.
                  
                  return (
                    <div key={match.id} className="live-card-simple">
                      <div className="lcs-header">
                        {status === "LIVE" ? (
                          <span className="hp-badge badge-danger">IN ONDA</span>
                        ) : (
                          <span className="hp-badge badge-secondary">OGGI {formatTime(match.matchDate)}</span>
                        )}
                        <FaYoutube className="yt-icon" />
                      </div>
                      
                      <div className="lcs-match-info">
                        <div className="lcs-teams">
                          <span className="team">{match.teamA}</span>
                          <span className="vs">vs</span>
                          <span className="team">{match.teamB}</span>
                        </div>
                      </div>

                      <a 
                        href="https://youtube.com/@PolisportivaSanDonato" 
                        target="_blank" 
                        rel="noreferrer"
                        className={`hp-btn ${status === "LIVE" ? "btn-danger" : "btn-outline"}`}
                      >
                        Guarda ora
                      </a>
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* 📰 COLONNA 2: NEWS FEED */}
            <main className="hp-col hp-col-news">
              <div className="column-header">
                <h3 className="col-title"><FaNewspaper /> Ultime Notizie</h3>
              </div>

              {loading ? (
                <div className="loader-container"><div className="loader"></div></div>
              ) : (
                <div className="news-feed-list">
                  {latestNews.map((news) => (
                    <div 
                      key={news.id} 
                      className="news-feed-card" 
                      onClick={() => navigate(`/news/${news.id}`, { state: { post: news } })}
                    >
                      <div 
                        className="nfc-image" 
                        style={{ backgroundImage: `url(${news.image || "/placeholder.jpg"})` }}
                      ></div>
                      <div className="nfc-content">
                        <span className="nfc-meta">{news.date} • {news.category}</span>
                        <h4 className="nfc-title">{news.title}</h4>
                        <span className="nfc-link">Leggi <FaArrowRight /></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="view-all-wrapper">
                 <button className="hp-btn btn-link" onClick={() => navigate('/news')}>
                   Vedi tutte le notizie
                 </button>
              </div>
            </main>

            {/* 📅 COLONNA 3: CALENDARIO */}
            <aside className="hp-col hp-col-calendar">
              <div className="column-header">
                <h3 className="col-title"><FaCalendarAlt /> Calendario</h3>
              </div>

              <div className="events-list">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="event-row">
                    <div className="event-date-box">
                      <span className="ev-day">{event.day}</span>
                      <span className="ev-month">{event.month}</span>
                    </div>
                    <div className="event-details">
                      <div className="ev-meta">
                        <span className={`ev-tag tag-${event.category.toLowerCase()}`}>{event.category}</span>
                        <span className="ev-time"><FaClock /> {event.time}</span>
                      </div>
                      <h4 className="ev-title">{event.title}</h4>
                      <p className="ev-location"><FaMapMarkerAlt /> {event.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>

        </div>
      </div>
    </div>
  );
}