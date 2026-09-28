import React from "react";

/**
 * Una fila di loghi che scorre senza fine (vedi .mv-nastro in Movimento.css).
 *
 * Il giro è scritto due volte: quando la prima copia esce a sinistra la
 * seconda è esattamente al suo posto, e il salto non si vede. La copia è
 * nascosta ai lettori di schermo e fuori dal giro del tabulatore, perché
 * leggere ogni sponsor due volte (per due file) sarebbe solo rumore: i
 * link veri stanno nel muro più sotto.
 */
export default function NastroLoghi({ sponsors, inverso = false, durata = "46s" }) {
  const giro = (copia) => (
    <ul className="spn-nastro-giro" aria-hidden={copia ? "true" : undefined}>
      {sponsors.map((s) => (
        <li key={s.name} className="spn-nastro-tessera">
          <img
            src={s.image}
            alt={copia ? "" : `Logo ${s.name}`}
            loading="lazy"
            decoding="async"
            style={{ "--spn-zoom": s.zoom }}
          />
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={`mv-nastro spn-nastro${inverso ? " spn-nastro--inverso" : ""}`}
      style={{ "--mv-nastro-durata": durata }}
    >
      <div className="mv-nastro-traccia">
        {giro(false)}
        {giro(true)}
      </div>
    </div>
  );
}
