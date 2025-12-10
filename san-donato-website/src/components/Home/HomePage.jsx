import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AboutSection from "./AboutSection";
import { getLatestPostsByCategory } from "../../api/API.mjs";
import { FaCalendarAlt, FaClock, FaArrowRight, FaYoutube, FaCircle, FaNewspaper, FaChevronLeft, FaChevronRight, FaMapMarkerAlt } from "react-icons/fa";
import "../../css/HomePage.css";

export default function HomePage() {
  const [latestNews, setLatestNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Refs per lo scroll orizzontale su mobile
  const liveListRef = useRef(null);
  const calendarListRef = useRef(null);

  // --- HELPER DATE (Simulazione dati dinamici) ---
  const today = new Date();
  
  // Genera una data ISO relativa a "adesso"
  const getTestDate = (daysOffset, hoursOffset = 0) => {
    const d = new Date(today);
    d.setDate(today.getDate() + daysOffset);
    d.setHours(today.getHours() + hoursOffset); 
    return d.toISOString();
  };

  // Genera giorno della settimana (es. "LUN")
  const getDayName = (dateISO) => {
    const d = new Date(dateISO);
    return d.toLocaleDateString('it-IT', { weekday: 'short' }).toUpperCase().replace('.', '');
  };

  // Genera data breve (es. "25/09")
  const getShortDate = (dateISO) => {
    const d = new Date(dateISO);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  };

  // --- DATI SIMULATI ---
  
  // 1. CALENDARIO: Genero eventi per i prossimi giorni (Settimana corrente)
  const weeklyEvents = [
    { id: 1, dateISO: getTestDate(0, 2), title: "Allenamento U19", location: "Palestra Cartiera", category: "Basket" },
    { id: 2, dateISO: getTestDate(1, -2), title: "Gara U14 vs Kolbe", location: "Sede PSD", category: "Volley" },
    { id: 3, dateISO: getTestDate(2, 4), title: "Partita 1^ Squadra", location: "Campo Borgo", category: "Calcio" },
    { id: 4, dateISO: getTestDate(3, 0), title: "Festa Inizio Anno", location: "Oratorio", category: "Evento" },
  ];

  // 2. PARTITE LIVE: Genero partite vicine (tra -2h e +12h)
  const allMatches = [
    { id: 101, teamA: "PSD Volley", teamB: "Lasalliano", matchDate: getTestDate(0, 0) }, // Inizia ORA
    { id: 102, teamA: "PSD Calcio", teamB: "Real Torino", matchDate: getTestDate(0, 3) }, // Tra 3 ore
    { id: 103, teamA: "Basket U19", teamB: "Crock", matchDate: getTestDate(1, 0) }, // Tra 24 ore (NON deve apparire)
  ];

  // Filtro: Solo partite da 2 ore fa a 12 ore nel futuro
  const displayedMatches = allMatches.filter(match => {
    const matchTime = new Date(match.matchDate);
    const diffHours = (matchTime - today) / (1000 * 60 * 60);
    return diffHours >= -2 && diffHours <= 12; 
  });

  // --- LOGICA STATUS & FORMATTING ---
  const getMatchStatus = (isoDate) => {
    const diffMs = new Date(isoDate) - new Date();
    const diffMin = Math.floor(diffMs / 60000); // minuti
    // Live se iniziata da meno di 2.5h (-150m) o inizia tra meno di 15m
    if (diffMin <= 15 && diffMin > -150) return "LIVE";
    return "UPCOMING";
  };

  const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // --- FETCH NEWS ---
  useEffect(() => {
    let mounted = true;
    async function fetchNews() {
      try {
        const grouped = await getLatestPostsByCategory();
        let allNews = [];
        if (grouped) {
            Object.values(grouped).forEach(cat => { if (Array.isArray(cat)) allNews.push(...cat); });
        }
        // Ordina per ID desc (assumendo ID più alto = più recente)
        allNews.sort((a, b) => b.id - a.id);
        
        if (mounted) { 
          setLatestNews(allNews.slice(0, 5)); // Prendi le prime 5
          setLoading(false); 
        }
      } catch (err) { console.error(err); if(mounted) setLoading(false); }
    }
    fetchNews();
    return () => { mounted = false; };
  }, []);

  // --- CAROUSEL SCROLL (Mobile) ---
  const scrollContainer = (ref, direction) => {
    if(ref.current) {
      const scrollAmount = 280; // Larghezza card approssimativa
      ref.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="hp-root">
      <AboutSection />

      <div className="hp-main-container">
        
        {/* GRIGLIA LAYOUT (Mobile: Flex Column / Desktop: Grid Areas) */}
        <div className="hp-grid-layout">
            
            {/* 1. LIVE MATCHES (Area: live) */}
            <aside className="hp-col hp-col-live">
              <div className="column-header">
                <h3 className="col-title text-danger"><FaCircle className="live-pulse-icon" /> Live Center</h3>
                <div className="mobile-arrows">
                  <button onClick={() => scrollContainer(liveListRef, 'left')}><FaChevronLeft/></button>
                  <button onClick={() => scrollContainer(liveListRef, 'right')}><FaChevronRight/></button>
                </div>
              </div>
              
              <div className="scroll-wrapper" ref={liveListRef}>
                {displayedMatches.length > 0 ? displayedMatches.map((match) => {
                  const status = getMatchStatus(match.matchDate);
                  return (
                    <div key={match.id} className="live-card-simple">
                      <div className="lcs-header">
                        {status === "LIVE" ? 
                          <span className="hp-badge badge-danger">IN ONDA</span> : 
                          <span className="hp-badge badge-secondary">OGGI {formatTime(match.matchDate)}</span>
                        }
                        <FaYoutube className="yt-icon" />
                      </div>
                      <div className="lcs-match-info">
                        <div className="lcs-teams">
                          <span className="team">{match.teamA}</span>
                          <span className="vs">vs</span>
                          <span className="team">{match.teamB}</span>
                        </div>
                      </div>
                      <a href="https://youtube.com/@PolisportivaSanDonato" target="_blank" rel="noreferrer" className={`hp-btn ${status === "LIVE" ? "btn-danger" : "btn-outline"}`}>
                        {status === "LIVE" ? "Guarda" : "Vai al canale"}
                      </a>
                    </div>
                  );
                }) : (
                  <div className="empty-state-box">
                    Nessuna diretta nelle prossime 12h
                  </div>
                )}
              </div>
            </aside>

            {/* 2. CALENDARIO (Area: calendar) */}
            {/* Su Mobile questo blocco appare per secondo come scritto qui. Su Desktop lo sposteremo a destra col CSS */}
            <aside className="hp-col hp-col-calendar">
              <div className="column-header">
                <h3 className="col-title"><FaCalendarAlt /> Questa Settimana</h3>
                <div className="mobile-arrows">
                  <button onClick={() => scrollContainer(calendarListRef, 'left')}><FaChevronLeft/></button>
                  <button onClick={() => scrollContainer(calendarListRef, 'right')}><FaChevronRight/></button>
                </div>
              </div>

              <div className="scroll-wrapper" ref={calendarListRef}>
                {weeklyEvents.map((event) => (
                  <div key={event.id} className="event-card">
                    <div className="event-date-badge">
                      <span className="ed-day">{getDayName(event.dateISO)}</span>
                      <span className="ed-date">{getShortDate(event.dateISO)}</span>
                    </div>
                    <div className="event-info">
                      <span className={`ev-tag tag-${event.category.toLowerCase()}`}>{event.category}</span>
                      <h4 className="ev-title">{event.title}</h4>
                      <div className="ev-meta-row">
                        <span><FaClock/> {formatTime(event.dateISO)}</span>
                        <span><FaMapMarkerAlt/> {event.location}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            {/* 3. NEWS (Area: news) */}
            {/* Su Mobile appare per ultimo. Su Desktop lo metteremo al CENTRO col CSS */}
            <main className="hp-col hp-col-news">
              <div className="column-header">
                <h3 className="col-title"><FaNewspaper /> Ultime Notizie</h3>
              </div>

              {loading ? <div className="loader"></div> : (
                <div className="news-vertical-list">
                  {latestNews.map((news) => (
                    <div key={news.id} className="news-item-compact" onClick={() => navigate(`/news/${news.id}`, { state: { post: news } })}>
                      <div className="nic-image" style={{ backgroundImage: `url(${news.image || "/placeholder.jpg"})` }}></div>
                      <div className="nic-content">
                        <span className="nic-date">{news.date}</span>
                        <h4 className="nic-title">{news.title}</h4>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="view-all-wrapper">
                <button className="hp-btn btn-link" onClick={() => navigate('/news')}>Vedi tutte</button>
              </div>
            </main>

        </div>
      </div>
    </div>
  );
}