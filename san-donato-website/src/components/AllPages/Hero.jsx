import { Link } from "react-router-dom";
import { MARCHIO } from "./marchio";
import "../../css/Hero.css";

/**
 * Il marchio nella barra dell'intestazione: logo e nome, che portano alla home.
 *
 * Qui c'era una fascia bianca alta quasi duecento pixel con il nome in
 * grande, lo slogan e il motto, ripetuta in cima a ogni pagina: chi apriva
 * il calendario dal telefono vedeva mezzo schermo di intestazione prima
 * della prima partita. Adesso il marchio sta nella stessa riga del menu, a
 * sinistra, e resta visibile scorrendo; lo slogan è nella barra sottile di
 * sopra, e il motto è il titolo della home e la chiusura del menu del
 * telefono (vedi marchio.js).
 *
 * Il file si chiama ancora Hero perché PublicLayout lo mette fra la barra
 * sottile e il menu: la griglia che li affianca sta in MyNavbar.css.
 */
export default function Hero() {
  return (
    <div className="testata-marchio">
      <Link to="/" className="tm-link" aria-label={`${MARCHIO.nome}, torna alla home`}>
        {/* Le dimensioni vere del file: il browser riserva lo spazio prima
            che l'immagine arrivi, e la riga non si allarga di colpo. */}
        <span className="tm-tessera" aria-hidden="true">
          <img
            src={MARCHIO.logo}
            alt=""
            className="tm-logo"
            width="500"
            height="500"
            decoding="async"
          />
        </span>
        <span className="tm-nome" aria-hidden="true">
          <span className="tm-nome-sopra">Polisportiva</span>
          <span className="tm-nome-sotto">San Donato</span>
        </span>
      </Link>
    </div>
  );
}
