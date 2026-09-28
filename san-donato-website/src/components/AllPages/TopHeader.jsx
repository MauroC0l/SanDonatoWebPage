import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";
import { SiTiktok } from "react-icons/si";
import { FiMapPin, FiMail, FiLogIn, FiUserPlus } from "react-icons/fi";
import { attesaAreaRiservata } from "../../precarica";
import { MARCHIO } from "./marchio";
import "../../css/TopHeader.css";

import headerData from "../../data/TopHeader.json";

/**
 * La barra sottile sopra al menu, divisa in tre.
 *
 * È la sola parte dell'intestazione che se ne va scorrendo: il marchio e il
 * menu restano attaccati in alto, questa no (vedi il "top" negativo in
 * MyNavbar.css). Sul telefono non c'è proprio: social, recapiti e accesso
 * stanno nel menu a tutto schermo, e la prima riga resta al marchio.
 *
 * A sinistra i social con lo slogan, poi dove ci si trova nella città, in
 * fondo come si entra, separato da una lineetta: l'accesso non deve
 * sembrare l'ennesimo profilo della società.
 *
 * Tutto piccolo e tenue: sotto c'è la riga del marchio e del menu, ed è
 * quella che deve prendersi il primo sguardo. Solo "Accedi" ha un contorno
 * arancione, perché è la voce che chi torna cerca a colpo d'occhio.
 */
export default function TopHeader() {
  const { contactInfo, socialLinks } = headerData;

  const social = [
    { chiave: "facebook", Icona: FaFacebookF, nome: "Facebook" },
    { chiave: "instagram", Icona: FaInstagram, nome: "Instagram" },
    { chiave: "youtube", Icona: FaYoutube, nome: "YouTube" },
    { chiave: "tiktok", Icona: SiTiktok, nome: "TikTok" }
  ];

  const indirizzo = [contactInfo.street, contactInfo.city].filter(Boolean).join(", ");

  return (
    <div className="top-header">
      <div className="th-griglia">

        <div className="th-social">
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
          {/* Lo slogan che prima stava sotto al nome, nella fascia bianca:
              qui accanto ai social, dove racconta di chi sono i profili. */}
          <span className="th-slogan">{MARCHIO.slogan}</span>
        </div>

        <div className="th-contatti">
          {/* L'indirizzo porta alla mappa e l'email apre il programma di
              posta: sono i due gesti che uno fa dopo averli letti, e
              costringerlo a copiarli a mano sarebbe gratuito. */}
          <a
            className="th-contatto th-indirizzo"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${indirizzo} Torino`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FiMapPin aria-hidden="true" />
            <span>{indirizzo}</span>
          </a>

          <span className="th-punto" aria-hidden="true" />

          <a className="th-contatto th-email" href={`mailto:${contactInfo.email}`}>
            <FiMail aria-hidden="true" />
            <span>{contactInfo.email}</span>
          </a>
        </div>

        <div className="th-accesso">
          {/* Il pacchetto dell'area riservata comincia a scaricarsi quando
              il puntatore sfiora il collegamento, non quando lo si clicca:
              fra le due cose passano due o trecento millisecondi, che
              bastano quasi sempre. Vedi src/precarica.js. */}
          <Link
            to="/registrati"
            className="th-azione"
            aria-label="Registrati"
            {...attesaAreaRiservata}
          >
            <FiUserPlus aria-hidden="true" />
            <span>Registrati</span>
          </Link>

          <Link
            to="/login"
            className="th-azione th-azione-forte"
            aria-label="Accedi all'area riservata"
            {...attesaAreaRiservata}
          >
            <FiLogIn aria-hidden="true" />
            <span>Accedi</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
