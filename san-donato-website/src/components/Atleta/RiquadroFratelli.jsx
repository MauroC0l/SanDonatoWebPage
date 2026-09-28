import { useState } from "react";
import {
  FaUsers, FaCheckCircle, FaHourglassHalf, FaTimesCircle, FaPlus, FaTrashAlt
} from "react-icons/fa";
import { dichiaraFratello, ritiraFratello } from "../../api/adminApi";

/**
 * "Ho un fratello o una sorella già iscritti": il pannello per dichiararlo.
 *
 * La società fa pagare meno dal secondo figlio iscritto. Finora quello
 * sconto se lo doveva ricordare qualcuno — la famiglia al momento di
 * pagare, o la segreteria mentre assegnava le quote a memoria: chi se ne
 * dimenticava pagava di più senza sapere di averne diritto.
 *
 * QUI SI DICHIARA E BASTA, e va detto chiaramente a chi compila: la
 * quota per la famiglia la applica il sito, ma solo dopo che la
 * segreteria ha confermato la parentela. Il motivo è la regola che regge
 * tutto il sito — i propri dati li scrive l'interessato, la quota la
 * decide la società — e un campo del modulo che abbassa l'importo dovuto
 * da solo sarebbe l'atleta che si scrive la propria quota.
 *
 * Sta nella pagina dell'iscrizione, sotto al modulo: una parentela è un
 * dato di chi si iscrive, come gli altri che si compilano lì.
 *
 * E non si dice mai se quel codice fiscale corrisponde a un iscritto:
 * rispondere "trovato" vorrebbe dire che chiunque può provare il codice
 * fiscale di una persona qualsiasi e scoprire se fa sport qui.
 */

const ASPETTO = {
  in_attesa: {
    Icona: FaHourglassHalf,
    testo: "La segreteria la controllerà."
  },
  confermato: {
    Icona: FaCheckCircle,
    testo: "Confermata: la tua quota è quella per la famiglia."
  },
  respinto: {
    Icona: FaTimesCircle,
    testo: "Non è stata riconosciuta."
  }
};

export default function RiquadroFratelli({ fratelli = [], onAggiornati, onErrore }) {
  const [codice, setCodice] = useState("");
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState("");

  const dichiara = async () => {
    setErrore("");
    setOccupato(true);

    try {
      onAggiornati(await dichiaraFratello(codice));
      setCodice("");
    } catch (err) {
      /* L'errore si mostra QUI, accanto alla casella, e non solo nella
         striscia in cima alla pagina: chi sbaglia una lettera del codice
         fiscale sta guardando il campo, non l'intestazione. */
      setErrore(err.message || "Non è stato possibile registrare la dichiarazione.");
      onErrore?.(err);
    } finally {
      setOccupato(false);
    }
  };

  const ritira = async (id) => {
    setErrore("");
    setOccupato(true);

    try {
      onAggiornati(await ritiraFratello(id));
    } catch (err) {
      setErrore(err.message || "Non è stato possibile ritirare la dichiarazione.");
      onErrore?.(err);
    } finally {
      setOccupato(false);
    }
  };

  return (
    <section className="adm-panel fra">
      <h2 className="adm-panel-title">
        <FaUsers aria-hidden="true" /> Fratelli e sorelle
      </h2>

      <p className="adm-hint fra-spiega">
        Se un tuo fratello o una tua sorella sono già iscritti alla
        Polisportiva, puoi chiedere la <strong>quota per la famiglia</strong>.
        Scrivi qui il suo codice fiscale: la segreteria controlla e, se
        risulta, la tua quota diventa quella per la famiglia. Finché non
        l&apos;ha guardata resta quella che vedi in alto. Vale per questa
        stagione: la prossima si richiede di nuovo.
      </p>

      {fratelli.length > 0 && (
        <ul className="fra-elenco">
          {fratelli.map((f) => {
            const aspetto = ASPETTO[f.stato] ?? ASPETTO.in_attesa;
            const { Icona } = aspetto;

            return (
              <li key={f.id} className={`fra-riga is-${f.stato}`}>
                <Icona aria-hidden="true" />

                <span className="fra-testi">
                  <span className="fra-codice">{f.codiceFiscale}</span>
                  <span className="fra-stato">
                    {aspetto.testo}
                    {/* Il motivo del rifiuto, quando c'è: "respinta" e basta
                        vuol dire una telefonata in segreteria per sapere
                        cosa c'era di sbagliato. */}
                    {f.stato === "respinto" && f.motivo && ` ${f.motivo}`}
                  </span>
                </span>

                {/* Si ritira solo finché nessuno l'ha guardata: dopo, è la
                    ragione per cui quella quota è quella che è. */}
                {f.stato === "in_attesa" && (
                  <button
                    type="button"
                    className="adm-icon-btn adm-icon-danger"
                    onClick={() => ritira(f.id)}
                    disabled={occupato}
                    title="Ritira questa dichiarazione"
                    aria-label={`Ritira la dichiarazione ${f.codiceFiscale}`}
                  >
                    <FaTrashAlt />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="fra-aggiungi">
        <label className="adm-field">
          <span className="adm-label">Codice fiscale di tuo fratello o tua sorella</span>
          <input
            type="text"
            className="adm-input"
            value={codice}
            onChange={(e) => setCodice(e.target.value.toUpperCase())}
            placeholder="Sedici caratteri"
            maxLength={16}
            disabled={occupato}
          />
        </label>

        {/* type="button": questo pannello sta fuori dal modulo
            dell'iscrizione apposta — sono due salvataggi diversi, e un
            invio solo li confonderebbe. */}
        <button
          type="button"
          className="adm-btn adm-btn-secondary"
          onClick={dichiara}
          disabled={occupato || codice.trim().length < 16}
        >
          <FaPlus /> {occupato ? "Invio…" : "Dichiara"}
        </button>
      </div>

      {errore && (
        <p className="adm-hint fra-errore" role="alert">{errore}</p>
      )}
    </section>
  );
}
