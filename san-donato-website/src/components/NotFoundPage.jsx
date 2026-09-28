import { Link } from "react-router-dom";
import { FaHouse, FaArrowRight, FaFutbol } from "react-icons/fa6";
import { VOCI } from "./AllPages/vociMenu";
import "../css/NotFoundPage.css";

const PAROLE = ["Fuori campo", "Pagina non trovata", "Torna in gioco", "404"];

/**
 * La pagina che non c'è. Stessa famiglia delle altre aperture scure: il
 * 404 enorme, con lo zero che è un pallone che rotola, e subito sotto le
 * strade per rientrare — la home e le voci del menu. Chi arriva qui da un
 * vecchio collegamento cercava qualcosa: meglio offrirgli le porte che
 * lasciarlo davanti a un muro.
 */
export default function NotFoundPage() {
  const scorciatoie = VOCI.filter((v) => v.to !== "/");

  return (
    <div className="nfp">
      <section className="nfp-eroe" aria-labelledby="nfp-titolo">
        <div className="mv-aurora nfp-aurora" aria-hidden="true" />
        <div className="nfp-griglia" aria-hidden="true" />

        <div className="nfp-dentro">
          {/* Il numero è solo disegno: il titolo vero è la frase sotto */}
          <p className="nfp-numero" aria-hidden="true" data-rivela="zoom">
            <span>4</span>
            <span className="nfp-pallone">
              <span className="nfp-pallone-giro"><FaFutbol /></span>
            </span>
            <span>4</span>
          </p>

          <p className="nfp-occhiello" data-rivela>
            <span className="nfp-punto" aria-hidden="true" /> Errore 404
          </p>
          <h1 id="nfp-titolo" className="nfp-titolo" data-rivela>
            Pagina <span className="mv-testo-vivo">non trovata</span>
          </h1>
          <p className="nfp-testo" data-rivela style={{ "--mv-ritardo": "120ms" }}>
            Ci scusiamo per l'inconveniente. La risorsa che stai cercando potrebbe essere stata
            rimossa, rinominata o non è momentaneamente disponibile.
          </p>

          <div className="nfp-azioni" data-rivela style={{ "--mv-ritardo": "200ms" }}>
            <Link to="/" className="nfp-btn" data-magnete>
              <FaHouse aria-hidden="true" /> Torna alla Home
            </Link>
          </div>

          <nav className="nfp-scorciatoie" aria-label="Forse cercavi">
            <p className="nfp-scorciatoie-titolo">Forse cercavi</p>
            <ul data-rivela-gruppo>
              {scorciatoie.map((v) => (
                <li key={v.to}>
                  <Link to={v.to} className="nfp-scorciatoia mv-vetro">
                    <span className="nfp-scorciatoia-icona" aria-hidden="true">{v.icon}</span>
                    <span>{v.label}</span>
                    <FaArrowRight className="nfp-scorciatoia-freccia" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      <div className="nfp-fascia" aria-hidden="true">
        <div className="mv-nastro" style={{ "--mv-nastro-durata": "26s" }}>
          <div className="mv-nastro-traccia">
            {[0, 1].map((copia) => (
              <span className="nfp-fascia-giro" key={copia}>
                {PAROLE.map((p) => (
                  <span key={p}>{p} <span className="nfp-stella">✦</span></span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
