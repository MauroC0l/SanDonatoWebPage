import { useState } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "moment/dist/locale/it";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../css/CalendarPage.css";

moment.locale("it");
const localizer = momentLocalizer(moment);

const mockMatches = [
  { id: 1, title: "Team A vs Team B", start: new Date(2025, 9, 20, 18, 30), end: new Date(2025, 9, 20, 20, 0), location: "Palazzetto Roma", category: "Serie A" },
  { id: 2, title: "Team C vs Team D", start: new Date(2025, 9, 21, 19, 0), end: new Date(2025, 9, 21, 21, 0), location: "PalaTorino", category: "Serie B" },
  { id: 3, title: "Team E vs Team F", start: new Date(2025, 9, 23, 17, 30), end: new Date(2025, 9, 23, 19, 30), location: "Palasport Milano", category: "Serie A" },
  { id: 4, title: "Team G vs Team H", start: new Date(2025, 9, 24, 20, 0), end: new Date(2025, 9, 24, 22, 0), location: "Arena Napoli", category: "Under 21" },
  { id: 5, title: "Team I vs Team J", start: new Date(2025, 9, 24, 20, 0), end: new Date(2025, 9, 24, 22, 0), location: "PalaVerona", category: "Serie B" },
];

const categoryColors = {
  "Serie A": { bg: "#EEF2FF", text: "#4F46E5", dot: "#4F46E5" },
  "Serie B": { bg: "#ECFDF5", text: "#059669", dot: "#059669" },
  "Under 21": { bg: "#FFF7ED", text: "#EA580C", dot: "#EA580C" },
  default: { bg: "#F3F4F6", text: "#374151", dot: "#9CA3AF" },
};

// --- ICONS ---
const ChevronLeft = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>;
const ChevronRight = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>;
const CloseIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;

// --- TOOLBAR ---
const UltraModernToolbar = ({ date, view, views, onNavigate, onView }) => {
  const label = moment(date).format("MMMM YYYY");

  return (
    <div className="um-toolbar">
      <div className="um-header-group">
        <h2 className="um-title">{label}</h2>
        <div className="um-nav-controls">
          <button onClick={() => onNavigate("PREV")} className="um-icon-btn"><ChevronLeft /></button>
          <button onClick={() => onNavigate("TODAY")} className="um-today-btn">Oggi</button>
          <button onClick={() => onNavigate("NEXT")} className="um-icon-btn"><ChevronRight /></button>
        </div>
      </div>

      <div className="um-segmented-control">
        {views.map((v) => (
          <button
            key={v}
            onClick={() => onView(v)}
            className={`um-segment ${view === v ? "active" : ""}`}
          >
            {v === 'month' ? 'Mese' : v === 'week' ? 'Sett.' : v === 'day' ? 'Giorno' : 'Agenda'}
          </button>
        ))}
      </div>
    </div>
  );
};

// --- EVENTO ---
const CustomEvent = ({ event }) => {
  const colors = categoryColors[event.category] || categoryColors.default;
  return (
    <div className="um-event-pill" style={{ backgroundColor: colors.bg }}>
      <span className="um-event-dot" style={{ backgroundColor: colors.dot }}></span>
      <span className="um-event-text" style={{ color: colors.text }}>{event.title}</span>
    </div>
  );
};

// --- MODAL ---
const ModernModal = ({ event, onClose }) => {
  if (!event) return null;
  const colors = categoryColors[event.category] || categoryColors.default;

  return (
    <div className="um-modal-overlay" onClick={onClose}>
      <div className="um-modal-card" onClick={e => e.stopPropagation()}>
        <div className="um-modal-header">
          <span className="um-badge" style={{ backgroundColor: colors.bg, color: colors.text }}>
            {event.category}
          </span>
          <button className="um-close-btn" onClick={onClose}><CloseIcon /></button>
        </div>
        
        <h3 className="um-modal-title">{event.title}</h3>
        
        <div className="um-modal-details">
            <div className="um-detail-row">
                <label>Quando</label>
                <p>{moment(event.start).format("dddd D MMMM, HH:mm")}</p>
            </div>
            <div className="um-detail-row">
                <label>Dove</label>
                <p>{event.location}</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default function CalendarPage() {
  const [selectedEvent, setSelectedEvent] = useState(null);

  const eventPropGetter = () => ({ className: "um-event-wrapper" });

  return (
    <div className="um-page-container">
      <div className="um-calendar-wrapper">
        <Calendar
          localizer={localizer}
          events={mockMatches}
          startAccessor="start"
          endAccessor="end"
          defaultView="month"
          views={["month", "week", "day"]}
          components={{ toolbar: UltraModernToolbar, event: CustomEvent }}
          eventPropGetter={eventPropGetter}
          onSelectEvent={(event) => setSelectedEvent(event)}
          messages={{ showMore: total => `+${total}` }}
        />
      </div>
      {selectedEvent && <ModernModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
}