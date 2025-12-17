import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AboutSection from "./AboutSection";
import EventDetailsModal from "../../components/EventDetailsModal";
import ResultsModal from "../../components/ResultsModal";
import { getLatestPostsByCategory } from "../../api/API.mjs";
import { fetchTodayEvents, fetchWeekEvents } from '../../api/calendarApi';
import {
  FaCalendarAlt, FaClock, FaYoutube, FaCircle, FaNewspaper,
  FaChevronLeft, FaChevronRight, FaMapMarkerAlt, FaLock, FaTrophy
} from "react-icons/fa";
import "../../css/HomePage.css";

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

  // --- STATI MODALI ---
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showResults, setShowResults] = useState(false); // NUOVO STATE

  // Stato dummy per forzare il re-render quando scade il timer
  const [, setTick] = useState(0);

  const navigate = useNavigate();
  const liveListRef = useRef(null);
  const calendarListRef = useRef(null);

  // --- HELPER DATE ---
  const getDayName = (dateObj) => new Date(dateObj).toLocaleDateString('it-IT', { weekday: 'short' }).toUpperCase().replace('.', '');
  const getShortDate = (dateObj) => new Date(dateObj).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  const formatTime = (dateObj) => new Date(dateObj).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Helper per badge "New"
  const isPostNew = (dateString, daysWindow = 7) => {
    if (!dateString) return false;
    const [day, month, year] = dateString.split('/');
    const postDate = new Date(year, month - 1, day);
    const today = new Date();
    const differenceInTime = today.getTime() - postDate.getTime();
    const differenceInDays = differenceInTime / (1000 * 3600 * 24);
    return differenceInDays >= 0 && differenceInDays <= daysWindow;
  };

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
        if (mounted) setLoading(false);
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

          {/* 1. LIVE CENTER */}
          <aside className="hp-col hp-col-live">
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

                  let btnText = "Canale YT";
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

            <div className="scroll-wrapper" ref={liveListRef}>
              {loading ? (
                <div className="loader-wrapper">
                  <div className="loader-small"></div>
                </div>
              ) : (
                weekEvents.length > 0 ? weekEvents.map((event) => (
                  <div
                    key={event.id}
                    className="event-card clickable-card"
                    onClick={() => setSelectedEvent(event)}
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

            {/* NUOVO PULSANTE RISULTATI */}
            <div className="calendar-actions">
              <button className="btn-results-week" onClick={() => setShowResults(true)}>
                <FaTrophy /> Vedi risultati della settimana
              </button>
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
            ) : (
              <div className="news-vertical-list">
                {latestNews.map((news) => {
                  const showNewBadge = isPostNew(news.date) || isPostNew(news.isoDate);

                  return (
                    <div key={news.id} className="news-item-compact" onClick={() => navigate(`/news/${news.id}`, { state: { post: news } })}>
                      {showNewBadge && <span className="news-new-badge">NEW</span>}

                      <div className="nic-image" style={{ backgroundImage: `url(${news.image || "/placeholder.jpg"})` }}></div>
                      <div className="nic-content">
                        <span className="nic-date">{news.date}</span>
                        <h4 className="nic-title">{news.title}</h4>
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

      {/* MODALE DETTAGLI EVENTO */}
      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* NUOVO MODALE RISULTATI */}
      {showResults && (
        <ResultsModal onClose={() => setShowResults(false)} />
      )}

    </div>
  );
}