import React, { useState, useMemo, useEffect } from "react";
import "../css/CalendarPage.css";

// ==========================================
// 🛠 LOGICA APPLICAZIONE
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
const formatDate = (date) => new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
const formatTime = (date) => new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(date);

// CSS Vars Mapping per categorie
const CATEGORIES = {
  SERIE_A: { id: "Serie A", cssVar: "serie-a" },
  CHAMPIONS: { id: "Champions", cssVar: "champions" },
  COPPA: { id: "Coppa Italia", cssVar: "coppa" },
  AMICHEVOLE: { id: "Amichevole", cssVar: "amichevole" },
};

const generateMockEvents = () => {
  const events = [];
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const teams = ["Juventus", "Milan", "Inter", "Napoli", "Roma", "Lazio", "Fiorentina", "Atalanta", "Torino", "Real Madrid", "Barcellona"];
  const locations = ["Allianz Stadium", "San Siro", "Stadio Olimpico", "Maradona Stadium"];

  for (let i = 0; i < 25; i++) {
    const dayOffset = Math.floor(Math.random() * 40) - 10;
    const hour = 18 + Math.floor(Math.random() * 4);
    const teamA = teams[Math.floor(Math.random() * teams.length)];
    let teamB = teams[Math.floor(Math.random() * teams.length)];
    while(teamA === teamB) teamB = teams[Math.floor(Math.random() * teams.length)];
    
    const catKeys = Object.keys(CATEGORIES);
    const categoryKey = catKeys[Math.floor(Math.random() * catKeys.length)];
    const category = CATEGORIES[categoryKey];
    
    const startDate = new Date(year, month, today.getDate() + dayOffset, hour, 0);
    const endDate = new Date(startDate.getTime() + (105 * 60000));

    events.push({
      id: i,
      title: `${teamA} vs ${teamB}`,
      start: startDate,
      end: endDate,
      location: locations[Math.floor(Math.random() * locations.length)],
      category: category.id,
      cssVar: category.cssVar
    });
  }
  return events.sort((a, b) => a.start - b.start);
};

// Icon Components
const IconChevronLeft = () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>;
const IconChevronRight = () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;
const IconCalendar = () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const IconClock = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconMap = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const IconCheck = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
const IconX = () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;

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
        backgroundColor: `var(--cp-cat-${event.cssVar}-bg)`,
        color: `var(--cp-cat-${event.cssVar}-text)`,
        borderLeftColor: `var(--cp-cat-${event.cssVar}-text)`
      }}
    >
      {event.title}
    </div>
  );
};

export default function ModernCalendarPage() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeFilters, setActiveFilters] = useState(Object.keys(CATEGORIES));
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month");

  useEffect(() => { setEvents(generateMockEvents()); }, []);

  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
        const catKey = Object.keys(CATEGORIES).find(key => CATEGORIES[key].id === ev.category);
        return activeFilters.includes(catKey);
    });
  }, [events, activeFilters]);

  const toggleFilter = (key) => {
    setActiveFilters(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
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

  return (
    <div className="cp-dashboard-container">

      <div className="cp-main-grid">
        
        {/* SIDEBAR */}
        <aside className="cp-sidebar">
          <div className="cp-card">
            <h3 className="cp-card-title">Calendario Sport</h3>
            <p className="cp-card-subtitle">Stagione 2025/2026</p>
            
            <div className="cp-stat-box">
               <div className="cp-stat-icon">🏆</div>
               <div>
                 <div className="cp-stat-value">{events.length}</div>
                 <div className="cp-stat-label">Match Totali</div>
               </div>
            </div>
            <button className="cp-btn-primary">
              <span style={{ fontSize: '1.2rem', lineHeight: 0 }}>+</span> Nuovo Evento
            </button>
          </div>

          <div className="cp-card" style={{ flex: 1 }}>
            <div className="cp-filter-header">
               <span className="cp-filter-title">Categorie</span>
               <span className="cp-filter-count">{filteredEvents.length}</span>
            </div>
            <div>
              {Object.entries(CATEGORIES).map(([key, value]) => (
                <FilterToggle 
                  key={key} 
                  label={value.id} 
                  cssVar={value.cssVar} 
                  checked={activeFilters.includes(key)} 
                  onChange={() => toggleFilter(key)}
                />
              ))}
            </div>
          </div>
          
          <div className="cp-info-box">
            <div className="cp-info-label">Prossimo Match</div>
            {events.length > 0 && (
                <>
                    <div className="cp-info-match">{events[0].title}</div>
                    <div className="cp-info-date">{formatDate(events[0].start)}</div>
                </>
            )}
          </div>
        </aside>

        {/* MAIN AREA */}
        <main className="cp-calendar-wrapper">
            <div className="cp-toolbar">
              <div className="cp-toolbar-title">
                <h2>{view === 'month' ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}` : 'Agenda'}</h2>
                <p>Gestisci e visualizza tutti i match in programma</p>
              </div>

              <div className="cp-nav-controls">
                <button onClick={() => handleNavigate("PREV")} className="cp-btn-icon"><IconChevronLeft /></button>
                <button onClick={() => setCurrentDate(new Date())} className="cp-btn-text">Oggi</button>
                <button onClick={() => handleNavigate("NEXT")} className="cp-btn-icon"><IconChevronRight /></button>
              </div>

              <div className="cp-view-controls">
                <button onClick={() => setView('month')} className={`cp-btn-view ${view === 'month' ? 'cp-active' : ''}`}>Mese</button>
                <button onClick={() => setView('list')} className={`cp-btn-view ${view === 'list' ? 'cp-active' : ''}`}>Lista</button>
              </div>
            </div>

            <div className="cp-calendar-content">
                {view === 'month' && (
                    <>
                        <div className="cp-week-header">
                            {DAY_NAMES.map(day => <div key={day} className="cp-day-name">{day}</div>)}
                        </div>
                        <div className="cp-month-grid">
                            {calendarDays.map((dayObj, idx) => {
                                const dayEvents = filteredEvents.filter(ev => isSameDay(ev.start, dayObj.date));
                                const isToday = isSameDay(new Date(), dayObj.date);
                                return (
                                    <div key={idx} className={`cp-day-cell ${dayObj.isCurrentMonth ? 'cp-current-month' : 'cp-other-month'} ${isToday ? 'cp-today' : ''}`}>
                                        <div className="cp-day-number">{dayObj.date.getDate()}</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            {dayEvents.map(ev => <EventPill key={ev.id} event={ev} onClick={setSelectedEvent} />)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {view === 'list' && (
                    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                        {filteredEvents.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--cp-text-muted)' }}>Nessun evento trovato.</div>
                        ) : (
                            filteredEvents.map(ev => (
                                <div key={ev.id} onClick={() => setSelectedEvent(ev)} className="cp-list-view-item">
                                    <div className="cp-date-box" style={{ 
                                        backgroundColor: `var(--cp-cat-${ev.cssVar}-bg)`, 
                                        color: `var(--cp-cat-${ev.cssVar}-text)` 
                                    }}>
                                        <span className="cp-date-month" style={{ color: `var(--cp-cat-${ev.cssVar}-text)` }}>{MONTH_NAMES[ev.start.getMonth()].substring(0,3)}</span>
                                        <span className="cp-date-day" style={{ color: `var(--cp-cat-${ev.cssVar}-text)` }}>{ev.start.getDate()}</span>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className="cp-meta-row">
                                            <span className="cp-category-badge" style={{ 
                                                backgroundColor: `var(--cp-cat-${ev.cssVar}-bg)`, 
                                                color: `var(--cp-cat-${ev.cssVar}-text)` 
                                            }}>{ev.category}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--cp-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <IconClock /> {formatTime(ev.start)}
                                            </span>
                                        </div>
                                        <h3 style={{ margin: '0.25rem 0', color: 'var(--cp-text-main)' }}>{ev.title}</h3>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--cp-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <IconMap /> {ev.location}
                                        </div>
                                    </div>
                                    <IconChevronRight />
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
            <div className="cp-modal-header" style={{ backgroundColor: `var(--cp-cat-${selectedEvent.cssVar}-bg)` }}>
                <button className="cp-btn-close" onClick={() => setSelectedEvent(null)}><IconX /></button>
                <span className="cp-category-badge" style={{ 
                    backgroundColor: 'rgba(255,255,255,0.9)', 
                    color: `var(--cp-cat-${selectedEvent.cssVar}-text)` 
                }}>
                    {selectedEvent.category}
                </span>
            </div>
            <div className="cp-modal-body">
                <h2 className="cp-modal-title">{selectedEvent.title}</h2>
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
                <div className="cp-modal-footer">
                    <button className="cp-btn-primary">Modifica</button>
                    <button className="cp-btn-outline" onClick={() => setSelectedEvent(null)}>Chiudi</button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}