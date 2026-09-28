import { FaArrowDown, FaArrowUpRightFromSquare } from "react-icons/fa6";

/**
 * Un documento da scaricare, disegnato come un foglio: l'angolo piegato,
 * l'etichetta del formato, il titolo e un pulsante che dice cosa succede.
 *
 * Tutta la scheda è il collegamento, non solo il pulsante: sul telefono il
 * dito trova un bersaglio grande quanto il riquadro. Il pulsante resta,
 * disegnato, perché dice a chi guarda che il clic scarica un file.
 *
 * `scarica` mette l'attributo download (la privacy lo usava già); senza,
 * il file si apre in un'altra scheda, come facevano le pagine di prima.
 */
export default function SchedaFile({ titolo, testo, href, formato = "PDF", scarica = false, numero }) {
  const attributi = scarica
    ? { download: true }
    : { target: "_blank", rel: "noopener noreferrer" };

  return (
    <a className="doc-file" href={href} data-inclina="4" {...attributi}>
      <span className="doc-file-alone" aria-hidden="true" />
      <span className="doc-file-testa">
        <span className="doc-file-foglio" aria-hidden="true">
          <span className="doc-file-formato">{formato}</span>
        </span>
        {numero != null && (
          <span className="doc-file-numero" aria-hidden="true">{String(numero).padStart(2, "0")}</span>
        )}
      </span>
      <span className="doc-file-titolo">{titolo}</span>
      {testo && <span className="doc-file-testo">{testo}</span>}
      <span className="doc-file-azione">
        {scarica ? "Scarica" : "Apri"} {formato}
        <span className="doc-file-freccia" aria-hidden="true">
          {scarica ? <FaArrowDown /> : <FaArrowUpRightFromSquare />}
        </span>
      </span>
      {!scarica && <span className="doc-solo-lettori"> (si apre in una nuova scheda)</span>}
    </a>
  );
}
