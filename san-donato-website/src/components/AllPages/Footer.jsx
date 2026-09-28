import { Link, useLocation } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";
import { SiTiktok } from "react-icons/si";
import { FiMapPin, FiMail, FiArrowUpRight, FiArrowUp, FiArrowRight } from "react-icons/fi";
import "../../css/Footer.css";

import headerData from "../../data/TopHeader.json";
import { MARCHIO } from "./marchio";

/**
 * Il fondo di ogni pagina.
 *
 * Prima era una riga sola con il copyright. Il fondo è però il posto in cui
 * si va a cercare quello che non sta nel menu — la sede, l'indirizzo di
 * posta, la privacy, i contributi pubblici — e sono anche le informazioni
 * che una ASD è tenuta a rendere raggiungibili.
 *
 * I dati fiscali stavano nella barra in alto, in coda all'indirizzo. Lì
 * rubavano spazio ai contatti e nessuno li leggeva: qui sono al loro posto.
 *
 * Veste come l'intestazione (blu, la tessera bianca del logo, il nome in
 * due righe) e si apre con una fascia d'invito: chi è arrivato in fondo a
 * una pagina ha finito di leggere, ed è il momento di chiedergli di venire
 * a giocare. Sulla pagina dell'iscrizione la fascia non c'è: sarebbe un
 * invito a fare quello che si sta già facendo.
 */

const SEZIONI = [
  {
    titolo: "La Polisportiva",
    voci: [
      { a: "/chi-siamo", testo: "Chi siamo" },
      { a: "/sports", testo: "Gli sport" },
      { a: "/galleria", testo: "Galleria" },
      { a: "/sponsor", testo: "Sponsor" }
    ]
  },
  {
    titolo: "Partecipa",
    voci: [
      { a: "/iscrizione", testo: "Iscriviti" },
      { a: "/calendario", testo: "Calendario" },
      { a: "/news", testo: "Notizie" },
      { a: "/cinquepermille", testo: "5 per mille" }
    ]
  },
  {
    titolo: "Trasparenza",
    voci: [
      { a: "/privacy", testo: "Privacy" },
      { a: "/tutela-minori", testo: "Tutela dei minori" },
      { a: "/contributi-pubblici", testo: "Contributi pubblici" },
      { a: "/contatti", testo: "Contatti" }
    ]
  }
];

const SOCIAL = [
  { chiave: "facebook", Icona: FaFacebookF, nome: "Facebook" },
  { chiave: "instagram", Icona: FaInstagram, nome: "Instagram" },
  { chiave: "youtube", Icona: FaYoutube, nome: "YouTube" },
  { chiave: "tiktok", Icona: SiTiktok, nome: "TikTok" }
];

/* Torna in cima: dolce, tranne per chi ha chiesto meno movimento */
function tornaSu() {
  const ridotto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: ridotto ? "auto" : "smooth" });
}

export default function Footer() {
  const { pathname } = useLocation();
  const { contactInfo, socialLinks } = headerData;
  const indirizzo = [contactInfo.street, contactInfo.city].filter(Boolean).join(", ");
  const anno = new Date().getFullYear();
  const conInvito = pathname !== "/iscrizione";

  return (
    <footer className="ft">
      {/* ---------- Fascia d'invito ---------- */}
      {conInvito && (
        <section className="ft-invito" aria-labelledby="ft-invito-titolo">
          <div className="mv-aurora ft-invito-aurora" aria-hidden="true" />
          {/* La chiave cambia con la pagina: l'osservatore dei movimenti
              vede solo gli elementi nuovi, e senza chiave il titolo
              resterebbe quello già "visto" della pagina prima. */}
          <div className="ft-invito-dentro" key={pathname}>
            <p className="ft-invito-occhiello" data-rivela>
              <span className="ft-punto" aria-hidden="true" /> Ti aspettiamo
            </p>
            <h2 id="ft-invito-titolo" className="ft-invito-titolo" data-rivela>
              Scendi in campo <span className="mv-testo-vivo">con noi.</span>
            </h2>
            <div className="ft-invito-azioni" data-rivela style={{ "--mv-ritardo": "140ms" }}>
              <Link to="/iscrizione" className="ft-btn ft-btn--pieno" data-magnete>
                Iscriviti <FiArrowRight aria-hidden="true" />
              </Link>
              <Link to="/contatti" className="ft-btn ft-btn--vetro mv-vetro">
                Scrivici
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="ft-contenitore">

        {/* Le colonne salgono una dopo l'altra quando il fondo entra in
            vista: un segnale leggero che la pagina è finita qui. La chiave
            fa ripartire la comparsa a ogni pagina. */}
        <div className="ft-alto" data-rivela-gruppo key={pathname}>

          <div className="ft-chi">
            <Link to="/" className="ft-marchio" aria-label={`${MARCHIO.nome}, torna alla home`}>
              <span className="ft-tessera" aria-hidden="true">
                <img src={MARCHIO.logo} alt="" width="500" height="500" loading="lazy" decoding="async" />
              </span>
              <span className="ft-nome" aria-hidden="true">
                <span className="ft-nome-sopra">Polisportiva</span>
                <span className="ft-nome-sotto">San Donato</span>
              </span>
            </Link>
            <p className="ft-frase">
              Sport per tutti al Borgo San Donato, a Torino: calcio, pallavolo
              e basket, dai più piccoli agli adulti.
            </p>

            <div className="ft-social">
              {SOCIAL.map(({ chiave, Icona, nome }) => (
                <a
                  key={chiave}
                  href={socialLinks[chiave]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={nome}
                >
                  <Icona />
                </a>
              ))}
            </div>
          </div>

          {SEZIONI.map((sezione) => (
            <nav className="ft-colonna" key={sezione.titolo} aria-label={sezione.titolo}>
              <h3 className="ft-colonna-titolo">{sezione.titolo}</h3>
              <ul>
                {sezione.voci.map((voce) => (
                  <li key={voce.a}>
                    <Link to={voce.a}>{voce.testo}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="ft-colonna ft-dove">
            <h3 className="ft-colonna-titolo">Dove siamo</h3>

            <a
              className="ft-contatto"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${indirizzo} Torino`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FiMapPin aria-hidden="true" />
              <span>{indirizzo}</span>
              <FiArrowUpRight className="ft-fuori" aria-hidden="true" />
            </a>

            <a className="ft-contatto" href={`mailto:${contactInfo.email}`}>
              <FiMail aria-hidden="true" />
              <span>{contactInfo.email}</span>
            </a>
          </div>

        </div>

        <div className="ft-basso">
          <span>© {anno} A.S.D. Polisportiva San Donato</span>
          <span className="ft-fiscali">{contactInfo.legal}</span>
          <button type="button" className="ft-su" onClick={tornaSu}>
            Torna su <FiArrowUp aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Il nome enorme, solo disegnato, che chiude il sito */}
      <div className="ft-firma" aria-hidden="true">San Donato</div>
    </footer>
  );
}
