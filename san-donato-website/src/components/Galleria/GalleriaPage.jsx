import { useState } from "react";
import { Link } from "react-router-dom";
import { FaFutbol, FaBasketballBall, FaVolleyballBall, FaInstagram, FaCamera, FaTrophy, FaUsers } from "react-icons/fa";
import { FaArrowRight } from "react-icons/fa6";
import headerData from "../../data/TopHeader.json";
import "../../css/GalleriaPage.css";

/* Le cornici del mosaico: foto che "si stanno sviluppando". Sono solo
   disegno — la galleria vera non c'è ancora — e per questo il mosaico
   intero è nascosto ai lettori di schermo. */
const CORNICI = [
  { icona: <FaFutbol />, tono: "arancio" },
  { icona: <FaVolleyballBall />, tono: "blu" },
  { icona: <FaCamera />, tono: "notte" },
  { icona: <FaBasketballBall />, tono: "blu" },
  { icona: <FaTrophy />, tono: "arancio" },
  { icona: <FaUsers />, tono: "notte" },
];

const PAROLE = ["Galleria", "Arriva nel 2027", "Calcio", "Pallavolo", "Basket", "Sorpresa"];

const PALLONI = [
  <FaBasketballBall key="basket" />,
  <FaVolleyballBall key="volley" />,
  <FaFutbol key="calcio" />,
];

/**
 * La galleria non è ancora pronta: sarà una sorpresa per il 2027. La
 * pagina lo dice con la stessa voce delle altre aperture scure, e invece
 * di un cartello "lavori in corso" mostra un mosaico di cornici che si
 * stanno sviluppando, il pallone che rimbalza (e cambia sport a ogni
 * passaggio) e dove guardare le foto nel frattempo.
 */
export default function GalleriaPage() {
  const [pallone, setPallone] = useState(0);
  const { instagram } = headerData.socialLinks;

  // A ogni giro dell'animazione orizzontale il pallone cambia sport
  const cambiaPallone = (e) => {
    if (e.animationName === "gal-attraversa") setPallone((i) => (i + 1) % PALLONI.length);
  };

  return (
    <div className="gal">
      <section className="gal-eroe" aria-labelledby="gal-titolo">
        <div className="mv-aurora gal-aurora" aria-hidden="true" />
        <div className="gal-griglia" aria-hidden="true" />
        <div className="gal-fantasma" aria-hidden="true" data-parallasse="0.12">2027</div>

        <div className="gal-dentro">
          <div className="gal-testo">
            <p className="gal-occhiello" data-rivela>
              <span className="gal-punto" aria-hidden="true" /> In preparazione
            </p>
            <h1 id="gal-titolo" className="gal-titolo" data-rivela>
              <span className="mv-testo-vivo">Galleria</span>
            </h1>
            <p className="gal-messaggio" data-rivela style={{ "--mv-ritardo": "120ms" }}>
              Questa pagina non è ancora pronta… <br />
              sarà una sorpresa per il <strong>2027</strong>!
            </p>

            {/* Il pallone che rimbalza e cambia sport a ogni passaggio */}
            <div className="gal-campo mv-vetro" data-rivela style={{ "--mv-ritardo": "180ms" }} aria-hidden="true">
              <div className="gal-linea" />
              <div className="gal-orizzontale" onAnimationIteration={cambiaPallone}>
                <div className="gal-verticale">
                  <div className="gal-rotazione">{PALLONI[pallone]}</div>
                </div>
              </div>
            </div>

            <div className="gal-azioni" data-rivela style={{ "--mv-ritardo": "240ms" }}>
              <a href={instagram} className="gal-btn gal-btn--pieno" target="_blank" rel="noopener noreferrer" data-magnete>
                <FaInstagram aria-hidden="true" /> Intanto seguici su Instagram
              </a>
              <Link to="/news" className="gal-btn gal-btn--vetro mv-vetro">
                Leggi le news <FaArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>

          <ul className="gal-mosaico" aria-hidden="true" data-rivela-gruppo>
            {CORNICI.map((c, i) => (
              <li key={i} className={`gal-cella gal-cella--${i + 1}`}>
                <div className={`gal-cornice gal-cornice--${c.tono}`} data-inclina="6">
                  <span className="gal-cornice-icona">{c.icona}</span>
                  <span className="gal-cornice-luce" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="gal-fascia" aria-hidden="true">
        <div className="mv-nastro" style={{ "--mv-nastro-durata": "30s" }}>
          <div className="mv-nastro-traccia">
            {[0, 1].map((copia) => (
              <span className="gal-fascia-giro" key={copia}>
                {PAROLE.map((p) => (
                  <span key={p}>{p} <span className="gal-stella">✦</span></span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
