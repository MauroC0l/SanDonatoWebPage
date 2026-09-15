import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaExclamationCircle, FaReceipt, FaInfoCircle } from "react-icons/fa";
import { getIscrizione, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import { euro } from "../../utils/soldi";
import RiquadroQuota, { ElencoVersamenti } from "./RiquadroQuota";
import "../../css/Admin.css";
import "../../css/Quota.css";

/**
 * Quota e versamenti: quanto si deve, quanto si è versato, quando.
 *
 * Una pagina sua e non una fascia in cima all'iscrizione: è la domanda che
 * una famiglia viene a fare più spesso di tutte — "siamo in regola?" — e
 * meritava un posto dove si arriva in un clic invece che scorrendo un
 * modulo di anagrafica.
 *
 * Si legge e basta. Non c'è niente da compilare qui: l'unica cosa che si
 * può fare è pagare, e lo fa il pulsante dentro alla fascia.
 */
export default function QuotaPage() {
  const navigate = useNavigate();
  const { sessionExpired } = useAuth();
  const { avvisa } = useDialoghi();

  const [iscrizione, setIscrizione] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    setErrore(err.message || "Operazione non riuscita.");
    avvisa(err.message || "Operazione non riuscita.", "errore");
  }, [navigate, sessionExpired, avvisa]);

  useEffect(() => {
    let attivo = true;

    getIscrizione()
      .then((i) => {
        if (!attivo) return;
        setIscrizione(i);
        setCaricamento(false);
      })
      .catch((err) => {
        if (!attivo) return;
        gestisciErrore(err);
        setCaricamento(false);
      });

    return () => { attivo = false; };
  }, [gestisciErrore]);

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Carico la tua quota…</p>
      </div>
    );
  }

  const versamenti = iscrizione?.pagamenti ?? [];

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">Quota e versamenti</h1>
          <p className="adm-page-sub">
            A che punto sei con la quota di quest&apos;anno.
          </p>
        </div>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {/* La fascia senza il pulsante "tutti i versamenti": l'elenco è
          qui sotto, e una finestra che lo ripete coprirebbe la pagina per
          mostrare quello che c'era già. */}
      <RiquadroQuota iscrizione={iscrizione} conStorico={false} />

      <section className="adm-panel">
        <h2 className="adm-panel-title">
          <FaReceipt aria-hidden="true" /> I tuoi versamenti
        </h2>

        {versamenti.length === 0 ? (
          <p className="adm-hint">
            Non risulta ancora nessun versamento. Se hai pagato da poco,
            aspetta che l&apos;incasso venga registrato: compare qui da solo.
          </p>
        ) : (
          <>
            <ElencoVersamenti versamenti={versamenti} />

            <div className="qta-finestra-piede">
              <span>Totale versato</span>
              <strong>{euro(iscrizione?.versatoCentesimi ?? 0)}</strong>
            </div>
          </>
        )}

        {/* Chi ha pagato in contanti o con un bonifico non si vede comparire
            niente: meglio dirlo qui che lasciarlo scoprire. */}
        <p className="adm-hint">
          <FaInfoCircle aria-hidden="true" /> Se qualcosa non torna, scrivi
          alla segreteria: i versamenti li registra il sistema di pagamento, e
          nessuno li corregge a mano.
        </p>
      </section>
    </div>
  );
}
