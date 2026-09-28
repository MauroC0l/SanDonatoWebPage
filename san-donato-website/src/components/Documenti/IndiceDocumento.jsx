import { useEffect, useState } from "react";

/**
 * L'indice di una pagina lunga: sul computer resta attaccato di lato
 * mentre si legge e accende la voce della sezione che si ha davanti; sul
 * telefono diventa una fila di pillole in cima, da scorrere col pollice
 * (attaccato di lato non ci starebbe, e in alto coprirebbe il testo).
 *
 * Le sezioni si trovano per id: ogni voce è anche un normale collegamento
 * ad ancora, che funziona senza JavaScript.
 */
export default function IndiceDocumento({ voci, titolo = "In questa pagina" }) {
  const [attiva, setAttiva] = useState(voci[0]?.id);

  useEffect(() => {
    const sezioni = voci.map((v) => document.getElementById(v.id)).filter(Boolean);
    if (!sezioni.length) return undefined;
    /* Conta la sezione che attraversa una striscia sottile poco sopra la
       metà dello schermo: è quella che si sta leggendo, non quella di cui
       si vede appena il titolo in fondo. */
    const osservatore = new IntersectionObserver((voci2) => {
      const visibili = voci2.filter((v) => v.isIntersecting);
      if (visibili.length) setAttiva(visibili[0].target.id);
    }, { rootMargin: "-35% 0px -60% 0px", threshold: 0 });
    sezioni.forEach((s) => osservatore.observe(s));
    return () => osservatore.disconnect();
  }, [voci]);

  /* Scorrimento dolce, ma non per chi ha chiesto meno movimento */
  const vai = (id) => (e) => {
    const bersaglio = document.getElementById(id);
    if (!bersaglio) return;
    e.preventDefault();
    const ridotto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bersaglio.scrollIntoView({ behavior: ridotto ? "auto" : "smooth", block: "start" });
    setAttiva(id);
    // L'indirizzo ricorda la sezione, senza un salto in più
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav className="doc-indice" aria-label={titolo}>
      <p className="doc-indice-titolo">{titolo}</p>
      <ol className="doc-indice-voci">
        {voci.map((v, i) => (
          <li key={v.id}>
            <a
              href={`#${v.id}`}
              onClick={vai(v.id)}
              className={attiva === v.id ? "attiva" : undefined}
              aria-current={attiva === v.id ? "location" : undefined}
            >
              <span className="doc-indice-numero" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <span>{v.testo}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
