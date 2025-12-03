import { useState, useLayoutEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import {
  FaHome, FaNewspaper, FaUsers,
  FaEnvelope, FaCalendarAlt, FaFileAlt,
  FaHandshake, FaChild, FaScroll,
  FaFutbol, FaChevronDown
} from "react-icons/fa";
import "../../css/MyNavbar.css";

export default function MyNavbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(2);
  const dropdownRef = useRef(null);

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

  // Calcolo layout prima del render per evitare sfarfallii
  useLayoutEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      
      // Logica conservativa per evitare overflow
      if (width > 1450) {
        setVisibleCount(allLinks.length); 
      } else if (width > 1250) {
        setVisibleCount(9); 
      } else if (width > 1050) {
        setVisibleCount(7); 
      } else if (width > 850) {
        setVisibleCount(5); 
      } else if (width > 650) {
        setVisibleCount(4); 
      } else if (width > 480) {
        setVisibleCount(3); 
      } else {
        setVisibleCount(2); // Mobile: 2 icone + Altro
      }
    }

    handleResize(); 
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [allLinks.length]);

  // Gestione chiusura click esterno
  useLayoutEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const primaryLinks = allLinks.slice(0, visibleCount);
  const secondaryLinks = allLinks.slice(visibleCount);
  const showDropdown = secondaryLinks.length > 0;

  return (
    <header className="navbar">
      <div className="navbar-container">
        
        <nav className="navbar-nav">
          
          {/* LINK VISIBILI (Allineati a sinistra) */}
          {primaryLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {link.icon} 
              <span className="link-text">{link.label}</span>
            </NavLink>
          ))}

          {/* PULSANTE "ALTRO" (Spinto tutto a destra via CSS) */}
          {showDropdown && (
            <div className="dropdown" ref={dropdownRef}>
              <button
                className={`dropdown-toggle nav-link ${dropdownOpen ? 'active-toggle' : ''}`}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span className="link-text">Altro</span> 
                <FaChevronDown className={`arrow ${dropdownOpen ? 'rotate' : ''}`} />
              </button>

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
          )}

        </nav>
      </div>
    </header>
  );
}