import { useEffect, useRef } from "react";

/**
 * La riga arancione in alto che si allunga mentre si legge.
 *
 * Misura l'articolo e non la pagina: sotto al testo ci sono le altre
 * notizie e il piè di pagina, e con la pagina intera la barra arriverebbe
 * in fondo molto dopo l'ultima riga letta.
 *
 * Nessuno stato di React: a ogni scorrimento si scrive una variabile CSS
 * sull'elemento, in un requestAnimationFrame. Un setState per ogni pixel
 * ridisegnerebbe l'articolo intero decine di volte al secondo.
 */
export default function BarraLettura({ bersaglio }) {
  const barra = useRef(null);

  useEffect(() => {
    let inAttesa = false;

    const aggiorna = () => {
      inAttesa = false;
      const el = bersaglio.current;
      const riga = barra.current;
      if (!riga) return;
      if (!el) { riga.style.setProperty("--nzd-letto", "0"); return; }
      const r = el.getBoundingClientRect();
      // Letto = quanto dell'articolo è passato sopra ai due terzi dello schermo
      const passato = window.innerHeight * 0.66 - r.top;
      const quota = Math.min(1, Math.max(0, passato / Math.max(1, r.height)));
      riga.style.setProperty("--nzd-letto", quota.toFixed(4));
    };

    const suScorrimento = () => {
      if (inAttesa) return;
      inAttesa = true;
      requestAnimationFrame(aggiorna);
    };

    aggiorna();
    window.addEventListener("scroll", suScorrimento, { passive: true });
    window.addEventListener("resize", suScorrimento, { passive: true });
    return () => {
      window.removeEventListener("scroll", suScorrimento);
      window.removeEventListener("resize", suScorrimento);
    };
  }, [bersaglio]);

  return (
    <div className="nzd-barra-lettura" aria-hidden="true">
      <span ref={barra} className="nzd-barra-lettura-piena" />
    </div>
  );
}
