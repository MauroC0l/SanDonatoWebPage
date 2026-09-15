import { NavLink, Link, Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  FaNewspaper, FaSignOutAlt, FaExternalLinkAlt,
  FaCalendarAlt, FaUsers, FaUserCheck, FaRunning, FaHistory, FaSitemap, FaHome, FaFutbol,
  FaEuroSign,
  FaImages
} from "react-icons/fa";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { AREA_ATLETA } from "../../utils/percorsi";
import Ritratto from "./Ritratto";

import "../../css/Admin.css";
import "../../css/Ritratto.css";

/**
 * Le sezioni della barra, in un elenco invece che sparse nel JSX.
 *
 * Ogni voce dichiara le capacità che la rendono visibile: aggiungere una
 * sezione è una riga qui, e il confronto con server/autorizzazioni.js si fa
 * leggendo due elenchi affiancati invece che frugando nel markup.
 *
 * Non è un controllo di sicurezza — quello sta sul server — ma il modo di
 * non proporre a qualcuno una porta chiusa.
 */
const SEZIONI = [
  // La home non ha capacità: chiunque sia entrato ha una prima schermata.
  // "esatta" perché è l'area stessa e non una sottosezione: senza, sarebbe
  // accesa anche stando su Notizie o su Eventi.
  { a: "", etichetta: "Home", Icona: FaHome, capacita: null, esatta: true },
  { a: "notizie", etichetta: "Notizie", Icona: FaNewspaper, capacita: ["notizie.leggi_bozze"] },
  // Partite ed eventi sono due voci perché sono due moduli diversi: una
  // partita ha avversario, risultato e parziali; un'assemblea dei soci no.
  // Finiscono sullo stesso calendario del sito.
  { a: "partite", etichetta: "Partite", Icona: FaFutbol, capacita: ["eventi.gestisci_tutte", "eventi.gestisci_proprie"] },
  { a: "eventi", etichetta: "Eventi", Icona: FaCalendarAlt, capacita: ["eventi.gestisci_tutte"] },
  { a: "richieste", etichetta: "Richieste", Icona: FaUserCheck, capacita: ["iscrizioni.decidi_tutte", "iscrizioni.decidi_proprie"] },
  { a: "atleti", etichetta: "Atleti", Icona: FaRunning, capacita: ["atleti.leggi"] },
  { a: "squadre", etichetta: "Squadre", Icona: FaSitemap, capacita: ["squadre.gestisci"] },
  { a: "quote", etichetta: "Quote", Icona: FaEuroSign, capacita: ["quote.gestisci"] },
  { a: "utenti", etichetta: "Utenti", Icona: FaUsers, capacita: ["utenti.gestisci"] },
  { a: "libreria", etichetta: "Libreria", Icona: FaImages, capacita: ["notizie.scrivi", "eventi.gestisci_tutte", "eventi.gestisci_proprie"] },
  { a: "registro", etichetta: "Registro", Icona: FaHistory, capacita: ["registro.leggi"] }
];

/**
 * Guscio dell'area riservata: barra superiore, navigazione e controllo accesso.
 * Tutto ciò che sta sotto i prefissi dello staff passa da qui.
 */
export default function AdminLayout() {
  const { user, isAuthenticated, isChecking, logout, deveCambiarePassword } = useAuth();
  const area = useArea();
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

  /**
   * Un atleta non entra qui, nemmeno scrivendo l'indirizzo a mano.
   *
   * Il controllo sta nel guscio e non nelle singole rotte perché la pagina
   * del profilo è aperta a chiunque sia entrato: senza questa riga un atleta
   * che apre /admin/profilo si troverebbe la barra del pannello, con voci
   * che non gli servono e che il server gli rifiuterebbe comunque.
   */
  if (user?.role === "atleta") return <Navigate to={AREA_ATLETA} replace />;

  /**
   * Ciascuno sotto il proprio prefisso.
   *
   * Un allenatore che arriva su /admin/eventi — da un segnalibro vecchio o
   * da un collegamento passato da qualcun altro — viene portato sullo stesso
   * posto scritto come gli compete: /coach/eventi. La sezione non cambia,
   * cambia solo il nome dell'area, quindi il rimbalzo non fa perdere il
   * punto in cui si stava andando.
   */
  if (!location.pathname.startsWith(`${area}/`) && location.pathname !== area) {
    const resto = location.pathname.replace(/^\/[^/]+/, "");
    return <Navigate to={`${area}${resto}`} replace />;
  }

  /**
   * Chi ha una password provvisoria ne sceglie una sua prima di tutto.
   *
   * Si va a /select-password invece di sostituire il contenuto sul posto:
   * con l'indirizzo che restava quello di prima, ricaricare la pagina
   * riportava alla stessa schermata senza spiegazione, e non si poteva dire
   * a nessuno "apri questo indirizzo". Il controllo resta qui, nel guscio,
   * così non lo si aggira aprendo una sezione diversa.
   */
  if (deveCambiarePassword) return <Navigate to="/select-password" replace />;

  const capacita = user?.capabilities ?? [];

  /**
   * Chi si è registrato e non ha ancora una squadra resta nel guscio, ma con
   * la barra ridotta all'osso: le tre cose che gli servono — il sito, la
   * propria scheda, l'uscita — ci sono; le sezioni da amministrare, che non
   * potrebbe usare, no.
   */
  const inAttesa = user?.stato === "in_attesa";

  const visibili = inAttesa
    ? []
    : SEZIONI.filter((s) => !s.capacita || s.capacita.some((c) => capacita.includes(c)));

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="adm-shell">
      {/**
        * Due righe e non una.
        *
        * Con sei sezioni più il marchio più tre pulsanti, su una riga sola
        * non ci si sta: la riga andava a capo e "Vedi il sito", "Profilo" ed
        * "Esci" finivano sotto alla navigazione, cioè da nessuna parte. Qui
        * la prima riga è fissa — identità a sinistra, i tre pulsanti contro
        * il bordo destro, sempre — e le sezioni stanno sulla seconda, dove
        * possono essere quante servono.
        */}
      <header className="adm-topbar">
        <div className="adm-topbar-alta">
          {/* Porta all'ingresso dell'area riservata, non al sito pubblico:
              è il gesto con cui si torna al punto di partenza del pannello,
              e per uscire sul sito c'è il pulsante apposta qui a destra. */}
          <Link to={area} className="adm-brand" title="Torna all'ingresso dell'area riservata">
            <span className="adm-brand-mark">PSD</span>
            <span className="adm-brand-text">Area riservata</span>
          </Link>

          <div className="adm-user">
            <a href="/" className="adm-ghost-btn" target="_blank" rel="noreferrer" title="Apri il sito pubblico">
              <FaExternalLinkAlt /> <span className="adm-hide-sm">Vedi il sito</span>
            </a>

            {/* Il nome sta dentro al pulsante del profilo e non accanto:
                è l'etichetta della propria scheda, non una decorazione.
                Al posto dell'icona uguale per tutti c'è la propria foto —
                o le proprie iniziali — che è anche il modo più diretto di
                accorgersi di essere entrati con l'account sbagliato. */}
            <NavLink
              to={`${area}/profilo`}
              className={({ isActive }) => `adm-ghost-btn adm-profilo-btn ${isActive ? "is-active" : ""}`}
              title="I tuoi dati"
            >
              <Ritratto nome={user?.name} url={user?.immagineUrl} dimensione="xs" />
              <span className="adm-profilo-nome">{user?.name}</span>
            </NavLink>

            <button type="button" className="adm-ghost-btn adm-btn-esci" onClick={handleLogout} title="Esci">
              <FaSignOutAlt /> <span className="adm-hide-sm">Esci</span>
            </button>
          </div>
        </div>

        {visibili.length > 0 && (
          <nav className="adm-topbar-nav" aria-label="Sezioni">
            <div className="adm-nav">
              {visibili.map(({ a, etichetta, Icona, esatta }) => (
                <NavLink
                  key={a || "home"}
                  // La Home è l'area stessa, non una sua sottosezione: con
                  // "/admin/" finale sarebbe il prefisso di tutte le altre
                  // rotte, e risulterebbe accesa ovunque.
                  to={a ? `${area}/${a}` : area}
                  end={esatta}
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
