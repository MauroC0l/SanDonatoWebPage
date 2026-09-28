import { FaMapMarkerAlt, FaArrowRight } from "react-icons/fa";
import { linkMappa } from "./dati";

/**
 * La scheda di una squadra: chi, quando, dove.
 *
 * L'ordine è quello delle domande di un genitore che cerca la squadra
 * del figlio: prima nome e annate (è la mia?), poi i giorni (ce la
 * facciamo?), in fondo la sede con il link alla mappa.
 *
 * L'inclinazione 3D (data-inclina) sta qui e la comparsa sul contenitore
 * del genitore: sullo stesso elemento le due trasformazioni si
 * sovrascriverebbero.
 */
export default function SchedaSquadra({ gruppo, numero }) {
  return (
    <article className="sp-squadra" data-inclina="6">
      <div className="sp-squadra-testa">
        {gruppo.category && <span className="sp-chip">{gruppo.category}</span>}
        <span className="sp-squadra-numero" aria-hidden="true">
          {String(numero).padStart(2, "0")}
        </span>
      </div>

      <h3 className="sp-squadra-nome">{gruppo.name}</h3>
      {gruppo.years && <p className="sp-squadra-annate">{gruppo.years}</p>}

      <ul className="sp-orari">
        {gruppo.times.map((orario, i) => (
          <li className="sp-orario" key={i}>
            <span className="sp-orario-giorno">{orario.day}</span>
            <span className="sp-orario-ore">{orario.hours}</span>
            {/* Sede diversa da quella principale del gruppo */}
            {orario.place && (
              <span className="sp-orario-sede">
                <FaMapMarkerAlt aria-hidden="true" /> {orario.place}
              </span>
            )}
          </li>
        ))}
      </ul>

      <a
        className="sp-squadra-sede"
        href={linkMappa(gruppo.address)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaMapMarkerAlt className="sp-squadra-sede-icona" aria-hidden="true" />
        <span className="sp-squadra-sede-testo">
          <strong>{gruppo.location}</strong>
          <small>{gruppo.address}</small>
        </span>
        <FaArrowRight className="sp-freccia" aria-hidden="true" />
        <span className="sp-solo-lettori"> (apre la mappa in una nuova scheda)</span>
      </a>
    </article>
  );
}
