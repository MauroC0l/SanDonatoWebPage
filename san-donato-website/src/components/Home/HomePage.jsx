import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AboutSection from "./AboutSection";
import EventDetailsModal from "../../components/EventDetailsModal";
import ResultsModal from "../../components/ResultsModal";
import NewsletterForm from "./NewsletterForm"; 
import { getLatestPostsByCategory } from "../../api/API.mjs";
import { fetchHomeEvents } from '../../api/calendarApi';
import {
  FaCalendarAlt, FaClock, FaYoutube, FaCircle, FaNewspaper,
  FaChevronLeft, FaChevronRight, FaMapMarkerAlt, FaLock, FaTrophy,
  FaEnvelopeOpenText, FaPaperPlane
} from "react-icons/fa";
import "../../css/HomePage.css";

// Per quanti giorni una notizia resta marcata come "NEW"
const NEW_BADGE_DAYS = 2;

// Si basa sul campo ISO, l'unico confrontabile in modo affidabile:
// post.date è già formattato "gg/mm/aaaa" e new Date() lo interpreterebbe male.
// Sta fuori dal componente e riceve "now" perché il calcolo va fatto al
// caricamento dei dati, non a ogni render.
function isPostNew(post, now, daysWindow = NEW_BADGE_DAYS) {
  const postDate = new Date(post?.dateISO ?? "");
  if (isNaN(postDate.getTime())) return false;
  const differenceInDays = (now - postDate.getTime()) / (1000 * 3600 * 24);
  return differenceInDays >= 0 && differenceInDays <= daysWindow;
}

// --- COMPONENTE COUNTDOWN INTERNO ---
const CountdownTimer = ({ targetDate, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const target = new Date(targetDate).getTime();
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = target - now;
      if (distance < 0) {
        clearInterval(interval);
        if (onComplete) onComplete();
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
  const [newsError, setNewsError] = useState("");

  // --- STATI MODALI ---
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showNewsletter, setShowNewsletter] = useState(false);

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
    if (diffMin <= 15 && diffMin > -150) return "LIVE";
    return "UPCOMING";
  };

  const handleTimerComplete = useCallback(() => {
    setTick(t => t + 1);
  }, []);

  // --- FETCH DATA ---
  useEffect(() => {
    let mounted = true;

    async function loadAllData() {
      // allSettled e non all: se WordPress non risponde il calendario deve
      // comunque comparire, e viceversa. Un guasto solo non svuota la home.
      const [newsResult, calendarResult] = await Promise.allSettled([
        getLatestPostsByCategory(),
        fetchHomeEvents()
      ]);

      if (!mounted) return;

      if (newsResult.status === "fulfilled") {
        const allNews = [];
        Object.values(newsResult.value || {}).forEach(cat => {
          if (Array.isArray(cat)) allNews.push(...cat);
        });
        allNews.sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));

        // Il badge "NEW" viene deciso una volta sola, qui: la finestra è
        // di giorni, ricalcolarlo a ogni render non servirebbe a nulla.
        const now = Date.now();
        setLatestNews(
          allNews.slice(0, 5).map(post => ({ ...post, isNew: isPostNew(post, now) }))
        );
      } else {
        console.error("Errore caricamento notizie:", newsResult.reason);
        setNewsError(newsResult.reason?.message || "Notizie non disponibili.");
      }

      if (calendarResult.status === "fulfilled") {
        setTodayEvents(calendarResult.value.todayEvents || []);
        setWeekEvents(calendarResult.value.weekEvents || []);
      } else {
        console.error("Errore caricamento calendario:", calendarResult.reason);
      }

      setLoading(false);
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
    if (ref.current) {
      const scrollAmount = 280;
      ref.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };
  
  return (
    <div className="hp-root">
      <AboutSection />

      <div className="hp-main-container">
        <div className="hp-grid-layout">

          {/* 1. COLONNA SX: NEWSLETTER WIDGET + LIVE CENTER */}
          <aside className="hp-col hp-col-live">
            
            {/* --- NUOVO POSIZIONAMENTO NEWSLETTER WIDGET --- */}
            <div className="newsletter-widget-card" onClick={() => setShowNewsletter(true)}>
              <div className="nwc-icon">
                <FaEnvelopeOpenText />
              </div>
              <div className="nwc-content">
                <h4>Resta Aggiornato</h4>
                <p>Iscriviti per ricevere risultati e news.</p>
              </div>
              <div className="nwc-arrow">
                <FaPaperPlane />
              </div>
            </div>

            {/* --- LIVE CENTER --- */}
            <div className="column-header">
              <h3 className="col-title text-danger"><FaCircle className="live-pulse-icon" /> Live Center</h3>
              <div className="mobile-arrows">
                <button onClick={() => scrollContainer(liveListRef, 'left')}><FaChevronLeft /></button>
                <button onClick={() => scrollContainer(liveListRef, 'right')}><FaChevronRight /></button>
              </div>
            </div>

            <div className="scroll-wrapper" ref={liveListRef}>
              {loading ? (
                <div className="loader-wrapper">
                  <div className="loader-small"></div>
                </div>
              ) : (
                displayedMatches.length > 0 ? displayedMatches.map((match, index) => {
                  const status = getMatchStatus(match.start);
                  const hasDirectLink = !!match.diretta && match.diretta !== "";
                  const linkUrl = match.diretta || "https://youtube.com/@PolisportivaSanDonato";
                  const isNextEvent = index === 0 && status === "UPCOMING";
                  const isLocked = isNextEvent;

                  let btnText;
                  let btnClass = "btn-outline";

                  if (isLocked) {
                    btnText = "In attesa dell'inizio";
                    btnClass = "btn-locked";
                  } else if (status === "LIVE") {
                    btnText = hasDirectLink ? "Guarda ora" : "Vai al Canale";
                    btnClass = "btn-danger";
                  } else {
                    btnText = "Vai al Canale";
                  }

                  return (
                    <div key={match.id} className={`live-card-simple ${isNextEvent ? "live-card-next" : ""}`}>
                      <div className="lcs-header">
                        <div className="lcs-badges-group">
                          {status === "LIVE" ?
                            <span className="hp-badge badge-danger">IN ONDA</span> :
                            <span className="hp-badge badge-secondary">OGGI {formatTime(match.start)}</span>
                          }
                          <span className="hp-badge badge-category">
                            {match.category}
                          </span>
                        </div>
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
                        {isLocked && <FaLock style={{ marginRight: '6px', fontSize: '0.8em' }} />}
                        {btnText}
                      </a>
                    </div>
                  );
                }) : (
                  <div className="empty-state-box">
                    Nessuna diretta programmata per oggi
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
                <button onClick={() => scrollContainer(calendarListRef, 'left')}><FaChevronLeft /></button>
                <button onClick={() => scrollContainer(calendarListRef, 'right')}><FaChevronRight /></button>
              </div>
            </div>

            {!loading && (
              <div className="calendar-actions">
                <button className="btn-results-week" onClick={() => setShowResults(true)}>
                  <FaTrophy /> Vedi risultati della settimana
                </button>
              </div>
            )}

            <div className="scroll-wrapper" ref={calendarListRef}>
              {loading ? (
                <div className="loader-wrapper">
                  <div className="loader-small"></div>
                </div>
              ) : (
                weekEvents.length > 0 ? weekEvents.map((event) => (
                  <div
                    key={event.id}
                    className="event-card clickable-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedEvent(event)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedEvent(event); } }}
                  >
                    <div className="event-date-badge" style={{ backgroundColor: event.color }}>
                      <span className="ed-day">{getDayName(event.start)}</span>
                      <span className="ed-date">{getShortDate(event.start)}</span>
                    </div>
                    <div className="event-info">
                      <span className="ev-tag" style={{ color: event.color, borderColor: event.color }}>
                        {event.category}
                      </span>
                      <h4 className="ev-title">{event.title}</h4>
                      <div className="ev-meta-row">
                        <span><FaClock /> {event.hasTime ? formatTime(event.start) : "Tutto il giorno"}</span>
                        <span><FaMapMarkerAlt /> {event.location || "N.D."}</span>
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

            {loading ? (
              <div className="loader-wrapper">
                <div className="loader"></div>
              </div>
            ) : newsError ? (
              <div className="empty-state-box">{newsError}</div>
            ) : latestNews.length === 0 ? (
              <div className="empty-state-box">Nessuna notizia pubblicata</div>
            ) : (
              <div className="news-vertical-list">
                {latestNews.map((news) => {
                  const openNews = () => navigate(`/news/${news.id}`, { state: { post: news } });
                  return (
                    <div
                      key={news.id}
                      className="news-item-compact"
                      role="link"
                      tabIndex={0}
                      onClick={openNews}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openNews(); } }}
                    >
                      {news.isNew && <span className="news-new-badge">NEW</span>}
                      <div className="nic-image" style={{ backgroundImage: `url(${news.image || "/logo-poli-sfondo.jpg"})` }}></div>
                      <div className="nic-content">
                          <span className="nic-date">{news.date}</span>
                          <h4 className="nic-title">{news.title} </h4>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="view-all-wrapper">
              <button className="hp-btn btn-link" onClick={() => navigate('/news')}>Vedi tutte</button>
            </div>
          </main>

        </div>
      </div>

      {/* MODALI */}
      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {showResults && (
        <ResultsModal onClose={() => setShowResults(false)} />
      )}
      
      {showNewsletter && (
        <NewsletterForm onClose={() => setShowNewsletter(false)} />
      )}

    </div>
  );
}