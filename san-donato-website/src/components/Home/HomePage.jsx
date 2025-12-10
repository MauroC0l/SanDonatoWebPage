import React, { useEffect, useState } from "react";
import { Container, Row, Col, Button, Badge } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import AboutSection from "./AboutSection";
import { getLatestPostsByCategory } from "../../api/API.mjs";
import { FaCalendarAlt, FaMapMarkerAlt, FaClock, FaArrowRight, FaYoutube, FaCircle } from "react-icons/fa";
// Importazione dello stile CSS
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

  // --- DATI SIMULATI: DIRETTE (LIVE MATCHES) ---
  const liveMatches = [
    { id: 101, status: "LIVE", teamA: "PSD Volley", teamB: "Lasalliano", link: "https://youtube.com/live/..." },
    { id: 102, status: "UPCOMING", time: "20:30", teamA: "PSD Calcio", teamB: "Real Torino", link: "https://youtube.com/live/..." },
  ];

  // --- FETCH NEWS ---
  useEffect(() => {
    let mounted = true;

    async function fetchNews() {
      try {
        const grouped = await getLatestPostsByCategory();
        let allNews = [];
        
        // Controllo di sicurezza e unione categorie
        if (grouped) {
            Object.values(grouped).forEach(categoryNews => {
            if (Array.isArray(categoryNews)) allNews = [...allNews, ...categoryNews];
            });
        }
        
        // Prendiamo le prime 3 news più recenti
        const sortedNews = allNews.slice(0, 3);

        if (mounted) {
          setLatestNews(sortedNews);
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
      {/* Hero Section (Carosello Immagini) */}
      <AboutSection />

      <Container className="hp-main-container">
        
        {/* --- SEZIONE 1: ULTIME NOTIZIE (Full Width) --- */}
        <section className="hp-section news-section">
          <div className="section-header text-center">
            <h2 className="section-title">Ultime Notizie</h2>
            <p className="section-subtitle">Dal campo alla community</p>
          </div>

          {loading ? (
            <div className="loader-container"><div className="loader"></div></div>
          ) : (
            <div className="latest-news-grid">
              {latestNews.map((news) => (
                <div key={news.id} className="news-card-modern" onClick={() => navigate(`/news/${news.id}`, { state: { post: news } })}>
                  <div className="ncm-image-wrapper">
                    <img src={news.image || "/placeholder.jpg"} alt={news.title} loading="lazy" />
                    <span className="ncm-category-badge">{news.category || "News"}</span>
                  </div>
                  <div className="ncm-content">
                    <span className="ncm-date">{news.date}</span>
                    <h3 className="ncm-title">{news.title}</h3>
                    <span className="ncm-link">Leggi <FaArrowRight /></span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="text-center mt-4">
             <Button variant="outline-primary" className="btn-view-all" onClick={() => navigate('/news')}>Tutte le notizie</Button>
          </div>
        </section>

        {/* --- SEZIONE 2: LAYOUT SPLIT --- */}
        <section className="hp-section split-section">
          <Row className="gy-5 gx-lg-5"> 
            
            {/* 🔴 COLONNA SINISTRA (Desktop) / PRIMA (Mobile): LIVE MATCHES */}
            <Col lg={4} md={12} className="live-column">
              <div className="live-matches-wrapper">
                <div className="section-header text-start mb-4">
                  <h2 className="section-title text-danger" style={{ fontSize: '2rem' }}>
                    <FaCircle className="live-pulse-icon" /> Dirette
                  </h2>
                  <p className="section-subtitle">Guarda le partite in streaming</p>
                </div>

                <div className="live-list">
                  {liveMatches.map((match) => (
                    <div key={match.id} className="live-card-simple">
                      
                      {/* Header Card: Status */}
                      <div className="lcs-header">
                        {match.status === "LIVE" ? (
                          <Badge bg="danger" className="live-badge">IN ONDA</Badge>
                        ) : (
                          <Badge bg="secondary" className="upcoming-badge">OGGI {match.time}</Badge>
                        )}
                        <FaYoutube className="yt-icon" />
                      </div>
                      
                      {/* Match Info: Squadra vs Squadra (NO Punteggio) */}
                      <div className="lcs-match-info">
                        <div className="lcs-teams">
                          <span className="team">{match.teamA}</span>
                          <span className="vs">vs</span>
                          <span className="team">{match.teamB}</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <Button 
                        href={match.link} 
                        target="_blank" 
                        variant={match.status === "LIVE" ? "danger" : "outline-dark"} 
                        className="btn-watch-live"
                        size="sm"
                      >
                        {match.status === "LIVE" ? "Guarda Ora" : "Vai al canale"}
                      </Button>
                    </div>
                  ))}
                  
                  {/* Promo Box */}
                  <div className="channel-promo-box">
                    <span>Non ci sono altre dirette?</span>
                    <a href="https://youtube.com/@PolisportivaSanDonato" target="_blank" rel="noreferrer">
                      Visita l'archivio video →
                    </a>
                  </div>
                </div>
              </div>
            </Col>

            {/* 📅 COLONNA DESTRA (Desktop) / SECONDA (Mobile): CALENDARIO */}
            <Col lg={8} md={12} className="calendar-column">
              <div className="calendar-wrapper">
                <div className="section-header text-start mb-4">
                  <h2 className="section-title" style={{ fontSize: '2rem' }}>Prossimi Eventi</h2>
                  <p className="section-subtitle">Il calendario della settimana</p>
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
              </div>
            </Col>

          </Row>
        </section>

      </Container>
    </div>
  );
}