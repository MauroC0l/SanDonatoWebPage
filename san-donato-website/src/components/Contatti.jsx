import React, { useState } from "react";
import { 
  FaMapMarkerAlt, FaPhone, FaEnvelope, 
  FaClock, FaUniversity, FaMobileAlt, FaCheck, FaExternalLinkAlt 
} from "react-icons/fa";
import { FaRegCopy } from "react-icons/fa6";
import "../css/Contatti.css";
import contactsData from "../data/Contatti.json";

export default function Contacts() {
  const [copied, setCopied] = useState(false);
  
  // Destructure data for easier access
  const { header, sede, segreteria, recapiti, pagamenti } = contactsData;

  const handleCopyIBAN = () => {
    navigator.clipboard.writeText(pagamenti.ibanClean);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    // Unique animation class 'cnt-fade-in' to avoid conflicts
    <div className="contacts-page cnt-fade-in">
      
      <header className="contacts-header">
        <div className="header-content">
          <h1>
            {header.titlePrefix} <span className="highlight-text">{header.titleHighlight}</span>
          </h1>
          <p className="subtitle">{header.subtitle}</p>
          <div className="header-decoration"></div>
        </div>
      </header>

      <div className="contacts-container">
        
        {/* --- LEFT COLUMN --- */}
        <div className="contacts-column left-col">
          
          {/* Card Sede */}
          <section className="contact-card">
            <div className="card-header-row">
              <div className="card-icon-wrapper"><FaMapMarkerAlt /></div>
              <h3 className="card-title">{sede.title}</h3>
            </div>
            
            <div className="card-body">
              <p className="address-text">
                {sede.address} <br />
                <strong>{sede.city}</strong>
              </p>
              
              <a 
                href={sede.googleMapLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="map-link-container"
              >
                <img 
                  src={sede.mapImage} 
                  alt="Mappa Sede Polisportiva" 
                  className="map-image" 
                  loading="lazy"
                />
                <div className="map-overlay">
                  <span>Apri Navigatore ↗</span>
                </div>
              </a>
            </div>
          </section>

          {/* Card Segreteria */}
          <section className="contact-card">
            <div className="card-header-row">
              <div className="card-icon-wrapper"><FaClock /></div>
              <h3 className="card-title">{segreteria.title}</h3>
            </div>

            <div className="card-body">
              <div className="info-group">
                <span className="info-label">{segreteria.orariLabel}</span>
                <span className="info-value highlight">{segreteria.orariValue}</span>
              </div>
              
              <hr className="divider" />
              
              <div className="mobile-contact-section">
                <h4 className="sub-title"><FaMobileAlt /> {segreteria.mobileTitle}</h4>
                <p className="info-note">{segreteria.mobileNote}</p>
                <a href={`tel:${segreteria.phoneLink}`} className="phone-btn">
                  <FaPhone /> {segreteria.phoneDisplay} <span className="name-tag">{segreteria.contactName}</span>
                </a> 
              </div>
            </div>
          </section>

          {/* Card Recapiti */}
          <section className="contact-card">
            <div className="card-header-row">
              <div className="card-icon-wrapper"><FaEnvelope /></div>
              <h3 className="card-title">{recapiti.title}</h3>
            </div>

            <div className="card-body">
              <div className="email-stack">
                <a href={`mailto:${recapiti.email}`} className="email-link primary">
                  {recapiti.email}
                </a>
                <a href={`mailto:${recapiti.pec}`} className="email-link pec">
                  PEC: {recapiti.pec}
                </a>
              </div>

              <div className="fiscal-data-box">
                <div className="fiscal-row"><span>C.F.</span> {recapiti.cf}</div>
                <div className="fiscal-row"><span>P.IVA</span> {recapiti.piva}</div>
              </div>
            </div>
          </section>

        </div>

        {/* --- RIGHT COLUMN --- */}
        <div className="contacts-column right-col">
          
          {/* Card Bonifico */}
          <section className="contact-card payment-highlight">
            <div className="card-header-row">
              <div className="card-icon-wrapper bank"><FaUniversity /></div>
              <h3 className="card-title">{pagamenti.bancaTitle}</h3>
            </div>
            
            <div className="card-body">
              <p className="payment-intro">{pagamenti.intro}</p>
              
              <div className="iban-wrapper">
                <span className="iban-label">IBAN</span>
                <code className="iban-code">{pagamenti.ibanDisplay}</code>
                <button 
                  className={`copy-btn ${copied ? 'copied' : ''}`} 
                  onClick={handleCopyIBAN}
                  aria-label="Copia IBAN"
                >
                  {copied ? <><FaCheck /> Copiato!</> : <><FaRegCopy /> Copia</>}
                </button>
              </div>

              <p style={{ marginTop: '1rem' }}>Intestato a: <strong>POLISPORTIVA SAN DONATO ASD</strong></p>

              <div className="bank-logo-wrapper">
                <img src={pagamenti.logoBanca} alt="Banca" className="bank-img" loading="lazy" />
              </div>
            </div>
          </section>

          {/* Card Satispay */}
          <section className="contact-card satispay-card">
            <div className="satispay-content">
              <h3 className="satispay-title">{pagamenti.satispayTitle}</h3>
              <p className="shop-name">{pagamenti.shopName}</p>
              
              {/* QR Code Section */}
              <div className="satispay-qr-wrapper">
                <img 
                  src={pagamenti.qrImage} 
                  alt="QR Code Satispay" 
                  className="satispay-qr-img" 
                  loading="lazy"
                />
              </div>

              <div className="satispay-action-wrapper">
                <a 
                  href={pagamenti.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="satispay-btn-link"
                >
                  Paga con Satispay <FaExternalLinkAlt style={{ fontSize: '0.8em' }}/>
                </a>
                <p className="satispay-helper">Link diretto al pagamento sicuro</p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}