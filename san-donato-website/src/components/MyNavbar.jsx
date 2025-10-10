import { useState, useEffect, useRef } from "react";
import { Link, NavLink } from "react-router-dom";
import {
    FaHome, FaNewspaper, FaImages, FaUsers,
    FaEnvelope, FaCalendarAlt, FaFileAlt,
    FaHandshake, FaChild, FaScroll, FaBars
} from "react-icons/fa";
import "../css/MyNavbar.css";

export default function MyNavbar() {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const mainLinks = [
        { to: "/", label: "Home", icon: <FaHome /> },
        { to: "/news", label: "News", icon: <FaNewspaper /> },
        { to: "/sports", label: "Sport", icon: <FaCalendarAlt /> },
        { to: "/iscrizione", label: "Iscriviti", icon: <FaHandshake /> },
        { to: "/sponsor", label: "Sponsor", icon: <FaScroll /> },
        { to: "/chi-siamo", label: "Chi Siamo", icon: <FaUsers /> },
        { to: "/contatti", label: "Contatti", icon: <FaEnvelope /> },
    ];

    const dropdownLinks = [
        { to: "/privacy", label: "Privacy", icon: <FaFileAlt /> },
        { to: "/tutela-minori", label: "Tutela dei minori", icon: <FaChild /> },
        { to: "/cinquepermille", label: "5x1000", icon: <FaScroll /> },
        { to: "/contributi-pubblici", label: "Contributi pubblici", icon: <FaScroll /> },
    ];

    return (
        <header className="navbar">
            <div className="navbar-container">
                {/* TODO:: Da aggiungere?  */}              
                 {/*  <div className="navbar-logo">
                    <Link to="/" className="logo-text">Polisportiva San Donato</Link>
                </div> */}
                
                <nav className="navbar-nav">
                    {mainLinks.map((link, i) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.to === "/"}
                            className={({ isActive }) =>
                                isActive ? "nav-link active" : "nav-link"
                            }
                            data-index={i} // utile per nascondere alcuni link via CSS
                        >
                            {link.icon} <span>{link.label}</span>
                        </NavLink>
                    ))}

                    <div className="dropdown" ref={dropdownRef}>
                        <button
                            className="dropdown-toggle"
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                        >
                            <FaBars /> Documenti
                        </button>

                        {dropdownOpen && (
                            <div className="dropdown-menu show">
                                {dropdownLinks.map((link) => (
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
                        )}
                    </div>
                </nav>
            </div>
        </header>
    );
}
