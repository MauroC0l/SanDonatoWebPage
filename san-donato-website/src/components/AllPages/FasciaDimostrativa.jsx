import { useEffect } from "react";
import "../../css/FasciaDimostrativa.css";

/**
 * Il cartello che dice "questo non è il sito vero".
 *
 * Si accende con VITE_SITO_DIMOSTRATIVO=1, che va messo SOLO sul progetto
 * della dimostrazione. Spento per difetto: il giorno che questo codice
 * diventa il sito della società, nessuno deve ricordarsi di togliere niente
 * — e soprattutto nessuno deve ritrovarsi il sito vero marcato "noindex".
 *
 * Fa due cose che vanno insieme:
 *
 *   - lo dice alle persone, con una targhetta in basso che non si chiude.
 *     Un genitore che ci capita deve capire in un secondo che la quota
 *     scritta lì non è la sua;
 *   - lo dice ai motori di ricerca, con "noindex". Un indirizzo
 *     *.vercel.app di un progetto pubblicato è indicizzabile come
 *     qualunque altro, e una copia di prova del sito di una società
 *     sportiva nei risultati di Google è un guaio che dura mesi.
 */
export default function FasciaDimostrativa() {
  const dimostrativo = import.meta.env.VITE_SITO_DIMOSTRATIVO === "1";

  useEffect(() => {
    if (!dimostrativo) return;

    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);

    return () => meta.remove();
  }, [dimostrativo]);

  if (!dimostrativo) return null;

  return (
    <p className="fdim" role="status">
      <strong>Versione di prova</strong>
      <span>
        I dati sono inventati. Il sito della società è
        {" "}
        <a href="https://www.polisportivasandonato.it" rel="noreferrer">
          polisportivasandonato.it
        </a>
      </span>
    </p>
  );
}
