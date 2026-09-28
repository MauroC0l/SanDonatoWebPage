import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowRight, FaMapMarkerAlt, FaClock, FaFutbol, FaVolleyballBall, FaBasketballBall } from "react-icons/fa";
import { MARCHIO } from "../AllPages/marchio";
import "../../css/AboutSection.css";
import sectionData from "../../data/AboutSection.json";

const SPORT = [
  { nome: "Calcio", Icona: FaFutbol },
  { nome: "Pallavolo", Icona: FaVolleyballBall },
  { nome: "Basket", Icona: FaBasketballBall }
];

/* Il motto va su tre righe, con le ultime due parole accese: si taglia
   prima di "vince". Se un giorno il motto cambia e "vince" non c'è più,
   resta tutto su una riga normale invece di rompersi. */
function righeDelMotto(motto) {
  const [prima, dopo] = motto.split(/ (?=vince\b)/);
  return { prima, dopo };
}

/**
 * La prima schermata della home.
 *
 * Le foto della società scorrono sotto a un velo blu, e sopra c'è il motto
 * in grande: è la frase che prima stava in piccolo, in corsivo, nell'angolo
 * della fascia bianca, e che dice meglio di ogni descrizione che cosa
 * voglia essere la Polisportiva. In basso a destra il prossimo appuntamento
 * (o la diretta in corso), perché chi apre la home il sabato mattina cerca
 * prima di tutto quello.
 *
 * `prossimo` arriva dalla home, che ha già caricato gli eventi: qui non si
 * chiede niente al server. Finché non c'è, al suo posto ci sono gli sport.
 */
export default function AboutSection({ prossimo, inOnda, caricamento, onApriEvento }) {
  const { carouselImages, content, settings } = sectionData;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { prima, dopo } = righeDelMotto(MARCHIO.motto);

  useEffect(() => {
    // Chi ha chiesto meno animazioni al sistema operativo resta sulla prima
    // immagine: il carosello è decorativo, non porta informazione.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    const speed = settings?.intervalSpeed || 6000;

    const interval = setInterval(() => {
      // A scheda nascosta non ha senso avanzare: si tornerebbe indietro
      // di parecchie immagini tutte insieme al rientro.
      if (document.hidden) return;
      setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length);
    }, speed);

    return () => clearInterval(interval);
  }, [carouselImages.length, settings?.intervalSpeed]);

  const quando = prossimo ? new Date(prossimo.start) : null;
  // Solo la prima lettera maiuscola: in italiano i mesi restano minuscoli
  const data = quando?.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }) ?? "";
  const giorno = data.charAt(0).toUpperCase() + data.slice(1);
  const ora = prossimo?.hasTime
    ? quando.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : "tutto il giorno";

  return (
    <section className="about-section hh-eroe" aria-labelledby="hh-titolo">
      {/* Le immagini sono livelli sovrapposti che si dissolvono l'uno
          nell'altro: background-image non è animabile, e cambiandolo su un
          solo elemento il passaggio era uno stacco netto. Scorrono un po'
          più lente della pagina: la prima schermata prende profondità. */}
      <div className="about-layers" aria-hidden="true" data-parallasse="0.18">
        {carouselImages.map((image, index) => (
          <div
            key={image}
            className={`about-layer ${index === currentImageIndex ? "is-active" : ""}`}
            style={{ backgroundImage: `url(${image})` }}
          />
        ))}
      </div>

      <div className="about-overlay" aria-hidden="true" />
      <div className="mv-aurora hh-aurora" aria-hidden="true" />
      <div className="hh-griglia" aria-hidden="true" />
      <span className="hh-fantasma" aria-hidden="true" data-parallasse="0.1">PSD</span>

      <div className="hh-dentro">
        <div className="hh-testi">
          <p className="hh-occhiello" data-rivela="sfuma">
            <span className="hh-punto" aria-hidden="true" /> {MARCHIO.nome} · Torino
          </p>

          <h1 id="hh-titolo" className="hh-titolo" data-rivela>
            {dopo ? (
              <>
                <span className="hh-titolo-riga">{prima}</span>
                <span className="hh-titolo-riga hh-titolo-acceso mv-testo-vivo">{dopo}.</span>
              </>
            ) : prima}
          </h1>

          <p className="hh-testo" data-rivela style={{ "--mv-ritardo": "120ms" }}>
            {content.description}
          </p>

          <div className="hh-azioni" data-rivela style={{ "--mv-ritardo": "220ms" }}>
            <Link to="/iscrizione" className="hh-btn hh-btn-pieno" data-magnete>
              Iscriviti ora <FaArrowRight aria-hidden="true" />
            </Link>
            <Link to="/sports" className="hh-btn hh-btn-vetro mv-vetro">
              Scopri gli sport
            </Link>
          </div>
        </div>

        {/* La scheda di destra: il prossimo appuntamento, o gli sport.
            Durante il caricamento la sagoma occupa già il suo posto. */}
        <div className="hh-lato" data-rivela="destra" style={{ "--mv-ritardo": "320ms" }}>
          {caricamento ? (
            <div className="hh-scheda hh-scheda-attesa mv-vetro" aria-hidden="true" />
          ) : prossimo ? (
            <button type="button" className="hh-scheda hh-scheda-evento mv-vetro" data-inclina="5" onClick={() => onApriEvento(prossimo)}>
              <span className={`hh-scheda-etichetta ${inOnda ? "is-onda" : ""}`}>
                <span className="hh-punto" aria-hidden="true" />
                {inOnda ? "In onda adesso" : "Prossimo appuntamento"}
              </span>
              <span className="hh-scheda-titolo">{prossimo.title}</span>
              <span className="hh-scheda-meta">
                <span><FaClock aria-hidden="true" /> <span>{giorno}, {ora}</span></span>
                <span className="hh-scheda-luogo"><FaMapMarkerAlt aria-hidden="true" /> {prossimo.location || "Sede da definire"}</span>
              </span>
              <span className="hh-scheda-apri">
                Dettagli <FaArrowRight aria-hidden="true" />
              </span>
            </button>
          ) : (
            <Link to="/sports" className="hh-scheda hh-scheda-sport mv-vetro" data-inclina="5">
              <span className="hh-scheda-etichetta">
                <span className="hh-punto" aria-hidden="true" /> Tre sport, un quartiere
              </span>
              <span className="hh-sport">
                {SPORT.map(({ nome, Icona }) => (
                  <span key={nome} className="hh-sport-voce">
                    <Icona aria-hidden="true" /> {nome}
                  </span>
                ))}
              </span>
              <span className="hh-scheda-apri">
                Squadre e orari <FaArrowRight aria-hidden="true" />
              </span>
            </Link>
          )}
        </div>
      </div>

      <span className="hh-scorri" aria-hidden="true">
        <span className="hh-scorri-linea" />
        Scorri
      </span>
    </section>
  );
}
