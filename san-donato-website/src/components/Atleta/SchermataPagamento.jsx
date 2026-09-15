import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  FaTimes, FaCreditCard, FaUniversity, FaStore, FaLock,
  FaInfoCircle, FaCheckCircle, FaArrowRight
} from "react-icons/fa";
import { euro, daCampo, versoCampo } from "../../utils/soldi";
import "../../css/Pagamento.css";

/**
 * Il pagamento della quota, visto da chi paga.
 *
 * ATTENZIONE — QUI NON SI MUOVE UN EURO. La società non ha ancora scelto
 * con chi incassare, e finché non c'è un fornitore non esiste nessun posto
 * dove mandare i soldi. Questa schermata è il percorso completo, costruito
 * adesso perché è la parte che va decisa con le persone, non con il codice:
 * quanto si versa, in quante volte, con che mezzo.
 *
 * COSA MANCA PER RENDERLO VERO, in ordine:
 *
 *   1. la società sceglie il fornitore (Stripe, Nexi, SumUp: cambia il
 *      fornitore, non questa schermata);
 *   2. un endpoint apre una sessione di pagamento e restituisce l'indirizzo
 *      a cui mandare il browser — al posto di `procedi()` qui sotto;
 *   3. il versamento lo scrive la NOTIFICA che il fornitore manda al
 *      server, sulla stessa tabella "pagamenti" che usa oggi la segreteria.
 *
 * Il punto 3 non è un dettaglio: l'esito non si può registrare al ritorno
 * dell'utente sul sito. Chi chiude la pagina a metà avrebbe pagato senza
 * che risulti, e chi ricarica la pagina di ritorno risulterebbe due volte.
 */

const MODI = [
  {
    chiave: "carta",
    Icona: FaCreditCard,
    titolo: "Carta di credito o debito",
    nota: "Il versamento risulta subito, senza passare dalla segreteria."
  },
  {
    chiave: "bonifico",
    Icona: FaUniversity,
    titolo: "Bonifico bancario",
    nota: "Ci mette due o tre giorni: la segreteria lo registra quando arriva."
  },
  {
    chiave: "sede",
    Icona: FaStore,
    titolo: "In sede, di persona",
    nota: "Contanti o POS negli orari di segreteria, in Via Le Chiuse 20/A."
  }
];

export default function SchermataPagamento({ quota, versato, onChiudi }) {
  const residuo = quota == null ? null : Math.max(0, quota - versato);

  const [modo, setModo] = useState("carta");
  const [quanto, setQuanto] = useState(() => versoCampo(residuo ?? 0));
  const [inviato, setInviato] = useState(false);

  // Esc chiude, come in qualunque finestra di sistema.
  useEffect(() => {
    const suTasto = (e) => { if (e.key === "Escape") onChiudi(); };
    document.addEventListener("keydown", suTasto);
    return () => document.removeEventListener("keydown", suTasto);
  }, [onChiudi]);

  const centesimi = daCampo(quanto);
  const valido = centesimi != null && centesimi > 0 && (residuo == null || centesimi <= residuo);

  const procedi = () => setInviato(true);

  return createPortal(
    <div
      className="pag-velo"
      role="dialog"
      aria-modal="true"
      aria-label="Paga la quota"
      onClick={(e) => { if (e.target === e.currentTarget) onChiudi(); }}
    >
      <div className="pag-finestra">
        <div className="pag-testa">
          <h2 className="pag-titolo">Paga la tua quota</h2>
          <button type="button" className="adm-icon-btn" onClick={onChiudi} aria-label="Chiudi">
            <FaTimes />
          </button>
        </div>

        {/* L'avviso sta in cima e non in fondo: chi apre questa finestra deve
            sapere prima di leggere il resto che non sta per pagare davvero. */}
        <div className="pag-avviso">
          <FaInfoCircle aria-hidden="true" />
          <span>
            <strong>Anteprima.</strong> Il pagamento dal sito non è ancora
            attivo: qui non viene addebitato niente. Per ora la quota si versa
            in sede o con bonifico, e la segreteria la registra.
          </span>
        </div>

        {inviato ? (
          <div className="pag-corpo pag-esito">
            <FaCheckCircle className="pag-esito-icona" aria-hidden="true" />
            <h3>Qui finirebbe il percorso</h3>

            <p>
              Con il fornitore collegato, a questo punto il browser andrebbe
              sulla sua pagina sicura per {euro(centesimi)}
              {modo === "carta" ? " con la carta" : modo === "bonifico" ? " con bonifico" : ""}.
              Tornando indietro troveresti il versamento nel tuo elenco.
            </p>

            <p className="adm-hint">
              Il versamento non lo scrive il ritorno sul sito ma la notifica
              che il fornitore manda al server: così vale anche per chi chiude
              la pagina a metà, e non conta due volte per chi la ricarica.
            </p>

            <div className="adm-head-actions">
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setInviato(false)}>
                Torna indietro
              </button>
              <button type="button" className="adm-btn adm-btn-primary" onClick={onChiudi}>
                Ho capito
              </button>
            </div>
          </div>
        ) : (
          <div className="pag-corpo">
            <section className="pag-sezione">
              <h3 className="pag-sezione-titolo">Quanto versi</h3>

              <div className="pag-conto">
                <div>
                  <span className="pag-conto-etichetta">Quota della stagione</span>
                  <span className="pag-conto-valore">{euro(quota)}</span>
                </div>
                <div>
                  <span className="pag-conto-etichetta">Già versato</span>
                  <span className="pag-conto-valore">{euro(versato)}</span>
                </div>
                <div className="is-residuo">
                  <span className="pag-conto-etichetta">Resta da versare</span>
                  <span className="pag-conto-valore">{euro(residuo)}</span>
                </div>
              </div>

              <div className="pag-importo">
                <label className="adm-field">
                  <span className="adm-label">Quanto vuoi versare adesso</span>
                  <div className="pag-campo-euro">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="adm-input"
                      value={quanto}
                      onChange={(e) => setQuanto(e.target.value)}
                    />
                    <span aria-hidden="true">€</span>
                  </div>
                </label>

                {/* Si può versare un acconto: è quello che succede davvero,
                    e un modulo che accetta solo l'intero costringerebbe
                    comunque a passare in segreteria. */}
                {residuo != null && residuo > 0 && (
                  <div className="pag-scorciatoie">
                    <button
                      type="button"
                      className="adm-chip"
                      onClick={() => setQuanto(versoCampo(residuo))}
                    >
                      Tutto ({euro(residuo)})
                    </button>
                    <button
                      type="button"
                      className="adm-chip"
                      onClick={() => setQuanto(versoCampo(Math.round(residuo / 2)))}
                    >
                      Metà ({euro(Math.round(residuo / 2))})
                    </button>
                  </div>
                )}

                {!valido && (
                  <p className="adm-hint pag-errore">
                    {centesimi == null || centesimi <= 0
                      ? "Scrivi una cifra, per esempio 120,00."
                      : `Non puoi versare più di quanto resta (${euro(residuo)}).`}
                  </p>
                )}
              </div>
            </section>

            <section className="pag-sezione">
              <h3 className="pag-sezione-titolo">Come</h3>

              <div className="pag-modi">
                {MODI.map(({ chiave, Icona, titolo, nota }) => (
                  <button
                    key={chiave}
                    type="button"
                    className={`pag-modo ${modo === chiave ? "is-scelto" : ""}`}
                    onClick={() => setModo(chiave)}
                    aria-pressed={modo === chiave}
                  >
                    <Icona className="pag-modo-icona" aria-hidden="true" />
                    <span className="pag-modo-testi">
                      <strong>{titolo}</strong>
                      <span>{nota}</span>
                    </span>
                  </button>
                ))}
              </div>

              {modo === "bonifico" && (
                <p className="adm-hint pag-nota-modo">
                  Le coordinate della società non sono ancora sul sito: chiedile
                  in segreteria, e ricordati di scrivere nome, cognome e squadra
                  nella causale.
                </p>
              )}

              {modo === "sede" && (
                <p className="adm-hint pag-nota-modo">
                  Nessuna prenotazione: si passa negli orari di apertura e si
                  paga in contanti o con il POS.
                </p>
              )}
            </section>
          </div>
        )}

        {!inviato && (
          <div className="pag-piede">
            <span className="pag-piede-sicuro">
              <FaLock aria-hidden="true" /> Nessun dato della carta passa da questo sito.
            </span>

            <div className="adm-head-actions">
              <button type="button" className="adm-btn adm-btn-ghost" onClick={onChiudi}>
                Annulla
              </button>
              <button
                type="button"
                className="adm-btn adm-btn-primary"
                onClick={procedi}
                disabled={!valido}
              >
                Paga {valido ? euro(centesimi) : ""} <FaArrowRight />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
