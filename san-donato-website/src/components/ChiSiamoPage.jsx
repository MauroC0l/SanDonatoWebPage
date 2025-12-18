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
  FaGraduationCap,
} from "react-icons/fa6";
import { IoRibbon, IoBusiness } from "react-icons/io5";
import "../css/ChiSiamoPage.css"; 
import chiSiamoData from "../data/ChiSiamo.json";
import dynamicData from "../data/Data.json";

// MAPPA ICONE: Stringa JSON -> Componente React
const ICON_MAP = {
  balance: <FaScaleBalanced />,
  heart: <FaHeartPulse />,
  handshake: <FaHandshake />,
  group: <FaUserGroup />,
  child: <FaChildren />,
  map: <FaMapLocationDot />,
  tie: <FaUserTie />,
  business: <IoBusiness />,
  wallet: <FaWallet />,
  signature: <FaFileSignature />,
  gears: <FaUsersGear />,
  gradcap: <FaGraduationCap />,
};

export default function ChiSiamoPage() {
  const { hero, manifesto, organigramma, staff, kits, impact, footer } = chiSiamoData;

  return (
    // Aggiunto "csp-fade-in" per animazione d'ingresso
    <div className="csp-avant-garde-wrapper csp-fade-in">
      
      {/* 1. HERO SECTION */}
      <section className="csp-hero-block">
        <div className="csp-hero-content">
          
          <div className="csp-history-badge-container">
            <div className="csp-history-badge-ring">
              <span className="csp-history-badge-text">{hero.badgeText}</span>
            </div>
          </div>

          <h1 className="csp-hero-title">
            {hero.titlePrefix}<br />
            <span className="csp-text-gradient">{hero.titleHighlight}</span>
          </h1>
          <p className="csp-hero-subtitle" dangerouslySetInnerHTML={{ __html: hero.subtitle }} />
        </div>
      </section>

      {/* 2. MANIFESTO */}
      <section className="csp-manifesto-section">
        <div className="csp-section-header">
          <h2>Il Manifesto</h2>
          <div className="csp-header-line"></div>
        </div>
        <div className="csp-values-grid">
          {manifesto.map((val, idx) => (
            <div className="csp-value-item" key={idx}>
              <div className="csp-val-icon">{ICON_MAP[val.iconKey]}</div>
              <h4>{val.title}</h4>
              <p>{val.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. ORGANIGRAMMA */}
      <section className="csp-org-section-dark">
        <div className="csp-org-container">
          <div className="csp-org-header">
            <h2>Gli Organi della PSD</h2>
            <p>La professionalità dei volontari al servizio della comunità.</p>
          </div>
          
          <div className="csp-org-grid-modern">
            {organigramma.map((item, idx) => (
              <div className="csp-org-card-glass" key={idx}>
                <div className="csp-org-icon-floating">{ICON_MAP[item.iconKey]}</div>
                <h3>{item.role}</h3>
                <div className="csp-divider-small"></div>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- NUOVA SEZIONE: STAFF TECNICO & EDUCATIVO --- */}
      <section className="csp-staff-section">
        <div className="csp-section-header csp-center">
          <h2>Staff Tecnico & Educativo</h2>
          <div className="csp-header-line"></div>
          <p style={{color: 'var(--c-text-muted)', marginTop: '1rem'}}>
            Il cuore pulsante della nostra attività in campo.
          </p>
        </div>

        <div className="csp-staff-grid">
          {staff && staff.map((member, idx) => (
            <div className="csp-staff-card" key={idx}>
              <div className="csp-staff-icon">
                {ICON_MAP[member.iconKey]}
              </div>
              <h3>{member.role}</h3>
              <p>{member.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. MEMBERSHIP & IMPACT */}
      <section className="csp-membership-section">
        <div className="csp-section-header csp-center">
          <h2>Membership {dynamicData.anno}</h2>
          <p>Partecipa al progetto e al nuovo Murales.</p>
        </div>

        {/* Pricing Cards */}
        <div className="csp-pricing-grid">
          {kits.map((kit, i) => (
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

        {/* Impact Bar */}
        <div className="csp-impact-bar">
          <div className="csp-impact-stat">
            <IoRibbon className="csp-i-icon"/>
            <div>
              <strong>Affiliazioni</strong>
              <span>{impact.affiliazioni}</span>
            </div>
          </div>
          <div className="csp-impact-stat">
            <FaUserGroup className="csp-i-icon"/>
            <div>
              <strong>Numeri</strong>
              <span>{impact.numeri}</span>
            </div>
          </div>
          <div className="csp-impact-stat csp-highlight">
             <div>
               <strong>5x1000</strong>
               <code className="csp-fiscal-code">{impact.cf}</code>
             </div>
          </div>
        </div>

      </section>

    </div>
  );
}