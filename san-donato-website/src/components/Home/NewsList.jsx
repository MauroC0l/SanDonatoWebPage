import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "react-bootstrap/Button";
import "../../css/NewsList.css";

export default function NewsList({ news }) {
  const [currentPage, setCurrentPage] = useState(1);
  const newsPerPage = 12;
  const navigate = useNavigate();

  if (!news || news.length === 0) {
    return (
      <div className="no-news-message">
        <h4>Spiacenti, non ci sono news disponibili</h4>
      </div>
    );
  }

  const totalPages = Math.ceil(news.length / newsPerPage);
  const currentNews = news.slice((currentPage - 1) * newsPerPage, currentPage * newsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="news-container container">
      <div className="news-grid">
        {currentNews.map((p) => {
          const displayImage = p.image || "/logo-polisportiva.png";

          return (
            <article key={p.id} className="news-card">
              <div 
                className="news-image-wrapper"
                onClick={() => navigate(`/news/${p.id}`, { state: { post: p } })}
                style={{ cursor: "pointer" }}
                title="Leggi la notizia"
              >
                <img 
                  src={displayImage} 
                  alt={p.title} 
                  className="news-image" 
                />
              </div>

              <div className="news-content">
                <h3 className="news-title">{p.title}</h3>
                <p className="news-excerpt">{p.preview}</p>

                <div className="news-footer">
                  <div className="news-date">{p.date}</div>
                  
                  <Button
                    className="news-btn"
                    onClick={() => navigate(`/news/${p.id}`, { state: { post: p } })}
                  >
                    Leggi
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              className={`page-btn ${currentPage === i + 1 ? "active" : ""}`}
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