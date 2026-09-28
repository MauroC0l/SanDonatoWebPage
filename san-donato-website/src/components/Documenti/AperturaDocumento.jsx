import "../../css/Documenti.css";

/**
 * L'apertura scura delle pagine dei documenti (Privacy, Tutela minori,
 * Contributi, 5x1000): la stessa famiglia di Sponsor e Chi siamo, con il
 * titolo enorme, l'aurora dietro e la parola gigante solo disegnata.
 *
 * Le quattro pagine avevano ciascuna una testata sua, con colori e misure
 * diversi: chi passava dall'una all'altra non capiva di essere nella stessa
 * sezione. Un componente solo le tiene uguali. Il titolo arriva già
 * diviso in due (vedi spezzaTitolo.js): la seconda parte si accende.
 */
export default function AperturaDocumento({
  id,
  occhiello,
  prima,
  accesa,
  sottotitolo,
  fantasma,
  numeri = [],
  azioni = null,
  laterale = null,
  nota = null,
}) {
  return (
    <section className={`doc-eroe ${laterale ? "doc-eroe--laterale" : ""}`} aria-labelledby={id}>
      <div className="mv-aurora doc-eroe-aurora" aria-hidden="true" />
      <div className="doc-eroe-griglia" aria-hidden="true" />
      {fantasma && (
        <div className="doc-eroe-fantasma" aria-hidden="true" data-parallasse="0.12">
          {fantasma}
        </div>
      )}

      <div className="doc-eroe-dentro">
        <div className="doc-eroe-testo">
          <p className="doc-occhiello" data-rivela>
            <span className="doc-punto" aria-hidden="true" /> {occhiello}
          </p>
          <h1 id={id} className="doc-titolo" data-rivela>
            {prima && <span className="doc-titolo-riga">{prima}</span>}
            <span className="doc-titolo-riga mv-testo-vivo">{accesa}</span>
          </h1>
          {sottotitolo && (
            <p className="doc-sottotitolo" data-rivela style={{ "--mv-ritardo": "120ms" }}>
              {sottotitolo}
            </p>
          )}
          {nota && <div className="doc-eroe-nota" data-rivela style={{ "--mv-ritardo": "180ms" }}>{nota}</div>}
          {azioni && (
            <div className="doc-azioni" data-rivela style={{ "--mv-ritardo": "220ms" }}>
              {azioni}
            </div>
          )}
        </div>

        {laterale && (
          <div className="doc-eroe-laterale" data-rivela="zoom" style={{ "--mv-ritardo": "260ms" }}>
            {laterale}
          </div>
        )}

        {numeri.length > 0 && (
          <dl className="doc-numeri" data-rivela-gruppo>
            {numeri.map((n) => (
              <div key={n.dt}>
                <dt>{n.dt}</dt>
                <dd>{n.dd}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

/* Il nastro arancione inclinato che chiude l'apertura, come su Sponsor e
   Chi siamo. Solo decorazione: le parole le dice già la pagina. */
export function FasciaParole({ parole, durata = "30s" }) {
  return (
    <div className="doc-fascia" aria-hidden="true">
      <div className="mv-nastro" style={{ "--mv-nastro-durata": durata }}>
        <div className="mv-nastro-traccia">
          {[0, 1].map((copia) => (
            <span className="doc-fascia-giro" key={copia}>
              {parole.map((p) => (
                <span key={p}>
                  {p} <span className="doc-stella">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
