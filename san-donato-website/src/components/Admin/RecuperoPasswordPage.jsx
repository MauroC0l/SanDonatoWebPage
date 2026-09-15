import { Link } from "react-router-dom";
import { FaArrowLeft, FaEnvelope, FaTools } from "react-icons/fa";
import "../../css/Admin.css";

const LOGO = "/logo-polisportiva.png";

/**
 * Recupero della password — ancora da costruire.
 *
 * La pagina esiste già perché il collegamento sotto al modulo di accesso ci
 * deve essere: è il primo posto dove si guarda quando la password non va, e
 * mandare in una pagina "non trovata" chi è già in difficoltà è il modo
 * peggiore di dire "non c'è ancora".
 *
 * Quando si farà sul serio servono: una tabella di gettoni a scadenza breve,
 * un indirizzo da cui spedire (oggi le email partono solo da MailerLite, per
 * la newsletter) e la stessa attenzione dell'accesso a non rivelare quali
 * indirizzi sono registrati — la risposta dev'essere identica sia che
 * l'email esista sia che non esista.
 */
export default function RecuperoPasswordPage() {
  return (
    <div className="alg-page">
      <main className="alg-form-side">
        <div className="alg-back-row">
          <Link to="/login" className="alg-back">
            <FaArrowLeft className="alg-back-arrow" aria-hidden="true" />
            Torna all&apos;accesso
          </Link>
        </div>

        <div className="alg-card alg-card-esito">
          <img src={LOGO} alt="Polisportiva San Donato" className="alg-mobile-logo" />

          <FaTools className="alg-esito-icona alg-icona-attesa" aria-hidden="true" />

          <h2 className="alg-title">Recupero non ancora attivo</h2>

          <p className="alg-lead">
            Il reinvio automatico della password non è ancora in funzione sul
            sito. Nel frattempo si rimette a mano, ed è veloce.
          </p>

          <p className="adm-hint">
            Scrivi alla segreteria dicendo con quale indirizzo entri: chi
            amministra il sito ne imposta una nuova e te la consegna. Al primo
            accesso te ne farai chiedere una tua.
          </p>

          <div className="alg-attesa-azioni">
            <a href="mailto:info@polisportivasandonato.org" className="adm-btn adm-btn-primary">
              <FaEnvelope /> Scrivi alla segreteria
            </a>
          </div>
        </div>

        <p className="alg-footer">A.S.D. Polisportiva San Donato — Torino</p>
      </main>
    </div>
  );
}
