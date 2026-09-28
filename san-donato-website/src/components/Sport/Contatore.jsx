import { useEffect, useRef, useState } from "react";

const RIDOTTO = "(prefers-reduced-motion: reduce)";

/* Chi ha chiesto meno movimento vede subito il numero vero, e lo stesso
   chi non ha IntersectionObserver: il conteggio è un di più, il numero no. */
function parteDaZero() {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) return false;
  return !window.matchMedia(RIDOTTO).matches;
}

/**
 * Un numero che "conta" fino al suo valore la prima volta che entra nello
 * schermo. Lo scorrimento lo decide IntersectionObserver e il conteggio
 * requestAnimationFrame: niente librerie, come in utils/movimento.js.
 *
 * Ai lettori di schermo arriva solo il valore finale (testo nascosto), non
 * la sequenza di numeri intermedi.
 */
export default function Contatore({ valore, durata = 1400 }) {
  const rif = useRef(null);
  const [mostrato, setMostrato] = useState(() => (parteDaZero() ? 0 : valore));

  useEffect(() => {
    if (!parteDaZero() || !rif.current) return undefined;
    let fotogramma = 0;
    const osservatore = new IntersectionObserver(([voce]) => {
      if (!voce.isIntersecting) return;
      osservatore.disconnect();
      const inizio = performance.now();
      const passo = (ora) => {
        const t = Math.min(1, (ora - inizio) / durata);
        // Rallenta in fondo, come le comparse del sito (--mv-curva)
        const curva = 1 - Math.pow(1 - t, 4);
        setMostrato(Math.round(valore * curva));
        if (t < 1) fotogramma = requestAnimationFrame(passo);
      };
      fotogramma = requestAnimationFrame(passo);
    }, { threshold: 0.6 });
    osservatore.observe(rif.current);
    return () => { osservatore.disconnect(); cancelAnimationFrame(fotogramma); };
  }, [valore, durata]);

  return (
    <span ref={rif} className="sp-contatore">
      <span aria-hidden="true">{mostrato}</span>
      <span className="sp-solo-lettori">{valore}</span>
    </span>
  );
}
