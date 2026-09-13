import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaKey, FaEye, FaEyeSlash, FaExclamationCircle, FaArrowRight, FaShieldAlt,
  FaArrowLeft
} from "react-icons/fa";
import { cambiaPassword } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import "../../css/Admin.css";

const LOGO = "/logo-polisportiva.png";

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
  const navigate = useNavigate();

  const [attuale, setAttuale] = useState("");
  const [nuova, setNuova] = useState("");
  const [conferma, setConferma] = useState("");
  const [mostra, setMostra] = useState(false);
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
      if (!obbligatorio) navigate("/admin", { replace: true });
    } catch (err) {
      setErrore(err.message || "Cambio non riuscito.");
      setInvio(false);
    }
  };

  return (
    <div className="alg-page">
      <main className="alg-form-side">
        {/* Una via d'uscita c'è sempre, anche quando il cambio è obbligatorio:
            non si può usare il pannello, ma il sito sì. */}
        <div className="alg-back-row">
          <Link to="/" className="alg-back">
            <FaArrowLeft className="alg-back-arrow" aria-hidden="true" />
            Torna alla home
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

            <div className="alg-field">
              <FaKey className="alg-field-icon" aria-hidden="true" />
              <input
                id="cp-attuale"
                type={mostra ? "text" : "password"}
                className="alg-input"
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
            </div>

            <div className="alg-field">
              <FaShieldAlt className="alg-field-icon" aria-hidden="true" />
              <input
                id="cp-nuova"
                type={mostra ? "text" : "password"}
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
                onClick={() => setMostra((v) => !v)}
                disabled={invio}
                aria-label={mostra ? "Nascondi" : "Mostra"}
              >
                {mostra ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <div className="alg-field">
              <input
                id="cp-conferma"
                type={mostra ? "text" : "password"}
                className="alg-input alg-input-senza-icona"
                value={conferma}
                onChange={(e) => setConferma(e.target.value)}
                placeholder=" "
                autoComplete="new-password"
                disabled={invio}
              />
              <label htmlFor="cp-conferma" className="alg-label">Ripetila</label>
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
      </main>
    </div>
  );
}
