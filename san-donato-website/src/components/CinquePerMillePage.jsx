import React, { useState } from 'react';
import '../css/CinquePerMillePage.css'; 
// Importa il file JSON. Assicurati che il percorso sia corretto rispetto a dove salvi il file.
import pageData from '../data/CinquePerMille.json'; 

const CinquePerMillePage = () => {
  const [copied, setCopied] = useState(false);
  
  // Destrutturazione dei dati dal JSON per comodità
  const { fiscalCode, hero, codeSection, facsimile, deadlines, whySection } = pageData;

  const handleCopy = () => {
    navigator.clipboard.writeText(fiscalCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Funzione helper per renderizzare i quadratini del codice fiscale
  const renderCodeBoxes = (code) => {
    return code.split('').map((char, index) => (
      <div key={index} className="c5xm-box-char">{char}</div>
    ));
  };

  return (
    <div className="c5xm-wrapper">
      
      {/* HERO SECTION */}
      <header className="c5xm-hero">
        <div className="c5xm-hero-content c5xm-animate">
          <span className="c5xm-tag">{hero.tag}</span>
          <h1 className="c5xm-title">
            {hero.titleLine1}<br />
            {hero.titleLine2}
          </h1>
          <p className="c5xm-subtitle">
            {hero.subtitle}
          </p>
        </div>
      </header>

      {/* FOCUS SECTION (Code & Action) */}
      <section className="c5xm-code-section c5xm-animate" style={{animationDelay: '0.2s'}}>
        <div className="c5xm-card">
          <h3>{codeSection.title}</h3>
          
          <div className="c5xm-fiscal-code-box">
            <span className="c5xm-code">{fiscalCode}</span>
            <button 
              className={`c5xm-copy-btn ${copied ? 'copied' : ''}`} 
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  {codeSection.btnCopied}
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  {codeSection.btnDefault}
                </>
              )}
            </button>
          </div>

          <p className="c5xm-desc">
            {codeSection.description} <strong>Polisportiva San Donato</strong>.
          </p>
        </div>
      </section>

      {/* HOW TO SECTION (Fac-simile Visuale) */}
      <section className="c5xm-facsimile-wrapper">
        <div className="c5xm-hero-content">
          <h2 className="c5xm-facsimile-title">{facsimile.sectionTitle}</h2>
          <p className="c5xm-subtitle" style={{color: 'var(--c-text-muted)', marginBottom: '2rem'}}>
            {facsimile.subtitle}
          </p>
          
          {/* Visualizzazione CSS del modulo */}
          <div className="c5xm-tax-module">
            <div className="c5xm-module-header">{facsimile.moduleHeader}</div>
            <div className="c5xm-module-body">
              <p className="c5xm-module-text">
                {facsimile.moduleBody}
              </p>
              
              <div className="c5xm-signature-area">
                <span className="c5xm-signature-label">{facsimile.labelSignature}</span>
                <span className="c5xm-fake-sign">{facsimile.placeholderSignature}</span>
              </div>
              
              <div style={{marginTop: '10px'}}>
                <span className="c5xm-signature-label">{facsimile.labelCode}</span>
                <div className="c5xm-code-boxes">
                  {renderCodeBoxes(fiscalCode)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DEADLINES SECTION */}
      <section className="c5xm-deadlines-section">
        <h2 className="c5xm-section-title">{deadlines.title}</h2>
        <div className="c5xm-grid">
          {deadlines.items.map((item) => (
            <div key={item.id} className="c5xm-deadline-card">
              <span className="c5xm-date">{item.date}</span>
              <div className="c5xm-model-name">{item.model}</div>
              <p className="c5xm-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHY SECTION (Contenuto testuale) */}
      <section className="c5xm-why-section">
        <h2 className="c5xm-section-title">{whySection.title}</h2>
        <div className="c5xm-text-block">
          {whySection.paragraphs.map((para, index) => (
            <p key={index} dangerouslySetInnerHTML={{ __html: para }}></p>
          ))}
        </div>
      </section>

    </div>
  );
};

export default CinquePerMillePage;