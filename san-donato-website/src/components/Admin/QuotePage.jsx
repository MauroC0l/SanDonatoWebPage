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
import "../../css/admin/Persone.css";

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

/* Come si chiama, per chi legge il listino, ciascuna delle automatiche */
const ETICHETTA_AUTOMATICA = {
  prima_iscrizione: "chi la stagione prima non c'era",
  rinnovo: "chi c'era anche la stagione prima",
  famiglia: "fratello o sorella confermati"
};

const VUOTA = { nome: "", descrizione: "", importo: "", ordine: "", perAllenatori: false };

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
        ordine: Number(nuova.ordine) || 0,
        perAllenatori: nuova.perAllenatori
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
        ordine: Number(modifica.ordine) || 0,
        perAllenatori: modifica.perAllenatori
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

  /* Le automatiche (Prima iscrizione, Rinnovo, Famiglia) e quella degli
     allenatori le assegna il sito; le altre si scelgono scheda per scheda */
  /* Quella degli allenatori in fondo: le tre degli atleti sono quelle che
     si guardano di più, e stanno insieme in cima. */
  const automatiche = tariffe
    .filter((t) => t.automatica || t.perAllenatori)
    .sort((a, b) => Number(Boolean(a.perAllenatori)) - Number(Boolean(b.perAllenatori)));
  const aMano = tariffe.filter((t) => !t.automatica && !t.perAllenatori);

  /** Una tariffa del listino, o il suo modulo se la si sta modificando. */
  const disegna = (t) => {
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

            <label className="adm-check">
              <input
                type="checkbox"
                checked={modifica.perAllenatori}
                onChange={(e) => setModifica({ ...modifica, perAllenatori: e.target.checked })}
                disabled={occupato}
              />
              <span className="adm-check-box" aria-hidden="true" />
              <span>
                È la quota degli allenatori
                <em> (se un&apos;altra lo era, smette di esserlo)</em>
              </span>
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

                {/* Si vede senza aprire la modifica: è l'unica
                    tariffa che il sito assegna per conto suo, e
                    chi guarda il listino deve sapere quale. */}
                {t.perAllenatori && (
                  <span className="adm-status adm-status-pending">Allenatori</span>
                )}
                {/* Le tre che il sito assegna da solo: ci sono sempre,
                    si rinominano e se ne cambia l'importo */}
                {t.automatica && (
                  <span
                    className="adm-status adm-status-pending"
                    title={`La assegna il sito da solo: ${ETICHETTA_AUTOMATICA[t.automatica]}`}
                  >
                    Automatica
                  </span>
                )}
              </span>
              {t.descrizione && (
                <span className="qta-tariffa-nota">{t.descrizione}</span>
              )}
              {/* A chi la dà il sito, scritto e non solo in un suggerimento
                  che compare col mouse: sul telefono il mouse non c'è */}
              {(t.automatica || t.perAllenatori) && (
                <span className="prs-tariffa-chi">
                  Il sito la dà {t.automatica
                    ? `a ${ETICHETTA_AUTOMATICA[t.automatica]}`
                    : "agli allenatori, la prima volta che aprono la loro iscrizione"}
                </span>
              )}
            </div>

            <span className="qta-tariffa-importo">{euro(t.importoCentesimi)}</span>

            <span className="qta-tariffa-quanti">
              <FaUsers aria-hidden="true" />
              {t.quanti === 0 ? "nessuno"
                : t.quanti === 1 ? (t.perAllenatori ? "1 allenatore" : "1 atleta")
                  : `${t.quanti} ${t.perAllenatori ? "allenatori" : "atleti"}`}
            </span>

            {/* Pulsanti con la parola scritta: tre icone (matita, occhio,
                cestino) si indovinano, e chi apre questa pagina due volte
                l'anno non deve indovinare. */}
            {puoDecidere && (
              <div className="qta-tariffa-azioni prs-tariffa-azioni">
                <button
                  type="button"
                  className="adm-btn adm-btn-ghost adm-btn-piccolo"
                  onClick={() => setModifica({
                    id: t.id,
                    nome: t.nome,
                    descrizione: t.descrizione ?? "",
                    importo: versoCampo(t.importoCentesimi),
                    ordine: String(t.ordine),
                    perAllenatori: !!t.perAllenatori
                  })}
                  aria-label={`Modifica ${t.nome}`}
                >
                  <FaPencilAlt aria-hidden="true" /> Modifica
                </button>

                <button
                  type="button"
                  className="adm-btn adm-btn-ghost adm-btn-piccolo"
                  onClick={() => cambiaStato(t)}
                  disabled={occupato}
                  title={t.attiva ? "Smette di comparire fra le scelte; chi ce l'ha la tiene" : "Torna fra le scelte"}
                  aria-label={t.attiva ? `Spegni ${t.nome}` : `Riaccendi ${t.nome}`}
                >
                  {t.attiva ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
                  {t.attiva ? " Spegni" : " Riaccendi"}
                </button>

                {/* Le automatiche non si eliminano, e chi è in uso
                    nemmeno: si può solo spegnere */}
                {!t.automatica && (
                  <button
                    type="button"
                    className="adm-btn adm-btn-ghost adm-btn-piccolo adm-btn-cancella"
                    onClick={() => cancella(t)}
                    disabled={occupato || t.quanti > 0}
                    title={t.quanti > 0
                      ? "Ce l'hanno degli atleti: si può solo spegnere"
                      : "Elimina"}
                    aria-label={`Elimina ${t.nome}`}
                  >
                    <FaTrashAlt aria-hidden="true" /> Elimina
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="adm-page prs-pagina">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <p className="adm-occhiello">Soldi</p>
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

          {/* L'unica tariffa che si assegna da sola. Le altre le sceglie
              la segreteria, una scheda alla volta. */}
          <label className="adm-check">
            <input
              type="checkbox"
              checked={nuova.perAllenatori}
              onChange={(e) => setNuova({ ...nuova, perAllenatori: e.target.checked })}
              disabled={occupato}
            />
            <span className="adm-check-box" aria-hidden="true" />
            <span>
              È la quota degli allenatori
              <em> (gliela assegna il sito da solo, la prima volta che aprono la loro iscrizione)</em>
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
          {/* Due gruppi, perché sono due mestieri diversi: quelle che il
              sito assegna da solo — e che quindi non si toccano scheda per
              scheda — e quelle che la segreteria sceglie a mano per i casi
              particolari. Mescolate, non si capiva quali "succedono" e
              quali "si decidono". */}
          {automatiche.length > 0 && (
            <section className="adm-sezione prs-tariffe">
              <div className="adm-sezione-testa">
                <div>
                  <h2 className="adm-sezione-titolo">Le assegna il sito</h2>
                  <p className="adm-sezione-sotto">
                    Ognuno riceve quella giusta quando si iscrive o rinnova.
                    Ci sono sempre: se ne cambiano nome e importo, non si eliminano.
                  </p>
                </div>
              </div>
              <ul className="adm-schede">{automatiche.map(disegna)}</ul>
            </section>
          )}

          <section className="adm-sezione prs-tariffe">
            <div className="adm-sezione-testa">
              <div>
                <h2 className="adm-sezione-titolo">Altre tipologie di quote</h2>
                <p className="adm-sezione-sotto">
                  Per i casi particolari: la segreteria le sceglie dalla scheda
                  dell&apos;atleta, alla voce Quota.
                </p>
              </div>
            </div>
            {aMano.length > 0 ? (
              <ul className="adm-schede">{aMano.map(disegna)}</ul>
            ) : (
              <p className="adm-hint">Nessuna, per ora: bastano quelle automatiche.</p>
            )}
          </section>

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
