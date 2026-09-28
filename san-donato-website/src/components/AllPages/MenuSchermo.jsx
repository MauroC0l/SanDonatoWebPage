import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaYoutube, FaChevronDown, FaDownload, FaArrowRight } from "react-icons/fa";
import { SiTiktok } from "react-icons/si";
import { FiMapPin, FiMail, FiLogIn, FiUserPlus } from "react-icons/fi";
import { attesaAreaRiservata } from "../../precarica";
import { VOCI, DOCUMENTI } from "./vociMenu";
import { MARCHIO } from "./marchio";
import headerData from "../../data/TopHeader.json";

const SOCIAL = [
  { chiave: "facebook", Icona: FaFacebookF, nome: "Facebook" },
  { chiave: "instagram", Icona: FaInstagram, nome: "Instagram" },
  { chiave: "youtube", Icona: FaYoutube, nome: "YouTube" },
  { chiave: "tiktok", Icona: SiTiktok, nome: "TikTok" }
];

const ATTIVABILI = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Il menu a tutto schermo dei telefoni e dei tablet.
 *
 * Si apre SOTTO alla riga dell'intestazione, che resta in vista: il
 * pulsante che l'ha aperto diventa la croce che lo chiude, nello stesso
 * punto, e il marchio resta dov'era. Dentro c'è tutto quello che sul
 * computer sta nella barra sottile e nella riga del menu: le voci in
 * grande, i documenti, l'accesso, i social, i recapiti e il motto.
 *
 * Finché è aperto la pagina sotto non scorre, il tabulatore gira solo fra
 * le sue voci (e la croce), ed Esc lo chiude.
 */
export default function MenuSchermo({ uscita, chiudi, burgerRef, barraRef, pathname }) {
  const pannelloRef = useRef(null);
  const documentoAttivo = DOCUMENTI.some((d) => !d.download && d.to === pathname);
  // I documenti partono aperti se si è già su uno di loro
  const [docsAperti, setDocsAperti] = useState(documentoAttivo);

  const { contactInfo, socialLinks } = headerData;
  const indirizzo = [contactInfo.street, contactInfo.city].filter(Boolean).join(", ");

  /* Il pannello comincia dove finisce la riga dell'intestazione, che
     cambia altezza con la larghezza e con lo scorrimento (la barra
     sottile se ne va): si misura all'apertura invece di indovinarla. */
  useLayoutEffect(() => {
    const riga = barraRef.current;
    const pannello = pannelloRef.current;
    if (!riga || !pannello) return;
    const misura = () => {
      pannello.style.setProperty("--ms-alto", `${Math.max(0, Math.round(riga.getBoundingClientRect().bottom))}px`);
    };
    misura();
    window.addEventListener("resize", misura);
    return () => window.removeEventListener("resize", misura);
  }, [barraRef]);

  // La pagina sotto resta ferma: si scorre solo il menu
  useEffect(() => {
    const radice = document.documentElement;
    const prima = radice.style.overflow;
    radice.style.overflow = "hidden";
    return () => { radice.style.overflow = prima; };
  }, []);

  // Il fuoco entra nel menu, e il tabulatore non ne esce
  useEffect(() => {
    const pannello = pannelloRef.current;
    pannello?.querySelector(ATTIVABILI)?.focus({ preventScroll: true });

    const suTasto = (e) => {
      if (e.key === "Escape") { chiudi(); return; }
      if (e.key !== "Tab" || !pannello) return;
      /* Il giro si fa a mano, sempre: la croce sta nell'intestazione e il
         pannello in fondo al body, e nell'ordine del documento fra i due
         c'è tutta la pagina. Lasciando fare al browser, dalla croce il
         tabulatore finirebbe sui pulsanti della home sotto al menu. */
      const giro = [burgerRef.current, ...pannello.querySelectorAll(ATTIVABILI)]
        .filter((el) => el && el.offsetParent !== null);
      if (giro.length === 0) return;
      e.preventDefault();
      const qui = giro.indexOf(document.activeElement);
      const passo = e.shiftKey ? -1 : 1;
      const prossimo = qui === -1 ? 0 : (qui + passo + giro.length) % giro.length;
      giro[prossimo].focus();
    };
    document.addEventListener("keydown", suTasto);
    return () => document.removeEventListener("keydown", suTasto);
  }, [chiudi, burgerRef]);

  return (
    <div
      id="menu-schermo"
      ref={pannelloRef}
      className={`menu-schermo ${uscita ? "esce" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Menu del sito"
    >
      <div className="mv-aurora ms-aurora" aria-hidden="true" />
      <div className="ms-griglia" aria-hidden="true" />

      <div className="ms-dentro">
        <nav className="ms-nav" aria-label="Menu principale">
          <ol className="ms-voci">
            {VOCI.map((voce, i) => (
              <li key={voce.to} style={{ "--ms-i": i }}>
                <NavLink to={voce.to} end={voce.to === "/"} className="ms-voce" onClick={chiudi}>
                  <span className="ms-numero" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <span className="ms-etichetta">{voce.label}</span>
                  <FaArrowRight className="ms-freccia" aria-hidden="true" />
                </NavLink>
              </li>
            ))}

            <li style={{ "--ms-i": VOCI.length }}>
              <button
                type="button"
                className={`ms-voce ms-voce-documenti ${documentoAttivo ? "active" : ""}`}
                aria-expanded={docsAperti}
                aria-controls="ms-documenti"
                onClick={() => setDocsAperti((v) => !v)}
              >
                <span className="ms-numero" aria-hidden="true">{String(VOCI.length + 1).padStart(2, "0")}</span>
                <span className="ms-etichetta">Documenti</span>
                <FaChevronDown className={`ms-freccia ms-freccia-giu ${docsAperti ? "gira" : ""}`} aria-hidden="true" />
              </button>

              <div id="ms-documenti" className="ms-documenti" hidden={!docsAperti}>
                {DOCUMENTI.map((doc) => (
                  doc.download ? (
                    <a key={doc.to} href={doc.to} className="ms-documento" download target="_blank" rel="noopener noreferrer" onClick={chiudi}>
                      <span aria-hidden="true">{doc.icon}</span>
                      {doc.label}
                      <FaDownload className="ms-scarica" aria-label="da scaricare" />
                    </a>
                  ) : (
                    <NavLink key={doc.to} to={doc.to} className="ms-documento" onClick={chiudi}>
                      <span aria-hidden="true">{doc.icon}</span>
                      {doc.label}
                    </NavLink>
                  )
                ))}
              </div>
            </li>
          </ol>
        </nav>

        <div className="ms-lato" style={{ "--ms-i": VOCI.length + 1 }}>
          <div className="ms-accesso">
            <Link to="/registrati" className="ms-bottone ms-bottone-vetro" onClick={chiudi} {...attesaAreaRiservata}>
              <FiUserPlus aria-hidden="true" /> Registrati
            </Link>
            <Link to="/login" className="ms-bottone ms-bottone-pieno" onClick={chiudi} {...attesaAreaRiservata}>
              <FiLogIn aria-hidden="true" /> Accedi
            </Link>
          </div>

          <div className="ms-recapiti">
            <a
              className="ms-recapito"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${indirizzo} Torino`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FiMapPin aria-hidden="true" /> {indirizzo}
            </a>
            <a className="ms-recapito" href={`mailto:${contactInfo.email}`}>
              <FiMail aria-hidden="true" /> {contactInfo.email}
            </a>
          </div>

          <div className="ms-social">
            {SOCIAL.map(({ chiave, Icona, nome }) => (
              <a key={chiave} href={socialLinks[chiave]} target="_blank" rel="noopener noreferrer" aria-label={nome}>
                <Icona aria-hidden="true" />
              </a>
            ))}
          </div>

          <figure className="ms-motto">
            <blockquote>{MARCHIO.motto}</blockquote>
            <figcaption>{MARCHIO.slogan}</figcaption>
          </figure>
        </div>
      </div>
    </div>
  );
}
