import { useState, useMemo, useCallback, useEffect } from "react";
import { Form, Button } from "react-bootstrap";
import DatePicker from "react-datepicker";
import NewsList from "./NewsList";
import { getAllPosts } from "../api/API.mjs";
import "react-datepicker/dist/react-datepicker.css";
import "../css/NewsPage.css";

export default function NewsPage() {
  const [news, setNews] = useState([]);
  const [sportFilter, setSportFilter] = useState([]);
  const [authorFilter, setAuthorFilter] = useState([]);
  const [dateRange, setDateRange] = useState([null, null]);
  const [sortOrder, setSortOrder] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [showMobileFilters, setShowMobileFilters] = useState(false); // 👈 visibilità filtri mobile

  const [startDate, endDate] = dateRange;

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      const posts = await getAllPosts();
      setNews(posts);
      setLoading(false);
    };
    fetchNews();
  }, []);

  const sportsList = useMemo(() => [...new Set(news.map(n => n.sport))], [news]);
  const authorsList = useMemo(() => [...new Set(news.map(n => n.author))], [news]);

  const toggleFilter = useCallback((value, setFilter) => {
    setFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }, []);

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
      .sort((a, b) => sortOrder === "desc"
        ? parseDate(b.date) - parseDate(a.date)
        : parseDate(a.date) - parseDate(b.date)
      );
  }, [news, sportFilter, authorFilter, startDate, endDate, sortOrder]);

  const handleResetFilters = useCallback(() => {
    setSportFilter([]);
    setAuthorFilter([]);
    setDateRange([null, null]);
    setSortOrder("desc");
  }, []);

  return (
    <section className="news-section">
      <h2 className="news-section-title">Notizie della Polisportiva San Paolo</h2>

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
