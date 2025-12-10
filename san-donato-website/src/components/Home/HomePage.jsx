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

  // --- DATI SIMULATI ---
  const upcomingEvents = [
    { id: 1, day: "24", month: "SET", title: "Open Day Minivolley", time: "17:00", location: "Palestra Cartiera", category: "Volley" },
    { id: 2, day: "28", month: "SET", title: "Prima Squadra Calcio vs Real Torino", time: "20:30", location: "Campo Borgo Vittoria", category: "Calcio" },
    { id: 3, day: "02", month: "OTT", title: "Basket U19 - Amichevole", time: "18:30", location: "Palestra Cartiera", category: "Basket" },
    { id: 4, day: "15", month: "OTT", title: "Festa di Inizio Stagione", time: "19:00", location: "Sede PSD", category: "Evento" },
  ];

  const liveMatches = [
    { id: 101, status: "LIVE", teamA: "PSD Volley", teamB: "Lasalliano", link: "https://youtube.com/live/..." },
    { id: 102, status: "UPCOMING", time: "20:30", teamA: "PSD Calcio", teamB: "Real Torino", link: "https://youtube.com/live/..." },
  ];

  useEffect(() => {
    let mounted = true;
    async function fetchNews() {
      try {
        const grouped = await getLatestPostsByCategory();
        let allNews = [];
        
        // 1. Estrai tutte le news da tutte le categorie
        if (grouped) {
            Object.values(grouped).forEach(categoryNews => {
                if (Array.isArray(categoryNews)) {
                    allNews = [...allNews, ...categoryNews];
                }
            });
        }

        // 2. ORDINAMENTO DECRESCENTE (Più recente in alto)
        // Se hai un campo data ISO stringa (es: "2023-10-27"), usa questo (è il più sicuro):
        // allNews.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Se non hai la data e ti basi sull'ID incrementale:
        allNews.sort((a, b) => b.id - a.id);

        // 3. Prendi le prime 5
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
                  <FaCircle className="live-pulse-icon" /> Live
                </h3>
              </div>
              
              <div className="live-list">
                {liveMatches.map((match) => (
                  <div key={match.id} className="live-card-simple">
                    <div className="lcs-header">
                      {match.status === "LIVE" ? (
                        <span className="hp-badge badge-danger">IN ONDA</span>
                      ) : (
                        <span className="hp-badge badge-secondary">OGGI {match.time}</span>
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
                      href={match.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={`hp-btn ${match.status === "LIVE" ? "btn-danger" : "btn-outline"}`}
                    >
                      {match.status === "LIVE" ? "Guarda Ora" : "Vai al canale"}
                    </a>
                  </div>
                ))}
                
                <div className="channel-promo-box">
                  <a href="https://youtube.com/@PolisportivaSanDonato" target="_blank" rel="noreferrer">
                    Vai al canale YouTube →
                  </a>
                </div>
              </div>
            </aside>

            {/* 📰 COLONNA 2: NEWS FEED (Centrale) - Mostra le Top 5 dall'API */}
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