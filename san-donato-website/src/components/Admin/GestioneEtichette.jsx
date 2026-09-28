import { useEffect, useRef, useState } from "react";
import { FaTags, FaPlus, FaPencilAlt, FaTrashAlt, FaCheck, FaTimes } from "react-icons/fa";
import {
  listEtichette, creaEtichetta, rinominaEtichetta, eliminaEtichetta
} from "../../api/adminApi";
import { useDialoghi } from "../../context/dialoghi";
import "../../css/Dialoghi.css";
import "../../css/Etichette.css";

/**
 * La finestra per gestire le etichette delle notizie: aggiungerle,
 * rinominarle, cancellarle.
 *
 * Si apre dall'editor, accanto al campo "Etichette", perché è lì che ci si
 * accorge che ne manca una o che una ha il nome sbagliato. Chiudendola,
 * l'editor rilegge l'elenco (onChiudi) e toglie dalla notizia quelle che
 * nel frattempo sono state cancellate.
 *
 * Rinominare e cancellare toccano TUTTE le notizie che hanno quell'etichetta,
 * comprese quelle online: per questo il server lo permette solo a chi può
 * pubblicare, e la cancellazione dice prima quante notizie coinvolge.
 */
export default function GestioneEtichette({ onChiudi, puoModificare }) {
  const { avvisa, conferma } = useDialoghi();

  const [etichette, setEtichette] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [nuova, setNuova] = useState("");
  const [inModifica, setInModifica] = useState(null); // { id, nome }
  const [occupato, setOccupato] = useState(false);
  const campoNuova = useRef(null);

  const ricarica = () => listEtichette()
    .then((elenco) => { setEtichette(elenco); setCaricamento(false); })
    .catch((err) => { avvisa(err.message || "Etichette non caricate.", "errore"); setCaricamento(false); });

  useEffect(() => {
    ricarica();
    campoNuova.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc chiude, come ogni finestra del pannello
  useEffect(() => {
    const tasto = (e) => {
      if (e.key !== "Escape") return;
      // Una conferma aperta sopra: Esc è suo, non di questa finestra
      if (document.querySelector(".dlg-velo")) return;
      // Con una rinomina aperta, Esc annulla quella e basta
      if (inModifica) setInModifica(null);
      else onChiudi();
    };
    document.addEventListener("keydown", tasto);
    return () => document.removeEventListener("keydown", tasto);
  }, [inModifica, onChiudi]);

  const esegui = async (azione, messaggio) => {
    setOccupato(true);
    try {
      await azione();
      if (messaggio) avvisa(messaggio, "ok");
      await ricarica();
      return true;
    } catch (err) {
      avvisa(err.message || "Operazione non riuscita.", "errore");
      return false;
    } finally {
      setOccupato(false);
    }
  };

  const aggiungi = async (e) => {
    e.preventDefault();
    const nome = nuova.trim();
    if (nome.length < 2) return;
    if (await esegui(() => creaEtichetta(nome), `Etichetta "${nome}" aggiunta.`)) setNuova("");
  };

  const salvaNome = async (e) => {
    e.preventDefault();
    const nome = inModifica.nome.trim();
    if (nome.length < 2) return;
    if (await esegui(() => rinominaEtichetta(inModifica.id, nome), "Etichetta rinominata.")) {
      setInModifica(null);
    }
  };

  const cancella = async (etichetta) => {
    const ok = await conferma({
      titolo: `Cancellare "${etichetta.nome}"?`,
      testo: etichetta.quante > 0
        ? `La tolgo da ${etichetta.quante === 1 ? "1 notizia" : `${etichetta.quante} notizie`}. Le notizie restano, senza questa etichetta.`
        : "Nessuna notizia la usa.",
      conferma: "Cancella",
      pericolo: true
    });
    if (!ok) return;
    await esegui(() => eliminaEtichetta(etichetta.id), "Etichetta cancellata.");
  };

  /* Disegnata dove sta, dentro all'area riservata, e non in fondo al
     documento: i colori dei campi e dei pulsanti sono definiti sul guscio
     del pannello, e fuori da lì il campo e "Aggiungi" restavano bianchi su
     bianco. Il velo è fisso, quindi copre comunque tutta la pagina. */
  return (
    <div
      className="etc-velo"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onChiudi(); }}
    >
      <div className="dlg-finestra etc-finestra" role="dialog" aria-modal="true" aria-labelledby="etc-titolo">
        <div className="etc-testa">
          <h2 className="dlg-finestra-titolo etc-titolo" id="etc-titolo">
            <FaTags aria-hidden="true" /> Etichette delle notizie
          </h2>
          <button type="button" className="adm-icon-btn" onClick={onChiudi} aria-label="Chiudi">
            <FaTimes />
          </button>
        </div>

        <form className="etc-nuova" onSubmit={aggiungi}>
          <input
            ref={campoNuova}
            type="text"
            className="adm-input"
            value={nuova}
            maxLength={40}
            placeholder="Nuova etichetta, es. Assemblea"
            onChange={(e) => setNuova(e.target.value)}
            disabled={occupato}
            aria-label="Nome della nuova etichetta"
          />
          <button type="submit" className="adm-btn adm-btn-primary" disabled={occupato || nuova.trim().length < 2}>
            <FaPlus /> Aggiungi
          </button>
        </form>

        {caricamento ? (
          <p className="adm-hint">Caricamento…</p>
        ) : etichette.length === 0 ? (
          <p className="adm-hint">Non c&apos;è ancora nessuna etichetta: aggiungi la prima qui sopra.</p>
        ) : (
          <ul className="etc-elenco">
            {etichette.map((e) => (
              <li key={e.id} className="etc-riga">
                {inModifica?.id === e.id ? (
                  <form className="etc-rinomina" onSubmit={salvaNome}>
                    <input
                      type="text"
                      className="adm-input"
                      value={inModifica.nome}
                      maxLength={40}
                      onChange={(ev) => setInModifica({ ...inModifica, nome: ev.target.value })}
                      autoFocus
                      disabled={occupato}
                      aria-label={`Nuovo nome per ${e.nome}`}
                    />
                    <button type="submit" className="adm-icon-btn" disabled={occupato} aria-label="Salva il nome">
                      <FaCheck />
                    </button>
                    <button type="button" className="adm-icon-btn" onClick={() => setInModifica(null)} aria-label="Annulla">
                      <FaTimes />
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="etc-nome">{e.nome}</span>
                    <span className="etc-quante">
                      {e.quante === 0 ? "nessuna notizia" : e.quante === 1 ? "1 notizia" : `${e.quante} notizie`}
                    </span>
                    {puoModificare && (
                      <span className="etc-azioni">
                        <button
                          type="button"
                          className="adm-icon-btn"
                          onClick={() => setInModifica({ id: e.id, nome: e.nome })}
                          disabled={occupato}
                          title="Rinomina"
                          aria-label={`Rinomina ${e.nome}`}
                        >
                          <FaPencilAlt />
                        </button>
                        <button
                          type="button"
                          className="adm-icon-btn adm-icon-danger"
                          onClick={() => cancella(e)}
                          disabled={occupato}
                          title="Cancella"
                          aria-label={`Cancella ${e.nome}`}
                        >
                          <FaTrashAlt />
                        </button>
                      </span>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {!puoModificare && (
          <p className="adm-hint etc-nota">
            Puoi aggiungere etichette nuove. Rinominarle o cancellarle cambia tutte
            le notizie che le usano: lo fa chi può pubblicare.
          </p>
        )}
      </div>
    </div>
  );
}
