import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  FaUser, FaKey, FaEye, FaEyeSlash, FaExclamationCircle,
  FaArrowRight, FaFutbol, FaVolleyballBall, FaBasketballBall,
  FaArrowLeft
} from "react-icons/fa";
import { useAuth } from "../../context/auth";
import { areaDi } from "../../utils/percorsi";
import "../../css/Admin.css";

const LOGO = "/logo-polisportiva.png";

export default function LoginPage() {
  const { user, login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /*
   * Nessuna attesa prima del modulo.
   *
   * Il controllo della sessione c'è ancora — serve a mandare via chi è già
   * dentro — ma non si aspetta che finisca per disegnare: a un modulo di
   * accesso non serve sapere chi sei, e chi arriva qui nove volte su dieci
   * una sessione non ce l'ha. Prima, per quel decimo di secondo, tutti
   * guardavano una rotella invece del campo in cui stavano per scrivere.
   *
   * Chi invece è già entrato vede il modulo per un istante e poi viene
   * portato nella sua area: è il prezzo, ed è il più basso dei due.
   */

  // Ognuno nella propria area: un atleta non va sotto /admin, dove non
  // troverebbe nulla che lo riguardi.
  if (isAuthenticated) {
    return <Navigate to={location.state?.from || areaDi(user?.role)} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Inserisci email e password.");
      return;
    }

    setSubmitting(true);
    try {
      // Il profilo torna dalla login: serve subito, perché dove mandare
      // questa persona dipende dal suo ruolo e lo stato non è ancora aggiornato.
      const profilo = await login(username, password, remember);
      navigate(location.state?.from || areaDi(profilo?.role), { replace: true });
    } catch (err) {
      setError(err.message || "Accesso non riuscito.");
      setSubmitting(false);
    }
  };

  return (
    <div className="alg-page">

      {/* ---------- Pannello identità ---------- */}
      <aside className="alg-brand">
        <div className="alg-brand-glow" aria-hidden="true">
          <span className="alg-orb alg-orb-1" />
          <span className="alg-orb alg-orb-2" />
          <span className="alg-orb alg-orb-3" />
        </div>

        <div className="alg-brand-inner">
          <img src={LOGO} alt="" className="alg-brand-logo" />

          <h1 className="alg-brand-title">
            Polisportiva<br />San Donato
          </h1>

          <p className="alg-brand-text">
            Chi gioca divertendosi vince sempre!
          </p>

          <ul className="alg-sports" aria-label="Le nostre discipline">
            <li><FaFutbol /> Calcio</li>
            <li><FaVolleyballBall /> Volley</li>
            <li><FaBasketballBall /> Basket</li>
          </ul>
        </div>
      </aside>

      {/* ---------- Pannello accesso ---------- */}
      <main className="alg-form-side">

        {/* Via d'uscita: chi arriva qui dal lucchetto e ha sbagliato porta
            deve poter tornare indietro senza il tasto del browser. */}
        <div className="alg-back-row">
          <Link to="/" className="alg-back">
            <FaArrowLeft className="alg-back-arrow" aria-hidden="true" />
            Torna alla home
          </Link>
        </div>
        <div className="alg-card">

          {/* Su schermi stretti il pannello identità si riduce a questo */}
          <img src={LOGO} alt="Polisportiva San Donato" className="alg-mobile-logo" />

          <p className="alg-eyebrow">Area riservata</p>
          <h2 className="alg-title">Accedi</h2>
          <p className="alg-lead">Pagina di accesso per atleti e operatori della PSD</p>

          <form onSubmit={handleSubmit} noValidate className="alg-form">

            <div className="alg-field">
              <FaUser className="alg-field-icon" aria-hidden="true" />
              <input
                id="alg-user"
                type="email"
                className="alg-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder=" "
                autoComplete="email"
                autoCapitalize="none"
                autoFocus
                spellCheck="false"
                disabled={submitting}
              />
              <label htmlFor="alg-user" className="alg-label">Email</label>
            </div>

            <div className="alg-field">
              <FaKey className="alg-field-icon" aria-hidden="true" />
              <input
                id="alg-pw"
                type={showPassword ? "text" : "password"}
                className="alg-input alg-input-pw"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                autoComplete="current-password"
                spellCheck="false"
                disabled={submitting}
              />
              <label htmlFor="alg-pw" className="alg-label">Password</label>
              {/* Rileggere quel che si è digitato evita di sbattere contro un
                  errore per un tasto premuto male, soprattutto da telefono. */}
              <button
                type="button"
                className="alg-reveal"
                onClick={() => setShowPassword(v => !v)}
                disabled={submitting}
                aria-label={showPassword ? "Nascondi la password" : "Mostra la password"}
                title={showPassword ? "Nascondi" : "Mostra"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <label className="alg-check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={submitting}
              />
              <span className="alg-check-box" aria-hidden="true" />
              <span>Resta collegato su questo dispositivo <em>(14 giorni)</em></span>
            </label>

            {error && (
              <div className="alg-alert" role="alert">
                <FaExclamationCircle /> <span>{error}</span>
              </div>
            )}

            <button type="submit" className="alg-submit" disabled={submitting}>
              {submitting ? (
                <><span className="alg-btn-spinner" aria-hidden="true" /> Accesso in corso…</>
              ) : (
                <>Accedi <FaArrowRight className="alg-btn-arrow" /></>
              )}
            </button>
          </form>

          {/* Il posto dove tutti guardano quando la password non va: sotto al
              modulo, scritto come su qualunque altro sito. */}
          <p className="alg-recupero">
            <Link to="/recupera-password" className="adm-inline-link">
              Password dimenticata?
            </Link>
          </p>

        </div>

        <p className="alg-footer">
          Sei un atleta e non hai un account?{" "}
          <Link to="/registrati" className="adm-inline-link">Registrati</Link>
        </p>

        <p className="alg-footer">A.S.D. Polisportiva San Donato — Torino</p>
      </main>
    </div>
  );
}
