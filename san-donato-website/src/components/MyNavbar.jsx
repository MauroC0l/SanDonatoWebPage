import { Link, NavLink } from "react-router-dom";
import { FaHome, FaNewspaper, FaImages, FaUsers, FaEnvelope } from "react-icons/fa";
import "../css/MyNavbar.css";

export default function MyNavbar() {
    return (
        <header className="navbar">
            <div className="navbar-container">
                <div className="navbar-logo">
                    <Link to="/" className="logo-text">Polisportiva San Donato</Link>
                </div>

                <nav className="navbar-nav">
                    <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                        <FaHome className="nav-icon" /> Home
                    </NavLink>
                    <NavLink to="/news" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                        <FaNewspaper className="nav-icon" /> News
                    </NavLink>
                    <NavLink to="/galleria" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                        <FaImages className="nav-icon" /> Galleria
                    </NavLink>
                    <NavLink to="/chi-siamo" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                        <FaUsers className="nav-icon" /> Chi Siamo
                    </NavLink>
                    <NavLink to="/contatti" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                        <FaEnvelope className="nav-icon" /> Contatti
                    </NavLink>
                    

                </nav>
            </div>
        </header>
    );

    /*
        chi siamo
        sport e attività
        modulistica e tariffe
        iscrizione rinnovo
        statuto
        politiche safeguarding
        tutela dei minori
        galleria
        privacy
        sponsor
        5*1000
        contributi pubblici
        contatti

    */
}
