import { NavLink, Link, Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  FaNewspaper, FaSignOutAlt, FaExternalLinkAlt,
  FaCalendarAlt, FaUsers, FaUserCheck, FaRunning, FaHistory, FaSitemap, FaHome, FaFutbol,
  FaEuroSign,
  FaImages,
  FaClipboardCheck,
  FaCalendarCheck,
  FaUserCircle,
  FaChalkboardTeacher,
  FaLayerGroup,
  FaFileAlt
} from "react-icons/fa";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { AREA_ATLETA } from "../../utils/percorsi";
import Ritratto from "./Ritratto";
import NavigazioneMobile from "./NavigazioneMobile";
import SelettoreStagione from "./SelettoreStagione";
import StagioneProvider from "../../context/StagioneProvider";
import { MARCHIO } from "../AllPages/marchio";

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
  { a: "notizie", etichetta: "Notizie", gruppo: "Comunicazione", Icona: FaNewspaper, capacita: ["notizie.leggi_bozze"] },
  // Partite ed eventi sono due voci perché sono due moduli diversi: una
  // partita ha avversario, risultato e parziali; un'assemblea dei soci no.
  // Finiscono sullo stesso calendario del sito.
  { a: "partite", etichetta: "Partite", gruppo: "Attività", Icona: FaFutbol, capacita: ["eventi.gestisci_tutte", "eventi.gestisci_proprie"] },
  { a: "eventi", etichetta: "Eventi", gruppo: "Attività", Icona: FaCalendarAlt, capacita: ["eventi.gestisci_tutte"] },
  // I tornei delle federazioni e i loro gironi. Quale squadra gioca in quale
  // girone si decide invece da Squadre.
  { a: "calendari", etichetta: "Calendari ufficiali", gruppo: "Attività", Icona: FaCalendarCheck, capacita: ["calendari.gestisci"] },
  { a: "richieste", etichetta: "Richieste", gruppo: "Persone", Icona: FaUserCheck, capacita: ["iscrizioni.decidi_tutte", "iscrizioni.decidi_proprie"] },
  { a: "atleti", etichetta: "Atleti", gruppo: "Persone", Icona: FaRunning, capacita: ["atleti.leggi"] },
  { a: "squadre", etichetta: "Squadre", gruppo: "Attività", Icona: FaSitemap, capacita: ["squadre.gestisci"] },
  { a: "quote", etichetta: "Quote", gruppo: "Quote e stagioni", Icona: FaEuroSign, capacita: ["quote.gestisci"] },
  // Chi allena e la sua quota: nell'elenco Atleti non compare, qui sì
  { a: "allenatori", etichetta: "Allenatori", gruppo: "Persone", Icona: FaChalkboardTeacher, capacita: ["quote.gestisci"] },
  // I numeri di ogni stagione, quella in corso e le passate
  { a: "stagioni", etichetta: "Stagioni", gruppo: "Quote e stagioni", Icona: FaLayerGroup, capacita: ["quote.gestisci"] },
  { a: "utenti", etichetta: "Utenti", gruppo: "Persone", Icona: FaUsers, capacita: ["utenti.gestisci"] },
  { a: "libreria", etichetta: "Libreria", gruppo: "Comunicazione", Icona: FaImages, capacita: ["notizie.scrivi", "eventi.gestisci_tutte", "eventi.gestisci_proprie"] },
  // I file che il sito mette a disposizione: statuto, privacy, rendiconti
  { a: "documenti", etichetta: "Documenti", gruppo: "Comunicazione", Icona: FaFileAlt, capacita: ["documenti.gestisci"] },
  { a: "registro", etichetta: "Registro", gruppo: "Sistema", Icona: FaHistory, capacita: ["registro.leggi"] },

  /* In fondo, dopo tutto quello che si amministra, perché è l'unica voce
     che non riguarda gli altri: è la propria iscrizione alla società e la
     propria quota. Oggi la vede chi allena — anche un allenatore è un
     iscritto che versa la sua quota — e chiunque altro la capacità dica. */
  { a: "iscrizione", etichetta: "Iscrizione", gruppo: "Per te", Icona: FaClipboardCheck, capacita: ["iscrizione.propria"] }
];

/**
 * I gruppi, nell'ordine in cui compaiono.
 *
 * Servono solo a chi vede molte sezioni (oggi l'amministratore): quattordici
 * voci in fila non si leggono, divise per argomento sì — "dove sono le
 * quote?" ha una risposta sola. Chi ne vede poche le ha in fila e basta,
 * perché un titolo sopra a due voci è rumore. Il gruppo di ciascuna sezione
 * sta nella sezione stessa, qui sopra; la Home non ne ha e sta sempre prima.
 */
const GRUPPI = ["Comunicazione", "Attività", "Persone", "Quote e stagioni", "Sistema", "Per te"];

/* Da quante sezioni in su si passa alla colonna a sinistra con i gruppi.
   Otto ci stanno ancora in una riga a 1280 pixel; di più no. */
const SOGLIA_GRUPPI = 8;

/**
 * Quali sezioni vanno nella barra in basso sul telefono, in ordine.
 *
 * Ci stanno quattro voci più il menu: per ciascun ruolo vincono le prime
 * quattro di questo elenco che quel ruolo può aprire. Ne esce la barra
 * giusta per tutti senza scriverla ruolo per ruolo — all'amministratore
 * Home, Partite, Richieste, Atleti; alla segreteria Home, Richieste,
 * Atleti, Quote; a chi scrive le notizie Home, Partite, Notizie, Libreria.
 * Il resto sta nel menu, a un tocco.
 */
const PRIORITA_MOBILE = [
  "", "partite", "richieste", "atleti", "notizie", "quote", "libreria",
  "eventi", "iscrizione", "allenatori", "stagioni", "squadre", "calendari", "documenti", "utenti", "registro"
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

  const perMobile = [...visibili]
    .sort((x, y) => PRIORITA_MOBILE.indexOf(x.a) - PRIORITA_MOBILE.indexOf(y.a))
    .map(({ a, etichetta, Icona, esatta, gruppo }) => ({ a: a ? `${area}/${a}` : area, etichetta, Icona, esatta, gruppo }));

  // Molte sezioni: colonna a sinistra, divise per gruppo (vedi GRUPPI)
  const conGruppi = visibili.length > SOGLIA_GRUPPI;
  const gruppi = conGruppi
    ? [
        { nome: null, sezioni: visibili.filter((s) => !s.gruppo) },
        ...GRUPPI.map((nome) => ({ nome, sezioni: visibili.filter((s) => s.gruppo === nome) }))
      ].filter((g) => g.sezioni.length > 0)
    : [{ nome: null, sezioni: visibili }];

  const voce = ({ a, etichetta, Icona, esatta }) => (
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
  );

  // Il selettore della stagione serve a chi vede atleti o quote
  const conStagioni = !inAttesa && ["atleti.leggi", "quote.gestisci"].some((c) => capacita.includes(c));

  return (
    <StagioneProvider attivo={conStagioni}>
    <div className={`adm-shell ${conGruppi ? "is-laterale" : ""}`}>
      {/**
        * Due righe e non una.
        *
        * Con sei sezioni più il marchio più tre pulsanti, su una riga sola
        * non ci si sta: la riga andava a capo e "Vedi il sito", "Profilo" ed
        * "Esci" finivano sotto alla navigazione, cioè da nessuna parte. Qui
        * la prima riga è fissa — identità a sinistra, i tre pulsanti contro
        * il bordo destro, sempre — e le sezioni stanno sulla seconda, dove
        * possono essere quante servono.
        *
        * Chi ne ha più di SOGLIA_GRUPPI le trova invece in una colonna a
        * sinistra, divise per gruppo: è la stessa <nav>, che il CSS
        * (.is-laterale) sposta di lato sugli schermi larghi.
        */}
      <header className="adm-topbar">
        <div className="adm-topbar-alta">
          {/* Porta all'ingresso dell'area riservata, non al sito pubblico:
              è il gesto con cui si torna al punto di partenza del pannello,
              e per uscire sul sito c'è il pulsante apposta qui a destra. */}
          <Link to={area} className="adm-brand" title="Torna all'ingresso dell'area riservata">
            {/* Il logo nella tessera bianca, come nell'intestazione del
                sito: chi arriva dal sito si ritrova a casa. */}
            <span className="adm-brand-mark" aria-hidden="true">
              <img src={MARCHIO.logo} alt="" width="500" height="500" decoding="async" />
            </span>
            <span className="adm-brand-text">
              <span className="adm-brand-sopra">Area riservata</span>
              <span className="adm-brand-sotto">San Donato</span>
            </span>
          </Link>

          {/* Quale stagione si guarda: vale per atleti, schede e allenatori */}
          {conStagioni && <SelettoreStagione />}

          <div className="adm-user">
            {/* Sul telefono "Vedi il sito" ed "Esci" stanno nel menu in basso:
                qui, accanto al marchio, resta solo la propria foto. */}
            <a href="/" className="adm-ghost-btn adm-solo-schermo-grande" target="_blank" rel="noreferrer" title="Apri il sito pubblico">
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

            <button type="button" className="adm-ghost-btn adm-btn-esci adm-solo-schermo-grande" onClick={handleLogout} title="Esci">
              <FaSignOutAlt /> <span className="adm-hide-sm">Esci</span>
            </button>
          </div>
        </div>

        {visibili.length > 0 && (
          <nav className="adm-topbar-nav" aria-label="Sezioni">
            <div className="adm-nav">
              {conGruppi ? (
                <div className="adm-nav-gruppi">
                  {gruppi.map(({ nome, sezioni }) => (
                    <div key={nome || "home"} className="adm-nav-gruppo" role={nome ? "group" : undefined} aria-label={nome || undefined}>
                      {nome && <p className="adm-nav-gruppo-titolo" aria-hidden="true">{nome}</p>}
                      {sezioni.map(voce)}
                    </div>
                  ))}
                </div>
              ) : (
                visibili.map(voce)
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="adm-main">
        <Outlet />
      </main>

      <NavigazioneMobile
        sezioni={perMobile}
        extra={[{ a: `${area}/profilo`, etichetta: "Profilo", Icona: FaUserCircle }]}
        gruppi={conGruppi ? GRUPPI : null}
        onEsci={handleLogout}
      />
    </div>
    </StagioneProvider>
  );
}
