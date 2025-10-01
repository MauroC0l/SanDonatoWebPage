import { useNavigate } from 'react-router-dom'
import Button from 'react-bootstrap/Button'
import '../css/NewsList.css'

export default function NewsList({ news }) {
    const navigate = useNavigate()

    return (
        <div className="news-container container py-8">
            <h2 className="news-heading">Ultime notizie</h2>
            <div className="news-grid">
                {news.map(p => (
                    <article key={p.id} className="news-card">
                        {p.image && <img src={`${p.image}`} alt={p.title} className="news-image" />}
                        <div className="news-content">
                            <h3 className="news-title">{p.title}</h3>
                            <div className="news-meta">{p.date} — {p.author}</div>
                            <p className="news-excerpt">{p.excerpt}</p>
                            <Button 
                                className="news-btn"
                                onClick={() => navigate(`/news/${p.id}`)}
                                variant="outline-warning"
                            >
                                Leggi
                            </Button>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    )
}
