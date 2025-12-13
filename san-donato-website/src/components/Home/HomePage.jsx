import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AboutSection from "./AboutSection";
import { getLatestPostsByCategory } from "../../api/API.mjs";
import { fetchTodayEvents, fetchWeekEvents } from '../../api/calendarApi';
import { FaCalendarAlt, FaClock, FaYoutube, FaCircle, FaNewspaper, FaChevronLeft, FaChevronRight, FaMapMarkerAlt, FaLock } from "react-icons/fa";
import "../../css/HomePage.css";

// --- COMPONENTE COUNTDOWN INTERNO ---
const CountdownTimer = ({ targetDate, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    // Target: Esatto orario di inizio
    const target = new Date(targetDate).getTime(); 

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = target - now;

      // Se il tempo è scaduto
      if (distance < 0) {
        clearInterval(interval);
        if (onComplete) onComplete(); // Sblocca il pulsante
        return;
      }

      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate, onComplete]);

  // Se non c'è timeLeft (o calcolo iniziale), non renderizzare nulla
  if (!timeLeft) return null;

  return (
    <div className="countdown-box">
        <span className="cb-label">La diretta inizierà tra</span>
        <div className="cb-timer">{timeLeft}</div>
    </div>
  );
};

export default function HomePage() {
  const [latestNews, setLatestNews] = useState([]);
  const [weekEvents, setWeekEvents] = useState([]); 
  const [todayEvents, setTodayEvents] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // Stato dummy per forzare il re-render quando scade il timer
  const [, setTick] = useState(0);

  const navigate = useNavigate();
  const liveListRef = useRef(null);
  const calendarListRef = useRef(null);

  // --- HELPER DATE ---
  const getDayName = (dateObj) => new Date(dateObj).toLocaleDateString('it-IT', { weekday: 'short' }).toUpperCase().replace('.', '');
  const getShortDate = (dateObj) => new Date(dateObj).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  const formatTime = (dateObj) => new Date(dateObj).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // --- LOGICA STATUS ---
  const getMatchStatus = (dateObj) => {
    if (!dateObj) return "UPCOMING";
    const diffMs = new Date(dateObj) - new Date();
    const diffMin = Math.floor(diffMs / 60000); 
    
    // Live se iniziata da meno di 2.5h (-150m) o inizia tra meno di 15m
    if (diffMin <= 15 && diffMin > -150) return "LIVE";
    return "UPCOMING";
  };

  // Funzione chiamata quando il countdown finisce
  const handleTimerComplete = useCallback(() => {
    setTick(t => t + 1); // Forza re-render per aggiornare lo status a LIVE
  }, []);

  // --- FETCH DATA ---
  useEffect(() => {
    let mounted = true;
    async function loadAllData() {
      try {
        setLoading(true);
        const [newsData, todayData, weekData] = await Promise.all([
            getLatestPostsByCategory(),
            fetchTodayEvents(),
            fetchWeekEvents()
        ]);

        if (mounted) {
            let allNews = [];
            if (newsData) {
                Object.values(newsData).forEach(cat => { if (Array.isArray(cat)) allNews.push(...cat); });
            }
            allNews.sort((a, b) => b.id - a.id);
            setLatestNews(allNews.slice(0, 5));
            setTodayEvents(todayData.events || []);
            setWeekEvents(weekData.events || []);
            setLoading(false);
        }
      } catch (err) {
        console.error("Errore caricamento HomePage:", err);
        if(mounted) setLoading(false);
      }
    }
    loadAllData();
    return () => { mounted = false; };
  }, []);

  // --- FILTRO LIVE MATCHES ---
  const displayedMatches = todayEvents.filter(ev => {
    if (!ev.hasTime) return false; 
    const now = new Date();
    const diffHours = (ev.start - now) / (1000 * 60 * 60);
    return diffHours >= -2 && diffHours <= 12; 
  });

  const scrollContainer = (ref, direction) => {
    if(ref.current) {
      const scrollAmount = 280; 
      ref.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="hp-root">
      <AboutSection />

      <div className="hp-main-container">
        <div className="hp-grid-layout">
            
            {/* 1. LIVE MATCHES */}
            <aside className="hp-col hp-col-live">
              <div className="column-header">
                <h3 className="col-title text-danger"><FaCircle className="live-pulse-icon" /> Live Center</h3>
                <div className="mobile-arrows">
                  <button onClick={() => scrollContainer(liveListRef, 'left')}><FaChevronLeft/></button>
                  <button onClick={() => scrollContainer(liveListRef, 'right')}><FaChevronRight/></button>
                </div>
              </div>
              
              <div className="scroll-wrapper" ref={liveListRef}>
                {loading ? <div className="loader-small"></div> : (
                    displayedMatches.length > 0 ? displayedMatches.map((match, index) => {
                    
                    const status = getMatchStatus(match.start);
                    
                    const hasDirectLink = !!match.diretta && match.diretta !== "";
                    const linkUrl = match.diretta || "https://youtube.com/@PolisportivaSanDonato";

                    // --- LOGICA PROSSIMO EVENTO ---
                    // È il primo della lista ED è ancora nel futuro?
                    const isNextEvent = index === 0 && status === "UPCOMING";
                    
                    // Se è il prossimo evento, il pulsante è bloccato (isLocked = true)
                    // Se lo status è LIVE, è sbloccato.
                    const isLocked = isNextEvent; 

                    // Testo pulsante
                    let btnText = "Canale YT";
                    let btnClass = "btn-outline";

                    if (isLocked) {
                        btnText = "In attesa dell'inizio";
                        btnClass = "btn-locked"; // Classe CSS specifica per disabilitato
                    } else if (status === "LIVE") {
                        btnText = hasDirectLink ? "Guarda ora" : "Vai al Canale";
                        btnClass = "btn-danger";
                    } else {
                        btnText = "Vai al Canale";
                    }

                    return (
                        <div key={match.id} className={`live-card-simple ${isNextEvent ? "live-card-next" : ""}`}>
                            
                            <div className="lcs-header">
                                {status === "LIVE" ? 
                                    <span className="hp-badge badge-danger">IN ONDA</span> : 
                                    <span className="hp-badge badge-secondary">OGGI {formatTime(match.start)}</span>
                                }
                                <FaYoutube className="yt-icon" />
                            </div>

                            <div className="lcs-match-info">
                                <div className="lcs-teams">
                                    <span className="team-full">{match.title}</span>
                                </div>
                                <div className="lcs-location-sm">
                                    <FaMapMarkerAlt /> 
                                    <span>{match.location || "Sede non definita"}</span>
                                </div>
                            </div>

                            {/* SEZIONE COUNTDOWN (Solo se bloccato) */}
                            {isLocked && (
                                <div className="lcs-lock-overlay">
                                    <CountdownTimer targetDate={match.start} onComplete={handleTimerComplete} />
                                </div>
                            )}

                            <a 
                                href={isLocked ? null : linkUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className={`hp-btn ${btnClass}`}
                                onClick={(e) => { if (isLocked) e.preventDefault(); }}
                            >
                                {isLocked && <FaLock style={{marginRight: '6px', fontSize: '0.8em'}} />}
                                {btnText}
                            </a>
                        </div>
                    );
                    }) : (
                    <div className="empty-state-box">
                        Nessuna diretta nelle prossime 12h
                    </div>
                    )
                )}
              </div>
            </aside>

            {/* 2. CALENDARIO */}
            <aside className="hp-col hp-col-calendar">
              <div className="column-header">
                <h3 className="col-title"><FaCalendarAlt /> Questa Settimana</h3>
                <div className="mobile-arrows">
                  <button onClick={() => scrollContainer(calendarListRef, 'left')}><FaChevronLeft/></button>
                  <button onClick={() => scrollContainer(calendarListRef, 'right')}><FaChevronRight/></button>
                </div>
              </div>

              <div className="scroll-wrapper" ref={calendarListRef}>
                {loading ? <div className="loader-small"></div> : (
                    weekEvents.length > 0 ? weekEvents.map((event) => (
                    <div key={event.id} className="event-card">
                        <div className="event-date-badge" style={{backgroundColor: event.color}}>
                        <span className="ed-day">{getDayName(event.start)}</span>
                        <span className="ed-date">{getShortDate(event.start)}</span>
                        </div>
                        <div className="event-info">
                        <span className="ev-tag" style={{ color: event.color, borderColor: event.color }}>
                            {event.category}
                        </span>
                        <h4 className="ev-title">{event.title}</h4>
                        <div className="ev-meta-row">
                            <span><FaClock/> {event.hasTime ? formatTime(event.start) : "Tutto il giorno"}</span>
                            <span><FaMapMarkerAlt/> {event.location || "N.D."}</span>
                        </div>
                        </div>
                    </div>
                    )) : (
                        <div className="empty-state-box">
                            Nessun evento in programma
                        </div>
                    )
                )}
              </div>
            </aside>

            {/* 3. NEWS */}
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