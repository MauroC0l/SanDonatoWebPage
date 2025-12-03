import { 
  FaMapMarkerAlt, FaPhone, FaEnvelope, 
  FaClock, FaUniversity, FaIdCard, FaMobileAlt 
} from "react-icons/fa";
import "../css/Contatti.css";

export default function Contacts() {
  return (
    <div className="contacts-page fade-in">
      
      {/* Intestazione */}
      <header className="contacts-header">
        <h1>Contatti & Sede</h1>
        <p>A.S.D. Polisportiva San Donato</p>
      </header>

      <div className="contacts-grid">
        
        {/* --- COLONNA SINISTRA: INFO E ORARI --- */}
        <div className="contacts-column">
          
          {/* Card Sede */}
          <section className="contact-card">
            <h3 className="card-title"><FaMapMarkerAlt /> La Nostra Sede</h3>
            <p className="address-text">
              Via Le Chiuse 20/A <br />
              10144 TORINO
            </p>
            
            {/* Immagine Mappa Cliccabile */}
            <a 
              href="https://www.google.com/maps/search/?api=1&query=Via+Le+Chiuse+20/A+Torino" 
              target="_blank" 
              rel="noopener noreferrer"
              className="map-link-container"
              title="Apri su Google Maps"
            >
              <img 
                src="/immaginiContatti/mappaSede.png" 
                alt="Mappa Sede" 
                className="map-image" 
              />
              <div className="map-overlay">
                <span>Apri Mappa ↗</span>
              </div>
            </a>
          </section>

          {/* Card Segreteria */}
          <section className="contact-card">
            <h3 className="card-title"><FaClock /> Segreteria</h3>
            <div className="info-row">
              <span className="info-label">Orari (dal 19 Settembre 2024):</span>
              <span className="info-value highlight">Giovedì 18:30 – 19:30</span>
            </div>
            
            <hr className="divider" />
            
            <h3 className="card-title"><FaMobileAlt /> Contatti Rapidi</h3>
            <p className="info-note">Per comunicazioni fuori sede</p>
            <div className="info-row">
              <FaPhone className="icon-small" />
              <a href="tel:+393498164034" className="phone-link">349.8164034</a> 
              <span className="contact-name">(Marco)</span>
            </div>
          </section>

          {/* Card Dati Fiscali */}
          <section className="contact-card">
            <h3 className="card-title"><FaEnvelope /> Recapiti & Dati</h3>
            
            <div className="info-block">
              <a href="mailto:info@polisportivasandonato.it" className="email-link">info@polisportivasandonato.it</a>
              <a href="mailto:polisportivasandonato@legalmail.it" className="email-link pec">PEC: polisportivasandonato@legalmail.it</a>
            </div>

            <div className="fiscal-data">
              <div><span className="label">C.F.</span> 97699790016</div>
              <div><span className="label">P.IVA</span> 09911610013</div>
            </div>
          </section>

        </div>

        {/* --- COLONNA DESTRA: PAGAMENTI --- */}
        <div className="contacts-column">
          
          {/* Card Banca */}
          <section className="contact-card payment-card">
            <h3 className="card-title"><FaUniversity /> Coordinate Bancarie</h3>
            <p className="payment-intro">Puoi effettuare i pagamenti tramite bonifico bancario:</p>
            
            <div className="iban-box">
              <span className="iban-label">IBAN</span>
              <span className="iban-code">IT 56 R 05018 01000 000017122862</span>
              <button 
                className="copy-btn" 
                onClick={() => navigator.clipboard.writeText("IT56R0501801000000017122862")}
                title="Copia IBAN"
              >
                Copia
              </button>
            </div>

            {/* Immagine Banca */}
            <div className="bank-image-container">
              <img 
                src="/immaginiContatti/logoBanca.png" 
                alt="Logo Banca" 
                className="bank-img" 
              />
            </div>
          </section>

          {/* Card Satispay */}
          <section className="contact-card satispay-card">
            <h3 className="card-title satispay-title">
              Paga con Satispay
            </h3>
            <p className="shop-name">Negozio: POLISPORTIVA SAN DONATO – TORINO</p>
            
            <div className="qr-container">
              {/* SOSTITUISCI CON IL TUO QR CODE REALE */}
              <img 
                src="/immaginiContatti/qrSatispay.png" 
                alt="QR Code Satispay" 
                className="qr-image" 
              />
              <span className="qr-caption">Inquadra per pagare</span>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}