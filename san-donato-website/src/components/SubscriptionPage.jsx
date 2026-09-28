import { Link } from "react-router-dom";
import { FaArrowDown, FaArrowRight, FaArrowUpRightFromSquare, FaUserPlus, FaRightToBracket, FaPhone, FaClock, FaFileSignature } from "react-icons/fa6";
import "../css/SubscriptionPage.css";
import contatti from "../data/Contatti.json";
import { attesaAreaRiservata } from "../precarica";

// Il portale esterno delle iscrizioni, mostrato dentro alla pagina
const PORTALE = "https://www.uffwebsm.it/PSD/";
const PORTALE_NOME = PORTALE.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

const PAROLE = ["Iscriviti", "Calcio", "Pallavolo", "Basket", "Borgo San Donato", "Sport per tutti"];

/* Scorrimento dolce verso il modulo, ma non per chi ha chiesto meno
   movimento; senza JavaScript resta il salto dell'ancora. */
const vaiA = (id) => (e) => {
  const bersaglio = document.getElementById(id);
  if (!bersaglio) return;
  e.preventDefault();
  const ridotto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  bersaglio.scrollIntoView({ behavior: ridotto ? "auto" : "smooth", block: "start" });
};

/**
 * Iscrizione. Prima era il solo riquadro del portale esterno, senza una
 * parola attorno: chi arrivava non sapeva dove fosse né cosa fare. Adesso
 * un'apertura come le altre pagine, le strade possibili in una griglia
 * (il modulo, la registrazione all'area riservata, l'accesso, la
 * segreteria) e il portale dentro a una cornice da finestra, con il
 * collegamento per aprirlo a parte: sul telefono, in una scheda sua, si
 * compila meglio.
 */
export default function SubscriptionPage() {
  const { phoneDisplay, phoneLink, contactName, orariValue } = contatti.segreteria;

  return (
    <div className="isc">
      {/* ---------- Apertura ---------- */}
      <section className="isc-eroe" aria-labelledby="isc-titolo">
        <div className="mv-aurora isc-aurora" aria-hidden="true" />
        <div className="isc-griglia-campo" aria-hidden="true" />
        <div className="isc-fantasma" aria-hidden="true" data-parallasse="0.12">GIOCA</div>

        <div className="isc-dentro">
          <p className="isc-occhiello" data-rivela>
            <span className="isc-punto" aria-hidden="true" /> Iscrizioni
          </p>
          <h1 id="isc-titolo" className="isc-titolo" data-rivela>
            <span className="isc-titolo-riga">Iscriviti alla</span>
            <span className="isc-titolo-riga mv-testo-vivo">Polisportiva</span>
          </h1>
          <div className="isc-eroe-basso" data-rivela style={{ "--mv-ritardo": "120ms" }}>
            <p className="isc-sottotitolo">
              Calcio, pallavolo e basket al Borgo San Donato, a Torino: dai più piccoli agli adulti.
            </p>
            <div className="isc-azioni">
              <a href="#isc-portale" className="isc-btn isc-btn--pieno" data-magnete onClick={vaiA("isc-portale")}>
                Vai al modulo <FaArrowDown aria-hidden="true" />
              </a>
              <Link to="/registrati" className="isc-btn isc-btn--vetro mv-vetro" {...attesaAreaRiservata}>
                <FaUserPlus aria-hidden="true" /> Registrati
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="isc-fascia" aria-hidden="true">
        <div className="mv-nastro" style={{ "--mv-nastro-durata": "30s" }}>
          <div className="mv-nastro-traccia">
            {[0, 1].map((copia) => (
              <span className="isc-fascia-giro" key={copia}>
                {PAROLE.map((p) => <span key={p}>{p} <span className="isc-stella">✦</span></span>)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Le strade ---------- */}
      <section className="isc-strade" aria-labelledby="isc-strade-titolo">
        <header className="isc-testa">
          <p className="isc-etichetta" data-rivela>Da dove partire</p>
          <h2 id="isc-strade-titolo" className="isc-h2" data-rivela>
            Scegli <em>la tua strada</em>.
          </h2>
        </header>

        <ul className="isc-bento" data-rivela-gruppo>
          <li className="isc-bento-cella isc-bento-cella--grande">
            <a href="#isc-portale" className="isc-scheda isc-scheda--scura" onClick={vaiA("isc-portale")} data-inclina="4">
              <span className="mv-aurora isc-scheda-aurora" aria-hidden="true" />
              <span className="isc-scheda-icona" aria-hidden="true"><FaFileSignature /></span>
              <span className="isc-scheda-filigrana" aria-hidden="true"><FaFileSignature /></span>
              <span className="isc-scheda-titolo">Modulo di iscrizione</span>
              <span className="isc-scheda-testo">
                Il portale delle iscrizioni della Polisportiva, qui sotto in questa pagina.
              </span>
              <span className="isc-scheda-azione">Compila il modulo <FaArrowDown aria-hidden="true" /></span>
            </a>
          </li>
          <li className="isc-bento-cella">
            <Link to="/registrati" className="isc-scheda" data-inclina="4" {...attesaAreaRiservata}>
              <span className="isc-scheda-icona" aria-hidden="true"><FaUserPlus /></span>
              <span className="isc-scheda-titolo">Registrati</span>
              <span className="isc-scheda-testo">Crea il tuo account nell'area riservata degli atleti.</span>
              <span className="isc-scheda-azione">Crea l'account <FaArrowRight aria-hidden="true" /></span>
            </Link>
          </li>
          <li className="isc-bento-cella">
            <Link to="/login" className="isc-scheda" data-inclina="4" {...attesaAreaRiservata}>
              <span className="isc-scheda-icona" aria-hidden="true"><FaRightToBracket /></span>
              <span className="isc-scheda-titolo">Accedi</span>
              <span className="isc-scheda-testo">Hai già un account? Entra nella tua area riservata.</span>
              <span className="isc-scheda-azione">Accedi <FaArrowRight aria-hidden="true" /></span>
            </Link>
          </li>
          <li className="isc-bento-cella isc-bento-cella--larga">
            <div className="isc-scheda isc-scheda--arancio">
              <span className="isc-scheda-icona" aria-hidden="true"><FaPhone /></span>
              <span className="isc-scheda-titolo">Hai domande? Chiedi alla segreteria</span>
              <span className="isc-segreteria">
                <a href={`tel:${phoneLink}`} className="isc-segreteria-tel">
                  <FaPhone aria-hidden="true" /> {phoneDisplay} · {contactName}
                </a>
                <span className="isc-segreteria-orari">
                  <FaClock aria-hidden="true" /> {orariValue}
                </span>
                <Link to="/contatti" className="isc-segreteria-link">
                  Tutti i contatti <FaArrowRight aria-hidden="true" />
                </Link>
              </span>
            </div>
          </li>
        </ul>
      </section>

      {/* ---------- Il portale ---------- */}
      <section id="isc-portale" className="isc-portale" aria-labelledby="isc-portale-titolo">
        <header className="isc-portale-testa">
          <div>
            <p className="isc-etichetta" data-rivela>Modulo</p>
            <h2 id="isc-portale-titolo" className="isc-h2" data-rivela>
              Il portale <em>iscrizioni</em>.
            </h2>
          </div>
          <a href={PORTALE} className="isc-apri" target="_blank" rel="noopener noreferrer" data-rivela>
            Apri in una nuova scheda <FaArrowUpRightFromSquare aria-hidden="true" />
          </a>
        </header>

        {/* La cornice da finestra: la barra con i tre puntini e l'indirizzo
            dice che quello dentro è un altro sito. Niente comparsa sul
            riquadro: un iframe che si sposta mentre lo si usa disorienta. */}
        <div className="isc-finestra">
          <div className="isc-finestra-barra">
            <span className="isc-finestra-puntini" aria-hidden="true"><span /><span /><span /></span>
            <span className="isc-finestra-indirizzo">{PORTALE_NOME}</span>
            <a href={PORTALE} className="isc-finestra-apri" target="_blank" rel="noopener noreferrer" aria-label="Apri il portale in una nuova scheda">
              <FaArrowUpRightFromSquare aria-hidden="true" />
            </a>
          </div>
          <div className="isc-finestra-corpo">
            <iframe
              src={PORTALE}
              title="Portale iscrizioni della Polisportiva San Donato"
              style={{ border: "none" }}
              // Il portale deve poter inviare moduli e aprire finestre sue
              sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
