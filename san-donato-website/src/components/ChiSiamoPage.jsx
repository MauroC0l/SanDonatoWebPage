import React from "react";
import { 
  FaUserGroup, 
  FaHandshake, 
  FaScaleBalanced, 
  FaChildren, 
  FaHeartPulse,
  FaMapLocationDot,
  FaCheck,
  FaUserTie,
  FaUsersGear,
  FaFileSignature,
  FaWallet,
  FaGraduationCap
} from "react-icons/fa6";
import { IoRibbon, IoBusiness } from "react-icons/io5";
import "../css/ChiSiamoPage.css"; 

// Dati dal PDF
const MANIFESTO_VALUES = [
  { icon: <FaScaleBalanced />, title: "Uguaglianza", text: "Uguali nel diritto a divertirsi, diversi nelle capacità." },
  { icon: <FaHeartPulse />, title: "Serenità", text: "Un clima senza pressioni: conta l'applicazione, non la performance." },
  { icon: <FaHandshake />, title: "Fair Play", text: "Rispetto dell'avversario. Rifiuto netto della violenza." },
  { icon: <FaUserGroup />, title: "Squadra", text: "Vittoria e sconfitta sono sempre condivise. Nessuno è solo." },
  { icon: <FaChildren />, title: "Educazione", text: "L'allenatore non addestra ma educa alla felicità del ragazzo." },
  { icon: <FaMapLocationDot />, title: "Territorio", text: "Un punto di riferimento per il quartiere San Donato e la Cartiera." }
];

const ORG_STRUCTURE = [
  { role: "Presidente", icon: <FaUserTie />, desc: "Garante della visione educativa e dei progetti associativi." },
  { role: "Consiglio Direttivo", icon: <IoBusiness />, desc: "Organo esecutivo: decide le iniziative e la politica associativa." },
  { role: "Tesoriere", icon: <FaWallet />, desc: "Gestione conti, bilanci e rendicontazione economica." },
  { role: "Segreteria", icon: <FaFileSignature />, desc: "Cuore operativo: iscrizioni, quote e certificati medici." },
  { role: "Resp. di Settore", icon: <FaUsersGear />, desc: "Coordinamento tecnico, rapporti con Federazioni e gare." },
  { role: "Allenatori", icon: <FaUserTie />, desc: "Educatori formati, esempio di comportamento in campo." },
  { role: "Aiuto Allenatori", icon: <FaGraduationCap />, desc: "Giovani (16-18 anni) in formazione affiancati ai coach." }
];

const KITS = [
  { 
    name: "Smile", 
    price: "15", 
    color: "var(--c-blue)",
    features: ["Maglietta PSD", "Sacca Sport"] 
  },
  { 
    name: "Smart", 
    price: "30", 
    color: "var(--c-accent)",
    isPopular: true,
    features: ["Maglietta PSD", "Felpa Ufficiale", "Tessera Socio"] 
  },
  { 
    name: "Dream", 
    price: "50", 
    color: "var(--c-dark)",
    features: ["Maglietta PSD", "Felpa Ufficiale", "Tessera Socio", "Sacca Sport"] 
  }
];

export default function ChiSiamoPage() {
  return (
    <div className="csp-avant-garde-wrapper">
      
      {/* 1. HERO SECTION */}
      <section className="csp-hero-block">
        <div className="csp-hero-content">
          
          {/* Nuovo Stile Badge */}
          <div className="csp-history-badge-container">
            <div className="csp-history-badge-ring">
              <span className="csp-history-badge-text">Dal 2008 Insieme</span>
            </div>
          </div>

          <h1 className="csp-hero-title">
            Sport al<br />
            <span className="csp-text-gradient">Futuro Presente.</span>
          </h1>
          <p className="csp-hero-subtitle">
            Nati il 29 febbraio 2008 per educare attraverso lo sport. 
            Oggi siamo <strong>350 tesserati</strong> uniti da valori di condivisione e libertà.
          </p>
        </div>
      </section>

      {/* 2. MANIFESTO (Grid Diretta) */}
      <section className="csp-manifesto-section">
        <div className="csp-section-header">
          <h2>Il Manifesto</h2>
          <div className="csp-header-line"></div>
        </div>
        <div className="csp-values-grid">
          {MANIFESTO_VALUES.map((val, idx) => (
            <div className="csp-value-item" key={idx}>
              <div className="csp-val-icon">{val.icon}</div>
              <h4>{val.title}</h4>
              <p>{val.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. ORGANIGRAMMA (Nuovo Stile Scuro/Contrasto) */}
      <section className="csp-org-section-dark">
        <div className="csp-org-container">
          <div className="csp-org-header">
            <h2>Gli Organi della PSD</h2>
            <p>La professionalità dei volontari al servizio della comunità.</p>
          </div>
          
          <div className="csp-org-grid-modern">
            {ORG_STRUCTURE.map((item, idx) => (
              <div className="csp-org-card-glass" key={idx}>
                <div className="csp-org-icon-floating">{item.icon}</div>
                <h3>{item.role}</h3>
                <div className="csp-divider-small"></div>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. MEMBERSHIP & IMPACT (Layout Espanso) */}
      <section className="csp-membership-section">
        <div className="csp-section-header csp-center">
          <h2>Membership 2023/24</h2>
          <p>Partecipa al progetto e al nuovo Murales.</p>
        </div>

        {/* Pricing Cards */}
        <div className="csp-pricing-grid">
          {KITS.map((kit, i) => (
            <div className={`csp-pricing-card ${kit.isPopular ? 'csp-popular' : ''}`} key={i}>
              {kit.isPopular && <div className="csp-pop-badge">Consigliato</div>}
              <h3 className="csp-kit-name">Kit {kit.name}</h3>
              <div className="csp-kit-price">
                <span className="csp-currency">€</span>{kit.price}
              </div>
              <ul className="csp-kit-features">
                {kit.features.map((feat, f) => (
                  <li key={f}><FaCheck className="csp-check-icon"/> {feat}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Impact Bar (Sotto le card) */}
        <div className="csp-impact-bar">
          <div className="csp-impact-stat">
            <IoRibbon className="csp-i-icon"/>
            <div>
              <strong>Affiliazioni</strong>
              <span>CSI • UISP • FIGC • US Acli</span>
            </div>
          </div>
          <div className="csp-impact-stat">
            <FaUserGroup className="csp-i-icon"/>
            <div>
              <strong>Numeri</strong>
              <span>150 Volley • 134 Calcio • 16 Basket</span>
            </div>
          </div>
          <div className="csp-impact-stat csp-highlight">
             <div>
               <strong>5x1000</strong>
               <code className="csp-fiscal-code">97699790016</code>
             </div>
          </div>
        </div>

      </section>

      <footer className="csp-page-footer">
        <p>Progetto Educativo 2023 - 2026 "Sport al Futuro Presente"</p>
      </footer>

    </div>
  );
}