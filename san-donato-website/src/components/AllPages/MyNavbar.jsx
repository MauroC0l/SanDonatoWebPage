import { useState, useLayoutEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import {
  FaHome, FaNewspaper, FaUsers,
  FaEnvelope, FaCalendarAlt, FaFileAlt,
  FaHandshake, FaChild, FaScroll,
  FaFutbol, FaChevronDown,
  FaImages // <--- NUOVA IMPORTAZIONE PER L'ICONA GALLERIA
} from "react-icons/fa";
import "../../css/MyNavbar.css";

export default function MyNavbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(2);
  const dropdownRef = useRef(null);
  const docsRef = useRef(null);

  // 1. Definiamo i link principali
  const mainLinks = [
    { to: "/", label: "Home", icon: <FaHome /> },
    { to: "/calendario", label: "Calendario", icon: <FaCalendarAlt /> },
    { to: "/news", label: "News", icon: <FaNewspaper /> },
    { to: "/sports", label: "Sport", icon: <FaFutbol /> },
    { to: "/iscrizione", label: "Iscriviti", icon: <FaHandshake /> },
    { to: "/galleria", label: "Galleria", icon: <FaImages /> },
    { to: "/chi-siamo", label: "Chi Siamo", icon: <FaUsers /> },
    { to: "/contatti", label: "Contatti", icon: <FaEnvelope /> },
    { to: "/sponsor", label: "Sponsor", icon: <FaScroll /> },
  ];

  // 2. Definiamo i link Documenti con supporto per il DOWNLOAD
  const docLinks = [
    { 
      to: "/documenti/PSD_VADEMECUM_2025-2026.pdf", 
      label: "Vademecum", 
      icon: <FaFileAlt />, 
      download: true 
    },
    { 
      to: "/documenti/PSD_STATUTO.pdf", 
      label: "Statuto", 
      icon: <FaScroll />, 
      download: true 
    },
    { to: "/privacy", label: "Privacy", icon: <FaFileAlt /> },
    { to: "/tutela-minori", label: "Tutela minori", icon: <FaChild /> },
    { to: "/cinquepermille", label: "5x1000", icon: <FaScroll /> },
    { to: "/contributi-pubblici", label: "Contributi", icon: <FaScroll /> },
  ];

  // Gestione Resize
  useLayoutEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      if (width > 1250) setVisibleCount(mainLinks.length);
      else if (width > 1050) setVisibleCount(5);
      else if (width > 850) setVisibleCount(4);
      else if (width > 650) setVisibleCount(3);
      else setVisibleCount(2);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mainLinks.length]);

  // Click Outside
  useLayoutEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setDropdownOpen(false);
      if (docsRef.current && !docsRef.current.contains(event.target)) setDocsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const primaryLinks = mainLinks.slice(0, visibleCount);
  const secondaryLinks = mainLinks.slice(visibleCount);

  return (
    <header className="navbar">
      <div className="navbar-container">
        <nav className="navbar-nav">
          
          {/* LINK PRINCIPALI VISIBILI */}
          {primaryLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === "/"} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              {link.icon} <span className="link-text">{link.label}</span>
            </NavLink>
          ))}

          {/* DROPDOWN DOCUMENTI */}
          <div className="dropdown" ref={docsRef}>
            {/* Aggiunta classe 'clean-toggle' per rimuovere lo sfondo come richiesto */}
            <button className={`nav-link dropdown-toggle clean-toggle ${docsOpen ? 'active-toggle' : ''}`} onClick={() => setDocsOpen(!docsOpen)}>
              <FaFileAlt /> <span className="link-text">Documenti</span>
              <FaChevronDown className={`arrow ${docsOpen ? 'rotate' : ''}`} />
            </button>
            <div className={`dropdown-menu ${docsOpen ? "show" : ""}`}>
              {docLinks.map((link, index) => (
                // Logica condizionale: se è un download usa <a>, altrimenti <NavLink>
                link.download ? (
                  <a 
                    key={index} 
                    href={link.to} 
                    className="dropdown-item" 
                    download 
                    onClick={() => setDocsOpen(false)}
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    {link.icon} {link.label}
                  </a>
                ) : (
                  <NavLink key={index} to={link.to} className="dropdown-item" onClick={() => setDocsOpen(false)}>
                    {link.icon} {link.label}
                  </NavLink>
                )
              ))}
            </div>
          </div>

          {/* PULSANTE ALTRO */}
          {secondaryLinks.length > 0 && (
            <div className="dropdown" ref={dropdownRef}>
              <button className={`nav-link dropdown-toggle ${dropdownOpen ? 'active-toggle' : ''}`} onClick={() => setDropdownOpen(!dropdownOpen)}>
                <span className="link-text">Altro</span>
                <FaChevronDown className={`arrow ${dropdownOpen ? 'rotate' : ''}`} />
              </button>
              <div className={`dropdown-menu ${dropdownOpen ? "show" : ""}`}>
                {secondaryLinks.map((link) => (
                  <NavLink key={link.to} to={link.to} className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                    {link.icon} {link.label}
                  </NavLink>
                ))}
              </div>
            </div>
          )}

        </nav>
      </div>
    </header>
  );
}