import { useState, useMemo, useCallback, useEffect } from "react";
import { Form, Button } from "react-bootstrap";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import { getAllPosts } from "../../api/API.mjs";
import NewsList from "../Home/NewsList";
import "../../css/NewsPage.css";

export default function NewsPage() {
  const [news, setNews] = useState([]);
  const [sportFilter, setSportFilter] = useState([]);
  const [authorFilter, setAuthorFilter] = useState([]);
  const [dateRange, setDateRange] = useState([null, null]);
  
  // ✅ MODIFICA QUI: Impostato su "desc" per avere di default "Dalla più recente"
  const [sortOrder, setSortOrder] = useState("desc");
  
  const [loading, setLoading] = useState(true);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [startDate, endDate] = dateRange;

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      try {
        const posts = await getAllPosts();
        setNews(posts);
      } catch (error) {
        console.error("Errore nel recupero delle notizie:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  const sportsList = useMemo(() => [...new Set(news.map(n => n.sport))], [news]);
  const authorsList = useMemo(() => [...new Set(news.map(n => n.author))], [news]);

  const toggleFilter = useCallback((value, setFilter) => {
    setFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }, []);

  // Funzione helper per parsare le date in modo sicuro
  const parseDate = (str) => str ? new Date(str) : new Date(0);

  const filteredNews = useMemo(() => {
    return news
      .filter(n =>
        (!sportFilter.length || sportFilter.includes(n.sport)) &&
        (!authorFilter.length || authorFilter.includes(n.author))
      )
      .filter(n => {
        const newsDate = parseDate(n.date);
        return (!startDate || newsDate >= startDate) && (!endDate || newsDate <= endDate);
      })
      .sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        // ✅ LOGICA DI ORDINAMENTO:
        // Se "desc": dateB - dateA (La data più recente ha un timestamp più alto, quindi viene prima)
        // Se "asc": dateA - dateB (La data più vecchia viene prima)
        return sortOrder === "desc" 
          ? dateB - dateA 
          : dateA - dateB;
      });
  }, [news, sportFilter, authorFilter, startDate, endDate, sortOrder]);

  const handleResetFilters = useCallback(() => {
    setSportFilter([]);
    setAuthorFilter([]);
    setDateRange([null, null]);
    setSortOrder("desc"); // Reset riporta a discendente
  }, []);

  return (
    <section className="news-section">
      <h2 className="news-section-title">Notizie della Polisportiva San Donato</h2>

      {loading ? (
        <div className="loader-container">
          <div className="loader"></div>
        </div>
      ) : (
        <div className="news-layout">
          {/* 🔸 Pulsante visibile solo su smartphone */}
          <div className="mobile-filters-toggle">
            <Button
              className="filter-toggle-btn"
              onClick={() => setShowMobileFilters(prev => !prev)}
            >
              {showMobileFilters ? "Chiudi filtri ✕" : "Filtri ⚙️"}
            </Button>
          </div>

          {/* 🔸 Sidebar desktop + dropdown mobile */}
          <aside className={`news-sidebar ${showMobileFilters ? "show-mobile" : ""}`}>
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
                  dateFormat="dd/MM/yyyy" // Formato italiano per il DatePicker
                />
              </Form.Group>

              <Form.Group className="form-group">
                <Form.Label className="form-label">Ordina per data</Form.Label>
                <Form.Select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="form-select"
                >
                  <option value="desc">Dal più recente</option>
                  <option value="asc">Dal meno recente</option>
                </Form.Select>
              </Form.Group>

              <Button className="filter-reset-btn" onClick={handleResetFilters}>
                Reset Filtri
              </Button>
            </Form>
          </aside>

          {/* 🔸 Lista notizie */}
          <div className="news-list-wrapper section-spacing">
            <NewsList news={filteredNews} />
          </div>
        </div>
      )}
    </section>
  );
}

const FilterGroup = ({ label, options, selected, toggleFilter, setFilter }) => (
  <Form.Group className="form-group">
    <Form.Label className="form-label">{label}</Form.Label>
    {options.map((opt, index) => (
      <Form.Check
        key={`${opt}-${index}`}
        type="checkbox"
        label={opt}
        className="form-check custom-checkbox"
        onChange={() => toggleFilter(opt, setFilter)}
        checked={selected.includes(opt)}
      />
    ))}
  </Form.Group>
);