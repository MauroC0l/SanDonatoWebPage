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
        { to: "/galleria", label: "Galleria", icon: <FaImages /> },
        { to: "/sports", label: "Sport & Attività", icon: <FaCalendarAlt /> },
        { to: "/modulistica-tariffe", label: "Modulistica & Tariffe", icon: <FaFileAlt /> },
        { to: "/iscrizione-rinnovo", label: "Iscrizione & Rinnovo", icon: <FaHandshake /> },
        { to: "/sponsor", label: "Sponsor", icon: <FaScroll /> },
        { to: "/chi-siamo", label: "Chi Siamo", icon: <FaUsers /> },
    ];

    const dropdownLinks = [
        { to: "/contatti", label: "Contatti", icon: <FaEnvelope /> },
        { to: "/privacy", label: "Privacy", icon: <FaFileAlt /> },
        { to: "/tutela-minori", label: "Tutela dei minori", icon: <FaChild /> },
        { to: "/safeguarding", label: "Safeguarding", icon: <FaUsers /> },
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
                    {mainLinks.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.to === "/"}
                            className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                        >
                            <span className="nav-icon">{link.icon}</span> {link.label}
                        </NavLink>
                    ))}

                    <div className="dropdown" ref={dropdownRef}>
                        <button
                            className="dropdown-toggle"
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                        >
                            <FaBars /> Menu
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
