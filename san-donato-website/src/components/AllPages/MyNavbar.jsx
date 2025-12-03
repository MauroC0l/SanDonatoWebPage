import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  FaHome, FaNewspaper, FaUsers,
  FaEnvelope, FaCalendarAlt, FaFileAlt,
  FaHandshake, FaChild, FaScroll, FaBars,
  FaFutbol, FaTimes
} from "react-icons/fa";
import "../../css/MyNavbar.css";

export default function MyNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Unica lista con TUTTI i link
  const links = [
    { to: "/", label: "Home", icon: <FaHome /> },
    { to: "/news", label: "News", icon: <FaNewspaper /> },
    { to: "/sports", label: "Sport", icon: <FaFutbol /> },
    { to: "/calendario", label: "Calendario", icon: <FaCalendarAlt /> },
    { to: "/iscrizione", label: "Iscriviti", icon: <FaHandshake /> },
    { to: "/sponsor", label: "Sponsor", icon: <FaScroll /> },
    { to: "/chi-siamo", label: "Chi Siamo", icon: <FaUsers /> },
    { to: "/contatti", label: "Contatti", icon: <FaEnvelope /> },
    // Ex Dropdown ora visibili:
    { to: "/privacy", label: "Privacy", icon: <FaFileAlt /> },
    { to: "/tutela-minori", label: "Tutela minori", icon: <FaChild /> },
    { to: "/cinquepermille", label: "5x1000", icon: <FaScroll /> },
    { to: "/contributi-pubblici", label: "Contributi", icon: <FaScroll /> },
  ];

  return (
    <header className="navbar">
      <div className="navbar-container">
        
        {/* Logo */}
        <div className="navbar-logo">
           ASD Sport
        </div>

        {/* Tasto Hamburger (Visibile su Mobile e Tablet) */}
        <div className="mobile-menu-icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <FaTimes /> : <FaBars />}
        </div>

        {/* Menu di Navigazione */}
        <nav className={mobileMenuOpen ? "navbar-nav active" : "navbar-nav"}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.icon} <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}