import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import CalendarioSulTelefono from "./CalendarioSulTelefono";
import "../css/CalendarPage.css";
import EventDetailsModal from "./EventDetailsModal";
import { fetchEventsByRange, fetchProssimoEvento } from '../api/calendarApi';
import {
  FiChevronLeft, FiChevronRight, FiClock, FiMapPin, FiX, FiSliders,
  FiCalendar, FiList, FiGrid, FiArrowRight
} from "react-icons/fi";

// ==========================================
// Utilità e costanti
// ==========================================

const MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

const DAY_NAMES = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

// Quante pillole entrano in una casella del mese prima del "+N": oltre,
// la casella si allungherebbe e la griglia smetterebbe di essere una griglia.
const PILLOLE_PER_CASELLA = 3;

// Il tipo dell'evento detto come lo direbbe una persona
const NOME_TIPO = {
  partita: "Partita",
  torneo: "Torneo",
  allenamento: "Allenamento",
  evento: "Evento"
};

const NOME_SPORT = { Societa: "Società" };

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

const getFirstDayOfMonth = (year, month) => {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
};

const isSameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

// Chiave di un giorno, per raggruppare gli eventi una volta sola invece di
// filtrare l'elenco intero per ognuna delle 42 caselle.
const chiaveGiorno = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/* Passato quando è finito, non quando è cominciato: una partita in corso
   non va ancora attenuata. Un evento di tutto il giorno lo è solo da
   domani: la cena di stasera non è "passata" alle nove del mattino. */
const isEventPast = (ev) => {
  if (!ev.hasTime) {
    const fineGiorno = new Date(ev.start);
    fineGiorno.setHours(23, 59, 59, 999);
    return fineGiorno < new Date();
  }
  return (ev.end || ev.start) < new Date();
};

const maiuscola = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const formatDate = (date) => maiuscola(new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(date));

const formatDayHeader = (date) =>
  maiuscola(new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date));

const formatTime = (date) => new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(date);

const nomeGiorno = (date) => maiuscola(new Intl.DateTimeFormat('it-IT', { weekday: 'long' }).format(date));

/* Il nome della squadra senza lo sport davanti, dentro al gruppo di quello
   sport: sotto "Calcio" basta "Allievi", e la spalla non va a capo tre
   volte per ripetere la stessa parola. */
const nomeCorto = (etichetta, prefisso) =>
  prefisso && etichetta.toLowerCase().startsWith(prefisso.toLowerCase()) && etichetta.length > prefisso.length
    ? etichetta.slice(prefisso.length)
    : etichetta;

/* Il prefisso da togliere in un gruppo: il nome dello sport, oppure la
   prima parola che tutte le sue squadre hanno in comune ("Volley" sotto
   "Pallavolo"). Con una squadra sola non si toglie niente. */
const prefissoGruppo = (sport, squadre) => {
  const nomi = squadre.map(s => s.label || s.id);
  const conSport = `${sport} `.toLowerCase();
  if (nomi.every(n => n.toLowerCase().startsWith(conSport))) return `${sport} `;
  const prima = nomi[0].split(" ")[0] + " ";
  if (nomi.length > 1 && nomi.every(n => n.startsWith(prima) && n.length > prima.length)) return prima;
  return "";
};

// ==========================================
// Pezzi della pagina
// ==========================================

/** Una squadra nei filtri: una pastiglia col suo colore, accesa o spenta. */
const FilterToggle = ({ label, fullLabel, color, checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    aria-pressed={checked}
    aria-label={fullLabel}
    title={fullLabel}
    className={`cp-filtro ${checked ? 'cp-active' : 'cp-inactive'}`}
    style={{ "--cp-c": color }}
  >
    <span className="cp-dot" aria-hidden="true" />
    <span className="cp-filtro-nome">{label}</span>
  </button>
);

/** Un impegno dentro a una casella del mese. */
const EventPill = ({ event, onClick }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onClick(event); }}
    // Invio sulla pillola apre la pillola, non il giorno che la contiene
    onKeyDown={(e) => e.stopPropagation()}
    className={`cp-event-pill ${isEventPast(event) ? 'cp-event-past' : ''}`}
    style={{ "--cp-c": event.color }}
    title={`${event.hasTime ? formatTime(event.start) + " · " : ""}${event.title}`}
  >
    {event.hasTime && <span className="cp-pill-ora">{formatTime(event.start)}</span>}
    <span className="cp-pill-text">{event.title}</span>
  </button>
);

/**
 * Una riga dell'elenco: l'ora a sinistra, la barra del colore della
 * squadra, e per esteso tutto quello che nella casella del mese non ci sta.
 * La usano sia la vista del giorno sia l'elenco del mese.
 */
const RigaEvento = ({ ev, onApri }) => {
  const passato = isEventPast(ev);
  return (
    <button
      type="button"
      onClick={() => onApri(ev)}
      className={`cp-riga ${passato ? 'cp-event-past' : ''}`}
      style={{ "--cp-c": ev.color }}
    >
      <span className="cp-riga-ora">
        {ev.hasTime ? (
          <>
            <strong>{formatTime(ev.start)}</strong>
            {ev.end > ev.start && <small>{formatTime(ev.end)}</small>}
          </>
        ) : (
          <small>Tutto il giorno</small>
        )}
      </span>
      <span className="cp-riga-barra" aria-hidden="true" />
      <span className="cp-riga-testi">
        <span className="cp-riga-meta">
          <span className="cp-riga-squadra">{ev.category}</span>
          {NOME_TIPO[ev.tipo] && <span className="cp-riga-tipo">{NOME_TIPO[ev.tipo]}</span>}
        </span>
        <span className="cp-riga-titolo">{ev.title}</span>
        <span className="cp-riga-luogo">
          <FiMapPin aria-hidden="true" /> <span>{ev.location || "Luogo da definire"}</span>
        </span>
      </span>
      {ev.result && <span className="cp-riga-risultato">{ev.result}</span>}
      <FiChevronRight className="cp-riga-freccia" aria-hidden="true" />
    </button>
  );
};

const VISTE = [
  { id: "month", nome: "Mese", Icona: FiGrid },
  { id: "list", nome: "Giorno", Icona: FiCalendar },
  { id: "agenda", nome: "Elenco", Icona: FiList }
];

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [activeFilters, setActiveFilters] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Il prossimo evento di tutta la stagione, oltre il mese mostrato
  const [prossimo, setProssimo] = useState(null);
  // Il titolo grande è uscito dallo schermo: la barra dei comandi, che
  // resta attaccata in alto, mostra lei il mese (vedi l'osservatore sotto).
  const [titoloFuori, setTitoloFuori] = useState(false);
  // La dissolvenza del contenuto parte solo quando si cambia vista, non
  // all'apertura della pagina: la griglia deve essere lì subito.
  const [vistaCambiata, setVistaCambiata] = useState(false);

  const titoloRef = useRef(null);
  const chiudiCassettoRef = useRef(null);
  const apriCassettoRef = useRef(null);

  /* Con il pannello dei filtri aperto la pagina dietro sta ferma: il dito
     che scorre l'elenco delle squadre muoveva anche il calendario. Esc lo
     chiude, e il fuoco entra nel pannello e torna al pulsante che l'ha
     aperto: chi usa la tastiera non resta a metà pagina. */
  useEffect(() => {
    if (!isMobileSidebarOpen) return undefined;
    const prima = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    chiudiCassettoRef.current?.focus();
    const tasti = (e) => { if (e.key === "Escape") setIsMobileSidebarOpen(false); };
    document.addEventListener("keydown", tasti);
    const pulsante = apriCassettoRef.current;
    return () => {
      document.body.style.overflow = prima;
      document.removeEventListener("keydown", tasti);
      pulsante?.focus();
    };
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    let attivo = true;
    fetchProssimoEvento().then((evento) => { if (attivo) setProssimo(evento); });
    return () => { attivo = false; };
  }, []);

  useEffect(() => {
    const el = titoloRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const osservatore = new IntersectionObserver(([voce]) => {
      setTitoloFuori(!voce.isIntersecting && voce.boundingClientRect.top < 0);
    });
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, []);

  // Estratti dallo stato: il calendario ricarica quando cambia il mese
  // visualizzato, non a ogni cambio di giorno selezionato.
  const visibleYear = currentDate.getFullYear();
  const visibleMonth = currentDate.getMonth();

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);

        const year = visibleYear;
        const month = visibleMonth;

        /* Tutti i giorni che la griglia mostra, compresi quelli grigi del
           mese prima e del mese dopo: a fine settembre si vedono i primi
           giorni di ottobre, e vederli vuoti quando ci sono partite era una
           bugia. Nei conteggi del mese però contano solo i giorni del mese
           (vedi eventiDelMese). Le 42 caselle sono le stesse di calendarDays. */
        const inizioGriglia = new Date(year, month, 1 - getFirstDayOfMonth(year, month));
        inizioGriglia.setHours(0, 0, 0, 0);

        const fineGriglia = new Date(inizioGriglia);
        fineGriglia.setDate(fineGriglia.getDate() + 41);
        fineGriglia.setHours(23, 59, 59, 999);

        const { events: mappedEvents, categories: categoriesArray } = await fetchEventsByRange(inizioGriglia, fineGriglia);

        setEvents(mappedEvents);

        // Inizializza categorie/filtri solo al primo caricamento
        setAvailableCategories(prev => prev.length === 0 ? categoriesArray : prev);
        setActiveFilters(prev => prev.length === 0 ? categoriesArray.map(cat => cat.id) : prev);

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    };

    // Ricarica quando cambia il mese/anno visualizzato
    loadEvents();
  }, [visibleYear, visibleMonth]);

  // Niente scorrimento della pagina dietro alla scheda aperta
  useEffect(() => {
    if (selectedEvent) {
      document.body.classList.add('cp-modal-open');
    } else {
      document.body.classList.remove('cp-modal-open');
    }
    return () => { document.body.classList.remove('cp-modal-open'); };
  }, [selectedEvent]);

  const filteredEvents = useMemo(() => {
    return events.filter(ev => activeFilters.includes(ev.category));
  }, [events, activeFilters]);

  // Solo quelli del mese mostrato: sono gli "incontri per questo mese"
  const eventiDelMese = useMemo(() => filteredEvents.filter(ev =>
    ev.start.getFullYear() === visibleYear && ev.start.getMonth() === visibleMonth
  ), [filteredEvents, visibleYear, visibleMonth]);

  const dailyEvents = useMemo(() => {
    return filteredEvents.filter(ev => isSameDay(ev.start, currentDate));
  }, [filteredEvents, currentDate]);

  // Gli eventi per giorno, calcolati una volta per tutte le caselle
  const perGiorno = useMemo(() => {
    const mappa = new Map();
    for (const ev of filteredEvents) {
      const k = chiaveGiorno(ev.start);
      if (!mappa.has(k)) mappa.set(k, []);
      mappa.get(k).push(ev);
    }
    return mappa;
  }, [filteredEvents]);

  // L'elenco del mese, a gruppi di giorno
  const giorniDelMese = useMemo(() => {
    const gruppi = [];
    for (const ev of eventiDelMese) {
      const ultimo = gruppi[gruppi.length - 1];
      if (ultimo && isSameDay(ultimo.data, ev.start)) ultimo.eventi.push(ev);
      else gruppi.push({ data: ev.start, eventi: [ev] });
    }
    return gruppi;
  }, [eventiDelMese]);

  // Le squadre che hanno almeno un impegno nel mese: il secondo numero
  const squadreInCampo = useMemo(
    () => new Set(eventiDelMese.map(ev => ev.category)).size,
    [eventiDelMese]
  );

  // Le squadre dei filtri raccolte per sport, nell'ordine in cui arrivano
  const gruppiSport = useMemo(() => {
    const gruppi = [];
    for (const c of availableCategories) {
      let g = gruppi.find(x => x.sport === c.sport);
      if (!g) gruppi.push(g = { sport: c.sport, squadre: [] });
      g.squadre.push(c);
    }
    return gruppi;
  }, [availableCategories]);

  const toggleFilter = (categoryName) => {
    setActiveFilters(prev => prev.includes(categoryName)
      ? prev.filter(k => k !== categoryName)
      : [...prev, categoryName]
    );
  };

  // Seleziona o deseleziona tutto
  const toggleAllFilters = () => {
    if (activeFilters.length > 0) {
      setActiveFilters([]);
    } else {
      setActiveFilters(availableCategories.map(c => c.id));
    }
  };

  /* Un tocco sul nome dello sport accende o spegne tutte le sue squadre:
     chi segue solo la pallavolo non deve spegnere a mano dodici pastiglie. */
  const toggleSport = (gruppo) => {
    const ids = gruppo.squadre.map(s => s.id);
    const tutteAccese = ids.every(id => activeFilters.includes(id));
    setActiveFilters(prev => tutteAccese
      ? prev.filter(id => !ids.includes(id))
      : [...new Set([...prev, ...ids])]
    );
  };

  const mostraTutte = () => setActiveFilters(availableCategories.map(c => c.id));

  // Mese e elenco si spostano di un mese, il giorno di un giorno
  const handleNavigate = (direction) => {
    const newDate = new Date(currentDate);
    const passo = direction === "PREV" ? -1 : 1;
    if (view === 'list') {
      newDate.setDate(newDate.getDate() + passo);
    } else {
      // Dal 31 si va al primo del mese: setMonth dal 31 gennaio salterebbe marzo
      newDate.setDate(1);
      newDate.setMonth(newDate.getMonth() + passo);
    }
    setCurrentDate(newDate);
  };

  // Stabile fra un render e l'altro: la scheda lo usa in un effetto, e una
  // funzione nuova a ogni render lo rifarebbe partire (e le ruberebbe il fuoco).
  const chiudiScheda = useCallback(() => setSelectedEvent(null), []);

  const cambiaVista = useCallback((nuova) => {
    setView(nuova);
    setVistaCambiata(true);
  }, []);

  const apriGiorno = useCallback((data) => {
    setCurrentDate(data);
    cambiaVista('list');
  }, [cambiaVista]);

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

  const nextMatch = useMemo(() => {
    if (loading) return null;

    const futureEvents = filteredEvents
      .filter(e => e.start >= new Date())
      .sort((a, b) => a.start - b.start);

    // Nel mese mostrato non c'è niente in arrivo: vale il prossimo in
    // assoluto, anche se cade in un altro mese.
    return futureEvents.length > 0 ? futureEvents[0] : prossimo;
  }, [filteredEvents, loading, prossimo]);

  // Il titolo grande: il mese, oppure il giorno nella vista del giorno
  const titoloGrande = view === 'list'
    ? `${nomeGiorno(currentDate)} ${currentDate.getDate()}`
    : MONTH_NAMES[visibleMonth];
  const titoloCoda = view === 'list'
    ? `${MONTH_NAMES[visibleMonth]} ${visibleYear}`
    : String(visibleYear);
  const etichettaBreve = view === 'list'
    ? formatDayHeader(currentDate)
    : `${MONTH_NAMES[visibleMonth]} ${visibleYear}`;

  const oggi = new Date();
  const annoStagione = oggi.getMonth() >= 6 ? oggi.getFullYear() : oggi.getFullYear() - 1;
  const filtriParziali = availableCategories.length > 0 && activeFilters.length < availableCategories.length;

  if (error) {
    return (
      <div className="cp-pagina">
        <header className="cp-eroe">
          <div className="cp-eroe-dentro">
            <h1 className="cp-titolo"><span className="cp-titolo-grande">Calendario</span></h1>
            <p className="cp-sottotitolo">Il calendario non si è caricato: {error}</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="cp-pagina">

      {/* ---------- TESTATA ----------
          Blu come la barra di navigazione, a cui si attacca: il mese in
          grande è la prima cosa che si legge, perché è la domanda con cui
          si apre un calendario ("che mese sto guardando?"). */}
      <header className="cp-eroe">
        <div className="mv-aurora" aria-hidden="true" />
        <div className="cp-eroe-trama" aria-hidden="true" />
        {/* Il numero del mese, enorme e vuoto, che scorre più lento: dice
            "calendario" senza una parola, ed è solo decorazione. */}
        <span className="cp-eroe-fantasma" data-parallasse="0.12" aria-hidden="true">
          {String(visibleMonth + 1).padStart(2, "0")}
        </span>

        <div className="cp-eroe-dentro">
          <div className="cp-eroe-testa">
            <p className="cp-occhiello" data-rivela="sfuma">
              <span className="cp-punto" aria-hidden="true" />
              Calendario · Stagione {annoStagione}/{String(annoStagione + 1).slice(2)}
            </p>
            <h1 className="cp-titolo" ref={titoloRef} aria-live="polite" data-rivela>
              <span className="cp-titolo-grande">{titoloGrande}</span>
              <span className="cp-titolo-coda mv-testo-vivo">{titoloCoda}</span>
            </h1>
            <p className="cp-sottotitolo" data-rivela>
              Partite, allenamenti e appuntamenti di tutte le squadre. Tocca un
              giorno per vederlo per esteso, o filtra per squadra.
            </p>
          </div>

          {/* A destra, un piccolo mosaico: il prossimo impegno e i numeri
              del mese. Il prossimo si apre come ogni altro evento. */}
          <div className="cp-eroe-mosaico" data-rivela-gruppo>
            <div className="cp-prossimo mv-vetro" style={{ "--cp-c": nextMatch?.color || "#ff6600" }}>
              <span className="cp-prossimo-etichetta">
                <span className="cp-punto" aria-hidden="true" /> Prossimo impegno
              </span>
              {loading ? (
                <div className="cp-loader cp-loader-piccolo" />
              ) : nextMatch ? (
                <button type="button" className="cp-prossimo-corpo" onClick={() => setSelectedEvent(nextMatch)}>
                  <span className="cp-prossimo-squadra">
                    <span className="cp-dot" aria-hidden="true" /> {nextMatch.category}
                  </span>
                  <span className="cp-prossimo-titolo">{nextMatch.title}</span>
                  <span className="cp-prossimo-quando">
                    <FiClock aria-hidden="true" />
                    {formatDate(nextMatch.start)}{nextMatch.hasTime ? ` · ${formatTime(nextMatch.start)}` : ""}
                  </span>
                  <span className="cp-prossimo-apri">Dettagli <FiArrowRight aria-hidden="true" /></span>
                </button>
              ) : (
                <p className="cp-prossimo-vuoto">Nessun evento in programma</p>
              )}
            </div>

            <div className="cp-numero mv-vetro">
              <strong>{loading ? "–" : eventiDelMese.length}</strong>
              <span>Impegni a {MONTH_NAMES[visibleMonth].toLowerCase()}</span>
            </div>
            <div className="cp-numero mv-vetro">
              <strong>{loading ? "–" : squadreInCampo}</strong>
              <span>Squadre in campo</span>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- COMANDI ----------
          Sale sul bordo della testata e resta attaccato in alto scorrendo:
          mese avanti e indietro servono proprio mentre si scorre l'elenco. */}
      <div className="cp-comandi-fascia">
        <div className="cp-comandi">
          <div className="cp-nav-controls">
            <button type="button" onClick={() => handleNavigate("PREV")} className="cp-btn-icon"
              aria-label={view === 'list' ? "Giorno precedente" : "Mese precedente"}>
              <FiChevronLeft size={20} />
            </button>
            <button type="button" onClick={() => setCurrentDate(new Date())} className="cp-btn-text">Oggi</button>
            <button type="button" onClick={() => handleNavigate("NEXT")} className="cp-btn-icon"
              aria-label={view === 'list' ? "Giorno successivo" : "Mese successivo"}>
              <FiChevronRight size={20} />
            </button>
          </div>

          <span className={`cp-comandi-titolo ${titoloFuori ? 'is-visibile' : ''}`} aria-hidden={!titoloFuori}>
            {etichettaBreve}
          </span>

          <div className="cp-view-controls" role="group" aria-label="Vista">
            {VISTE.map(({ id, nome, Icona }) => (
              <button
                key={id}
                type="button"
                onClick={() => cambiaVista(id)}
                aria-pressed={view === id}
                className={`cp-btn-view ${view === id ? 'cp-active' : ''}`}
              >
                <Icona aria-hidden="true" /> <span>{nome}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            ref={apriCassettoRef}
            className="cp-btn-mobile-filter"
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label={`Filtri: ${activeFilters.length} squadre su ${availableCategories.length}`}
          >
            <FiSliders size={18} aria-hidden="true" />
            {filtriParziali && <span className="cp-btn-filtri-conta">{activeFilters.length}</span>}
          </button>
        </div>
      </div>

      <div className="cp-main-grid">

        {/* ---------- SPALLA ----------
            Sul computer una colonna; sul telefono un pannello che sale dal
            basso. Le schede compaiono una dopo l'altra; la griglia del mese
            no: è lo strumento, deve essere lì subito. */}
        {isMobileSidebarOpen && <div className="cp-backdrop" onClick={() => setIsMobileSidebarOpen(false)} />}
        <aside
          className={`cp-sidebar ${isMobileSidebarOpen ? 'cp-mobile-open' : ''}`}
          aria-label="Filtri del calendario"
          data-rivela-gruppo
        >
          <div className="cp-filtri">
            <div className="cp-mobile-drag-handle" aria-hidden="true" />
            <div className="cp-filtri-testa">
              <div>
                <h2 className="cp-filtri-titolo">Squadre</h2>
                <p className="cp-filtri-conta">
                  {activeFilters.length} di {availableCategories.length} nel calendario
                </p>
              </div>
              <button type="button" className="cp-btn-reset" onClick={toggleAllFilters}>
                {activeFilters.length > 0 ? "Nessuna" : "Tutte"}
              </button>
              <button
                type="button"
                ref={chiudiCassettoRef}
                className="cp-btn-close-mobile"
                onClick={() => setIsMobileSidebarOpen(false)}
                aria-label="Chiudi i filtri"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="cp-filtri-gruppi">
              {gruppiSport.map((g) => {
                const accese = g.squadre.filter(s => activeFilters.includes(s.id)).length;
                return (
                  <div key={g.sport} className="cp-filtri-gruppo">
                    <button
                      type="button"
                      className="cp-filtri-sport"
                      onClick={() => toggleSport(g)}
                      aria-pressed={accese === g.squadre.length ? true : accese === 0 ? false : "mixed"}
                    >
                      <span>{NOME_SPORT[g.sport] ?? g.sport}</span>
                      <small>{accese}/{g.squadre.length}</small>
                    </button>
                    <div className="cp-filtri-pastiglie">
                      {g.squadre.map((category) => (
                        <FilterToggle
                          key={category.id}
                          label={nomeCorto(category.label || category.id, prefissoGruppo(g.sport, g.squadre))}
                          fullLabel={category.id}
                          color={category.color}
                          checked={activeFilters.includes(category.id)}
                          onChange={() => toggleFilter(category.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Solo sul telefono: chiude il pannello dicendo cosa si vedrà */}
            <div className="cp-filtri-applica">
              <button type="button" onClick={() => setIsMobileSidebarOpen(false)}>
                Mostra {eventiDelMese.length} {eventiDelMese.length === 1 ? "impegno" : "impegni"}
                {" "}a {MONTH_NAMES[visibleMonth].toLowerCase()}
              </button>
            </div>
          </div>

          {/* Sul computer nella colonna; sul telefono sotto al calendario (vedi in fondo) */}
          <CalendarioSulTelefono squadre={availableCategories} className="cp-abbona-lato" />
        </aside>

        {/* ---------- IL CALENDARIO ---------- */}
        <main className="cp-calendar-wrapper">
          {filtriParziali && (
            <div className="cp-avviso-filtri">
              <FiSliders aria-hidden="true" />
              <span>
                Stai guardando <strong>{activeFilters.length}</strong> squadre su {availableCategories.length}
              </span>
              <button type="button" onClick={mostraTutte}>Mostra tutte</button>
            </div>
          )}

          {/* La chiave cambia con la vista: il contenuto nuovo entra con una
              breve dissolvenza, e si capisce che la vista è cambiata. */}
          <div className={`cp-calendar-content ${vistaCambiata ? 'cp-entra' : ''} ${loading ? 'cp-in-attesa' : ''}`} key={view}>
            {loading && <div className="cp-loader"></div>}

            {!loading && view === 'month' && (
              <>
                <div className="cp-week-header" aria-hidden="true">
                  {DAY_NAMES.map((day, i) => (
                    <div key={day} className={`cp-day-name ${i >= 5 ? 'cp-weekend' : ''}`}>{day}</div>
                  ))}
                </div>
                <div className="cp-month-grid">
                  {calendarDays.map((dayObj, idx) => {
                    const dayEvents = perGiorno.get(chiaveGiorno(dayObj.date)) || [];
                    const isToday = isSameDay(oggi, dayObj.date);
                    const visibili = dayEvents.slice(0, PILLOLE_PER_CASELLA);
                    const altri = dayEvents.length - visibili.length;
                    const openDay = () => apriGiorno(dayObj.date);
                    return (
                      <div
                        key={idx}
                        className={[
                          'cp-day-cell',
                          dayObj.isCurrentMonth ? 'cp-current-month' : 'cp-other-month',
                          isToday ? 'cp-today' : '',
                          idx % 7 >= 5 ? 'cp-weekend' : '',
                          dayEvents.length ? 'cp-con-eventi' : ''
                        ].join(' ')}
                        role="button"
                        tabIndex={0}
                        aria-label={`${formatDayHeader(dayObj.date)}${isToday ? ", oggi" : ""}: ${
                          dayEvents.length === 0 ? "nessun impegno" : dayEvents.length === 1 ? "1 impegno" : `${dayEvents.length} impegni`}`}
                        onClick={openDay}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDay(); } }}
                      >
                        <div className="cp-day-header">
                          <span className="cp-day-number">{dayObj.date.getDate()}</span>
                          {isToday && <span className="cp-oggi-etichetta">Oggi</span>}
                        </div>
                        <div className="cp-events-container">
                          {visibili.map(ev => <EventPill key={ev.id} event={ev} onClick={setSelectedEvent} />)}
                          {altri > 0 && <span className="cp-altri">+{altri}<span className="cp-altri-parola"> altri</span></span>}
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
                    <FiCalendar className="cp-empty-icona" aria-hidden="true" />
                    <p>
                      Nessun impegno per<br />
                      <strong>{formatDayHeader(currentDate)}</strong>
                    </p>
                    <button type="button" className="cp-empty-azione" onClick={() => cambiaVista('agenda')}>
                      Vedi tutto il mese <FiArrowRight aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="cp-righe">
                    {dailyEvents.map(ev => <RigaEvento key={ev.id} ev={ev} onApri={setSelectedEvent} />)}
                  </div>
                )}
              </div>
            )}

            {!loading && view === 'agenda' && (
              <div className="cp-list-container">
                {giorniDelMese.length === 0 ? (
                  <div className="cp-empty-state">
                    <FiCalendar className="cp-empty-icona" aria-hidden="true" />
                    <p>
                      Nessun impegno a<br />
                      <strong>{MONTH_NAMES[visibleMonth]} {visibleYear}</strong>
                    </p>
                  </div>
                ) : (
                  <ol className="cp-agenda">
                    {giorniDelMese.map(({ data, eventi }) => {
                      const eOggi = isSameDay(data, oggi);
                      const passato = !eOggi && data < oggi;
                      return (
                        <li
                          key={chiaveGiorno(data)}
                          className={`cp-agenda-giorno ${eOggi ? 'cp-today' : ''} ${passato ? 'cp-agenda-passato' : ''}`}
                        >
                          {/* La data resta attaccata in alto mentre scorrono i
                              suoi impegni: in un giorno con cinque partite non
                              si perde il segno. */}
                          <button type="button" className="cp-agenda-data" onClick={() => apriGiorno(data)}
                            aria-label={`Apri ${formatDayHeader(data)}`}>
                            <span className="cp-agenda-sett">{DAY_NAMES[(data.getDay() + 6) % 7]}</span>
                            <span className="cp-agenda-num">{data.getDate()}</span>
                            {eOggi && <span className="cp-agenda-oggi">Oggi</span>}
                          </button>
                          <div className="cp-righe">
                            {eventi.map(ev => <RigaEvento key={ev.id} ev={ev} onApri={setSelectedEvent} />)}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Sul telefono il riquadro sta qui, sotto al calendario, e non
            dentro al pannello dei filtri: chi cerca come portare le partite
            sul telefono non va a cercarle fra i filtri. */}
        <CalendarioSulTelefono squadre={availableCategories} className="cp-abbona-sotto" />

      </div>

      <EventDetailsModal
        event={selectedEvent}
        onClose={chiudiScheda}
      />

    </div>
  );
}
