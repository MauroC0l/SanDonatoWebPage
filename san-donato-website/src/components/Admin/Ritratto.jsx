import { useState } from "react";

/**
 * L'immagine di una persona, con le iniziali quando non c'è.
 *
 * Il ripiego non è un'icona grigia uguale per tutti: in un elenco di
 * sessanta atleti quella non aiuta a trovare nessuno. Le iniziali su un
 * colore ricavato dal nome sì — la stessa persona ha sempre lo stesso
 * colore, in ogni pagina, e l'occhio la ritrova prima di aver letto.
 *
 * Il colore si calcola dal nome e non si sorteggia: deve restare identico
 * fra un caricamento e l'altro, altrimenti il vantaggio sparisce.
 */

/** Le iniziali: due al massimo, dal nome e dal cognome. */
function iniziali(nome) {
  const pezzi = String(nome || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (pezzi.length === 0) return "?";
  if (pezzi.length === 1) return pezzi[0].slice(0, 2).toUpperCase();

  return (pezzi[0][0] + pezzi[pezzi.length - 1][0]).toUpperCase();
}

/**
 * Una tinta stabile a partire dal nome.
 *
 * Saturazione e luminosità sono fisse e basse: servono colori che stiano
 * accanto al testo senza urlare, e con il bianco sopra devono restare
 * leggibili tutti quanti, non solo i più scuri.
 */
function tinta(nome) {
  const testo = String(nome || "");
  let somma = 0;
  for (let i = 0; i < testo.length; i++) somma = (somma * 31 + testo.charCodeAt(i)) % 360;
  return `hsl(${somma} 45% 42%)`;
}

export default function Ritratto({ nome, url, dimensione = "m", className = "" }) {
  // Un indirizzo può esserci ed essere rotto — un file cancellato
  // dall'archivio, un dominio cambiato. In quel caso si torna alle
  // iniziali invece di lasciare il riquadro spezzato del browser.
  const [rotta, setRotta] = useState(false);

  const classi = `rit rit-${dimensione} ${className}`.trim();
  const etichetta = nome || "Persona senza nome";

  if (url && !rotta) {
    return (
      <img
        className={classi}
        src={url}
        alt={etichetta}
        loading="lazy"
        onError={() => setRotta(true)}
      />
    );
  }

  return (
    <span
      className={`${classi} rit-iniziali`}
      style={{ backgroundColor: tinta(etichetta) }}
      // Le iniziali sono decorative: il nome per esteso è quasi sempre
      // scritto lì accanto, e farlo leggere due volte a chi usa un lettore
      // di schermo è solo rumore.
      aria-hidden="true"
    >
      {iniziali(nome)}
    </span>
  );
}
