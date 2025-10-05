import { useState, useMemo, useCallback } from "react";
import { Form, Button, Container } from "react-bootstrap";
import DatePicker from "react-datepicker";
import NewsList from "./NewsList";
import "react-datepicker/dist/react-datepicker.css";
import "../css/NewsPage.css";

/* ==========================
   🔧 Helper e costanti utili
   ========================== */

// Converte una data in formato "gg/mm/aaaa" in un oggetto Date
const parseDate = (str) => {
  const [day, month, year] = str.split("/").map(Number);
  return new Date(year, month - 1, day);
};

// Mesi e anni usati dal DatePicker
const months = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 1990 + 1 }, (_, i) => 1990 + i);

/* =====================================================
   📰 Componente principale che gestisce filtri e notizie
   ===================================================== */
export default function NewsPage() {

  /* ---------------------------------------------------
     🧾 Mock di notizie fittizie (statiche)
     --------------------------------------------------- */
  // useMemo evita di ricrearle a ogni render
  const mockNews = useMemo(() =>[
  {
    id: 1,
    title: "Scuola Calcio PRO per bambine e bambini",
    subtitle: "del 2017 – 2018",
    preview: "Allenamenti di prova per bambine e bambini del 2017-2018 presso l’Oratorio Sant’Alfonso.",
    date: "05/10/2025",
    sport: "Calcio",
    author: "Staff PSD",
    image: "immaginiNotizie/scuolaCalcio.jpg",
    excerpt: "Dal 10 ottobre 2025 ci saranno allenamenti di prova ogni mercoledì dalle 17:15 presso il campo dell’Oratorio Sant’Alfonso in via Netro 3 – Torino. Per informazioni: PIETRO +39 3384159476."
  },
  {
    id: 2,
    title: "Scuola Calcio START per bambine e bambini",
    subtitle: "del 2019 – 2018",
    preview: "Allenamenti di prova per bambine e bambini del 2019-2018 presso l’Oratorio San Donato.",
    date: "05/10/2025",
    sport: "Calcio",
    author: "Staff PSD",
    image: "immaginiNotizie/scuolaCalcio.jpg",
    excerpt: "Dal 10 ottobre 2025 ci saranno allenamenti di prova ogni venerdì dalle 17:15 presso il campo dell’Oratorio San Donato in via Le Chiuse 20/A – Torino. Per informazioni: MATTEO +39 380 2671212."
  },
  {
    id: 3,
    title: "CALCIO A 7",
    preview: "Allenamenti di calcio a 7 presso l’Oratorio Sant’Alfonso per annate 2013-2016.",
    date: "05/10/2025",
    sport: "Calcio a 7",
    author: "Staff PSD",
    image: "immaginiNotizie/scuolaCalcio.jpg",
    excerpt: "Gli allenamenti si terranno presso il campo dell’Oratorio Sant’Alfonso in via Netro 3 – Torino. Annate 2015 – 2016: lunedì e giovedì dalle 16:45. Annate 2013 – 2014: lunedì e giovedì dalle 18:15."
  },
  {
    id: 4,
    title: "CALCIO A 11",
    preview: "Allenamenti di calcio a 11 per annate 2009-2013, over 18 CSI e Prima squadra presso il campo di via Paolo Veronese.",
    date: "05/10/2025",
    sport: "Calcio a 11",
    author: "Staff PSD",
    image: "immaginiNotizie/scuolaCalcio.jpg",
    excerpt: "Gli allenamenti si terranno presso il campo di via Paolo Veronese 173/A - Torino. Annate 2012 – 2013: martedì e giovedì dalle 17:00. Annate 2010 – 2011: martedì e giovedì dalle 17:00. Annate 2007 – 2009: martedì e giovedì dalle 18:30. Over 18 CSI: lunedì e mercoledì dalle 20:00. Prima Squadra: martedì e giovedì dalle 21:00."
  },
  {
    id: 5,
    title: "MINIVOLLEY per bambine e bambini",
    subtitle: "del 2019 – 2018",
    preview: "Allenamenti di minivolley per bambine e bambini presso la palestra Cartiera.",
    date: "05/10/2025",
    sport: "Minivolley",
    author: "Staff PSD",
    image: "immaginiNotizie/torneoPallavolo.jpg",
    excerpt: "Gli allenamenti si terranno alla palestra Cartiera in via Fossano 8, Torino. Per informazioni: DAVIDE +39 3283922664."
  },
  {
    id: 6,
    title: "PALLAVOLO GIOVANILI per ragazze",
    subtitle: "dal 2013 al 2007",
    preview: "Allenamenti di pallavolo giovanile per ragazze presso la palestra Cartiera.",
    date: "05/10/2025",
    sport: "Pallavolo",
    author: "Staff PSD",
    image: "immaginiNotizie/torneoPallavolo.jpg",
    excerpt: "Gli allenamenti si svolgeranno alla palestra Cartiera in via Fossano 8, Torino. Per informazioni: DAVIDE +39 3283922664."
  },
  {
    id: 7,
    title: "PALLAVOLO campionati ADULTI",
    subtitle: "Femminili e Misto",
    preview: "Allenamenti di pallavolo per campionati adulti presso la palestra Cartiera.",
    date: "05/10/2025",
    sport: "Pallavolo",
    author: "Staff PSD",
    image: "immaginiNotizie/torneoPallavolo.jpg",
    excerpt: "Gli allenamenti si terranno alla palestra Cartiera in via Fossano 8, Torino. Per informazioni: DAVIDE +39 3283922664."
  },
  {
    id: 8,
    title: "BASKET GIOVANILE U19M",
    subtitle: "dal 2005 – 2007",
    preview: "Allenamenti di basket giovanile per U19M presso la palestra Cartiera.",
    date: "05/10/2025",
    sport: "Basket",
    author: "Staff PSD",
    image: "immaginiNotizie/corsoBasket.jpg",
    excerpt: "Gli allenamenti si svolgeranno alla palestra Cartiera in via Fossano 8, Torino. Per informazioni: ALESSIO +39 3478248674."
  },
  {
    id: 9,
    title: "BASKET CAMPIONATO OPEN",
    subtitle: "maschile",
    preview: "Allenamenti di basket per il campionato open maschile presso la palestra Cartiera.",
    date: "05/10/2025",
    sport: "Basket",
    author: "Staff PSD",
    image: "immaginiNotizie/corsoBasket.jpg",
    excerpt: "Gli allenamenti si terranno alla palestra Cartiera in via Fossano 8, Torino. Per informazioni: ALESSIO +39 3478248674."
  },
  {
    id: 10,
    title: "FESTA di INAUGURAZIONE STAGIONE 2025-2026",
    preview: "Grande festa di inaugurazione stagione 2025-2026 con giochi, quiz e aperitivo.",
    date: "05/07/2025",
    sport: "Multisport",
    author: "Dirigenza",
    image: "immaginiNotizie/campoEstivo.jpg",
    excerpt: "Sabato 11 ottobre dalle 18 nel salone San Donato in Via Le Chiuse 20/A. Festa di inizio stagione “in stile PSD” con sfida tra squadre della PSD nella QUIZ NIGHT, giochi, foto squadre e aperitivo per iniziare tutti insieme. Vi aspettiamo!"
  }
], []);

  /* ---------------------------------------------------
     🎛️ Stati dei filtri
     --------------------------------------------------- */
  const [sportFilter, setSportFilter] = useState([]);   // Sport selezionati
  const [authorFilter, setAuthorFilter] = useState([]); // Autori selezionati
  const [dateRange, setDateRange] = useState([null, null]); // Intervallo date
  const [sortOrder, setSortOrder] = useState("desc");   // Ordinamento (desc o asc)
  const [startDate, endDate] = dateRange;               // Destructuring dell'intervallo

  /* ---------------------------------------------------
     📋 Liste uniche di sport e autori (per i checkbox)
     --------------------------------------------------- */
  const sportsList = useMemo(() => [...new Set(mockNews.map(n => n.sport))], [mockNews]);
  const authorsList = useMemo(() => [...new Set(mockNews.map(n => n.author))], [mockNews]);

  /* ---------------------------------------------------
     ✅ Funzione generica per aggiungere/rimuovere filtri
     --------------------------------------------------- */
  const toggleFilter = useCallback((value, setFilter) => {
    setFilter(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)   // Se già selezionato → rimuovilo
        : [...prev, value]                // Altrimenti → aggiungilo
    );
  }, []);

  /* ---------------------------------------------------
     🧮 Calcolo notizie filtrate e ordinate
     --------------------------------------------------- */
  const filteredNews = useMemo(() => {
    return mockNews
      // Filtro per sport e autore
      .filter(n => (!sportFilter.length || sportFilter.includes(n.sport)) &&
        (!authorFilter.length || authorFilter.includes(n.author)))
      // Filtro per intervallo di date
      .filter(n => {
        const newsDate = parseDate(n.date);
        return (!startDate || newsDate >= startDate) && (!endDate || newsDate <= endDate);
      })
      // Ordinamento per data
      .sort((a, b) => sortOrder === "desc"
        ? parseDate(b.date) - parseDate(a.date)
        : parseDate(a.date) - parseDate(b.date)
      );
  }, [mockNews, sportFilter, authorFilter, startDate, endDate, sortOrder]);

  /* ---------------------------------------------------
     ♻️ Reset di tutti i filtri
     --------------------------------------------------- */
  const handleResetFilters = useCallback(() => {
    setSportFilter([]);
    setAuthorFilter([]);
    setDateRange([null, null]);
    setSortOrder("desc");
  }, []);

  /* ---------------------------------------------------
     🖼️ Render del componente
     --------------------------------------------------- */
  return (
    <section className="news-section">
      <h2 className="news-section-title">Notizie della Polisportiva San Paolo</h2>

      <div className="news-layout">
        {/* Sidebar con tutti i filtri */}
        <aside className="news-sidebar">
          <h4>Filtri</h4>
          <Form>
            {/* Filtri per sport e pubblicatore */}
            <FilterGroup label="Sport" options={sportsList} selected={sportFilter} toggleFilter={toggleFilter} setFilter={setSportFilter} />
            <FilterGroup label="Pubblicatore" options={authorsList} selected={authorFilter} toggleFilter={toggleFilter} setFilter={setAuthorFilter} />

            {/* Filtro per periodo tramite DatePicker */}
            <Form.Group className="form-group">
              <Form.Label className="form-label">Periodo</Form.Label>
              <DatePicker
                selectsRange
                startDate={startDate}
                endDate={endDate}
                onChange={setDateRange}
                className="form-control custom-datepicker"
                placeholderText="Seleziona intervallo"
                isClearable
                // Personalizzazione intestazione calendario
                renderCustomHeader={({ date, changeYear, changeMonth, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
                  <div className="custom-header">
                    <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled} className="react-datepicker__navigation react-datepicker__navigation--previous">&lt;</button>
                    <div className="custom-header-selects">
                      <select value={date.getMonth()} onChange={({ target }) => changeMonth(Number(target.value))} className="custom-month-select modern-select">
                        {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                      </select>
                      <select value={date.getFullYear()} onChange={({ target }) => changeYear(Number(target.value))} className="custom-year-select modern-select">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <button onClick={increaseMonth} disabled={nextMonthButtonDisabled} className="react-datepicker__navigation react-datepicker__navigation--next">&gt;</button>
                  </div>
                )}
              />
            </Form.Group>

            {/* Ordinamento per data */}
            <Form.Group className="form-group">
              <Form.Label className="form-label">Ordina per data</Form.Label>
              <Form.Select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="form-select">
                <option value="desc">Dal più recente</option>
                <option value="asc">Dal meno recente</option>
              </Form.Select>
            </Form.Group>

            {/* Pulsante reset */}
            <Button className="filter-reset-btn" onClick={handleResetFilters}>Reset Filtri</Button>
          </Form>
        </aside>

        {/* Lista notizie filtrate */}
        <div className="news-list-wrapper section-spacing">
          <NewsList news={filteredNews} />
        </div>
      </div>
    </section>
  );
}

/* =====================================================
   🧩 Componente riutilizzabile per checkbox dei filtri
   ===================================================== */
function FilterGroup({ label, options, selected, toggleFilter, setFilter }) {
  return (
    <Form.Group className="form-group">
      <Form.Label className="form-label">{label}</Form.Label>
      {/* Genera un checkbox per ogni opzione */}
      {options.map(opt => (
        <Form.Check
          key={opt}
          type="checkbox"
          label={opt}
          className="form-check custom-checkbox"
          onChange={() => toggleFilter(opt, setFilter)}   // Gestione selezione
          checked={selected.includes(opt)}                 // Stato del checkbox
        />
      ))}
    </Form.Group>
  );
}
