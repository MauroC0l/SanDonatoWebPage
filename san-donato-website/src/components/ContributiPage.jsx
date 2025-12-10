import '../css/ContributiPage.css'; 
import pageData from '../data/Contributi.json'; // Percorso al file JSON

const ContributiPage = () => {
  
  // Destrutturazione dati
  const { hero, covidTable, singleDocument, footer } = pageData;

  return (
    <div className="cpub-wrapper">
      
      {/* HEADER SECTION */}
      <header className="cpub-hero">
        <div className="cpub-animate">
          <div className="cpub-badge">
            <svg className="cpub-icon-badge" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            {hero.badge}
          </div>
          
          <h1 className="cpub-title">{hero.title}</h1>
          <p className="cpub-subtitle">{hero.subtitle}</p>
          <span className="cpub-legal-ref">{hero.legalRef}</span>
        </div>
      </header>

      {/* DATA TABLE SECTION */}
      <section className="cpub-table-section cpub-animate" style={{animationDelay: '0.2s'}}>
        
        <div className="cpub-section-header">
          <h2>{covidTable.title}</h2>
        </div>

        <div className="cpub-table-card">
          <div className="cpub-table-scroll">
            <table className="cpub-table">
              <thead>
                <tr>
                  {covidTable.headers.map((head, i) => (
                    <th key={i}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {covidTable.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="cpub-cell-date">{row.date}</td>
                    <td>
                      <span className="cpub-entity-name">{row.entity}</span>
                      <span className="cpub-entity-detail">{row.details}</span>
                    </td>
                    <td className="cpub-cell-amount">€ {row.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SINGLE DOWNLOAD SECTION */}
      <section className="cpub-download-section cpub-animate" style={{animationDelay: '0.4s'}}>
        <div className="cpub-download-card">
          <div className="cpub-dl-content">
            <h3>{singleDocument.title}</h3>
            <p>{singleDocument.description}</p>
          </div>
          <a 
            href={singleDocument.link} 
            className="cpub-dl-btn" 
            target="_blank" 
            rel="noopener noreferrer" 
            download
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Scarica {singleDocument.fileSize}
          </a>
        </div>
      </section>

      {/* FOOTER NOTE */}
      <footer className="cpub-info-section">
        <div className="cpub-info-container">
          <h4 className="cpub-info-title">{footer.title}</h4>
          <p className="cpub-info-text">{footer.text}</p>
        </div>
      </footer>

    </div>
  );
};

export default ContributiPage;