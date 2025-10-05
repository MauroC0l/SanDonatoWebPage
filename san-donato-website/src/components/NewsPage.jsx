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
  const mockNews = useMemo(() => [
    { id: 1, title: "Ripartono le iscrizioni alla scuola calcio PSD 2025", date: "02/01/2025", sport: "Calcio", author: "Staff PSD", image: "immaginiNotizie/scuolaCalcio.jpg", excerpt: "La nuova stagione calcistica è alle porte: aperte le iscrizioni per bambini e ragazzi dai 6 ai 13 anni." },
    { id: 2, title: "Torneo giovanile di pallavolo – Edizione 2025", date: "18/03/2025", sport: "Pallavolo", author: "Comitato Sportivo PSD", image: "immaginiNotizie/torneoPallavolo.jpg", excerpt: "Il tradizionale torneo giovanile torna con squadre provenienti da tutta la provincia." },
    { id: 3, title: "Al via il nuovo corso di basket per principianti", date: "05/04/2025", sport: "Basket", author: "Staff PSD", image: "immaginiNotizie/corsoBasket.jpg", excerpt: "Un corso pensato per chi vuole avvicinarsi al basket in modo divertente e formativo." },
    { id: 4, title: "Camp estivo multisport PSD: iscrizioni aperte!", date: "15/05/2025", sport: "Multisport", author: "Dirigenza PSD", image: "immaginiNotizie/campoEstivo.jpg", excerpt: "Un’estate di sport, giochi e amicizia per bambini e ragazzi dai 7 ai 15 anni." },
    { id: 5, title: "Inaugurazione della nuova palestra comunale PSD", date: "25/06/2025", sport: "Multisport", author: "Dirigenza PSD", image: "immaginiNotizie/pesiPalestra.jpg", excerpt: "Una struttura moderna e completamente rinnovata, dedicata a fitness e attività sportive di gruppo." },
    { id: 6, title: "Torneo estivo di calcio a 5: iscrizioni aperte", date: "10/07/2025", sport: "Calcio", author: "Staff PSD", image: "immaginiNotizie/torneoCalcetto.jpg", excerpt: "Partecipa al torneo estivo di calcio a 5: squadre amatoriali e giovanili da tutta la regione." },
    { id: 7, title: "Torneo scolastico di pallavolo 2025", date: "01/09/2025", sport: "Pallavolo", author: "Settore Giovanile PSD", image: "immaginiNotizie/torneoPallavolo.jpg", excerpt: "Le scuole del territorio si sfidano nel consueto appuntamento di fine estate dedicato alla pallavolo." },
    { id: 8, title: "Nuove divise ufficiali per la stagione 2025/26", date: "15/09/2025", sport: "Calcio", author: "Staff PSD", image: "immaginiNotizie/scuolaCalcio.jpg", excerpt: "Svelate le nuove maglie ufficiali della stagione: un design moderno che celebra la storia del club." },
    { id: 9, title: "Open day di pallavolo: vieni a provare gratis!", date: "22/09/2025", sport: "Pallavolo", author: "Staff PSD", image: "immaginiNotizie/torneoPallavolo.jpg", excerpt: "Una giornata aperta a tutti per provare la pallavolo e conoscere gli allenatori del settore giovanile." },
    { id: 10, title: "Nuovo corso di minibasket per bambini", date: "01/10/2025", sport: "Basket", author: "Staff PSD", image: "immaginiNotizie/corsoBasket.jpg", excerpt: "Partono le lezioni di minibasket dedicate ai più piccoli: sport, gioco e coordinazione motoria." },
    { id: 11, title: "Annunciato il calendario del camp invernale PSD", date: "10/11/2025", sport: "Multisport", author: "Dirigenza PSD", image: "immaginiNotizie/campoEstivo.jpg", excerpt: "Torna il camp invernale con nuove attività indoor per bambini e ragazzi durante le vacanze natalizie." },
    { id: 12, title: "Nuove attrezzature nella palestra comunale", date: "20/11/2025", sport: "Multisport", author: "Dirigenza PSD", image: "immaginiNotizie/pesiPalestra.jpg", excerpt: "Sono arrivate le nuove attrezzature professionali per potenziare l’area fitness e la sala pesi." },
    { id: 13, title: "Winter Cup di calcio giovanile 2025", date: "05/12/2025", sport: "Calcio", author: "Staff PSD", image: "immaginiNotizie/torneoCalcetto.jpg", excerpt: "Le squadre under 14 si sfidano nella Winter Cup 2025: tre giorni di sport e divertimento." },
    { id: 14, title: "Torneo natalizio di pallavolo mista", date: "18/12/2025", sport: "Pallavolo", author: "Settore Giovanile PSD", image: "immaginiNotizie/torneoPallavolo.jpg", excerpt: "Torna il tradizionale torneo natalizio misto: sport, spirito di squadra e beneficenza." },
    { id: 15, title: "Iscrizioni scuola calcio PSD 2025 – seconda tranche", date: "05/01/2025", sport: "Calcio", author: "Staff PSD", image: "immaginiNotizie/scuolaCalcio.jpg", excerpt: "Ultimi posti disponibili per il corso calcistico per bambini e ragazzi dai 6 ai 13 anni." },
    { id: 16, title: "Mini torneo giovanile di pallavolo", date: "20/03/2025", sport: "Pallavolo", author: "Comitato Sportivo PSD", image: "immaginiNotizie/torneoPallavolo.jpg", excerpt: "Piccoli gruppi scolastici si sfidano in un mini torneo di fine stagione." },
    { id: 17, title: "Basket: corso avanzato per ragazzi", date: "12/04/2025", sport: "Basket", author: "Staff PSD", image: "immaginiNotizie/corsoBasket.jpg", excerpt: "Un corso dedicato ai giovani che vogliono migliorare tecniche e tattiche di gioco." },
    { id: 18, title: "Camp estivo multisport – nuova edizione", date: "20/05/2025", sport: "Multisport", author: "Dirigenza PSD", image: "immaginiNotizie/campoEstivo.jpg", excerpt: "Nuova edizione del camp estivo: giochi, sport e attività creative." },
    { id: 19, title: "Palestra comunale: apertura sala funzionale", date: "30/06/2025", sport: "Multisport", author: "Dirigenza PSD", image: "immaginiNotizie/pesiPalestra.jpg", excerpt: "Nuova area funzionale dedicata al fitness nella palestra comunale." },
    { id: 20, title: "Torneo calcio a 5 – fase finale", date: "15/07/2025", sport: "Calcio", author: "Staff PSD", image: "immaginiNotizie/torneoCalcetto.jpg", excerpt: "Le migliori squadre del torneo estivo si sfidano nella fase finale." },
    { id: 21, title: "Pallavolo: mini camp scolastico", date: "10/09/2025", sport: "Pallavolo", author: "Settore Giovanile PSD", image: "immaginiNotizie/torneoPallavolo.jpg", excerpt: "Un camp dedicato alle scuole per introdurre i ragazzi alla pallavolo." },
    { id: 22, title: "Presentazione divise ufficiali", date: "20/09/2025", sport: "Calcio", author: "Staff PSD", image: "immaginiNotizie/scuolaCalcio.jpg", excerpt: "Evento di presentazione delle nuove divise ufficiali della stagione." },
    { id: 23, title: "Open day pallavolo – seconda edizione", date: "25/09/2025", sport: "Pallavolo", author: "Staff PSD", image: "immaginiNotizie/torneoPallavolo.jpg", excerpt: "Una giornata gratuita per provare il mondo della pallavolo." },
    { id: 24, title: "Minibasket: corso autunnale", date: "10/10/2025", sport: "Basket", author: "Staff PSD", image: "immaginiNotizie/corsoBasket.jpg", excerpt: "Corso dedicato ai più piccoli per sviluppare abilità motorie e coordinazione." },
    { id: 25, title: "Calendario camp invernale 2025", date: "15/11/2025", sport: "Multisport", author: "Dirigenza PSD", image: "immaginiNotizie/campoEstivo.jpg", excerpt: "Programma dettagliato delle attività del camp invernale PSD." },
    { id: 26, title: "Nuove attrezzature palestra – ampliamento", date: "25/11/2025", sport: "Multisport", author: "Dirigenza PSD", image: "immaginiNotizie/pesiPalestra.jpg", excerpt: "Arrivo di nuove attrezzature per ampliare la palestra comunale." },
    { id: 27, title: "Winter Cup: risultati finali", date: "10/12/2025", sport: "Calcio", author: "Staff PSD", image: "immaginiNotizie/torneoCalcetto.jpg", excerpt: "Risultati e classifiche finali della Winter Cup giovanile." },
    { id: 28, title: "Torneo natalizio: classifiche", date: "20/12/2025", sport: "Pallavolo", author: "Settore Giovanile PSD", image: "immaginiNotizie/torneoPallavolo.jpg", excerpt: "Classifiche finali e premi del torneo natalizio di pallavolo." },
    { id: 29, title: "Ripartono le iscrizioni scuola calcio", date: "05/01/2026", sport: "Calcio", author: "Staff PSD", image: "immaginiNotizie/scuolaCalcio.jpg", excerpt: "Apertura nuova stagione iscrizioni per la scuola calcio PSD." },
    { id: 30, title: "Corso di basket avanzato – iscrizioni aperte", date: "10/02/2026", sport: "Basket", author: "Staff PSD", image: "immaginiNotizie/corsoBasket.jpg", excerpt: "Iscrizioni aperte per il corso avanzato di basket per ragazzi." }
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
