import { lazy, Suspense } from "react";
import { NavLink, Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  FaNewspaper, FaPlus, FaSignOutAlt, FaUserCircle, FaExternalLinkAlt,
  FaCalendarAlt, FaUsers, FaUserCheck, FaKey
} from "react-icons/fa";
import { useAuth } from "../../context/auth";
const CambioPasswordPage = lazy(() => import("./CambioPasswordPage"));
const AttesaSquadraPage = lazy(() => import("./AttesaSquadraPage"));

import "../../css/Admin.css";

/**
 * Guscio dell'area riservata: barra superiore, navigazione e controllo accesso.
 * Tutto ciò che sta sotto /admin passa da qui.
 */
export default function AdminLayout() {
  const { user, isAuthenticated, isChecking, logout, deveCambiarePassword } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (isChecking) {
    return (
      <div className="adm-boot">
        <div className="adm-spinner" />
        <p>Verifica dell&apos;accesso…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Ricordiamo dove voleva andare, per riportarcelo dopo il login
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Prima di qualunque altra cosa: chi ha una password provvisoria deve
  // sceglierne una sua. Il controllo sta qui e non nelle singole pagine,
  // così non si può aggirare aprendo un indirizzo diverso.
  if (deveCambiarePassword) {
    return (
      <Suspense fallback={<div className="adm-boot"><div className="adm-spinner" /></div>}>
        <CambioPasswordPage obbligatorio />
      </Suspense>
    );
  }

  // Chi si è registrato e non ha ancora una squadra non entra nel
  // pannello: non c'è nulla che possa fare finché qualcuno non decide.
  if (user?.stato === "in_attesa") {
    return (
      <Suspense fallback={<div className="adm-boot"><div className="adm-spinner" /></div>}>
        <AttesaSquadraPage />
      </Suspense>
    );
  }

  /** Scorciatoia: le capacità arrivano dal server insieme all'utente. */
  const puo = (capacita) => (user?.capabilities ?? []).includes(capacita);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="adm-shell">
      <header className="adm-topbar">
        <div className="adm-topbar-inner">
          <div className="adm-brand">
            <span className="adm-brand-mark">PSD</span>
            <span className="adm-brand-text">Area riservata</span>
          </div>

          {/* Ognuno vede le proprie sezioni: a un allenatore non serve la
              voce "Notizie", che gli risponderebbe comunque di no. Non è un
              controllo di sicurezza — quello sta sul server — ma il modo di
              non proporre a qualcuno una porta chiusa. */}
          <nav className="adm-nav">
            {puo("notizie.leggi_bozze") && (
              <NavLink to="/admin" end className={({ isActive }) => `adm-nav-link ${isActive ? "is-active" : ""}`}>
                <FaNewspaper /> <span>Notizie</span>
              </NavLink>
            )}

            {puo("notizie.scrivi") && (
              <NavLink to="/admin/nuova" className={({ isActive }) => `adm-nav-link ${isActive ? "is-active" : ""}`}>
                <FaPlus /> <span>Nuova</span>
              </NavLink>
            )}

            {(puo("eventi.gestisci_proprie") || puo("eventi.gestisci_tutte")) && (
              <NavLink to="/admin/eventi" className={({ isActive }) => `adm-nav-link ${isActive ? "is-active" : ""}`}>
                <FaCalendarAlt /> <span>Eventi</span>
              </NavLink>
            )}

            {(puo("iscrizioni.decidi_tutte") || puo("iscrizioni.decidi_proprie")) && (
              <NavLink to="/admin/iscrizioni" className={({ isActive }) => `adm-nav-link ${isActive ? "is-active" : ""}`}>
                <FaUserCheck /> <span>Richieste</span>
              </NavLink>
            )}

            {puo("utenti.gestisci") && (
              <NavLink to="/admin/persone" className={({ isActive }) => `adm-nav-link ${isActive ? "is-active" : ""}`}>
                <FaUsers /> <span>Persone</span>
              </NavLink>
            )}
          </nav>

          <div className="adm-user">
            <span className="adm-user-name">
              <FaUserCircle /> {user?.name}
              {user?.role && <span className="adm-role-tag">{user.role}</span>}
            </span>
            <NavLink to="/admin/password" className="adm-ghost-btn" title="Cambia la password">
              <FaKey /> <span className="adm-hide-sm">Password</span>
            </NavLink>
            <a href="/" className="adm-ghost-btn" target="_blank" rel="noreferrer" title="Apri il sito pubblico">
              <FaExternalLinkAlt /> <span className="adm-hide-sm">Vedi il sito</span>
            </a>
            <button type="button" className="adm-ghost-btn" onClick={handleLogout}>
              <FaSignOutAlt /> <span className="adm-hide-sm">Esci</span>
            </button>
          </div>
        </div>
      </header>

      <main className="adm-main">
        <Outlet />
      </main>
    </div>
  );
}
