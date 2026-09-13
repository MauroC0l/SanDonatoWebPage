import { FaHourglassHalf, FaSignOutAlt, FaExternalLinkAlt } from "react-icons/fa";
import { useAuth } from "../../context/auth";
import "../../css/Admin.css";

const LOGO = "/logo-polisportiva.png";

/**
 * Quello che vede chi si è registrato e non ha ancora una squadra.
 *
 * Non è una pagina di errore e non deve sembrarlo: la persona ha fatto
 * tutto giusto, manca un passaggio che tocca a qualcun altro. Perciò dice
 * chi sta decidendo e cosa può fare nel frattempo, invece di limitarsi a
 * negare l'accesso.
 */
export default function AttesaSquadraPage() {
  const { user, logout } = useAuth();

  return (
    <div className="alg-page">
      <main className="alg-form-side">
        <div className="alg-card alg-card-esito">
          <img src={LOGO} alt="Polisportiva San Donato" className="alg-mobile-logo" />

          <FaHourglassHalf className="alg-esito-icona alg-icona-attesa" aria-hidden="true" />

          <h2 className="alg-title">Aspetti una squadra</h2>

          <p className="alg-lead">
            Ciao {user?.name}. La tua registrazione è arrivata: adesso
            l&apos;allenatore o la segreteria devono assegnarti alla squadra
            giusta.
          </p>

          <p className="adm-hint">
            Dipende dall&apos;età e dal campionato, per questo non l&apos;hai
            scelta tu. Appena sarà deciso, entrando da qui troverai la tua
            area. Se passano dei giorni, conviene farsi sentire in segreteria.
          </p>

          <div className="alg-attesa-azioni">
            <a href="/" className="adm-btn adm-btn-primary">
              <FaExternalLinkAlt /> Vai al sito
            </a>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={logout}>
              <FaSignOutAlt /> Esci
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
