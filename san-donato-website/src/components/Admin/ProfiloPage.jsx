import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaUserCircle, FaSave, FaKey, FaLock, FaUsers, FaClock,
  FaExclamationCircle, FaHourglassHalf, FaCheckCircle, FaTimesCircle,
  FaCamera, FaTrash, FaEuroSign
} from "react-icons/fa";
import { getProfilo, getIscrizione, aggiornaProfilo, uploadMedia, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import { areaDi } from "../../utils/percorsi";
import Ritratto from "./Ritratto";
import "../../css/Admin.css";
import "../../css/Ritratto.css";
import "../../css/Profilo.css";

const NOME_RUOLO = {
  admin: "Amministratore",
  segreteria: "Segreteria",
  editor: "Redattore",
  coach: "Allenatore",
  atleta: "Atleta"
};

const NOME_STATO = {
  attivo: "Attivo",
  in_attesa: "In attesa di una squadra",
  sospeso: "Sospeso"
};

function dataLunga(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit", month: "long", year: "numeric"
  });
}

/*
 * Le date della stagione come si dicono: "1° luglio 2026", con l'ordinale
 * sul primo del mese come si scrive in italiano. Arrivano come
 * "2026-07-01", un giorno e basta: si leggono a pezzi e non con new Date(),
 * che le prenderebbe per la mezzanotte UTC e in certi fusi orari le
 * sposterebbe al giorno prima.
 */
const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"
];

function giornoStagione(iso) {
  const [anno, mese, giorno] = String(iso ?? "").slice(0, 10).split("-").map(Number);
  if (!anno || !mese || !giorno) return null;
  return `${giorno === 1 ? "1°" : giorno} ${MESI[mese - 1]} ${anno}`;
}

/**
 * A che punto è l'iscrizione alla stagione, se non è quella normale.
 *
 * "statoStagione" è il dato nuovo; "ritirato" c'era prima, e resta come
 * ripiego finché il server non manda l'altro.
 */
function statoStagione(iscrizione) {
  const stato = iscrizione.statoStagione ?? (iscrizione.ritirato ? "ritirata" : "attiva");
  if (stato === "ritirata") {
    const il = giornoStagione(iscrizione.ritiratoIl);
    return { testo: il ? `Ritirato il ${il}` : "Ritirato", classe: "adm-status-draft" };
  }
  if (stato === "abbandonata") {
    return { testo: "Iscrizione abbandonata: contatta la segreteria", classe: "adm-status-respinta" };
  }
  return null;
}

/*
 * Vincoli sull'immagine del profilo, controllati prima di caricare.
 *
 * Il server ha i suoi, ed è lì che contano davvero. Questi servono a non
 * far aspettare la salita di otto megabyte a chi sta per sentirsi dire di
 * no: da un telefono, con la rete della palestra, è un minuto buttato.
 */
const TIPI_IMMAGINE = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const BYTE_MASSIMI_IMMAGINE = 8 * 1024 * 1024;

/** Riga "etichetta: valore" della scheda in sola lettura. */
function Dato({ etichetta, children }) {
  return (
    <div className="adm-dato">
      <dt className="adm-dato-etichetta">{etichetta}</dt>
      <dd className="adm-dato-valore">{children}</dd>
    </div>
  );
}

/**
 * La propria scheda: quello che il sito sa di te, e i campi che puoi
 * correggere da solo.
 *
 * Prima non esisteva: chi entrava trovava il proprio nome scritto in un
 * angolo della barra e nessun modo di cambiarlo. Per un refuso nel cognome
 * bisognava chiedere a un amministratore.
 */
export default function ProfiloPage() {
  const navigate = useNavigate();
  const { user, ricarica, sessionExpired } = useAuth();
  const { avvisa } = useDialoghi();

  const [profilo, setProfilo] = useState(null);
  const [form, setForm] = useState({ nome: "", cognome: "", email: "" });
  const [caricamento, setCaricamento] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [immagineInCorso, setImmagineInCorso] = useState(false);
  const [errore, setErrore] = useState("");
  const [iscrizione, setIscrizione] = useState(null);

  // Chi aspetta una squadra legge e basta: il server rifiuterebbe comunque
  // la modifica, e mostrare campi che non si possono salvare è una presa in giro.
  const inAttesa = profilo?.stato === "in_attesa";

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

    getProfilo()
      .then((p) => {
        if (!attivo) return;
        setProfilo(p);
        setForm({ nome: p.nome ?? "", cognome: p.cognome ?? "", email: p.email });
        setCaricamento(false);
      })
      .catch((err) => {
        if (!attivo) return;
        gestisciErrore(err);
        setCaricamento(false);
      });

    return () => { attivo = false; };
  }, [gestisciErrore]);

  /* La stagione a cui si è iscritti: solo per chi un'iscrizione ce l'ha
     (atleti e allenatori). È un di più rispetto al profilo, quindi se la
     chiamata non riesce la riga semplicemente non c'è: un errore in cima
     alla pagina per un dato secondario spaventerebbe per niente. */
  const conIscrizione = user?.capabilities?.includes("iscrizione.propria") ?? false;

  useEffect(() => {
    if (!conIscrizione) return undefined;
    let attivo = true;

    getIscrizione()
      .then((i) => { if (attivo) setIscrizione(i); })
      .catch(() => { if (attivo) setIscrizione(null); });

    return () => { attivo = false; };
  }, [conIscrizione]);

  /**
   * Carica la foto e la collega al proprio account.
   *
   * Due passaggi distinti — prima il file nell'archivio, poi
   * l'identificativo sul profilo — perché sono due cose che possono
   * fallire separatamente: se il secondo non riesce, il file resta
   * caricato e basta riprovare a collegarlo, invece di ricaricarlo.
   */
  const cambiaImmagine = async (evento) => {
    const file = evento.target.files?.[0];
    // Il campo si svuota subito: senza, riscegliere lo stesso file dopo un
    // errore non farebbe scattare niente.
    evento.target.value = "";
    if (!file) return;

    if (!TIPI_IMMAGINE.includes(file.type)) {
      avvisa("La foto deve essere un'immagine JPEG, PNG, WebP o AVIF.", "errore");
      return;
    }
    if (file.size > BYTE_MASSIMI_IMMAGINE) {
      avvisa("La foto supera gli 8 MB. Scattane una più piccola o ridimensionala.", "errore");
      return;
    }

    setImmagineInCorso(true);
    try {
      const caricata = await uploadMedia(file, {
        title: `Foto del profilo di ${profilo.nomeCompleto}`,
        cartella: "profili",
        tag: ["profilo"]
      });
      const aggiornato = await aggiornaProfilo({ immagineId: caricata.id });
      setProfilo(aggiornato);
      await ricarica();
      avvisa("Foto aggiornata.");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setImmagineInCorso(false);
    }
  };

  const togliImmagine = async () => {
    setImmagineInCorso(true);
    try {
      // Solo il collegamento: il file resta nell'archivio. Cancellarlo
      // sarebbe irreversibile per un gesto che spesso è un ripensamento.
      const aggiornato = await aggiornaProfilo({ immagineId: null });
      setProfilo(aggiornato);
      await ricarica();
      avvisa("Foto rimossa.");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setImmagineInCorso(false);
    }
  };

  const salva = async (evento) => {
    evento.preventDefault();
    setErrore("");
    setSalvataggio(true);

    try {
      const aggiornato = await aggiornaProfilo({
        nome: form.nome.trim(),
        cognome: form.cognome.trim(),
        email: form.email.trim().toLowerCase()
      });

      // La risposta è il profilo riletto per intero, non le sole colonne
      // scritte: si sostituisce, non si fonde.
      setProfilo(aggiornato);

      // Il nome compare anche nella barra in alto, che lo prende dalla
      // sessione: senza questa rilettura resterebbe quello vecchio.
      await ricarica();

      avvisa("Dati aggiornati.");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento del profilo…</p>
      </div>
    );
  }

  if (!profilo) {
    return (
      <div className="adm-alert adm-alert-error" role="alert">
        <FaExclamationCircle /> <span>{errore || "Profilo non disponibile."}</span>
      </div>
    );
  }

  const cambiato =
    form.nome.trim() !== (profilo.nome ?? "") ||
    form.cognome.trim() !== (profilo.cognome ?? "") ||
    form.email.trim().toLowerCase() !== profilo.email;

  const appartenenza = profilo.appartenenza;

  const stagione = conIscrizione ? iscrizione?.stagione ?? null : null;
  const statoIscrizione = stagione ? statoStagione(iscrizione) : null;

  // Richiesta respinta: il messaggio in cima cambia, e il riquadro "la tua
  // squadra" non lo ripete più in fondo alla pagina.
  const respinta = appartenenza?.stato === "rifiutata";

  return (
    <div className="adm-page adm-profilo">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">Il tuo profilo</h1>
          <p className="adm-page-sub">
            I tuoi dati sul sito. Quelli sportivi li gestisce la segreteria.
          </p>
        </div>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {/* Due messaggi diversi per due situazioni diverse, e mai insieme.
          Chi è stato respinto non "aspetta" più niente: dirgli che la
          richiesta è in corso sarebbe falso, e per giunta lo rimanderebbe a
          controllare una pagina che non cambierà. */}
      {inAttesa && (respinta ? (
        <div className="adm-alert adm-alert-error" role="status">
          <FaTimesCircle />
          <span>
            La richiesta per {appartenenza.sport} è stata respinta
            {appartenenza.motivoRifiuto ? `: ${appartenenza.motivoRifiuto}` : "."}
            {" "}Per rifarla, parlane con la segreteria.
          </span>
        </div>
      ) : (
        <div className="adm-alert adm-alert-info">
          <FaHourglassHalf />
          <span>
            La tua richiesta è in attesa: puoi controllare i dati che hai
            inserito, ma non modificarli. Appena l&apos;allenatore o la
            segreteria ti assegnano una squadra, questa pagina si sblocca.
          </span>
        </div>
      ))}

      <div className="adm-editor-grid">
        <div className="adm-editor-col">
          <section className="adm-panel">
            <h2 className="adm-panel-title">
              <FaUserCircle aria-hidden="true" /> Dati personali
            </h2>

            {/* La foto sta qui e non in fondo: è la prima cosa che si
                riconosce di sé in un elenco, ed è anche la più veloce da
                sistemare. */}
            <div className="adm-ritratto-scelta">
              <Ritratto
                nome={profilo.nomeCompleto}
                url={profilo.immagineUrl}
                dimensione="xl"
                className="rit-bordo"
              />

              <div className="adm-ritratto-azioni">
                <p className="adm-hint" style={{ marginTop: 0 }}>
                  {inAttesa
                    ? "La foto si potrà cambiare appena la richiesta viene accolta."
                    : "Ti riconoscono da questa negli elenchi e nelle convocazioni. Al posto suo, finché non c'è, restano le tue iniziali."}
                </p>

                {!inAttesa && (
                  <div className="adm-head-actions">
                    <label className={`adm-btn adm-btn-secondary ${immagineInCorso ? "is-disabilitato" : ""}`}>
                      <FaCamera />
                      {immagineInCorso
                        ? "Caricamento…"
                        : (profilo.immagineUrl ? "Cambia foto" : "Scegli una foto")}
                      {/* Un input nascosto dentro una label: il campo file
                          del browser non si può vestire, e un pulsante che
                          lo apre con un click sintetico non funziona su
                          tutti i telefoni. */}
                      <input
                        type="file"
                        accept={TIPI_IMMAGINE.join(",")}
                        onChange={cambiaImmagine}
                        disabled={immagineInCorso}
                        hidden
                      />
                    </label>

                    {profilo.immagineUrl && (
                      <button
                        type="button"
                        className="adm-btn adm-btn-ghost"
                        onClick={togliImmagine}
                        disabled={immagineInCorso}
                      >
                        <FaTrash /> Togli
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {inAttesa ? (
              <dl className="adm-dati">
                <Dato etichetta="Nome">{profilo.nome || <em>non indicato</em>}</Dato>
                <Dato etichetta="Cognome">{profilo.cognome || <em>non indicato</em>}</Dato>
                <Dato etichetta="Email">{profilo.email}</Dato>
              </dl>
            ) : (
              <form onSubmit={salva}>
                <div className="adm-due-colonne">
                  <label className="adm-field">
                    <span className="adm-label">Nome</span>
                    <input
                      type="text"
                      className="adm-input"
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      maxLength={80}
                      disabled={salvataggio}
                    />
                  </label>

                  <label className="adm-field">
                    <span className="adm-label">Cognome</span>
                    <input
                      type="text"
                      className="adm-input"
                      value={form.cognome}
                      onChange={(e) => setForm({ ...form, cognome: e.target.value })}
                      maxLength={80}
                      disabled={salvataggio}
                    />
                  </label>
                </div>

                <label className="adm-field">
                  <span className="adm-label">Email</span>
                  <input
                    type="email"
                    className="adm-input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    maxLength={255}
                    disabled={salvataggio}
                    required
                  />
                  <span className="adm-hint">
                    È anche il nome con cui entri: cambiandola, il prossimo
                    accesso va fatto con quella nuova.
                  </span>
                </label>

                <div className="adm-head-actions">
                  <button
                    type="submit"
                    className="adm-btn adm-btn-primary"
                    disabled={salvataggio || !cambiato}
                  >
                    <FaSave /> {salvataggio ? "Salvataggio…" : "Salva le modifiche"}
                  </button>
                </div>
              </form>
            )}
          </section>

          {!inAttesa && (
            <section className="adm-panel">
              <h2 className="adm-panel-title">
                <FaLock aria-hidden="true" /> Accesso
              </h2>
              <p className="adm-hint" style={{ marginTop: 0 }}>
                Cambiando la password vengono chiuse tutte le altre sessioni
                aperte con questo account, su qualunque dispositivo. Questa no.
              </p>
              {/* Il cambio password vive in due posti diversi a seconda
                  dell'area: sotto /admin per chi amministra, dentro
                  /area-riservata per gli atleti. */}
              <Link to={`${areaDi(profilo.ruolo)}/password`} className="adm-btn adm-btn-secondary">
                <FaKey /> Cambia la password
              </Link>
            </section>
          )}
        </div>

        <aside className="adm-editor-side">
          <section className="adm-panel">
            <h2 className="adm-panel-title">Il tuo account</h2>

            <dl className="adm-dati">
              <Dato etichetta="Ruolo">
                <span className="adm-role-tag">{NOME_RUOLO[profilo.ruolo] ?? profilo.ruolo}</span>
              </Dato>

              <Dato etichetta="Stato">
                <span className={`adm-status ${profilo.stato === "attivo" ? "adm-status-publish" : "adm-status-draft"}`}>
                  {NOME_STATO[profilo.stato] ?? profilo.stato}
                </span>
              </Dato>

              <Dato etichetta="Iscritto dal">{dataLunga(profilo.creatoIl)}</Dato>

              {/* Il periodo per esteso e non il solo "2026/27": è da lì
                  che si capisce fin quando vale la quota di quest'anno. */}
              {stagione && (
                <Dato etichetta="Stagione">
                  <span className="prf-stagione">
                    <strong>{stagione.nome}</strong>
                    {giornoStagione(stagione.inizio) && giornoStagione(stagione.fine) && (
                      <span className="prf-stagione-periodo">
                        dal {giornoStagione(stagione.inizio)} al {giornoStagione(stagione.fine)}
                      </span>
                    )}
                    {statoIscrizione && (
                      <span className={`adm-status ${statoIscrizione.classe}`}>{statoIscrizione.testo}</span>
                    )}
                  </span>
                </Dato>
              )}

              <Dato etichetta="Ultimo accesso">
                {profilo.ultimoAccesso
                  ? <><FaClock aria-hidden="true" /> {dataLunga(profilo.ultimoAccesso)}</>
                  : <em>questo è il primo</em>}
              </Dato>
            </dl>
          </section>

          {/* Niente riquadro quando la richiesta è stata respinta: quel caso
              lo racconta già l'avviso in cima, e ripeterlo qui sotto darebbe
              due volte la stessa brutta notizia. */}
          {appartenenza && !respinta && (
            <section className="adm-panel">
              <h2 className="adm-panel-title">La tua squadra</h2>

              {appartenenza.stato === "approvata" && (
                <p className="adm-esito-riga adm-esito-ok">
                  <FaCheckCircle aria-hidden="true" />
                  <span>Sei in <strong>{appartenenza.squadra}</strong> ({appartenenza.sport}).</span>
                </p>
              )}

              {appartenenza.stato === "in_attesa" && (
                <p className="adm-esito-riga adm-esito-attesa">
                  <FaHourglassHalf aria-hidden="true" />
                  <span>
                    Hai chiesto <strong>{appartenenza.sport}</strong> il{" "}
                    {dataLunga(appartenenza.richiestaIl)}. Manca l&apos;assegnazione
                    della squadra.
                  </span>
                </p>
              )}

            </section>
          )}

          {/* Le regole della quota, scritte una volta sola dove si cercano:
              la pagina della quota mostra i numeri, ma non dice perché la
              seconda metà compare barrata o perché le due metà differiscono
              di un centesimo. Solo per chi la quota la versa (atleti e
              allenatori): a chi amministra e basta non serve. */}
          {user?.capabilities?.includes("iscrizione.propria") && (
            <section className="adm-panel prf-quota">
              <h2 className="adm-panel-title">
                <FaEuroSign aria-hidden="true" /> Come funziona la quota
              </h2>
              <ul className="prf-quota-punti">
                <li>
                  La stagione va dal <strong>1° luglio</strong> al <strong>30 giugno</strong> dell&apos;anno dopo.
                </li>
                <li>
                  La quota è divisa in <strong>due metà</strong>: la prima va versata il
                  prima possibile, la seconda è dovuta da gennaio.
                </li>
                <li>
                  Puoi versarla <strong>tutta subito</strong>, in una volta sola,
                  oppure in due metà: quando paghi scegli tu quanto versare.
                </li>
                <li>
                  Se smetti prima del 1° gennaio, la seconda metà non la devi: nella
                  pagina della quota la vedrai barrata.
                </li>
              </ul>
            </section>
          )}

          {profilo.squadreGestite.length > 0 && (
            <section className="adm-panel">
              <h2 className="adm-panel-title">
                <FaUsers aria-hidden="true" /> Squadre che gestisci
              </h2>
              <div className="adm-squadre-riga">
                {profilo.squadreGestite.map((s) => (
                  <span key={s.id} className="adm-chip adm-chip-squadra adm-chip-statico">
                    {s.colore && (
                      <span
                        className="tnd-pallino"
                        style={{ backgroundColor: s.colore }}
                        aria-hidden="true"
                      />
                    )}
                    {s.nome}
                  </span>
                ))}
              </div>
              <p className="adm-hint">
                L&apos;elenco lo cambia un amministratore, dalla sezione Utenti.
              </p>
            </section>
          )}

          {user?.role === "atleta" && profilo.squadreGestite.length === 0 && !appartenenza && (
            <p className="adm-hint">
              Non risulta nessuna richiesta di iscrizione collegata a questo
              account.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
