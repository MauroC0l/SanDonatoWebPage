import React, { useState, useMemo, useEffect } from "react";
import "../css/CalendarPage.css";
// Importa le funzioni e le costanti dal file API
import { fetchCalendarEvents, getDynamicCategory, COLOR_CLASSES } from '../api/calendarApi';

// ==========================================
// 🛠 UTILITIES E COSTANTI
// ==========================================

const MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

const DAY_NAMES = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

const getFirstDayOfMonth = (year, month) => {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
};

const isSameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

// Formatter
const formatDate = (date) => new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);

const formatDayHeader = (date) => {
    const str = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    return str.charAt(0).toUpperCase() + str.slice(1);
}

const formatTime = (date) => new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(date);

// --- ICON COMPONENTS ---
const IconChevronLeft = () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>;
const IconChevronRight = () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;
const IconCalendar = () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const IconClock = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconMap = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const IconCheck = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
const IconX = () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const IconFilter = () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>;

// --- COMPONENTI UI ---

const FilterToggle = ({ label, cssVar, checked, onChange }) => (
  <div onClick={onChange} className={`cp-filter-item ${checked ? 'cp-active' : 'cp-inactive'}`}>
    <div className="cp-filter-label">
      <span className="cp-dot" style={{ backgroundColor: `var(--cp-cat-${cssVar}-dot)` }}></span>
      <span>{label}</span>
    </div>
    {checked && <IconCheck />}
  </div>
);

const EventPill = ({ event, onClick }) => {
  return (
    <div 
      onClick={(e) => { e.stopPropagation(); onClick(event); }}
      className="cp-event-pill"
      style={{ 
        '--pill-bg': `var(--cp-cat-${event.cssVar}-bg)`,
        '--pill-text': `var(--cp-cat-${event.cssVar}-text)`,
        '--pill-dot': `var(--cp-cat-${event.cssVar}-dot)`
      }}
      title={event.title}
    >
      <span className="cp-pill-text">{event.title}</span>
    </div>
  );
};

export default function ModernCalendarPage() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [availableCategories, setAvailableCategories] = useState([]); 
  const [activeFilters, setActiveFilters] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- FETCH GOOGLE CALENDAR ---
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        const { events: mappedEvents, categories: categoriesArray } = await fetchCalendarEvents();

        setEvents(mappedEvents);
        
        // Inizializza i filtri
        setAvailableCategories(categoriesArray);
        setActiveFilters(categoriesArray.map(cat => cat.id));

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  // Logica di Filtro
  const filteredEvents = useMemo(() => {
    return events.filter(ev => activeFilters.includes(ev.category));
  }, [events, activeFilters]);

  const dailyEvents = useMemo(() => {
    return filteredEvents.filter(ev => isSameDay(ev.start, currentDate));
  }, [filteredEvents, currentDate]);

  const toggleFilter = (categoryName) => {
    setActiveFilters(prev => prev.includes(categoryName) 
      ? prev.filter(k => k !== categoryName) 
      : [...prev, categoryName]
    );
  };
  
  const handleNavigate = (direction) => {
    const newDate = new Date(currentDate);
    if (view === 'month') {
        if (direction === "PREV") newDate.setMonth(newDate.getMonth() - 1);
        if (direction === "NEXT") newDate.setMonth(newDate.getMonth() + 1);
    } else {
        if (direction === "PREV") newDate.setDate(newDate.getDate() - 1);
        if (direction === "NEXT") newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const startDay = getFirstDayOfMonth(year, month);
    
    const prevMonthDays = [];
    const prevMonthDate = new Date(year, month, 0);
    const prevMonthLastDay = prevMonthDate.getDate();
    for (let i = 0; i < startDay; i++) {
        prevMonthDays.unshift({ date: new Date(year, month - 1, prevMonthLastDay - i), isCurrentMonth: false });
    }

    const currentMonthDays = [];
    for (let i = 1; i <= daysInMonth; i++) {
        currentMonthDays.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    const nextMonthDays = [];
    const totalSlots = 42;
    const remainingSlots = totalSlots - (prevMonthDays.length + currentMonthDays.length);
    for (let i = 1; i <= remainingSlots; i++) {
        nextMonthDays.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
  }, [currentDate]);

  // Calcolo del Prossimo Match
  const nextMatch = useMemo(() => {
    if (loading || events.length === 0) return null;
    
    const futureEvents = events
      .filter(e => e.start >= new Date())
      .sort((a, b) => a.start - b.start);

    return futureEvents.length > 0 ? futureEvents[0] : null;
  }, [events, loading]);


  if (error) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>Errore: {error}</div>;
  }

  return (
    <div className="cp-dashboard-container">

      <div className="cp-main-grid">
        
        {/* SIDEBAR (Drawer su mobile) */}
        <>
            {isMobileSidebarOpen && <div className="cp-backdrop" onClick={() => setIsMobileSidebarOpen(false)} />}
            <aside className={`cp-sidebar ${isMobileSidebarOpen ? 'cp-mobile-open' : ''}`}>
                <div className="cp-mobile-drag-handle"></div>
                <div className="cp-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 className="cp-card-title">Calendario Sport</h3>
                        <button className="cp-btn-close-mobile" onClick={() => setIsMobileSidebarOpen(false)}><IconX /></button>
                    </div>
                    <p className="cp-card-subtitle">Stagione {new Date().getFullYear()}/{new Date().getFullYear() + 1}</p>
                    
                    <div className="cp-stat-box">
                    <div className="cp-stat-icon">🏆</div>
                    <div>
                        <div className="cp-stat-value">{loading ? "..." : events.length}</div>
                        <div className="cp-stat-label">Match Totali</div>
                    </div>
                    </div>
                </div>

                {/* FILTRI DINAMICI */}
                <div className="cp-card" style={{ flex: 1 }}>
                    <div className="cp-filter-header">
                    <span className="cp-filter-title">Categorie ({availableCategories.length})</span>
                    <span className="cp-filter-count">{filteredEvents.length}</span>
                    </div>
                    <div>
                    {availableCategories.map((category) => (
                        <FilterToggle 
                        key={category.id} 
                        label={category.id} 
                        cssVar={category.cssVar} 
                        checked={activeFilters.includes(category.id)} 
                        onChange={() => toggleFilter(category.id)}
                        />
                    ))}
                    </div>
                </div>
                
                <div className="cp-info-box">
                    <div className="cp-info-label">Prossimo Match</div>
                    {loading ? (
                        <div>Caricamento...</div>
                    ) : nextMatch ? (
                        <>
                            <div className="cp-info-match">{nextMatch.title}</div>
                            <div className="cp-info-date">{formatDate(nextMatch.start)}</div>
                        </>
                    ) : (
                        <div>Nessun evento futuro</div>
                    )}
                </div>
            </aside>
        </>

        {/* MAIN AREA */}
        <main className="cp-calendar-wrapper">
            <div className="cp-toolbar">
              <div className="cp-toolbar-header-row">
                 <div className="cp-toolbar-title">
                    <h2>
                        {view === 'month' 
                            ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}` 
                            : formatDayHeader(currentDate)
                        }
                    </h2>
                 </div>
                 {/* Mobile Filter Button */}
                 <button className="cp-btn-mobile-filter" onClick={() => setIsMobileSidebarOpen(true)}>
                    <IconFilter />
                 </button>
              </div>

              <div className="cp-toolbar-actions-row">
                  <div className="cp-nav-controls">
                    <button onClick={() => handleNavigate("PREV")} className="cp-btn-icon"><IconChevronLeft /></button>
                    <button onClick={() => setCurrentDate(new Date())} className="cp-btn-text">Ritorna a oggi</button>
                    <button onClick={() => handleNavigate("NEXT")} className="cp-btn-icon"><IconChevronRight /></button>
                  </div>

                  <div className="cp-view-controls">
                    <button onClick={() => setView('month')} className={`cp-btn-view ${view === 'month' ? 'cp-active' : ''}`}>Mese</button>
                    <button onClick={() => setView('list')} className={`cp-btn-view ${view === 'list' ? 'cp-active' : ''}`}>Giorno</button>
                  </div>
              </div>
            </div>

            <div className="cp-calendar-content">
                {loading && <div style={{padding: 20, textAlign:'center'}}>Caricamento eventi da Google...</div>}
                
                {!loading && view === 'month' && (
                    <>
                        <div className="cp-week-header">
                            {DAY_NAMES.map(day => <div key={day} className="cp-day-name">{day}</div>)}
                        </div>
                        <div className="cp-month-grid">
                            {calendarDays.map((dayObj, idx) => {
                                const dayEvents = filteredEvents.filter(ev => isSameDay(ev.start, dayObj.date));
                                const isToday = isSameDay(new Date(), dayObj.date);
                                return (
                                    <div 
                                        key={idx} 
                                        className={`cp-day-cell ${dayObj.isCurrentMonth ? 'cp-current-month' : 'cp-other-month'} ${isToday ? 'cp-today' : ''}`}
                                        onClick={() => {
                                            setCurrentDate(dayObj.date);
                                            setView('list');
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="cp-day-number">{dayObj.date.getDate()}</div>
                                        <div className="cp-events-container">
                                            {dayEvents.map(ev => <EventPill key={ev.id} event={ev} onClick={setSelectedEvent} />)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {!loading && view === 'list' && (
                    <div className="cp-list-container">
                        {dailyEvents.length === 0 ? (
                            <div className="cp-empty-state">
                                Nessun evento programmato per<br/>
                                <strong>{formatDayHeader(currentDate)}</strong>
                            </div>
                        ) : (
                            dailyEvents.map(ev => (
                                <div key={ev.id} onClick={() => setSelectedEvent(ev)} className="cp-list-view-item">
                                    <div className="cp-date-box" style={{ 
                                        backgroundColor: `var(--cp-cat-${ev.cssVar}-bg)`, 
                                        color: `var(--cp-cat-${ev.cssVar}-text)` 
                                    }}>
                                        <span className="cp-date-month">{MONTH_NAMES[ev.start.getMonth()].substring(0,3)}</span>
                                        <span className="cp-date-day">{ev.start.getDate()}</span>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="cp-meta-row">
                                            <span className="cp-category-badge" style={{ 
                                                backgroundColor: `var(--cp-cat-${ev.cssVar}-bg)`, 
                                                color: `var(--cp-cat-${ev.cssVar}-text)` 
                                            }}>{ev.category}</span>
                                            <span className="cp-meta-time">
                                                <IconClock /> {formatTime(ev.start)}
                                            </span>
                                        </div>
                                        <h3 className="cp-event-title">{ev.title}</h3>
                                        <div className="cp-meta-location">
                                            <IconMap /> {ev.location}
                                        </div>
                                    </div>
                                    <div className="cp-list-arrow"><IconChevronRight /></div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </main>
      </div>

      {selectedEvent && (
        <div className="cp-modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="cp-modal-card" onClick={e => e.stopPropagation()}>
            <div className="cp-mobile-drag-handle-modal"></div>
            <div className="cp-modal-header" style={{ backgroundColor: `var(--cp-cat-${selectedEvent.cssVar}-bg)` }}>
                <button className="cp-btn-close" onClick={() => setSelectedEvent(null)}><IconX /></button>
                <span className="cp-category-badge cp-badge-large" style={{ 
                    color: `var(--cp-cat-${selectedEvent.cssVar}-text)` 
                }}>
                    {selectedEvent.category}
                </span>
            </div>
            <div className="cp-modal-body">
                <h2 className="cp-modal-title">{selectedEvent.title}</h2>
                <div className="cp-detail-grid">
                    <div className="cp-detail-row">
                        <div className="cp-icon-box"><IconCalendar /></div>
                        <div className="cp-detail-content">
                            <label>Data</label>
                            <p>{formatDate(selectedEvent.start)}</p>
                        </div>
                    </div>
                    <div className="cp-detail-row">
                        <div className="cp-icon-box"><IconClock /></div>
                        <div className="cp-detail-content">
                            <label>Orario</label>
                            <p>{formatTime(selectedEvent.start)} - {formatTime(selectedEvent.end)}</p>
                        </div>
                    </div>
                    <div className="cp-detail-row">
                        <div className="cp-icon-box"><IconMap /></div>
                        <div className="cp-detail-content">
                            <label>Luogo</label>
                            <p>{selectedEvent.location}</p>
                        </div>
                    </div>
                    {/* Mostra la descrizione completa dell'evento */}
                    {selectedEvent.description && (
                         <div className="cp-detail-row">
                            <div className="cp-detail-content" style={{marginTop: 10}}>
                                <label>Dettagli Evento</label>
                                <p style={{fontSize: '0.9rem', fontWeight: 400, whiteSpace: 'pre-wrap'}}>{selectedEvent.description}</p>
                            </div>
                        </div>
                    )}
                </div>
                <div className="cp-modal-footer">
                    {/* Pulsante per aprire su Google Calendar */}
                    <button className="cp-btn-primary" onClick={() => window.open(`https://calendar.google.com/calendar/u/0/r/eventedit/copy/${selectedEvent.id}`, '_blank')}>
                        Aggiungi al mio calendario
                    </button>
                    <button className="cp-btn-outline" onClick={() => setSelectedEvent(null)}>Chiudi</button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}