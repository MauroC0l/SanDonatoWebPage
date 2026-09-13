import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  FaUser, FaKey, FaEye, FaEyeSlash, FaExclamationCircle, FaArrowRight,
  FaArrowLeft, FaEnvelope, FaCheckCircle, FaFutbol, FaVolleyballBall,
  FaBasketballBall
} from "react-icons/fa";
import { registrati } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import "../../css/Admin.css";

const LOGO = "/logo-polisportiva.png";

/**
 * Si sceglie lo sport, non la squadra.
 *
 * Quale sia la propria squadra non lo sa chi si iscrive: dipende dall'età,
 * dal campionato e da come la società compone le formazioni. Chiederglielo
 * porterebbe risposte sbagliate da correggere a mano.
 */
const SPORT = [
  { valore: "Calcio", icona: FaFutbol },
  { valore: "Pallavolo", icona: FaVolleyballBall },
  { valore: "Basket", icona: FaBasketballBall }
];

export default function RegistrazionePage() {
  const { isAuthenticated, isChecking, ricarica } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nome: "", cognome: "", email: "", password: "", sport: ""
  });
  const [mostraPassword, setMostraPassword] = useState(false);
  const [errore, setErrore] = useState("");
  const [invio, setInvio] = useState(false);
  const [fatta, setFatta] = useState(null);

  if (isChecking) {
    return (
      <div className="adm-boot">
        <div className="adm-spinner" />
        <p>Un momento…</p>
      </div>
    );
  }

  // Chi è già dentro non ha motivo di registrarsi di nuovo
  if (isAuthenticated && !fatta) return <Navigate to="/admin" replace />;

  const aggiorna = (modifiche) => {
    setForm((prima) => ({ ...prima, ...modifiche }));
    setErrore("");
  };

  const invia = async (evento) => {
    evento.preventDefault();
    setErrore("");

    if (!form.nome.trim() || !form.cognome.trim()) return setErrore("Servono nome e cognome.");
    if (!form.email.trim()) return setErrore("Serve l'email.");
    if (form.password.length < 10) return setErrore("La password deve avere almeno 10 caratteri.");
    if (!form.sport) return setErrore("Scegli lo sport.");

    setInvio(true);
    try {
      const esito = await registrati({
        nome: form.nome.trim(),
        cognome: form.cognome.trim(),
        email: form.email.trim(),
        password: form.password,
        sport: form.sport
      });

      // La sessione è già aperta lato server: il contesto va riallineato,
      // altrimenti il pannello crederebbe che nessuno sia connesso.
      await ricarica();
      setFatta(esito);
    } catch (err) {
      setErrore(err.message || "Registrazione non riuscita.");
      setInvio(false);
    }
  };

  /* ---------- Riuscita ---------- */

  if (fatta) {
    return (
      <div className="alg-page">
        <main className="alg-form-side">
          <div className="alg-back-row">
            <Link to="/" className="alg-back">
              <FaArrowLeft className="alg-back-arrow" aria-hidden="true" />
              Torna alla home
            </Link>
          </div>

          <div className="alg-card alg-card-esito">
            <img src={LOGO} alt="Polisportiva San Donato" className="alg-mobile-logo" />
            <FaCheckCircle className="alg-esito-icona" aria-hidden="true" />

            <h2 className="alg-title">Registrazione inviata</h2>
            <p className="alg-lead">
              Benvenuto {fatta.utente.name}. Hai chiesto di entrare nella
              squadra di <strong>{fatta.sport.toLowerCase()}</strong>.
            </p>
            <p className="adm-hint">
              Adesso l&apos;allenatore o la segreteria ti assegneranno a una
              squadra. Fino ad allora il tuo account è in attesa: riceverai
              accesso quando la squadra sarà decisa.
            </p>

            <button
              type="button"
              className="alg-submit"
              onClick={() => navigate("/admin", { replace: true })}
            >
              Ho capito <FaArrowRight className="alg-btn-arrow" />
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* ---------- Modulo ---------- */

  return (
    <div className="alg-page">
      <aside className="alg-brand">
        <div className="alg-brand-glow" aria-hidden="true">
          <span className="alg-orb alg-orb-1" />
          <span className="alg-orb alg-orb-2" />
          <span className="alg-orb alg-orb-3" />
        </div>

        <div className="alg-brand-inner">
          <img src={LOGO} alt="" className="alg-brand-logo" />
          <h1 className="alg-brand-title">Polisportiva<br />San Donato</h1>
          <p className="alg-brand-text">
            Registrati e la società ti assegnerà alla tua squadra.
            Da lì avrai il calendario sempre a portata di mano.
          </p>
        </div>
      </aside>

      <main className="alg-form-side">
        <div className="alg-back-row">
          <Link to="/" className="alg-back">
            <FaArrowLeft className="alg-back-arrow" aria-hidden="true" />
            Torna alla home
          </Link>
        </div>

        <div className="alg-card">
          <img src={LOGO} alt="Polisportiva San Donato" className="alg-mobile-logo" />

          <p className="alg-eyebrow">Atleti</p>
          <h2 className="alg-title">Registrati</h2>
          <p className="alg-lead">Serve solo per gli atleti della società</p>

          <form onSubmit={invia} noValidate className="alg-form">

            <div className="adm-due-colonne">
              <div className="alg-field">
                <FaUser className="alg-field-icon" aria-hidden="true" />
                <input
                  id="reg-nome"
                  type="text"
                  className="alg-input"
                  value={form.nome}
                  onChange={(e) => aggiorna({ nome: e.target.value })}
                  placeholder=" "
                  autoComplete="given-name"
                  disabled={invio}
                />
                <label htmlFor="reg-nome" className="alg-label">Nome</label>
              </div>

              <div className="alg-field">
                <input
                  id="reg-cognome"
                  type="text"
                  className="alg-input alg-input-senza-icona"
                  value={form.cognome}
                  onChange={(e) => aggiorna({ cognome: e.target.value })}
                  placeholder=" "
                  autoComplete="family-name"
                  disabled={invio}
                />
                <label htmlFor="reg-cognome" className="alg-label">Cognome</label>
              </div>
            </div>

            <div className="alg-field">
              <FaEnvelope className="alg-field-icon" aria-hidden="true" />
              <input
                id="reg-email"
                type="email"
                className="alg-input"
                value={form.email}
                onChange={(e) => aggiorna({ email: e.target.value })}
                placeholder=" "
                autoComplete="email"
                autoCapitalize="none"
                spellCheck="false"
                disabled={invio}
              />
              <label htmlFor="reg-email" className="alg-label">Email</label>
            </div>

            <div className="alg-field">
              <FaKey className="alg-field-icon" aria-hidden="true" />
              <input
                id="reg-pw"
                type={mostraPassword ? "text" : "password"}
                className="alg-input alg-input-pw"
                value={form.password}
                onChange={(e) => aggiorna({ password: e.target.value })}
                placeholder=" "
                autoComplete="new-password"
                disabled={invio}
              />
              <label htmlFor="reg-pw" className="alg-label">Password</label>
              <button
                type="button"
                className="alg-reveal"
                onClick={() => setMostraPassword((v) => !v)}
                disabled={invio}
                aria-label={mostraPassword ? "Nascondi la password" : "Mostra la password"}
              >
                {mostraPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            {/* Nessun obbligo di maiuscole e simboli: quelle regole portano a
                "Password1!" e al foglietto sul monitor. La lunghezza conta di più. */}
            <p className="adm-hint">Almeno 10 caratteri. Va bene anche una frase.</p>

            {/* Tre pulsanti invece di un menu a tendina: le voci sono tre e
                si vedono tutte insieme, senza aprire niente. */}
            <fieldset className="alg-sport-scelta">
              <legend className="adm-label">Che sport pratichi?</legend>

              <div className="alg-sport-opzioni">
                {SPORT.map(({ valore, icona: Icona }) => (
                  <button
                    key={valore}
                    type="button"
                    className={`alg-sport-opzione ${form.sport === valore ? "is-scelto" : ""}`}
                    onClick={() => aggiorna({ sport: valore })}
                    disabled={invio}
                    aria-pressed={form.sport === valore}
                  >
                    <Icona aria-hidden="true" />
                    <span>{valore}</span>
                  </button>
                ))}
              </div>

              <span className="adm-hint">
                La squadra te la assegna la società: dipende dall&apos;età e
                dal campionato.
              </span>
            </fieldset>

            {errore && (
              <div className="alg-alert" role="alert">
                <FaExclamationCircle /> <span>{errore}</span>
              </div>
            )}

            <button type="submit" className="alg-submit" disabled={invio}>
              {invio ? (
                <><span className="alg-btn-spinner" aria-hidden="true" /> Un attimo…</>
              ) : (
                <>Crea l&apos;account <FaArrowRight className="alg-btn-arrow" /></>
              )}
            </button>
          </form>

          <p className="alg-footer">
            Hai già un account? <Link to="/login" className="adm-inline-link">Accedi</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
