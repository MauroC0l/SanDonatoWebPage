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

              {/* Subtitle */}
              {p.subtitle && <div className="news-subtitle">{p.subtitle}</div>}

              {/* Preview invece di excerpt */}
              <p className="news-excerpt">{p.preview}</p>

              <div className="news-footer">
                <div className="news-author-date">
                  <div className="news-author">{p.author}</div>
                  <div className="news-date">{p.date}</div>
                </div>

                <Button
                  className="news-btn"
                  onClick={() => navigate(`/news/${p.id}`)}
                >
                  Leggi
                </Button>
              </div>

            </div>
          </article>
        ))}
      </div>

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
