import React from "react";
import { FaChild, FaFileContract, FaUserShield, FaDownload, FaChevronRight } from "react-icons/fa";
import "../css/TutelaMinoriPage.css";
import pageData from "../data/TutelaMinori.json";

export default function TutelaMinoriPage() {
  const { header, intro, documents, safeguarding } = pageData;

  return (
    <div className="tml-page-wrapper tml-fade-in">
      
      {/* HEADER HERO */}
      <header className="tml-header">
        <div className="tml-header-content">
          <div className="tml-icon-badge">
            <FaChild />
          </div>
          <h1 className="tml-title">{header.title}</h1>
          <p className="tml-subtitle">{header.subtitle}</p>
        </div>
      </header>

      <div className="tml-container">
        
        {/* SEZIONE INTRODUTTIVA */}
        <section className="tml-intro-card">
          <h2>{intro.title}</h2>
          <p>{intro.text}</p>
        </section>

        {/* GRIGLIA DOCUMENTI */}
        <section className="tml-docs-section">
          <h3 className="tml-section-title">Documenti Ufficiali</h3>
          <div className="tml-docs-grid">
            {documents.map((doc) => (
              <div key={doc.id} className="tml-doc-card">
                <div className="tml-doc-icon">
                  <FaFileContract />
                </div>
                <div className="tml-doc-content">
                  <h4>{doc.title}</h4>
                  <p>{doc.description}</p>
                  <a 
                    href={doc.fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="tml-download-btn"
                  >
                    Scarica PDF <FaDownload />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SAFEGUARDING OFFICER */}
        <section className="tml-safeguarding-block">
          <div className="tml-sg-icon">
            <FaUserShield />
          </div>
          <div className="tml-sg-content">
            <h3>{safeguarding.title}</h3>
            <p>{safeguarding.description}</p>
            
            <div className="tml-officer-box">
               {/* Sostituire con dati reali se disponibili, altrimenti lasciare generico */}
               <span className="tml-officer-role">Contatto Ufficiale:</span>
               <a href={`mailto:${safeguarding.contactEmail}`} className="tml-officer-email">
                 {safeguarding.contactEmail} <FaChevronRight />
               </a>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}