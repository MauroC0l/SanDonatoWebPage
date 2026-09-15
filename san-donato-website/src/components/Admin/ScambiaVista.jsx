/**
 * I pulsanti con cui si sceglie cosa guardare, o come.
 *
 * Un gruppo di pulsanti e non una tendina: le opzioni sono due o tre, si
 * cambia spesso, e una tendina costringerebbe a due gesti per ogni cambio.
 *
 * L'etichetta si può cambiare perché non serve solo agli elenchi: sulla
 * scheda di una persona sceglie fra due viste, e "come vedere l'elenco"
 * letto da un lettore di schermo sarebbe una bugia.
 */
export default function ScambiaVista({
  vista, onCambia, opzioni, etichetta = "Come vedere l'elenco"
}) {
  return (
    <div className="adm-scambia-vista" role="group" aria-label={etichetta}>
      {opzioni.map(({ valore, etichetta, Icona }) => {
        const attiva = vista === valore;

        return (
          <button
            key={valore}
            type="button"
            className={`adm-vista-btn ${attiva ? "is-active" : ""}`}
            onClick={() => onCambia(valore)}
            // aria-pressed e non un semplice pulsante: chi usa un lettore di
            // schermo deve sapere quale delle tre è quella accesa adesso.
            aria-pressed={attiva}
            title={etichetta}
          >
            <Icona aria-hidden="true" />
            <span className="adm-hide-sm">{etichetta}</span>
          </button>
        );
      })}
    </div>
  );
}
