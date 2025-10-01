import '../css/News.css';

export default function News() {
    
  //Mock news
  const mockNews = [ 
    {
      id: 1,
      title: "Iscrizioni aperte per la scuola calcio 2025",
      date: "1 Ottobre 2025",
      author: "Staff PSD",
      image: "scuolaCalcio.jpg",
      excerpt: "La scuola calcio apre le iscrizioni per tutti i bambini dai 6 ai 12 anni. Vieni a provare i nostri allenamenti!"
    },
    {
      id: 2,
      title: "Torneo di Pallavolo giovanile",
      date: "20 Settembre 2025",
      author: "Staff PSD",
      image: "torneoPallavolo.jpg",
      excerpt: "Si terrà il torneo di pallavolo giovanile presso la palestra comunale. Tutti i team sono benvenuti!"
    }
  ];

  return (
    <div className="news-container">
      {mockNews.map(news => (
        <div key={news.id} className="news-card">
          <img src={news.image} alt={news.title} className="news-image" />
          <div className="news-content">
            <h3 className="news-title">{news.title}</h3>
            <div className="news-meta">{news.date} — {news.author}</div>
            <p className="news-excerpt">{news.excerpt}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
