import { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import {
  FaHome, FaNewspaper, FaUsers,
  FaEnvelope, FaCalendarAlt, FaFileAlt,
  FaHandshake, FaChild, FaScroll, FaBars,
  FaFutbol, FaTimes, FaChevronDown
} from "react-icons/fa";
import "../../css/MyNavbar.css";

export default function MyNavbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Nuovo stato per mobile
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

  // Chiude il menu mobile quando si clicca su un link
  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  };

  const mainLinks = [
    { to: "/", label: "Home", icon: <FaHome /> },
    { to: "/news", label: "News", icon: <FaNewspaper /> },
    { to: "/sports", label: "Sport", icon: <FaFutbol /> },
    { to: "/calendario", label: "Calendario", icon: <FaCalendarAlt /> },
    { to: "/iscrizione", label: "Iscriviti", icon: <FaHandshake /> },
    { to: "/sponsor", label: "Sponsor", icon: <FaScroll /> },
    { to: "/chi-siamo", label: "Chi Siamo", icon: <FaUsers /> },
    { to: "/contatti", label: "Contatti", icon: <FaEnvelope /> },
  ];

  const dropdownLinks = [
    { to: "/privacy", label: "Privacy", icon: <FaFileAlt /> },
    { to: "/tutela-minori", label: "Tutela minori", icon: <FaChild /> },
    { to: "/cinquepermille", label: "5x1000", icon: <FaScroll /> },
    { to: "/contributi-pubblici", label: "Contributi", icon: <FaScroll /> },
  ];

  return (
    <header className="navbar">
      <div className="navbar-container">
        
        {/* LOGO O TITOLO (Opzionale, utile su mobile) */}
        <div className="navbar-logo">
           ASD Sport
        </div>

        {/* Tasto Hamburger (Visibile solo su Mobile) */}
        <div className="mobile-menu-icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <FaTimes /> : <FaBars />}
        </div>

        {/* Menu di Navigazione (Diventa una lista verticale su mobile) */}
        <nav className={mobileMenuOpen ? "navbar-nav active" : "navbar-nav"}>
          
          {mainLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              onClick={closeMobileMenu}
            >
              {link.icon} <span>{link.label}</span>
            </NavLink>
          ))}

          {/* Dropdown Documenti */}
          <div className="dropdown" ref={dropdownRef}>
            <button
              className="dropdown-toggle nav-link"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <FaBars /> <span>Documenti</span> <FaChevronDown className={`arrow ${dropdownOpen ? 'rotate' : ''}`} />
            </button>

            {/* Menu a tendina */}
            <div className={dropdownOpen ? "dropdown-menu show" : "dropdown-menu"}>
              {dropdownLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className="dropdown-item"
                  onClick={closeMobileMenu}
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