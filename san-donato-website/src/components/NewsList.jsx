import { useNavigate } from 'react-router-dom';
import Button from 'react-bootstrap/Button';
import '../css/NewsList.css';

export default function NewsList({ news }) {
  const navigate = useNavigate();

  return (
    <div className="news-container container">
      <div className="news-grid">
        {news.map(p => (
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
    </div>
  );
}
