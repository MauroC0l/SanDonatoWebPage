import { NavLink, Link, Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  FaUserCircle, FaUsers, FaClipboardCheck, FaSignOutAlt, FaExternalLinkAlt,
  FaHome, FaPhoneAlt, FaEuroSign
} from "react-icons/fa";
import { useAuth } from "../../context/auth";
import { areaDi, AREA_ATLETA } from "../../utils/percorsi";

import "../../css/Admin.css";

/**
 * Il guscio dell'area dell'atleta.
 *
 * Non è il pannello di amministrazione con qualche voce nascosta: è un'altra
 * schermata, con tre voci sole e parole sue. Chi entra qui non gestisce
 * niente, guarda le proprie cose — e "admin" nell'indirizzo, a un ragazzo di
 * quattordici anni, non dice nulla.
 */
const SEZIONI = [
  { a: "/area-riservata", fine: true, etichetta: "Home", Icona: FaHome },
  { a: "/area-riservata/squadra", etichetta: "Squadra", Icona: FaUsers },
  { a: "/area-riservata/iscrizione", etichetta: "Iscrizione", Icona: FaClipboardCheck },

  /* I contatti prima del profilo e dopo l'iscrizione: sono la cosa che si
     torna a cambiare più spesso — numeri nuovi, un genitore che cambia
     turno — e in fondo a un modulo di venti caselle non si aggiornavano
     mai. */
  { a: "/area-riservata/contatti", etichetta: "Contatti", Icona: FaPhoneAlt },

  /* "Siamo in regola con la quota?" è la domanda che in segreteria
     arrivava più di ogni altra, e la risposta era già nel database. Una
     voce sola per arrivarci. */
  { a: "/area-riservata/quota", etichetta: "Quota", Icona: FaEuroSign },

  { a: "/area-riservata/profilo", etichetta: "Profilo", Icona: FaUserCircle }
];

export default function AreaAtletaLayout() {
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
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Chi ha una password provvisoria ne sceglie una sua prima di tutto il
  // resto: il controllo sta qui e non nelle pagine, così non si aggira
  // aprendo un indirizzo diverso.
  /**
   * Si va a /select-password invece di sostituire il contenuto sul posto.
   *
   * Con l'indirizzo che restava quello di prima, ricaricare la pagina
   * riportava alla stessa schermata senza spiegazione, e non si poteva dire
   * a nessuno "apri questo indirizzo". Il controllo resta qui nel guscio,
   * così non lo si aggira aprendo una sezione diversa.
   */
  if (deveCambiarePassword) return <Navigate to="/select-password" replace />;

  // Chi amministra qualcosa ha la sua area, con molte più sezioni: capitare
  // qui gli farebbe credere di aver perso i permessi.
  if (user?.role !== "atleta") return <Navigate to={areaDi(user?.role)} replace />;

  const inAttesa = user?.stato === "in_attesa";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="adm-shell">
      <header className="adm-topbar">
        <div className="adm-topbar-alta">
          {/* Porta all ingresso dell area riservata, non al sito pubblico:
              per uscire sul sito c e il pulsante apposta qui a destra. */}
          <Link to={AREA_ATLETA} className="adm-brand" title="Torna all ingresso della tua area">
            <span className="adm-brand-mark">PSD</span>
            <span className="adm-brand-text">Area riservata</span>
          </Link>

          <div className="adm-user">
            <a href="/" className="adm-ghost-btn" target="_blank" rel="noreferrer" title="Apri il sito pubblico">
              <FaExternalLinkAlt /> <span className="adm-hide-sm">Vedi il sito</span>
            </a>

            <button type="button" className="adm-ghost-btn adm-btn-esci" onClick={handleLogout} title="Esci">
              <FaSignOutAlt /> <span className="adm-hide-sm">Esci</span>
            </button>
          </div>
        </div>

        {/* Finche la squadra non e assegnata non c e ne un calendario da
            guardare ne un iscrizione da compilare: resta il profilo. */}
        {!inAttesa && (
          <nav className="adm-topbar-nav" aria-label="Sezioni">
            <div className="adm-nav">
              {SEZIONI.map(({ a, fine, etichetta, Icona }) => (
                <NavLink
                  key={a}
                  to={a}
                  end={fine}
                  className={({ isActive }) => `adm-nav-link ${isActive ? "is-active" : ""}`}
                >
                  <Icona aria-hidden="true" /> <span>{etichetta}</span>
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="adm-main">
        <Outlet />
      </main>
    </div>
  );
}
