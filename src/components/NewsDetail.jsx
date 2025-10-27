import { useNavigate, useLocation } from "react-router-dom";
import Button from "react-bootstrap/Button";
import "../css/NewsDetail.css";

export default function NewsDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const post = location.state?.post;

  if (!post) {
    return (
      <div className="news-detail-error">
        Nessun dato disponibile. Torna alla lista delle news.
        <Button
          variant="secondary"
          onClick={() => navigate("/news")}
          className="mt-3"
        >
          ← Torna alle news
        </Button>
      </div>
    );
  }

  return (
    <div className="news-detail-page container">
      {post.image && (
        <img src={post.image} alt={post.title} className="news-detail-image" />
      )}

      <h2 className="news-detail-title" dangerouslySetInnerHTML={{ __html: post.title }} />

      <div className="news-detail-meta">
        <span>{post.author}</span> • <span>{post.date}</span>
      </div>

      <div
        className="news-detail-content"
        dangerouslySetInnerHTML={{ __html: post.content || post.preview }}
      />

      <div className="news-detail-footer">
        <Button
          variant="secondary"
          onClick={() => navigate("/news")}
        >
          ← Torna alle news
        </Button>
      </div>
    </div>
  );
}
