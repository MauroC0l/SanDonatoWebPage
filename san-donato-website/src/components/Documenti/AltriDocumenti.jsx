import { Link, useLocation } from "react-router-dom";
import { FaArrowDown, FaArrowRight } from "react-icons/fa6";
import { useVociDocumenti } from "../AllPages/vociMenu";

/**
 * In fondo a ogni pagina dei documenti, gli altri documenti: chi cerca lo
 * statuto dopo aver letto la privacy non deve risalire fino al menu.
 *
 * L'elenco è lo stesso della tendina "Documenti" dell'intestazione
 * (vociMenu.jsx), così una voce nuova compare in tutti e due i posti.
 * La pagina in cui si è non si ripete.
 */
export default function AltriDocumenti() {
  const { pathname } = useLocation();
  const altri = useVociDocumenti().filter((d) => d.to !== pathname);
  // I file arrivano dopo le pagine: la griglia rinasce quando cambiano, così
  // il movimento la fa comparire intera invece di lasciare le voci nuove
  // senza comparsa (o quelle vecchie a metà).
  const firma = altri.map((d) => d.chiave).join("|");

  return (
    <section className="doc-altri" aria-labelledby="doc-altri-titolo">
      <div className="doc-altri-dentro">
        <header className="doc-altri-testa">
          <p className="doc-etichetta" data-rivela>Trasparenza</p>
          <h2 id="doc-altri-titolo" className="doc-h2" data-rivela>
            Gli altri <em>documenti</em>.
          </h2>
        </header>
        <ul key={firma} className="doc-altri-griglia" data-rivela-gruppo>
          {altri.map((d) => {
            const contenuto = (
              <>
                <span className="doc-altri-icona" aria-hidden="true">{d.icon}</span>
                <span className="doc-altri-nome">{d.label}</span>
                <span className="doc-altri-tipo">{d.download ? "PDF da scaricare" : "Pagina"}</span>
                <span className="doc-altri-freccia" aria-hidden="true">
                  {d.download ? <FaArrowDown /> : <FaArrowRight />}
                </span>
              </>
            );
            return (
              <li key={d.chiave}>
                {d.download ? (
                  <a href={d.to} className="doc-altri-voce" download target="_blank" rel="noopener noreferrer">
                    {contenuto}
                  </a>
                ) : (
                  <Link to={d.to} className="doc-altri-voce">{contenuto}</Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
