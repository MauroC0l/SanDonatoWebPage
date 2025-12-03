import { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "moment/dist/locale/it";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../css/CalendarPage.css";

moment.locale("it");
const localizer = momentLocalizer(moment);

const mockMatches = [
  { id: 1, title: "Team A vs Team B", start: new Date(2025, 9, 20, 18, 30), end: new Date(2025, 9, 20, 20, 0), location: "Palazzetto Roma", category: "Serie A", matchNumber: 1 },
  { id: 2, title: "Team C vs Team D", start: new Date(2025, 9, 21, 19, 0), end: new Date(2025, 9, 21, 21, 0), location: "PalaTorino", category: "Serie B", matchNumber: 2 },
  { id: 3, title: "Team E vs Team F", start: new Date(2025, 9, 23, 17, 30), end: new Date(2025, 9, 23, 19, 30), location: "Palasport Milano", category: "Serie A", matchNumber: 3 },
  { id: 4, title: "Team G vs Team H", start: new Date(2025, 9, 24, 20, 0), end: new Date(2025, 9, 24, 22, 0), location: "Arena Napoli", category: "Under 21", matchNumber: 4 },
  { id: 5, title: "Team I vs Team J", start: new Date(2025, 9, 24, 20, 0), end: new Date(2025, 9, 24, 22, 0), location: "PalaVerona", category: "Serie B", matchNumber: 5 },
  { id: 6, title: "Team K vs Team L", start: new Date(2025, 9, 24, 20, 0), end: new Date(2025, 9, 24, 22, 0), location: "Palazzetto Firenze", category: "Under 21", matchNumber: 6 },
];

const categoryColors = {
  "Serie A": "#ff7b33",
  "Serie B": "#457b9d",
  "Under 21": "#2a9d8f",
  default: "#1d3557",
};

// Tooltip
const EventTooltip = ({ event, position }) => (
  <div
    className="event-tooltip-click"
    style={{
      position: "absolute",
      left: position.x + 10,
      top: position.y + 10,
      backgroundColor: "#1d3557",
      color: "white",
      padding: "10px",
      borderRadius: "12px",
      zIndex: 9999,
      whiteSpace: "pre-line",
      boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
      pointerEvents: "auto",
    }}
    onClick={(e) => e.stopPropagation()}
  >
    {`Partita #${event.matchNumber}\nLuogo: ${event.location}\nCategoria: ${event.category}\nOrario: ${moment(event.start).format("HH:mm")} - ${moment(event.end).format("HH:mm")}`}
  </div>
);

// Toolbar personalizzata
const CustomToolbar = ({ date, view, views, onNavigate, onView }) => {
  const viewLabels = { month: "Mese", week: "Settimana", day: "Giorno", agenda: "Agenda" };

  return (
    <div className="rbc-toolbar-custom flex-row">
      <div className="toolbar-group">
        <div className="toolbar-buttons">
          <button onClick={() => onNavigate("PREV")}>Prec</button>
          <button onClick={() => onNavigate("TODAY")}>Oggi</button>
          <button onClick={() => onNavigate("NEXT")}>Succ</button>
        </div>
      </div>

      <div className="toolbar-month">{moment(date).format("MMMM YYYY")}</div>

      <div className="toolbar-group">
        <div className="toolbar-buttons">
          {views.map((v) => (
            <button key={v} onClick={() => onView(v)} className={view === v ? "active-view" : ""}>
              {viewLabels[v] || v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Evento cliccabile
const EventComponent = ({ event, style, view, onClick }) => {
  const handleClick = (e) => { e.stopPropagation(); onClick(event, { x: e.pageX, y: e.pageY }); };
  const dynamicStyle = useMemo(() => ({
    ...style,
    cursor: "pointer",
    height: "100%",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "0 4px",
    boxSizing: "border-box",
    borderRadius: "12px",
  }), [style]);
  return <div onClick={handleClick} style={dynamicStyle}>{event.title}</div>;
};

export default function SportPage() {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleEventClick = useCallback((event, position) => { setSelectedEvent(event); setTooltipPos(position); }, []);

  useEffect(() => {
    const handleClickOutside = () => setSelectedEvent(null);
    if (selectedEvent) document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [selectedEvent]);

  const eventStyleGetter = useCallback(
    (event) => ({
      style: {
        backgroundColor: categoryColors[event.category] || categoryColors.default,
        borderRadius: "12px",
        color: "white",
        border: "none",
        fontWeight: 600,
        boxShadow: "0 3px 8px rgba(0,0,0,0.2)",
      },
    }),
    []
  );

  const messages = useMemo(() => ({
    allDay: "Tutto il giorno",
    previous: "Prec",
    next: "Succ",
    today: "Oggi",
    month: "Mese",
    week: "Settimana",
    day: "Giorno",
    agenda: "Agenda",
    date: "Data",
    time: "Ora",
    event: "Evento",
    noEventsInRange: "Nessun evento in questo intervallo.",
    showMore: (total) => `+ altri ${total}`,
  }), []);

  const formats = useMemo(() => ({
    dayFormat: (date, culture, localizer) => localizer.format(date, "ddd DD", culture),
    weekdayFormat: (date, culture, localizer) => localizer.format(date, "dddd", culture),
    dayHeaderFormat: (date, culture, localizer) => localizer.format(date, "dddd DD MMMM", culture),
    dayRangeHeaderFormat: ({ start, end }, culture, localizer) => `${localizer.format(start, "D MMM")} – ${localizer.format(end, "D MMM YYYY")}`,
    timeGutterFormat: (date, culture, localizer) => localizer.format(date, "HH:mm", culture),
  }), []);

  // Limiti orari per week/day
  const minTime = new Date(); minTime.setHours(10,0,0);
  const maxTime = new Date(); maxTime.setHours(23,0,0);

  return (
    <div className="sportPageContainer">
      <h1 className="header">🏐 Calendario Pallavolo</h1>
      <div className="calendarWrapper relative">
        <Calendar
          localizer={localizer}
          events={mockMatches}
          startAccessor="start"
          endAccessor="end"
          defaultView="month"
          views={["month", "week", "day"]}
          style={{ height: "85vh" }}
          eventPropGetter={eventStyleGetter}
          components={{ event: (props) => <EventComponent {...props} onClick={handleEventClick} />, toolbar: CustomToolbar }}
          dayPropGetter={() => ({ style: { minWidth: "170px" } })}
          messages={messages}
          formats={formats}
          min={minTime}   // Limite minimo
          max={maxTime}   // Limite massimo
        />
        {selectedEvent && <EventTooltip event={selectedEvent} position={tooltipPos} />}
      </div>
    </div>
  );
}
