import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FaEuroSign, FaCheckCircle, FaCreditCard, FaReceipt, FaTimes } from "react-icons/fa";
import { euro } from "../../utils/soldi";
import { raggruppaPerAnno } from "../../utils/versamenti";
import SchermataPagamento from "./SchermataPagamento";
import "../../css/Quota.css";

/**
 * La propria quota: quanto si deve, quanto si è versato, quanto manca.
 *
 * L'atleta questi dati li LEGGE e basta, e così fa anche la segreteria:
 * nessuno scrive un versamento a mano. A registrarli sarà la notifica del
 * fornitore del pagamento online, che è l'unico a sapere davvero se i
 * soldi sono arrivati — un modulo in cui qualcuno dichiara di aver pagato
 * non è una ricevuta, nemmeno se a compilarlo è la segreteria.
 *
 * Prima qui c'era una frase che diceva di passare in sede per sapere a che
 * punto si era. Era la domanda più frequente in segreteria, e la risposta
 * era già nel database.
 *
 * Sta in cima alla pagina e occupa tutta la larghezza, non in fondo alla
 * colonna di destra: è la prima cosa che una famiglia viene a controllare,
 * molto più dell'indirizzo che ha già scritto tre mesi fa.
 */

const NOME_METODO = {
  contanti: "in contanti",
  bonifico: "con bonifico",
  pos: "con il POS",
  altro: "altro"
};

function giorno(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit", month: "long", year: "numeric"
  });
}

/*
 * "conStorico" lo spegne chi l'elenco ce l'ha già sotto: nella pagina
 * della quota i versamenti sono lì, e un pulsante che apre una finestra
 * per rimostrarli sarebbe solo un modo di coprire quello che si sta
 * guardando.
 */
export default function RiquadroQuota({ iscrizione, conStorico = true }) {
  const [pagamentoAperto, setPagamentoAperto] = useState(false);
  const [storicoAperto, setStoricoAperto] = useState(false);

  const quota = iscrizione?.quotaStagionaleCentesimi ?? null;
  const versato = iscrizione?.versatoCentesimi ?? 0;
  const versamenti = iscrizione?.pagamenti ?? [];

  // Il residuo esiste solo se la quota è stata decisa: senza, "manca tutto"
  // e "non manca niente" sarebbero la stessa cosa scritta a caso.
  const manca = quota == null ? null : quota - versato;
  const saldata = manca != null && manca <= 0;
  const percentuale = quota ? Math.min(100, Math.round((versato / quota) * 100)) : 0;

  // I versamenti arrivano dal più vecchio: l'ultimo è in fondo.
  const ultimo = versamenti.length ? versamenti[versamenti.length - 1] : null;

  return (
    <section className={`adm-panel qta ${saldata ? "is-saldata" : ""}`}>
      <div className="qta-riga">

        {/* La cifra che conta, grande quanto merita */}
        <div className="qta-testata">
          <span className="qta-occhiello">
            <FaEuroSign aria-hidden="true" /> La tua quota
          </span>

          {quota == null ? (
            <>
              <span className="qta-cifra qta-cifra-vuota">Da definire</span>
              <span className="qta-sotto">
                La segreteria non l&apos;ha ancora impostata per te.
              </span>
            </>
          ) : saldata ? (
            <>
              <span className="qta-cifra qta-cifra-ok">
                <FaCheckCircle aria-hidden="true" /> Saldata
              </span>
              <span className="qta-sotto">
                Hai versato {euro(versato)} su {euro(quota)}.
              </span>
            </>
          ) : (
            <>
              <span className="qta-cifra">{euro(manca)}</span>
              <span className="qta-sotto">
                ancora da versare, su una quota di {euro(quota)}
              </span>
            </>
          )}
        </div>

        {/* A che punto si è */}
        {quota != null && (
          <div className="qta-avanzamento">
            <div
              className="qta-barra"
              role="img"
              aria-label={`Versati ${euro(versato)} su ${euro(quota)}`}
            >
              <span
                className={`qta-barra-piena ${saldata ? "is-saldata" : ""}`}
                style={{ width: `${percentuale}%` }}
              />
            </div>

            <div className="qta-numeri">
              <span><strong>{euro(versato)}</strong> versati</span>
              <span className="qta-percento">{percentuale}%</span>
            </div>

            {iscrizione?.iscrittoDal && (
              <span className="qta-dal">
                Iscritto dal <strong>{giorno(iscrizione.iscrittoDal)}</strong>,
                cioè dal primo versamento.
              </span>
            )}
          </div>
        )}

        {/* Cosa si può fare */}
        <div className="qta-azioni">
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            onClick={() => setPagamentoAperto(true)}
            disabled={quota == null || saldata}
            title={quota == null
              ? "La quota non è ancora stata decisa"
              : saldata ? "Hai già versato tutto" : "Paga la quota"}
          >
            <FaCreditCard /> Paga la quota
          </button>

          {/*
            * L'ultimo versamento in chiaro, il resto dietro a un pulsante.
            *
            * Un elenco a scomparsa dentro alla fascia era la scelta
            * sbagliata: aprendolo la pagina si allungava e tutto quello che
            * stava sotto scendeva di colpo. La domanda vera poi è una sola
            * — "l'ultimo bonifico è arrivato?" — e quella si risponde senza
            * aprire niente.
            */}
          {ultimo && (
            <span className="qta-ultimo">
              <FaReceipt aria-hidden="true" />
              Ultimo: <strong>{euro(ultimo.importoCentesimi)}</strong> il {giorno(ultimo.pagatoIl)}
            </span>
          )}

          {conStorico && versamenti.length > 0 && (
            <button
              type="button"
              className="qta-tutti"
              onClick={() => setStoricoAperto(true)}
            >
              Tutti i versamenti ({versamenti.length})
            </button>
          )}
        </div>
      </div>

      {storicoAperto && (
        <StoricoVersamenti
          versamenti={versamenti}
          totale={versato}
          onChiudi={() => setStoricoAperto(false)}
        />
      )}

      {pagamentoAperto && (
        <SchermataPagamento
          quota={quota}
          versato={versato}
          onChiudi={() => setPagamentoAperto(false)}
        />
      )}
    </section>
  );
}

/**
 * Tutti i versamenti, in una finestra.
 *
 * Fuori dalla fascia e non dentro: aperto lì dentro, l'elenco allungava la
 * pagina e spingeva in basso tutto il resto a ogni clic. Qui invece si
 * apre, si legge, si chiude, e la pagina sotto non si muove di un pixel.
 *
 * È l'estratto conto di una famiglia: porta il totale in fondo, perché la
 * verifica che si fa davvero è "torna con quello che ho pagato io".
 */
function StoricoVersamenti({ versamenti, totale, onChiudi }) {
  useEffect(() => {
    const suTasto = (e) => { if (e.key === "Escape") onChiudi(); };
    document.addEventListener("keydown", suTasto);
    return () => document.removeEventListener("keydown", suTasto);
  }, [onChiudi]);

  return createPortal(
    <div
      className="qta-velo"
      role="dialog"
      aria-modal="true"
      aria-label="I tuoi versamenti"
      onClick={(e) => { if (e.target === e.currentTarget) onChiudi(); }}
    >
      <div className="qta-finestra">
        <div className="qta-finestra-testa">
          <h2><FaReceipt aria-hidden="true" /> I tuoi versamenti</h2>
          <button type="button" className="adm-icon-btn" onClick={onChiudi} aria-label="Chiudi">
            <FaTimes />
          </button>
        </div>

        <ElencoVersamenti versamenti={versamenti} />

        <div className="qta-finestra-piede">
          <span>Totale versato</span>
          <strong>{euro(totale)}</strong>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * I versamenti, dal più recente.
 *
 * Un pezzo a sé perché lo mostrano in due: la finestra che si apre dalla
 * fascia della quota e la pagina "Quota e versamenti". Scritto due volte,
 * il giorno che cambia il modo di mostrare un rimborso cambierebbe in uno
 * solo dei due posti.
 */
export function ElencoVersamenti({ versamenti }) {
  const perAnno = raggruppaPerAnno(versamenti);

  return (
    <div className="qta-anni">
      {perAnno.map(({ anno, righe, totale }) => (
        <section key={anno}>
          {/* L'anno come intestazione, con il suo totale.

              La quota è di una stagione, i versamenti si accumulano per
              sempre: senza l'anno davanti, tre bonifici del 2025 e due del
              2026 sono un elenco solo, e "quanto ho pagato quest'anno" non
              si risponde più. */}
          <h3 className="qta-anno">
            <span>{anno}</span>
            <span className="qta-anno-totale">{euro(totale)}</span>
          </h3>

          <ul className="qta-storico">
            {righe.map((v) => (
              <li key={v.id}>
                <span className="qta-storico-importo">{euro(v.importoCentesimi)}</span>

                <span className="qta-storico-testi">
                  <span className="qta-storico-quando">{giorno(v.pagatoIl)}</span>
                  <span className="qta-storico-come">
                    {NOME_METODO[v.metodo] ?? v.metodo}
                    {v.causale && ` · ${v.causale}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
