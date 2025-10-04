import { useState, useMemo, useCallback } from "react";
import { Form, Button, Container } from "react-bootstrap";
import DatePicker from "react-datepicker";
import NewsList from "./NewsList";
import "react-datepicker/dist/react-datepicker.css";
import "../css/NewsPage.css";

// --- Helper e costanti ---
const parseDate = (str) => {
  const [day, month, year] = str.split("/").map(Number);
  return new Date(year, month - 1, day);
};

const months = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 1980 + 1 }, (_, i) => 1980 + i);

export default function NewsPage() {
  const mockNews = useMemo(() => [
    { id: 1, title: "Iscrizioni aperte per la scuola calcio 2025", date: "01/10/2025", sport: "Calcio",    author: "Staff PSD", image: "immaginiNotizie/scuolaCalcio.jpg", excerpt: "La scuola calcio apre le iscrizioni per tutti i bambini dai 6 ai 12 anni." },
    { id: 2, title: "Torneo di Pallavolo giovanile",               date: "20/09/2025", sport: "Pallavolo", author: "Staff PSD", image: "immaginiNotizie/torneoPallavolo.jpg", excerpt: "Si terrà il torneo di pallavolo giovanile presso la palestra comunale." },
    { id: 3, title: "Nuovo corso di basket",                       date: "15/10/2025", sport: "Basket",    author: "Staff PSD", image: "immaginiNotizie/corsoBasket.jpg", excerpt: "Iscriviti al nuovo corso di basket per principianti!" },
    { id: 4, title: "Camp estivo sportivo PSD",                    date: "05/07/2025", sport: "Multisport",author: "Dirigenza", image: "immaginiNotizie/campoEstivo.jpg", excerpt: "Il camp estivo PSD è aperto a tutti i bambini." },
    { id: 5, title: "Apertura nuova palestra",                     date: "10/06/2025", sport: "Multisport",author: "Dirigenza", image: "immaginiNotizie/pesiPalestra.jpg", excerpt: "La nuova palestra comunale è aperta a tutti i bambini." },
    { id: 6, title: "Aperte iscrizioni torneo calcio a 5",         date: "20/06/2025", sport: "Calcio",    author: "Staff PSD", image: "immaginiNotizie/torneoCalcetto.jpg", excerpt: "Iscriviti al torneo di calcio a 5 per bambini dai 6 ai 12 anni." },
    { id: 7, title: "Aperte iscrizioni torneo pallavolo",          date: "25/06/2025", sport: "Pallavolo",author: "Staff PSD", image: "immaginiNotizie/torneoPallavolo.jpg", excerpt: "Iscriviti al torneo di pallavolo per bambini dai 6 ai 12 anni." }
  ], []);

  const [sportFilter, setSportFilter] = useState([]);
  const [authorFilter, setAuthorFilter] = useState([]);
  const [dateRange, setDateRange] = useState([null, null]);
  const [sortOrder, setSortOrder] = useState("desc");
  const [startDate, endDate] = dateRange;

  const sportsList = useMemo(() => [...new Set(mockNews.map(n => n.sport))], [mockNews]);
  const authorsList = useMemo(() => [...new Set(mockNews.map(n => n.author))], [mockNews]);

  const toggleFilter = useCallback((value, setFilter) => {
    setFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }, []);

  const filteredNews = useMemo(() => {
    return mockNews
      .filter(n => (!sportFilter.length || sportFilter.includes(n.sport)) &&
                   (!authorFilter.length || authorFilter.includes(n.author)))
      .filter(n => {
        const newsDate = parseDate(n.date);
        return (!startDate || newsDate >= startDate) && (!endDate || newsDate <= endDate);
      })
      .sort((a, b) => sortOrder === "desc"
        ? parseDate(b.date) - parseDate(a.date)
        : parseDate(a.date) - parseDate(b.date)
      );
  }, [mockNews, sportFilter, authorFilter, startDate, endDate, sortOrder]);

  const handleResetFilters = useCallback(() => {
    setSportFilter([]);
    setAuthorFilter([]);
    setDateRange([null, null]);
    setSortOrder("desc");
  }, []);

  return (
    <section className="news-section">
      <h2 className="news-section-title">Notizie della Polisportiva San Paolo</h2>
      <div className="news-layout">
        <aside className="news-sidebar">
          <h4>Filtri</h4>
          <Form>
            <FilterGroup label="Sport" options={sportsList} selected={sportFilter} toggleFilter={toggleFilter} setFilter={setSportFilter} />
            <FilterGroup label="Pubblicatore" options={authorsList} selected={authorFilter} toggleFilter={toggleFilter} setFilter={setAuthorFilter} />
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
            <Form.Group className="form-group">
              <Form.Label className="form-label">Ordina per data</Form.Label>
              <Form.Select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="form-select">
                <option value="desc">Dal più recente</option>
                <option value="asc">Dal meno recente</option>
              </Form.Select>
            </Form.Group>
            <Button className="filter-reset-btn" onClick={handleResetFilters}>Reset Filtri</Button>
          </Form>
        </aside>

        <Container className="section-spacing">
          <NewsList news={filteredNews} />
        </Container>
      </div>
    </section>
  );
}

function FilterGroup({ label, options, selected, toggleFilter, setFilter }) {
  return (
    <Form.Group className="form-group">
      <Form.Label className="form-label">{label}</Form.Label>
      {options.map(opt => (
        <Form.Check
          key={opt}
          type="checkbox"
          label={opt}
          className="form-check custom-checkbox"
          onChange={() => toggleFilter(opt, setFilter)}
          checked={selected.includes(opt)}
        />
      ))}
    </Form.Group>
  );
}
