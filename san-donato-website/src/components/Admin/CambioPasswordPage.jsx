import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaKey, FaEye, FaEyeSlash, FaExclamationCircle, FaArrowRight, FaShieldAlt,
  FaArrowLeft, FaCheckDouble
} from "react-icons/fa";
import { cambiaPassword } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import { percorsoProfilo } from "../../utils/percorsi";
import "../../css/Admin.css";

const LOGO = "/logo-polisportiva.png";

/** Schermo intero: quando questa pagina sostituisce il pannello. */
function GuscioPieno({ children }) {
  return (
    <div className="alg-page">
      <main className="alg-form-side">{children}</main>
    </div>
  );
}

/** Dentro al pannello: una pagina come le altre, con la scheda centrata. */
function GuscioNelPannello({ children }) {
  return (
    <div className="adm-page">
      <div className="adm-centrata">{children}</div>
    </div>
  );
}

/**
 * Cambio della password.
 *
 * Si apre da sola, prima di qualunque altra cosa, a chi ha un account
 * creato da un amministratore: quella password provvisoria la conosce
 * anche chi l'ha creata, e finché resta in piedi l'account non è davvero
 * di chi lo usa.
 */
export default function CambioPasswordPage({ obbligatorio = false }) {
  const { user, ricarica } = useAuth();
  const { avvisa } = useDialoghi();
  const navigate = useNavigate();

  // Dove si torna indietro. Quando il cambio è obbligatorio non si può
  // tornare al profilo: quella pagina rimanderebbe subito qui, perché finché
  // la password provvisoria è in piedi non si va da nessun'altra parte. In
  // quel caso l'unica via d'uscita vera è il sito pubblico.
  const indietro = obbligatorio
    ? { a: "/", etichetta: "Torna alla home" }
    : { a: percorsoProfilo(user?.role), etichetta: "Torna al profilo" };

  const [attuale, setAttuale] = useState("");
  const [nuova, setNuova] = useState("");
  const [conferma, setConferma] = useState("");
  /**
   * Un occhio per campo, non uno solo per tutti.
   *
   * Prima il pulsante era uno e scopriva le tre password insieme: chi voleva
   * ricontrollare di aver ribattuto bene la seconda si ritrovava in chiaro
   * anche quella vecchia, davanti a chiunque passasse dietro.
   */
  const [mostra, setMostra] = useState({ attuale: false, nuova: false, conferma: false });

  const occhio = (campo) => ({
    tipo: mostra[campo] ? "text" : "password",
    inverti: () => setMostra((prima) => ({ ...prima, [campo]: !prima[campo] }))
  });
  const [errore, setErrore] = useState("");
  const [invio, setInvio] = useState(false);

  const invia = async (evento) => {
    evento.preventDefault();
    setErrore("");

    if (nuova.length < 10) return setErrore("La nuova password deve avere almeno 10 caratteri.");
    if (nuova !== conferma) return setErrore("Le due password non coincidono.");
    if (nuova === attuale) return setErrore("La nuova password deve essere diversa da quella attuale.");

    setInvio(true);
    try {
      await cambiaPassword(attuale, nuova);
      await ricarica();
      if (!obbligatorio) {
        avvisa("Password cambiata. Le altre sessioni sono state chiuse.");
        navigate(indietro.a, { replace: true });
      }
    } catch (err) {
      setErrore(err.message || "Cambio non riuscito.");
      setInvio(false);
    }
  };

  /**
   * Due gusci per la stessa schermata.
   *
   * Quando il cambio è obbligatorio questa pagina prende il posto di tutto il
   * pannello, e allora è giusto che occupi lo schermo. Quando invece la si
   * apre di propria volontà, sta DENTRO al pannello: il guscio a tutta pagina
   * aggiungeva un secondo blocco alto quanto lo schermo sotto alla barra,
   * quindi la scheda finiva sotto al centro e nasceva una barra di
   * scorrimento per del vuoto.
   */
  const Guscio = obbligatorio ? GuscioPieno : GuscioNelPannello;

  return (
    <Guscio>
        {/* Una via d'uscita c'è sempre, anche quando il cambio è obbligatorio:
            non si può usare il pannello, ma il sito sì. */}
        <div className="alg-back-row">
          <Link to={indietro.a} className="alg-back">
            <FaArrowLeft className="alg-back-arrow" aria-hidden="true" />
            {indietro.etichetta}
          </Link>
        </div>

        <div className="alg-card">
          <img src={LOGO} alt="Polisportiva San Donato" className="alg-mobile-logo" />

          <p className="alg-eyebrow">Sicurezza</p>
          <h2 className="alg-title">{obbligatorio ? "Scegli la tua password" : "Cambia password"}</h2>

          {obbligatorio ? (
            <p className="alg-lead">
              Quella con cui sei entrato l&apos;ha scelta chi ti ha creato
              l&apos;account, quindi la conosce anche lui. Scegline una tua.
            </p>
          ) : (
            <p className="alg-lead">
              {user?.email}
            </p>
          )}

          <form onSubmit={invia} noValidate className="alg-form">

            {/* Tre campi fatti allo stesso modo: ognuno con la sua icona a
                sinistra e il suo occhio a destra. Prima il terzo non aveva
                né l'una né l'altro e sembrava un campo di un'altra pagina. */}
            <div className="alg-field">
              <FaKey className="alg-field-icon" aria-hidden="true" />
              <input
                id="cp-attuale"
                type={occhio("attuale").tipo}
                className="alg-input alg-input-pw"
                value={attuale}
                onChange={(e) => setAttuale(e.target.value)}
                placeholder=" "
                autoComplete="current-password"
                autoFocus
                disabled={invio}
              />
              <label htmlFor="cp-attuale" className="alg-label">
                {obbligatorio ? "Password ricevuta" : "Password attuale"}
              </label>
              <button
                type="button"
                className="alg-reveal"
                onClick={occhio("attuale").inverti}
                disabled={invio}
                aria-label={mostra.attuale ? "Nascondi la password attuale" : "Mostra la password attuale"}
              >
                {mostra.attuale ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <div className="alg-field">
              <FaShieldAlt className="alg-field-icon" aria-hidden="true" />
              <input
                id="cp-nuova"
                type={occhio("nuova").tipo}
                className="alg-input alg-input-pw"
                value={nuova}
                onChange={(e) => setNuova(e.target.value)}
                placeholder=" "
                autoComplete="new-password"
                disabled={invio}
              />
              <label htmlFor="cp-nuova" className="alg-label">Nuova password</label>
              <button
                type="button"
                className="alg-reveal"
                onClick={occhio("nuova").inverti}
                disabled={invio}
                aria-label={mostra.nuova ? "Nascondi la nuova password" : "Mostra la nuova password"}
              >
                {mostra.nuova ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <div className="alg-field">
              <FaCheckDouble className="alg-field-icon" aria-hidden="true" />
              <input
                id="cp-conferma"
                type={occhio("conferma").tipo}
                className="alg-input alg-input-pw"
                value={conferma}
                onChange={(e) => setConferma(e.target.value)}
                placeholder=" "
                autoComplete="new-password"
                disabled={invio}
              />
              <label htmlFor="cp-conferma" className="alg-label">Ripetila</label>
              <button
                type="button"
                className="alg-reveal"
                onClick={occhio("conferma").inverti}
                disabled={invio}
                aria-label={mostra.conferma ? "Nascondi la conferma" : "Mostra la conferma"}
              >
                {mostra.conferma ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <p className="adm-hint">
              Almeno 10 caratteri. Cambiandola, le sessioni aperte altrove
              vengono chiuse.
            </p>

            {errore && (
              <div className="alg-alert" role="alert">
                <FaExclamationCircle /> <span>{errore}</span>
              </div>
            )}

            <button type="submit" className="alg-submit" disabled={invio}>
              {invio ? (
                <><span className="alg-btn-spinner" aria-hidden="true" /> Un attimo…</>
              ) : (
                <>Salva <FaArrowRight className="alg-btn-arrow" /></>
              )}
            </button>
          </form>
        </div>
    </Guscio>
  );
}
