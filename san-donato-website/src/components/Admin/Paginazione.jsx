import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

/**
 * La barra "Pagina 2 di 7", uguale in fondo a ogni elenco.
 *
 * Esisteva solo sotto le notizie, scritta a mano dentro a quella pagina. Gli
 * altri elenchi — eventi, richieste, atleti, utenti — sputavano fuori tutte
 * le righe insieme: con 263 eventi o 150 account il browser disegna una
 * pagina lunghissima, e chi cerca qualcosa scorre alla cieca.
 */
export default function Paginazione({ pagina, pagine, onCambia, totale, nome }) {
  // Con una pagina sola non c'è niente da dire: la barra sparisce invece di
  // mostrare due pulsanti spenti.
  if (pagine <= 1) return null;

  const [singolare, plurale] = nome ?? ["elemento", "elementi"];

  return (
    <nav className="adm-pagination" aria-label="Pagine">
      <button
        type="button"
        className="adm-btn adm-btn-ghost"
        onClick={() => onCambia(Math.max(1, pagina - 1))}
        disabled={pagina === 1}
      >
        <FaChevronLeft /> <span className="adm-hide-sm">Precedente</span>
      </button>

      <span className="adm-page-indicator">
        Pagina {pagina} di {pagine}
        {totale != null && (
          <span className="adm-page-totale">
            {totale} {totale === 1 ? singolare : plurale}
          </span>
        )}
      </span>

      <button
        type="button"
        className="adm-btn adm-btn-ghost"
        onClick={() => onCambia(Math.min(pagine, pagina + 1))}
        disabled={pagina === pagine}
      >
        <span className="adm-hide-sm">Successiva</span> <FaChevronRight />
      </button>
    </nav>
  );
}
