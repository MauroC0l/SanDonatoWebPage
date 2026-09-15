import "../../css/SagomaAccesso.css";

/**
 * La forma della pagina di accesso, mentre la pagina di accesso arriva.
 *
 * Non è una rotella: è il disegno di quello che sta per comparire — il
 * pannello blu a sinistra, la scheda con i due campi a destra. Il motivo è
 * che una sagoma non chiede di aspettare, dice che è già cominciato: chi
 * guarda riconosce la pagina prima ancora di poterla leggere, e quando i
 * contenuti arrivano non si sposta niente, perché lo spazio era già quello.
 *
 * È la tecnica che usano i siti che si aprono spesso — le sagome grigie di
 * Facebook, di YouTube, di LinkedIn — e vale la pena qui perché questa
 * pagina ha una forma sola e la conosciamo in anticipo.
 *
 * Nella pratica si vedrà di rado: il pacchetto dell'area riservata comincia
 * a scaricarsi quando il puntatore sfiora "Accedi" (vedi precarica.js), e
 * questa sagoma compare solo dopo un quarto di secondo di attesa vera.
 */
export default function SagomaAccesso() {
  return (
    <div className="sga-pagina" role="status" aria-label="Apertura della pagina di accesso">
      <div className="sga-lato" aria-hidden="true">
        <span className="sga-logo" />
        <span className="sga-riga sga-riga-titolo" />
        <span className="sga-riga sga-riga-corta" />
      </div>

      <div className="sga-modulo" aria-hidden="true">
        <div className="sga-scheda">
          <span className="sga-riga sga-riga-titolo" />
          <span className="sga-riga sga-riga-corta" />

          <span className="sga-campo" />
          <span className="sga-campo" />
          <span className="sga-pulsante" />
        </div>
      </div>
    </div>
  );
}
