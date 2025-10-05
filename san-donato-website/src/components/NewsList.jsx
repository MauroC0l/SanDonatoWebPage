import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from 'react-bootstrap/Button';
import '../css/NewsList.css';

export default function NewsList({ news }) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const newsPerPage = 12;

  // Se non ci sono news, mostra messaggio centrato orizzontalmente
  if (!news || news.length === 0) {
    return (
      <div className="no-news-message">
        <h4>Spiacenti, non ci sono news disponibili</h4>
      </div>
    );
  }

  // Calcola pagine
  const totalPages = Math.ceil(news.length / newsPerPage);
  const indexOfLastNews = currentPage * newsPerPage;
  const indexOfFirstNews = indexOfLastNews - newsPerPage;
  const currentNews = news.slice(indexOfFirstNews, indexOfLastNews);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  };

  return (
    <div className="news-container container">
      <div className="news-grid">
        {currentNews.map(p => (
          <article key={p.id} className="news-card">
            <div className="news-image-wrapper">
              {p.image && <img src={p.image} alt={p.title} className="news-image" />}
            </div>
            <div className="news-content">
              <h3 className="news-title">{p.title}</h3>
              <div className="news-meta">{p.date} — {p.author}</div>
              <p className="news-excerpt">{p.excerpt}</p>
              <Button
                className="news-btn"
                onClick={() => navigate(`/news/${p.id}`)}
              >
                Leggi
              </Button>
            </div>
          </article>
        ))}
      </div>

      {/* PAGINAZIONE */}
      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              className={`page-btn ${currentPage === i + 1 ? 'active' : ''}`}
              onClick={() => handlePageChange(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
