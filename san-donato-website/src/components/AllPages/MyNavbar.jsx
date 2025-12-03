import { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import {
  FaHome, FaNewspaper, FaUsers,
  FaEnvelope, FaCalendarAlt, FaFileAlt,
  FaHandshake, FaChild, FaScroll,
  FaFutbol, FaEllipsisH, FaChevronDown
} from "react-icons/fa";
import "../../css/MyNavbar.css";

export default function MyNavbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Chiude il dropdown se si clicca fuori
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Definizione di TUTTI i link
  const allLinks = [
    { to: "/", label: "Home", icon: <FaHome /> },
    { to: "/news", label: "News", icon: <FaNewspaper /> },
    { to: "/sports", label: "Sport", icon: <FaFutbol /> },
    { to: "/calendario", label: "Calendario", icon: <FaCalendarAlt /> },
    { to: "/iscrizione", label: "Iscriviti", icon: <FaHandshake /> },
    { to: "/sponsor", label: "Sponsor", icon: <FaScroll /> },
    { to: "/chi-siamo", label: "Chi Siamo", icon: <FaUsers /> },
    { to: "/contatti", label: "Contatti", icon: <FaEnvelope /> },
    { to: "/privacy", label: "Privacy", icon: <FaFileAlt /> },
    { to: "/tutela-minori", label: "Tutela minori", icon: <FaChild /> },
    { to: "/cinquepermille", label: "5x1000", icon: <FaScroll /> },
    { to: "/contributi-pubblici", label: "Contributi", icon: <FaScroll /> },
  ];

  // Configurazione: Quanti link mostrare fissi su Mobile? (Consigliato: 3)
  const MOBILE_LIMIT = 3;

  const primaryLinks = allLinks.slice(0, MOBILE_LIMIT);
  const secondaryLinks = allLinks.slice(MOBILE_LIMIT);

  return (
    <header className="navbar">
      <div className="navbar-container">
        

        <nav className="navbar-nav">
          
          {/* 1. LINK PRIMARI (Sempre visibili: Home, News, Sport) */}
          {primaryLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {link.icon} <span className="link-text">{link.label}</span>
            </NavLink>
          ))}

          {/* 2. LINK SECONDARI (Versione Desktop: mostrati in fila) */}
          {secondaryLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => 
                isActive ? "nav-link desktop-only active" : "nav-link desktop-only"
              }
            >
              {link.icon} <span className="link-text">{link.label}</span>
            </NavLink>
          ))}

          {/* 3. DROPDOWN "ALTRO" (Versione Mobile: contiene i link secondari) */}
          <div className="dropdown mobile-only" ref={dropdownRef}>
            <button
              className={`dropdown-toggle nav-link ${dropdownOpen ? 'active-toggle' : ''}`}
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <FaEllipsisH /> <span>Altro</span> <FaChevronDown className={`arrow ${dropdownOpen ? 'rotate' : ''}`} />
            </button>

            {/* Contenuto del Dropdown */}
            <div className={dropdownOpen ? "dropdown-menu show" : "dropdown-menu"}>
              {secondaryLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className="dropdown-item"
                  onClick={() => setDropdownOpen(false)}
                >
                  {link.icon} {link.label}
                </NavLink>
              ))}
            </div>
          </div>

        </nav>
      </div>
    </header>
  );
}