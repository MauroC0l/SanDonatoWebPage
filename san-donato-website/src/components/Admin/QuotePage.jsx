import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaEuroSign, FaPlus, FaPencilAlt, FaSave, FaTimes, FaTrashAlt,
  FaExclamationCircle, FaEye, FaEyeSlash, FaUsers
} from "react-icons/fa";
import {
  listTariffe, creaTariffa, aggiornaTariffa, eliminaTariffa, AuthError
} from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import { euro, daCampo, versoCampo } from "../../utils/soldi";
import "../../css/Admin.css";

/**
 * Le tariffe della stagione.
 *
 * Prima la quota si batteva a mano su ogni scheda: sessanta importi scritti
 * uno per uno, con gli inevitabili 200 al posto di 250 e gli sconti
 * applicati a memoria. E alla domanda "quanti hanno lo sconto fratello" non
 * c'era modo di rispondere: la cifra c'era, il perché no.
 *
 * Qui si decidono una volta, e chi assegna sceglie fra queste.
 *
 * CAMBIARE UNA TARIFFA NON RITOCCA LE QUOTE GIÀ ASSEGNATE. Sono accordi
 * presi con le famiglie: riscriverli tutti insieme perché il consiglio ha
 * ritoccato il listino a gennaio vorrebbe dire quaranta persone che di colpo
 * devono di più senza che nessuno gliel'abbia detto.
 */

const VUOTA = { nome: "", descrizione: "", importo: "", ordine: "" };

export default function QuotePage() {
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();
  const { avvisa, conferma } = useDialoghi();

  // Le tariffe le legge chi assegna le quote, le decide chi amministra.
  const puoDecidere = (user?.capabilities ?? []).includes("quote.tariffe");

  const [tariffe, setTariffe] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");

  const [nuova, setNuova] = useState(null);
  const [modifica, setModifica] = useState(null);
  const [occupato, setOccupato] = useState(false);

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    setErrore(err.message || "Operazione non riuscita.");
    avvisa(err.message || "Operazione non riuscita.", "errore");
  }, [navigate, sessionExpired, avvisa]);

  const ricarica = useCallback(() => {
    return listTariffe()
      .then((elenco) => {
        setTariffe(elenco);
        setErrore("");
        setCaricamento(false);
      })
      .catch((err) => {
        gestisciErrore(err);
        setCaricamento(false);
      });
  }, [gestisciErrore]);

  useEffect(() => { ricarica(); }, [ricarica]);

  /* ---------- Scritture ---------- */

  const salvaNuova = async (evento) => {
    evento.preventDefault();

    const importoCentesimi = daCampo(nuova.importo);
    if (importoCentesimi == null) {
      avvisa("Scrivi l'importo, per esempio 250,00.", "errore");
      return;
    }

    setOccupato(true);
    try {
      await creaTariffa({
        nome: nuova.nome.trim(),
        descrizione: nuova.descrizione.trim() || undefined,
        importoCentesimi,
        ordine: Number(nuova.ordine) || 0
      });

      setNuova(null);
      await ricarica();
      avvisa("Tariffa creata.");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setOccupato(false);
    }
  };

  const salvaModifica = async (evento) => {
    evento.preventDefault();

    const importoCentesimi = daCampo(modifica.importo);
    if (importoCentesimi == null) {
      avvisa("Scrivi l'importo, per esempio 250,00.", "errore");
      return;
    }

    setOccupato(true);
    try {
      await aggiornaTariffa(modifica.id, {
        nome: modifica.nome.trim(),
        descrizione: modifica.descrizione.trim(),
        importoCentesimi,
        ordine: Number(modifica.ordine) || 0
      });

      setModifica(null);
      await ricarica();
      avvisa("Tariffa aggiornata. Le quote già assegnate restano quelle.");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setOccupato(false);
    }
  };

  const cambiaStato = async (t) => {
    setOccupato(true);
    try {
      await aggiornaTariffa(t.id, { attiva: !t.attiva });
      await ricarica();
      avvisa(t.attiva
        ? `"${t.nome}" non si può più scegliere. Chi ce l'ha la tiene.`
        : `"${t.nome}" torna fra le scelte.`, "info");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setOccupato(false);
    }
  };

  const cancella = async (t) => {
    const ok = await conferma({
      titolo: `Eliminare "${t.nome}"?`,
      testo: t.quanti > 0
        ? `Ce l'hanno ${t.quanti} atleti: non si può cancellare. Conviene spegnerla.`
        : "Nessuno la sta usando, quindi si può togliere. Questa non si annulla.",
      conferma: "Elimina",
      pericolo: true
    });
    if (!ok) return;

    try {
      await eliminaTariffa(t.id);
      await ricarica();
      avvisa("Tariffa eliminata.", "info");
    } catch (err) {
      gestisciErrore(err);
    }
  };

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento delle tariffe…</p>
      </div>
    );
  }

  const assegnate = tariffe.reduce((s, t) => s + t.quanti, 0);

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">Quote</h1>
          <p className="adm-page-sub">
            Le tariffe della stagione. Chi assegna una quota sceglie fra
            queste, invece di battere un importo a mano.
          </p>
        </div>

        {puoDecidere && !nuova && (
          <div className="adm-head-actions">
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={() => setNuova({ ...VUOTA, ordine: String(tariffe.length + 1) })}
            >
              <FaPlus /> Nuova tariffa
            </button>
          </div>
        )}
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {!puoDecidere && (
        <div className="adm-alert adm-alert-info">
          <FaExclamationCircle />
          <span>
            Le tariffe le decide chi amministra il sito. Da qui le puoi
            leggere, e le trovi fra le scelte quando assegni una quota.
          </span>
        </div>
      )}

      {/* ---------- Nuova ---------- */}
      {nuova && (
        <form className="adm-panel" onSubmit={salvaNuova}>
          <h2 className="adm-panel-title">
            <FaEuroSign aria-hidden="true" /> Nuova tariffa
          </h2>

          <div className="adm-due-colonne">
            <label className="adm-field">
              <span className="adm-label">Come si chiama</span>
              <input
                type="text"
                className="adm-input"
                value={nuova.nome}
                onChange={(e) => setNuova({ ...nuova, nome: e.target.value })}
                placeholder="Es. Prima iscrizione"
                maxLength={80}
                disabled={occupato}
                required
              />
            </label>

            <label className="adm-field">
              <span className="adm-label">Quanto</span>
              <input
                type="text"
                inputMode="decimal"
                className="adm-input"
                value={nuova.importo}
                onChange={(e) => setNuova({ ...nuova, importo: e.target.value })}
                placeholder="Es. 250,00"
                disabled={occupato}
                required
              />
            </label>
          </div>

          <label className="adm-field">
            <span className="adm-label">A chi si applica <em>(facoltativo)</em></span>
            <input
              type="text"
              className="adm-input"
              value={nuova.descrizione}
              onChange={(e) => setNuova({ ...nuova, descrizione: e.target.value })}
              placeholder="Es. dal secondo figlio iscritto in poi"
              maxLength={300}
              disabled={occupato}
            />
            <span className="adm-hint">
              Lo legge chi assegna la quota, nel momento in cui sceglie.
            </span>
          </label>

          <div className="adm-head-actions">
            <button type="submit" className="adm-btn adm-btn-primary" disabled={occupato}>
              <FaSave /> Crea
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              onClick={() => setNuova(null)}
              disabled={occupato}
            >
              <FaTimes /> Annulla
            </button>
          </div>
        </form>
      )}

      {/* ---------- Elenco ---------- */}
      {tariffe.length === 0 ? (
        <div className="adm-empty">
          <FaEuroSign className="adm-empty-icon" />
          <p>
            Non c&apos;è ancora nessuna tariffa. Finché non ne esiste una, le
            quote non si possono assegnare.
          </p>
        </div>
      ) : (
        <>
          <ul className="adm-schede">
            {tariffe.map((t) => {
              const inModifica = modifica?.id === t.id;

              return (
                <li key={t.id} className={`adm-scheda ${t.attiva ? "" : "is-disattivato"}`}>
                  {inModifica ? (
                    <form onSubmit={salvaModifica}>
                      <div className="adm-due-colonne">
                        <label className="adm-field">
                          <span className="adm-label">Come si chiama</span>
                          <input
                            type="text"
                            className="adm-input"
                            value={modifica.nome}
                            onChange={(e) => setModifica({ ...modifica, nome: e.target.value })}
                            maxLength={80}
                            disabled={occupato}
                            required
                          />
                        </label>

                        <label className="adm-field">
                          <span className="adm-label">Quanto</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="adm-input"
                            value={modifica.importo}
                            onChange={(e) => setModifica({ ...modifica, importo: e.target.value })}
                            disabled={occupato}
                            required
                          />
                        </label>
                      </div>

                      <label className="adm-field">
                        <span className="adm-label">A chi si applica</span>
                        <input
                          type="text"
                          className="adm-input"
                          value={modifica.descrizione}
                          onChange={(e) => setModifica({ ...modifica, descrizione: e.target.value })}
                          maxLength={300}
                          disabled={occupato}
                        />
                      </label>

                      {t.quanti > 0 && (
                        <p className="adm-hint">
                          Ce l&apos;hanno {t.quanti} atleti: cambiando l&apos;importo, le
                          loro quote <strong>restano quelle già concordate</strong>.
                          Il nuovo vale da qui in avanti.
                        </p>
                      )}

                      <div className="adm-head-actions">
                        <button type="submit" className="adm-btn adm-btn-primary" disabled={occupato}>
                          <FaSave /> Salva
                        </button>
                        <button
                          type="button"
                          className="adm-btn adm-btn-ghost"
                          onClick={() => setModifica(null)}
                          disabled={occupato}
                        >
                          <FaTimes /> Annulla
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="qta-tariffa">
                      <div className="qta-tariffa-chi">
                        <span className="qta-tariffa-nome">
                          {t.nome}
                          {!t.attiva && <span className="adm-status adm-status-draft">Spenta</span>}
                        </span>
                        {t.descrizione && (
                          <span className="qta-tariffa-nota">{t.descrizione}</span>
                        )}
                      </div>

                      <span className="qta-tariffa-importo">{euro(t.importoCentesimi)}</span>

                      <span className="qta-tariffa-quanti">
                        <FaUsers aria-hidden="true" />
                        {t.quanti === 0 ? "nessuno" : t.quanti === 1 ? "1 atleta" : `${t.quanti} atleti`}
                      </span>

                      {puoDecidere && (
                        <div className="qta-tariffa-azioni">
                          <button
                            type="button"
                            className="adm-icon-btn"
                            onClick={() => setModifica({
                              id: t.id,
                              nome: t.nome,
                              descrizione: t.descrizione ?? "",
                              importo: versoCampo(t.importoCentesimi),
                              ordine: String(t.ordine)
                            })}
                            title="Modifica"
                            aria-label={`Modifica ${t.nome}`}
                          >
                            <FaPencilAlt />
                          </button>

                          <button
                            type="button"
                            className="adm-icon-btn"
                            onClick={() => cambiaStato(t)}
                            disabled={occupato}
                            title={t.attiva ? "Spegni: smette di comparire fra le scelte" : "Riaccendi"}
                            aria-label={t.attiva ? `Spegni ${t.nome}` : `Riaccendi ${t.nome}`}
                          >
                            {t.attiva ? <FaEyeSlash /> : <FaEye />}
                          </button>

                          <button
                            type="button"
                            className="adm-icon-btn adm-icon-danger"
                            onClick={() => cancella(t)}
                            disabled={occupato || t.quanti > 0}
                            title={t.quanti > 0
                              ? "Ce l'hanno degli atleti: si può solo spegnere"
                              : "Elimina"}
                            aria-label={`Elimina ${t.nome}`}
                          >
                            <FaTrashAlt />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="adm-hint">
            {assegnate === 0
              ? "Nessuna quota assegnata finora."
              : `${assegnate} quote assegnate con queste tariffe.`}
          </p>
        </>
      )}
    </div>
  );
}
