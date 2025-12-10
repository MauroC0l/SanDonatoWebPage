import React, { useState } from "react";
import { 
  FaMapMarkerAlt, FaPhone, FaEnvelope, 
  FaClock, FaUniversity, FaMobileAlt, FaCheck 
} from "react-icons/fa";
import { FaRegCopy } from "react-icons/fa6"; // Icona copia più moderna
import "../css/Contatti.css";

export default function Contacts() {
  const [copied, setCopied] = useState(false);

  const handleCopyIBAN = () => {
    navigator.clipboard.writeText("IT56R0501801000000017122862");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset dopo 2 secondi
  };

  return (
    <div className="contacts-page fade-in">
      
      {/* Intestazione con tipografia moderna */}
      <header className="contacts-header">
        <div className="header-content">
          <h1>Contatti & Sede PROVA 1</h1>
          <p className="subtitle">A.S.D. Polisportiva San Donato</p>
          <div className="header-decoration"></div>
        </div>
      </header>

      <div className="contacts-container">
        
        {/* --- COLONNA SINISTRA: INFO E ORARI --- */}
        <div className="contacts-column left-col">
          
          {/* Card Sede */}
          <section className="contact-card">
            <div className="card-icon-wrapper"><FaMapMarkerAlt /></div>
            <div className="card-content">
              <h3 className="card-title">La Nostra Sede</h3>
              <p className="address-text">
                Via Le Chiuse 20/A <br />
                <strong>10144 TORINO</strong>
              </p>
              
              <a 
                href="https://maps.google.com/?q=Via+Le+Chiuse+20/A,+Torino" 
                target="_blank" 
                rel="noopener noreferrer"
                className="map-link-container"
              >
                <img 
                  src="/immaginiContatti/mappaSede.png" 
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

          {/* Card Segreteria & Contatti */}
          <section className="contact-card">
            <div className="card-icon-wrapper"><FaClock /></div>
            <div className="card-content">
              <h3 className="card-title">Segreteria</h3>
              <div className="info-group">
                <span className="info-label">Orari apertura:</span>
                <span className="info-value highlight">Giovedì 18:30 – 19:30</span>
              </div>
              
              <hr className="divider" />
              
              <div className="mobile-contact-section">
                <h4 className="sub-title"><FaMobileAlt /> Contatti Rapidi</h4>
                <p className="info-note">Per urgenze e comunicazioni</p>
                <a href="tel:+393498164034" className="phone-btn">
                  <FaPhone /> 349.8164034 <span className="name-tag">Marco</span>
                </a> 
              </div>
            </div>
          </section>

          {/* Card Dati Fiscali */}
          <section className="contact-card compact">
            <div className="card-icon-wrapper"><FaEnvelope /></div>
            <div className="card-content">
              <h3 className="card-title">Recapiti & Dati</h3>
              
              <div className="email-stack">
                <a href="mailto:info@polisportivasandonato.it" className="email-link primary">
                  info@polisportivasandonato.it
                </a>
                <a href="mailto:polisportivasandonato@legalmail.it" className="email-link pec">
                  PEC: polisportivasandonato@legalmail.it
                </a>
              </div>

              <div className="fiscal-data-box">
                <div className="fiscal-row"><span>C.F.</span> 97699790016</div>
                <div className="fiscal-row"><span>P.IVA</span> 09911610013</div>
              </div>
            </div>
          </section>

        </div>

        {/* --- COLONNA DESTRA: PAGAMENTI --- */}
        <div className="contacts-column right-col">
          
          {/* Card Banca */}
          <section className="contact-card payment-highlight">
            <div className="card-header-row">
              <div className="card-icon-wrapper bank"><FaUniversity /></div>
              <h3 className="card-title">Bonifico Bancario</h3>
            </div>
            
            <p className="payment-intro">Coordinate per i pagamenti:</p>
            
            <div className="iban-wrapper">
              <span className="iban-label">IBAN</span>
              <code className="iban-code">IT 56 R 05018 01000 000017122862</code>
              <button 
                className={`copy-btn ${copied ? 'copied' : ''}`} 
                onClick={handleCopyIBAN}
                aria-label="Copia IBAN"
              >
                {copied ? <><FaCheck /> Copiato!</> : <><FaRegCopy /> Copia</>}
              </button>
            </div>

            <div className="bank-logo-wrapper">
              <img src="/immaginiContatti/logoBanca.png" alt="Banca" className="bank-img" loading="lazy" />
            </div>
          </section>

          {/* Card Satispay */}
          <section className="contact-card satispay-card">
            <div className="satispay-content">
              <h3 className="satispay-title">Paga con Satispay</h3>
              <p className="shop-name">POLISPORTIVA SAN DONATO – TORINO</p>
              
              <div className="qr-frame">
                <img 
                  src="/immaginiContatti/qrSatispay.png" 
                  alt="QR Code Satispay" 
                  className="qr-image" 
                  loading="lazy"
                />
                <div className="scan-me-badge">Inquadra</div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}