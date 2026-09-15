import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";
import { SiTiktok } from "react-icons/si";
import { FiMapPin, FiMail, FiArrowUpRight } from "react-icons/fi";
import "../../css/Footer.css";

import headerData from "../../data/TopHeader.json";

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

export default function Footer() {
  const { contactInfo, socialLinks } = headerData;
  const indirizzo = [contactInfo.street, contactInfo.city].filter(Boolean).join(", ");
  const anno = new Date().getFullYear();

  const social = [
    { chiave: "facebook", Icona: FaFacebookF, nome: "Facebook" },
    { chiave: "instagram", Icona: FaInstagram, nome: "Instagram" },
    { chiave: "youtube", Icona: FaYoutube, nome: "YouTube" },
    { chiave: "tiktok", Icona: SiTiktok, nome: "TikTok" }
  ];

  return (
    <footer className="ft">
      <div className="ft-contenitore">

        <div className="ft-alto">

          <div className="ft-chi">
            <span className="ft-marchio">A.S.D. Polisportiva San Donato</span>
            <p className="ft-frase">
              Sport per tutti al Borgo San Donato, a Torino: calcio, pallavolo
              e basket, dai più piccoli agli adulti.
            </p>

            <div className="ft-social">
              {social.map(({ chiave, Icona, nome }) => (
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
        </div>

      </div>
    </footer>
  );
}
