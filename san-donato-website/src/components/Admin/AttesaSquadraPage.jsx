import { Link } from "react-router-dom";
import { FaHourglassHalf, FaUserCircle } from "react-icons/fa";
import { useAuth } from "../../context/auth";
import { percorsoProfilo } from "../../utils/percorsi";
import "../../css/Admin.css";
import "../../css/admin/Richieste.css";

/**
 * Quello che vede chi si è registrato e non ha ancora una squadra.
 *
 * Non è una pagina di errore e non deve sembrarlo: la persona ha fatto
 * tutto giusto, manca un passaggio che tocca a qualcun altro. Perciò dice
 * chi sta decidendo e cosa può fare nel frattempo, invece di limitarsi a
 * negare l'accesso.
 *
 * I tre passi numerati rispondono alla domanda che si fa chi arriva qui,
 * "a che punto sono?", meglio di un paragrafo: il primo è già spuntato, il
 * secondo è quello in corso e non tocca a lei, il terzo è quello che
 * succederà da solo.
 *
 * Sta dentro al guscio come qualunque altra pagina, con la barra ridotta
 * alle tre cose che servono davvero: il sito, il profilo, l'uscita.
 */
export default function AttesaSquadraPage() {
  const { user } = useAuth();
  const nome = (user?.name ?? "").split(" ")[0];

  return (
    <div className="adm-page">
      <div className="adm-attesa ric-attesa-pagina">
        <span className="ric-attesa-icona" aria-hidden="true"><FaHourglassHalf /></span>

        <h1 className="adm-attesa-titolo">Aspetti una squadra</h1>

        <p className="adm-attesa-testo">
          Ciao{nome ? ` ${nome}` : ""}, la tua registrazione è arrivata. Non devi
          fare altro: tocca alla società metterti nella squadra giusta.
        </p>

        <ol className="adm-passi ric-attesa-passi">
          <li className="is-fatto">
            <strong>Registrazione fatta</strong>
            <span>I tuoi dati sono arrivati.</span>
          </li>
          <li className="is-adesso">
            <strong>La società sceglie la tua squadra</strong>
            <span>
              Lo decidono l&apos;allenatore o la segreteria, in base all&apos;età e
              al campionato.
            </span>
          </li>
          <li>
            <strong>Entri nella tua area</strong>
            <span>Succede da solo: la prossima volta che entri la trovi pronta.</span>
          </li>
        </ol>

        <p className="adm-attesa-nota">
          Se passano più di qualche giorno, conviene farsi sentire in segreteria.
        </p>

        <div className="adm-attesa-azioni">
          <Link to={percorsoProfilo(user?.role)} className="adm-btn adm-btn-primary">
            <FaUserCircle aria-hidden="true" /> Controlla i tuoi dati
          </Link>
        </div>
      </div>
    </div>
  );
}
