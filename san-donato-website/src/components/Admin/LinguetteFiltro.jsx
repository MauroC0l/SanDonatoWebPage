/**
 * I filtri di un elenco di persone, come linguette con il loro numero.
 *
 * Il numero accanto al nome è la metà utile del filtro: "Certificato
 * scaduto 13" dice già se vale la pena toccarlo, prima di toccarlo. Un
 * filtro che conta zero resta toccabile ma si spegne nel grigio, così
 * l'occhio va da solo su quelli che hanno qualcosa dentro.
 *
 * Sul telefono le linguette scorrono di lato invece di andare a capo: su
 * tre righe di pastiglie non si capisce più quale sia accesa.
 *
 * Ogni voce: { chiave, etichetta, conta, tono } — tono "allarme" o
 * "attenzione" colora il numero quando non è zero.
 */
export default function LinguetteFiltro({ voci, attiva, onCambia, etichetta }) {
  return (
    <div className="prs-linguette" role="group" aria-label={etichetta}>
      {voci.map((v) => {
        const accesa = attiva === v.chiave;
        const vuota = v.conta === 0 && v.chiave !== "";

        return (
          <button
            key={v.chiave || "tutti"}
            type="button"
            className={`prs-linguetta ${accesa ? "is-active" : ""} ${vuota ? "is-vuota" : ""}`}
            onClick={() => onCambia(v.chiave)}
            aria-pressed={accesa}
          >
            {v.etichetta}
            {v.conta != null && (
              <span
                className={`adm-badge-conta ${
                  accesa ? "" : vuota ? "is-neutro" : v.tono ? `is-${v.tono}` : "is-neutro"
                }`}
              >
                {v.conta}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
