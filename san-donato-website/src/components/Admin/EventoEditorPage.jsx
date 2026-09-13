import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft, FaSave, FaExclamationCircle, FaCheckCircle,
  FaImage, FaTrashAlt, FaInfoCircle
} from "react-icons/fa";
import {
  getEvento, createEvento, updateEvento, listSquadre, listEventi,
  collegaMediaEvento, scollegaMediaEvento,
  uploadMedia, AuthError
} from "../../api/adminApi";
import { prepareImage, formatSize } from "../../utils/prepareImage";
import { useAuth } from "../../context/auth";
import "../../css/Admin.css";

const TIPI = [
  { valore: "partita", etichetta: "Partita" },
  { valore: "allenamento", etichetta: "Allenamento" },
  { valore: "torneo", etichetta: "Torneo" },
  { valore: "riunione", etichetta: "Riunione" },
  { valore: "altro", etichetta: "Altro" }
];

const VUOTO = {
  squadraId: "",
  tipo: "partita",
  titolo: "",
  avversario: "",
  inizio: "",
  fine: "",
  tuttoIlGiorno: false,
  luogo: "",
  descrizione: "",
  risultato: "",
  parziali: "",
  marcatori: "",
  diretta: ""
};

/**
 * Gli input datetime-local vogliono l'ora LOCALE senza fuso, mentre il
 * back-end parla in UTC. Convertire qui evita che un evento delle 15:00
 * compaia alle 13:00 a chi lo rilegge.
 */
function versoInput(iso, soloData = false) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  const data = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return soloData ? data : `${data}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function daInput(valore) {
  return valore ? new Date(valore).toISOString() : null;
}

export default function EventoEditorPage() {
  const { id } = useParams();
  const nuovo = !id;
  const navigate = useNavigate();
  const { sessionExpired } = useAuth();

  const [form, setForm] = useState(VUOTO);
  const [squadre, setSquadre] = useState([]);
  const [squadreAmmesse, setSquadreAmmesse] = useState(null);
  const [media, setMedia] = useState([]);
  const [caricamento, setCaricamento] = useState(!nuovo);
  const [salvataggio, setSalvataggio] = useState(false);
  const [caricandoFile, setCaricandoFile] = useState(false);
  const [errore, setErrore] = useState("");
  const [avviso, setAvviso] = useState("");
  const inputFile = useRef(null);

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    setErrore(err.message || "Operazione non riuscita.");
  }, [navigate, sessionExpired]);

  /* ---------- Squadre proponibili ---------- */

  useEffect(() => {
    let attivo = true;

    // listEventi serve solo a sapere quali squadre può gestire chi è
    // collegato: l'informazione viaggia insieme all'elenco.
    Promise.all([listSquadre(), listEventi({ da: new Date(), a: new Date() })])
      .then(([elenco, { squadreAmmesse: ammesse }]) => {
        if (!attivo) return;
        setSquadre(elenco);
        setSquadreAmmesse(ammesse);
      })
      .catch(gestisciErrore);

    return () => { attivo = false; };
  }, [gestisciErrore]);

  /* ---------- Caricamento di un evento esistente ---------- */

  useEffect(() => {
    if (nuovo) return;
    let attivo = true;

    getEvento(id)
      .then((evento) => {
        if (!attivo) return;
        setForm({
          squadraId: String(evento.squadraId),
          tipo: evento.tipo,
          titolo: evento.titolo,
          avversario: evento.avversario ?? "",
          inizio: versoInput(evento.inizio, evento.tuttoIlGiorno),
          fine: versoInput(evento.fine, evento.tuttoIlGiorno),
          tuttoIlGiorno: evento.tuttoIlGiorno,
          luogo: evento.luogo ?? "",
          descrizione: evento.descrizione ?? "",
          risultato: evento.risultato ?? "",
          parziali: evento.parziali ?? "",
          marcatori: (evento.marcatori ?? []).join(", "),
          diretta: evento.diretta ?? ""
        });
        setMedia(evento.media ?? []);
        setCaricamento(false);
      })
      .catch((err) => {
        if (!attivo) return;
        gestisciErrore(err);
        setCaricamento(false);
      });

    return () => { attivo = false; };
  }, [id, nuovo, gestisciErrore]);

  const aggiorna = (modifiche) => {
    setForm((prima) => ({ ...prima, ...modifiche }));
    setAvviso("");
  };

  /* ---------- Salvataggio ---------- */

  const salva = async (evento) => {
    evento.preventDefault();
    setErrore("");
    setAvviso("");

    if (!form.squadraId) return setErrore("Scegli la squadra.");
    if (!form.titolo.trim()) return setErrore("Il titolo è obbligatorio.");
    if (!form.inizio) return setErrore("Indica quando comincia.");

    setSalvataggio(true);

    const dati = {
      squadraId: Number(form.squadraId),
      tipo: form.tipo,
      titolo: form.titolo.trim(),
      avversario: form.avversario.trim() || null,
      inizio: daInput(form.inizio),
      fine: form.fine ? daInput(form.fine) : null,
      tuttoIlGiorno: form.tuttoIlGiorno,
      luogo: form.luogo.trim() || null,
      descrizione: form.descrizione.trim() || null,
      risultato: form.risultato.trim() || null,
      parziali: form.parziali.trim() || null,
      // Da "Rossi, Bianchi" a ["Rossi", "Bianchi"]: chi compila scrive
      // come parla, la lista la fa il codice.
      marcatori: form.marcatori.trim()
        ? form.marcatori.split(",").map((m) => m.trim()).filter(Boolean)
        : null,
      diretta: form.diretta.trim() || null
    };

    try {
      if (nuovo) {
        const creato = await createEvento(dati);
        navigate(`/admin/eventi/${creato.id}`, { replace: true });
        return;
      }
      await updateEvento(id, dati);
      setAvviso("Evento salvato: è nel calendario del sito.");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  /* ---------- Foto e video ---------- */

  const aggiungiFile = async (evento) => {
    const file = evento.target.files?.[0];
    evento.target.value = "";
    if (!file) return;

    setErrore("");
    setCaricandoFile(true);

    try {
      // Le foto si alleggeriscono prima di partire; i video no, sarebbe
      // un lavoro che il browser non può fare in tempi ragionevoli.
      const daInviare = file.type.startsWith("image/") ? await prepareImage(file) : file;

      const salvato = await uploadMedia(daInviare, { title: form.titolo || file.name });
      setMedia(await collegaMediaEvento(id, salvato.id));

      setAvviso(
        daInviare.size < file.size
          ? `File aggiunto e alleggerito da ${formatSize(file.size)} a ${formatSize(daInviare.size)}.`
          : "File aggiunto."
      );
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setCaricandoFile(false);
    }
  };

  const togliFile = async (mediaId) => {
    try {
      setMedia(await scollegaMediaEvento(id, mediaId));
    } catch (err) {
      gestisciErrore(err);
    }
  };

  /* ---------- Render ---------- */

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento dell&apos;evento…</p>
      </div>
    );
  }

  const proponibili = Array.isArray(squadreAmmesse)
    ? squadre.filter((s) => squadreAmmesse.includes(s.id))
    : squadre;

  const occupato = salvataggio || caricandoFile;
  const eUnaPartita = form.tipo === "partita" || form.tipo === "torneo";

  return (
    <form className="adm-page adm-editor-page" onSubmit={salva}>
      <div className="adm-page-head">
        <div className="adm-head-left">
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            onClick={() => navigate("/admin/eventi")}
          >
            <FaArrowLeft /> Eventi
          </button>
          <h1 className="adm-page-title">{nuovo ? "Nuovo evento" : "Modifica evento"}</h1>
        </div>

        <div className="adm-head-actions">
          <button type="submit" className="adm-btn adm-btn-primary" disabled={occupato}>
            <FaSave /> {salvataggio ? "Salvataggio…" : "Salva"}
          </button>
        </div>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {avviso && (
        <div className="adm-alert adm-alert-success" role="status">
          <FaCheckCircle /> <span>{avviso}</span>
        </div>
      )}

      <div className="adm-editor-grid">
        <div className="adm-editor-col">

          <div className="adm-due-colonne">
            <label className="adm-field">
              <span className="adm-label">Squadra</span>
              <select
                className="adm-input adm-select"
                value={form.squadraId}
                onChange={(e) => aggiorna({ squadraId: e.target.value })}
                disabled={occupato}
              >
                <option value="">Scegli…</option>
                {proponibili.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </label>

            <label className="adm-field">
              <span className="adm-label">Tipo</span>
              <select
                className="adm-input adm-select"
                value={form.tipo}
                onChange={(e) => aggiorna({ tipo: e.target.value })}
                disabled={occupato}
              >
                {TIPI.map((t) => (
                  <option key={t.valore} value={t.valore}>{t.etichetta}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="adm-field">
            <span className="adm-label">Titolo</span>
            <input
              type="text"
              className="adm-input"
              value={form.titolo}
              onChange={(e) => aggiorna({ titolo: e.target.value })}
              placeholder="Es. Allievi - Rivoli"
              disabled={occupato}
            />
          </label>

          <label className="adm-field">
            <span className="adm-label">Avversario <em>(facoltativo)</em></span>
            <input
              type="text"
              className="adm-input"
              value={form.avversario}
              onChange={(e) => aggiorna({ avversario: e.target.value })}
              disabled={occupato}
            />
          </label>

          <label className="adm-check">
            <input
              type="checkbox"
              checked={form.tuttoIlGiorno}
              onChange={(e) => aggiorna({ tuttoIlGiorno: e.target.checked })}
              disabled={occupato}
            />
            <span className="adm-check-box" aria-hidden="true" />
            <span>Dura tutto il giorno (senza orario)</span>
          </label>

          <div className="adm-due-colonne">
            <label className="adm-field">
              <span className="adm-label">Inizio</span>
              <input
                type={form.tuttoIlGiorno ? "date" : "datetime-local"}
                className="adm-input"
                value={form.inizio}
                onChange={(e) => aggiorna({ inizio: e.target.value })}
                disabled={occupato}
              />
            </label>

            <label className="adm-field">
              <span className="adm-label">Fine <em>(facoltativa)</em></span>
              <input
                type={form.tuttoIlGiorno ? "date" : "datetime-local"}
                className="adm-input"
                value={form.fine}
                onChange={(e) => aggiorna({ fine: e.target.value })}
                disabled={occupato}
              />
            </label>
          </div>

          <label className="adm-field">
            <span className="adm-label">Luogo</span>
            <input
              type="text"
              className="adm-input"
              value={form.luogo}
              onChange={(e) => aggiorna({ luogo: e.target.value })}
              placeholder="Es. Campo Le Chiuse, Torino"
              disabled={occupato}
            />
          </label>

          <label className="adm-field">
            <span className="adm-label">Note</span>
            <textarea
              className="adm-input adm-textarea"
              rows={3}
              value={form.descrizione}
              onChange={(e) => aggiorna({ descrizione: e.target.value })}
              disabled={occupato}
            />
          </label>
        </div>

        <aside className="adm-editor-side">
          <div className="adm-panel">
            <h2 className="adm-panel-title">Esito</h2>

            {!eUnaPartita && (
              <div className="adm-hint">
                <FaInfoCircle /> Si compila per partite e tornei.
              </div>
            )}

            <label className="adm-field">
              <span className="adm-label">Risultato</span>
              <input
                type="text"
                className="adm-input"
                value={form.risultato}
                onChange={(e) => aggiorna({ risultato: e.target.value })}
                placeholder="Es. 3 - 1"
                disabled={occupato}
              />
            </label>

            <label className="adm-field">
              <span className="adm-label">Parziali</span>
              <input
                type="text"
                className="adm-input"
                value={form.parziali}
                onChange={(e) => aggiorna({ parziali: e.target.value })}
                placeholder="Es. 25-20, 25-18, 23-25"
                disabled={occupato}
              />
            </label>

            <label className="adm-field">
              <span className="adm-label">Marcatori</span>
              <input
                type="text"
                className="adm-input"
                value={form.marcatori}
                onChange={(e) => aggiorna({ marcatori: e.target.value })}
                placeholder="Rossi, Bianchi, Verdi"
                disabled={occupato}
              />
              <span className="adm-hint">Separati da virgola.</span>
            </label>

            <label className="adm-field">
              <span className="adm-label">Diretta</span>
              <input
                type="url"
                className="adm-input"
                value={form.diretta}
                onChange={(e) => aggiorna({ diretta: e.target.value })}
                placeholder="https://…"
                disabled={occupato}
              />
            </label>
          </div>

          {/* I file si collegano a un evento che esiste già: prima di
              salvarlo non c'è nulla a cui attaccarli. */}
          <div className="adm-panel">
            <h2 className="adm-panel-title">Foto e video</h2>

            {nuovo ? (
              <div className="adm-hint">
                <FaInfoCircle /> Salva l&apos;evento per poter aggiungere file.
              </div>
            ) : (
              <>
                {media.length === 0 && (
                  <p className="adm-hint">Nessun file. Si possono aggiungere dopo la partita.</p>
                )}

                <ul className="adm-media-griglia">
                  {media.map((m) => (
                    <li key={m.id} className="adm-media-voce">
                      {m.mime?.startsWith("image/") ? (
                        <img src={m.url} alt={m.alt || ""} loading="lazy" />
                      ) : (
                        <span className="adm-media-file">{m.mime?.split("/")[1] ?? "file"}</span>
                      )}
                      <button
                        type="button"
                        className="adm-icon-btn adm-icon-danger"
                        onClick={() => togliFile(m.id)}
                        title="Togli dall'evento"
                      >
                        <FaTrashAlt />
                      </button>
                    </li>
                  ))}
                </ul>

                <input
                  ref={inputFile}
                  type="file"
                  accept="image/*,video/mp4,video/webm"
                  hidden
                  onChange={aggiungiFile}
                />
                <button
                  type="button"
                  className="adm-btn adm-btn-secondary adm-btn-block"
                  onClick={() => inputFile.current?.click()}
                  disabled={occupato}
                >
                  <FaImage /> {caricandoFile ? "Caricamento…" : "Aggiungi un file"}
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
    </form>
  );
}
