import React from "react";

/**
 * Una scheda del muro dei partner.
 *
 * Non tutti gli sponsor hanno un sito: per quelli la scheda è un semplice
 * riquadro e non un link vuoto, che porterebbe in cima alla pagina stessa
 * e lascerebbe il lettore di schermo ad annunciare un "link" che non va
 * da nessuna parte.
 */
export default function SchedaSponsor({ sponsor, numero }) {
  const conLink = Boolean(sponsor.link);
  const Tag = conLink ? "a" : "div";
  const attributiLink = conLink
    ? {
        href: sponsor.link,
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": `${sponsor.name} — apre il sito in una nuova scheda`
      }
    : {};

  return (
    <Tag className={`spn-scheda${conLink ? " spn-scheda--link" : ""}`} data-inclina="6" {...attributiLink}>
      <span className="spn-scheda-alone" aria-hidden="true" />
      <div className="spn-scheda-testa">
        <span className="spn-scheda-numero">{String(numero).padStart(2, "0")}</span>
        {conLink && <span className="spn-scheda-dominio">{dominio(sponsor.link)}</span>}
      </div>
      <div className="spn-scheda-logo">
        <img
          src={sponsor.image}
          alt={`Logo ${sponsor.name}`}
          loading="lazy"
          decoding="async"
          style={{ "--spn-zoom": sponsor.zoom }}
        />
      </div>
      <div className="spn-scheda-piede">
        <h3 className="spn-scheda-nome">{sponsor.name}</h3>
        {conLink ? (
          <span className="spn-scheda-freccia" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 17 7M8 7h9v9" />
            </svg>
          </span>
        ) : (
          <span className="spn-scheda-etichetta">Partner</span>
        )}
      </div>
    </Tag>
  );
}

// Nella scheda basta il nome del sito, senza "https://www." e percorsi
function dominio(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
