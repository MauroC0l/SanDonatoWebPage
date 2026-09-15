import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";
import { SiTiktok } from "react-icons/si";
import { FiMapPin, FiMail, FiLogIn, FiUserPlus } from "react-icons/fi";
import { attesaAreaRiservata } from "../../precarica";
import "../../css/TopHeader.css";

import headerData from "../../data/TopHeader.json";

/**
 * La barra sopra a tutto, divisa in tre.
 *
 * A sinistra dove ci si trova sui social, al centro dove ci si trova nella
 * città, a destra come si entra. Tre zone e non due: prima i contatti erano
 * spinti a destra e l'accesso finiva schiacciato in mezzo ai social, con il
 * risultato che sembrava l'ennesimo profilo della società.
 *
 * Le tre zone stanno su una griglia 1fr auto 1fr e non su un flex con
 * space-between: così il centro è centrato rispetto alla PAGINA e non
 * rispetto a quanto spazio avanza fra le altre due, che cambia a ogni
 * larghezza e faceva ballare l'indirizzo.
 *
 * L'accesso resta scritto e non disegnato come un pulsante: sopra al logo e
 * al menu, un pulsante pieno si prenderebbe il primo sguardo, che qui
 * appartiene alla società. Il contorno compare al passaggio del mouse, che
 * è il momento in cui serve — quando uno sta per cliccare.
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
          {/* Il nome dell'azione sta anche nell'etichetta: sotto i 420
              pixel la scritta sparisce e resta la sola icona, che senza
              questa sarebbe un collegamento senza nome. */}
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
