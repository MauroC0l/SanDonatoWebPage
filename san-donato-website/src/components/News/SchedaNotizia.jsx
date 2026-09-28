import { Link } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa";
import { dataBreve, etichetteDi, sportVisibile } from "./notizieUtili";

/* Quante etichette mostra una scheda. Oltre, un "+2": cinque pastiglie in
   fila su un telefono prenderebbero il posto del titolo. */
const ETICHETTE_IN_SCHEDA = 2;

/**
 * Una scheda del mosaico delle notizie (e della fila "Continua a leggere"
 * sotto un articolo).
 *
 * Due elementi e non uno: la cella esterna è quella che compare scorrendo
 * (la mette in fila data-rivela-gruppo del contenitore), il collegamento
 * dentro è quello che si inclina sotto al puntatore. Comparsa e
 * inclinazione usano tutte e due transform, e sullo stesso elemento una
 * cancellerebbe l'altra.
 *
 * variante: "normale" (foto sopra, testo sotto), "grande" (foto a tutto
 * campo con il testo sopra, due colonne per due righe) o "larga" (scura,
 * foto a sinistra e testo a destra, su due colonne).
 */
export default function SchedaNotizia({ post, variante = "normale" }) {
  const etichette = etichetteDi(post);
  const inVista = etichette.slice(0, ETICHETTE_IN_SCHEDA);
  const altre = etichette.length - inVista.length;
  const sport = post.sport && post.sport !== "Altro" ? sportVisibile(post.sport) : null;
  const grande = variante === "grande";

  return (
    <div className={`nz-cella nz-cella-${variante}`}>
      <Link
        to={`/news/${post.id}`}
        state={{ post }}
        className={`nz-scheda nz-scheda-${variante}`}
        data-inclina={grande ? "3" : "5"}
      >
        <span className="nz-foto-cornice">
          {/* Un <img> e non uno sfondo: così il browser la scarica solo
              quando la scheda si avvicina allo schermo. Alt vuoto perché
              il titolo, nel collegamento, dice già di cosa si tratta. */}
          <img
            className="nz-foto"
            src={post.image || "/logo-poli-sfondo.jpg"}
            alt=""
            loading={grande ? "eager" : "lazy"}
            decoding="async"
          />
        </span>
        {grande && <span className="nz-velo" aria-hidden="true" />}

        {(inVista.length > 0 || grande) && (
          <span className="nz-bollini">
            {grande && (
              <span className="nz-bollino nz-bollino-evidenza">
                <span className="nz-punto" aria-hidden="true" /> In evidenza
              </span>
            )}
            {inVista.map((e) => (
              // Le etichette le scrive lo staff e possono essere lunghe: si
              // troncano, il nome intero resta nel suggerimento.
              <span key={e.id} className="nz-bollino" title={e.nome}>{e.nome}</span>
            ))}
            {altre > 0 && (
              <span
                className="nz-bollino nz-bollino-altre"
                title={etichette.slice(ETICHETTE_IN_SCHEDA).map((e) => e.nome).join(", ")}
              >
                +{altre}
              </span>
            )}
          </span>
        )}

        <span className="nz-testi">
          <span className="nz-meta">
            <time dateTime={post.dateISO || undefined}>{dataBreve(post)}</time>
            {sport && <><span className="nz-meta-punto" aria-hidden="true" />{sport}</>}
          </span>

          <span className="nz-scheda-titolo">{post.title}</span>

          {post.preview && <span className="nz-sommario">{post.preview}</span>}

          <span className="nz-leggi">
            <span>Leggi</span>
            <span className="nz-leggi-tondo" aria-hidden="true"><FaArrowRight /></span>
          </span>
        </span>
      </Link>
    </div>
  );
}
