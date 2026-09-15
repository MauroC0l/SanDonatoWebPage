import { Link } from "react-router-dom";
import { FaHourglassHalf, FaUserCircle } from "react-icons/fa";
import { useAuth } from "../../context/auth";
import { percorsoProfilo } from "../../utils/percorsi";
import "../../css/Admin.css";

/**
 * Quello che vede chi si è registrato e non ha ancora una squadra.
 *
 * Non è una pagina di errore e non deve sembrarlo: la persona ha fatto
 * tutto giusto, manca un passaggio che tocca a qualcun altro. Perciò dice
 * chi sta decidendo e cosa può fare nel frattempo, invece di limitarsi a
 * negare l'accesso.
 *
 * Prima occupava lo schermo intero, barra compresa: chi ci finiva non aveva
 * più modo di rileggere i propri dati né di uscire. Ora sta dentro al guscio
 * come qualunque altra pagina, con la barra ridotta alle tre cose che
 * servono davvero: il sito, il profilo, l'uscita.
 */
export default function AttesaSquadraPage() {
  const { user } = useAuth();

  return (
    <div className="adm-page">
      <div className="adm-attesa">
        <FaHourglassHalf className="adm-attesa-icona" aria-hidden="true" />

        <h1 className="adm-attesa-titolo">Aspetti una squadra</h1>

        <p className="adm-attesa-testo">
          Ciao {user?.name}. La tua registrazione è arrivata: adesso
          l&apos;allenatore o la segreteria devono assegnarti alla squadra
          giusta.
        </p>

        <p className="adm-attesa-nota">
          Dipende dall&apos;età e dal campionato, per questo non l&apos;hai
          scelta tu. Appena sarà deciso, entrando da qui troverai la tua area.
          Se passano dei giorni, conviene farsi sentire in segreteria.
        </p>

        <div className="adm-attesa-azioni">
          <Link to={percorsoProfilo(user?.role)} className="adm-btn adm-btn-primary">
            <FaUserCircle /> Controlla i tuoi dati
          </Link>
        </div>
      </div>
    </div>
  );
}
