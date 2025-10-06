import { useState, useMemo, useCallback, useEffect } from "react";
import { Form, Button } from "react-bootstrap";
import DatePicker from "react-datepicker";
import NewsList from "./NewsList";
import { getAllPosts } from "../api/API.mjs";
import "react-datepicker/dist/react-datepicker.css";
import "../css/NewsPage.css";

const months = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 1990 + 1 }, (_, i) => 1990 + i);

const parseDate = (str) => str ? new Date(str) : new Date(0);
const formatDate = (isoDate) => {
  if (!isoDate) return "";
  const dateObj = new Date(isoDate);
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
};
const cleanText = (text) => {
  if (!text) return "";
  const replacements = [
    [/&#8211;/g, ""], [/&#038;/g, ""], [/&#8217;/g, "'"],
    [/<\/?p>/g, ""], [/&hellip;/g, ""], [/: \[...\]/g, ""],
    [/5&#215;1000/g, ""], [/&#8220;/g, ""], [/&#8221;/g, ""],
    [/\[\]/g, ""], [/PSD_[^\s]*/g, ""], [/5xmille&nbsp;/g, ""]
  ];
  return replacements.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text).trim();
};

export default function NewsPage() {
  const [news, setNews] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [sportFilter, setSportFilter] = useState([]);
  const [authorFilter, setAuthorFilter] = useState([]);
  const [dateRange, setDateRange] = useState([null, null]);
  const [sortOrder, setSortOrder] = useState("desc");

  const [startDate, endDate] = dateRange;
  const [filtersOpen, setFiltersOpen] = useState(false); // stato apertura filtri

  const fetchNews = useCallback(async () => {
    setLoading(true);
    const { posts, totalPages } = await getAllPosts(10, page);
    const cleaned = posts.map(post => ({
      ...post,
      date: formatDate(post.date),
      title: cleanText(post.title),
      preview: cleanText(post.preview)
    }));
    setNews(prev => [...prev, ...cleaned]);
    setTotalPages(totalPages);
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const sportsList = useMemo(() => [...new Set(news.map(n => n.sport))], [news]);
  const authorsList = useMemo(() => [...new Set(news.map(n => n.author))], [news]);

  const toggleFilter = useCallback((value, setFilter) => {
    setFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }, []);

  const filteredNews = useMemo(() => {
    return news
      .filter(n => (!sportFilter.length || sportFilter.includes(n.sport)) &&
                   (!authorFilter.length || authorFilter.includes(n.author)))
      .filter(n => {
        const newsDate = parseDate(n.date);
        return (!startDate || newsDate >= startDate) && (!endDate || newsDate <= endDate);
      })
      .sort((a, b) => sortOrder === "desc"
        ? parseDate(b.date) - parseDate(a.date)
        : parseDate(a.date) - parseDate(b.date));
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

      <div className="mobile-filter-toggle">
        <Button onClick={() => setFiltersOpen(!filtersOpen)} variant="primary">
          Filtri {filtersOpen ? "▲" : "▼"}
        </Button>
      </div>

      <div className={`news-layout ${filtersOpen ? "filters-open" : ""}`}>
        <aside className={`news-sidebar ${filtersOpen ? "open" : "closed"}`}>
          <h4>Filtri</h4>
          <Form>
            <FilterGroup label="Sport" options={sportsList} selected={sportFilter} toggleFilter={toggleFilter} setFilter={setSportFilter} />
            <FilterGroup label="Pubblicatore" options={authorsList} selected={authorFilter} toggleFilter={toggleFilter} setFilter={setAuthorFilter} />

            <Form.Group>
              <Form.Label>Periodo</Form.Label>
              <DatePicker selectsRange startDate={startDate} endDate={endDate} onChange={setDateRange}
                className="form-control custom-datepicker" placeholderText="Seleziona intervallo" isClearable
                renderCustomHeader={({ date, changeYear, changeMonth, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
                  <div className="custom-header">
                    <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled}>&lt;</button>
                    <select value={date.getMonth()} onChange={({ target }) => changeMonth(Number(target.value))}>{months.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
                    <select value={date.getFullYear()} onChange={({ target }) => changeYear(Number(target.value))}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
                    <button onClick={increaseMonth} disabled={nextMonthButtonDisabled}>&gt;</button>
                  </div>
                )}
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Ordina per data</Form.Label>
              <Form.Select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="desc">Dal più recente</option>
                <option value="asc">Dal meno recente</option>
              </Form.Select>
            </Form.Group>

            <Button onClick={handleResetFilters}>Reset Filtri</Button>
          </Form>
        </aside>

        <div className="news-list-wrapper section-spacing">
          <NewsList news={filteredNews} />
          {page < totalPages && <Button onClick={() => setPage(prev => prev + 1)}>Carica altre notizie</Button>}
          {loading && <div className="loader"></div>}
        </div>
      </div>
    </section>
  );
}

const FilterGroup = ({ label, options, selected, toggleFilter, setFilter }) => (
  <Form.Group>
    <Form.Label>{label}</Form.Label>
    {options.map((opt, i) => (
      <Form.Check key={i} type="checkbox" label={opt} onChange={() => toggleFilter(opt, setFilter)} checked={selected.includes(opt)} />
    ))}
  </Form.Group>
);
