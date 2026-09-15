import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft, FaSave, FaExclamationCircle,
  FaImage, FaTrashAlt, FaInfoCircle, FaTrophy, FaEye
} from "react-icons/fa";
import {
  getEvento, createEvento, updateEvento, listSquadre, listEventi,
  collegaMediaEvento, scollegaMediaEvento,
  uploadMedia, AuthError
} from "../../api/adminApi";
import { prepareImage, formatSize } from "../../utils/prepareImage";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { useDialoghi } from "../../context/dialoghi";
import Tendina from "./Tendina";
import SceltaLuogo from "./SceltaLuogo";
import CampoData from "./CampoData";
import "../../css/Admin.css";

/*
 * I tipi, divisi fra le due sezioni.
 *
 * Un torneo sta con le partite: ha un risultato, e chi lo inserisce si fa
 * la stessa domanda — com'è finita. L'allenamento sta con le partite
 * perché è un impegno della squadra, non della società.
 */
const TIPI_PARTITA = [
  { valore: "partita", etichetta: "Partita" },
  { valore: "torneo", etichetta: "Torneo" },
  { valore: "allenamento", etichetta: "Allenamento" }
];

const TIPI_EVENTO = [
  { valore: "evento", etichetta: "Evento" },
  { valore: "riunione", etichetta: "Riunione" },
  { valore: "altro", etichetta: "Altro" }
];

const SPORT_SQUADRA = ["Calcio", "Pallavolo", "Basket", "Societa"];

/**
 * Come si racconta l'esito di una partita, sport per sport.
 *
 * Prima il modulo era uno solo per tutti: chi inseriva una partita di volley
 * si trovava davanti il campo "Marcatori", che nella pallavolo non esiste, e
 * chi inseriva una di calcio il campo "Parziali", che nel calcio non c'è. I
 * campi che non servono non sono neutri: fanno dubitare di stare compilando
 * la cosa giusta, e ogni tanto qualcuno li riempie lo stesso.
 *
 * Un campo assente da questa tabella non viene mostrato NÉ inviato: il dato
 * eventualmente già in archivio resta dov'è, e il modulo lo segnala invece di
 * cancellarlo di nascosto.
 */
const ESITO_PER_SPORT = {
  Calcio: {
    risultato: { etichetta: "Risultato", segnaposto: "Es. 3 - 1" },
    marcatori: { etichetta: "Marcatori", segnaposto: "Rossi, Bianchi, Verdi" }
  },
  Pallavolo: {
    risultato: { etichetta: "Set vinti", segnaposto: "Es. 3 - 1" },
    parziali: { etichetta: "Parziali dei set", segnaposto: "25-20, 25-18, 23-25" }
  },
  Basket: {
    risultato: { etichetta: "Punteggio", segnaposto: "Es. 74 - 68" },
    parziali: { etichetta: "Parziali dei quarti", segnaposto: "18-15, 22-20, 14-19, 20-17" }
  }
};

/* Per gli eventi di società, e per tutto ciò che non è uno dei tre sport,
   si mostra il modulo completo: non sapendo che partita sia, togliere un
   campo rischia di togliere proprio quello che serviva. */
const ESITO_GENERICO = {
  risultato: { etichetta: "Risultato", segnaposto: "Es. 3 - 1" },
  parziali: { etichetta: "Parziali", segnaposto: "25-20, 25-18, 23-25" },
  marcatori: { etichetta: "Marcatori", segnaposto: "Rossi, Bianchi, Verdi" }
};

const VUOTO = {
  squadraId: "",
  tipo: "partita",
  // Vuoto significa "quello della squadra"
  sport: "",
  titolo: "",
  avversario: "",
  inizio: "",
  fine: "",
  tuttoIlGiorno: false,
  // Vuoto significa "si vede subito": vedi la nota in db/schema.js
  visibileDal: null,
  luogo: "",
  latitudine: null,
  longitudine: null,
  descrizione: "",
  risultato: "",
  parziali: "",
  marcatori: "",
  diretta: ""
};

/** Fra un'ora, arrotondata: un punto di partenza sensato per la visibilità. */
function fraUnOra() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

/**
 * @param genere  "partite" oppure "eventi". Cambia il modulo e dove si
 *                torna dopo aver salvato; il calendario del sito è lo
 *                stesso per entrambi.
 */
export default function EventoEditorPage({ genere = "partite" }) {
  const ePartita = genere === "partite";

  // La sezione a cui appartiene questo modulo, per i ritorni e i rimandi.
  const sezione = ePartita ? "partite" : "eventi";
  const { id } = useParams();
  const nuovo = !id;
  const navigate = useNavigate();
  const { sessionExpired } = useAuth();
  const area = useArea();
  const { avvisa } = useDialoghi();

  const [form, setForm] = useState(() => ({ ...VUOTO, tipo: ePartita ? "partita" : "evento" }));
  const [squadre, setSquadre] = useState([]);
  const [squadreAmmesse, setSquadreAmmesse] = useState(null);
  const [media, setMedia] = useState([]);
  const [caricamento, setCaricamento] = useState(!nuovo);
  const [salvataggio, setSalvataggio] = useState(false);
  const [caricandoFile, setCaricandoFile] = useState(false);
  const [errore, setErrore] = useState("");
  const inputFile = useRef(null);

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    setErrore(err.message || "Operazione non riuscita.");
    avvisa(err.message || "Operazione non riuscita.", "errore");
  }, [navigate, sessionExpired, avvisa]);

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
          sport: evento.sportProprio ?? "",
          titolo: evento.titolo,
          avversario: evento.avversario ?? "",
          inizio: evento.inizio ?? "",
          fine: evento.fine ?? "",
          visibileDal: evento.visibileDal ?? null,
          tuttoIlGiorno: evento.tuttoIlGiorno,
          luogo: evento.luogo ?? "",
          latitudine: evento.latitudine ?? null,
          longitudine: evento.longitudine ?? null,
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

  const aggiorna = useCallback((modifiche) => {
    setForm((prima) => ({ ...prima, ...modifiche }));
    setErrore("");
  }, []);

  /* ---------- Sport in vigore ed esito ---------- */

  const squadraScelta = useMemo(
    () => squadre.find((s) => String(s.id) === String(form.squadraId)),
    [squadre, form.squadraId]
  );

  /**
   * L'unico sport di chi sta compilando, se ne ha uno solo.
   *
   * Un allenatore che allena solo squadre di calcio non vedrà mai una
   * partita di pallavolo: prima di aver scelto la squadra il modulo gli
   * proponeva comunque "Parziali dei set", che nel calcio non esistono.
   * Con una sola possibilità, la scelta è già fatta.
   */
  const sportUnico = useMemo(() => {
    const proponibili = Array.isArray(squadreAmmesse)
      ? squadre.filter((s) => squadreAmmesse.includes(s.id))
      : squadre;

    const sport = [...new Set(proponibili.map((s) => s.sport).filter((x) => x && x !== "Societa"))];
    return sport.length === 1 ? sport[0] : null;
  }, [squadre, squadreAmmesse]);

  // Lo sport viene dalla squadra; il campo sull'evento serve solo a
  // scavalcarla. È la stessa regola che applica il server quando rilegge.
  // Senza squadra scelta vale quello di chi compila, se ne ha uno solo.
  const sportInVigore = form.sport || squadraScelta?.sport || sportUnico || null;

  const esito = sportInVigore
    ? (ESITO_PER_SPORT[sportInVigore] ?? ESITO_GENERICO)
    : ESITO_GENERICO;

  /* ---------- Salvataggio ---------- */

  const salva = async (evento) => {
    evento.preventDefault();
    setErrore("");

    if (!form.squadraId) return setErrore("Scegli la squadra.");
    if (!form.titolo.trim()) return setErrore("Il titolo è obbligatorio.");
    if (!form.inizio) return setErrore("Indica quando comincia.");

    setSalvataggio(true);

    const dati = {
      squadraId: Number(form.squadraId),
      tipo: form.tipo,
      sport: form.sport || null,
      titolo: form.titolo.trim(),
      avversario: form.avversario.trim() || null,
      inizio: form.inizio,
      fine: form.fine || null,
      visibileDal: form.visibileDal,
      tuttoIlGiorno: form.tuttoIlGiorno,
      luogo: form.luogo.trim() || null,
      // Le coordinate viaggiano in coppia: mezza posizione non indica nulla
      latitudine: form.latitudine ?? null,
      longitudine: form.longitudine ?? null,
      descrizione: form.descrizione.trim() || null,

      // Solo i campi che questo sport prevede. Quelli che non prevede non
      // partono affatto, così un valore già in archivio non viene cancellato
      // solo perché il modulo ha smesso di mostrarlo.
      ...(esito.risultato ? { risultato: form.risultato.trim() || null } : {}),
      ...(esito.parziali ? { parziali: form.parziali.trim() || null } : {}),
      ...(esito.marcatori ? {
        // Da "Rossi, Bianchi" a ["Rossi", "Bianchi"]: chi compila scrive
        // come parla, la lista la fa il codice.
        marcatori: form.marcatori.trim()
          ? form.marcatori.split(",").map((m) => m.trim()).filter(Boolean)
          : null
      } : {})
    };

    try {
      if (nuovo) {
        const creato = await createEvento(dati);
        avvisa("Evento creato: è nel calendario del sito.");
        navigate(`${area}/${sezione}/${creato.id}`, { replace: true });
        return;
      }
      await updateEvento(id, dati);
      avvisa("Evento salvato: è nel calendario del sito.");
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

      const salvato = await uploadMedia(daInviare, {
        title: form.titolo || file.name,
        cartella: "eventi",
        tag: ["evento"]
      });
      setMedia(await collegaMediaEvento(id, salvato.id));

      avvisa(
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
      avvisa("File tolto dall'evento.");
    } catch (err) {
      gestisciErrore(err);
    }
  };

  /* ---------- Tendine ---------- */

  const opzioniSquadra = useMemo(() => {
    const proponibili = Array.isArray(squadreAmmesse)
      ? squadre.filter((s) => squadreAmmesse.includes(s.id))
      : squadre;

    // Raggruppate per sport: con venti squadre, "Allievi" e "Under 14"
    // scorrono meglio se il calcio sta col calcio.
    return [...proponibili]
      .sort((a, b) => a.sport.localeCompare(b.sport) || a.nome.localeCompare(b.nome))
      .map((s) => ({
        valore: String(s.id),
        etichetta: s.nome,
        gruppo: s.sport === "Societa" ? "Società" : s.sport,
        colore: s.colore
      }));
  }, [squadre, squadreAmmesse]);

  const opzioniSport = useMemo(() => [
    { valore: "", etichetta: "Quello della squadra", nota: squadraScelta?.sport },
    ...SPORT_SQUADRA.map((s) => ({
      valore: s,
      etichetta: s === "Societa" ? "Società" : s
    }))
  ], [squadraScelta]);

  /* ---------- Render ---------- */

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento dell&apos;evento…</p>
      </div>
    );
  }

  const occupato = salvataggio || caricandoFile;
  const eUnaPartita = form.tipo === "partita" || form.tipo === "torneo";

  /* Campi che questo sport non prevede ma che hanno già qualcosa scritto:
     vanno detti, non nascosti in silenzio. */
  const fuoriPosto = [
    !esito.parziali && form.parziali ? "i parziali" : null,
    !esito.marcatori && form.marcatori ? "i marcatori" : null
  ].filter(Boolean);

  return (
    <form className="adm-page adm-editor-page" onSubmit={salva}>
      <div className="adm-page-head">
        <div className="adm-head-left">
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            onClick={() => navigate(`${area}/${sezione}`)}
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

      <div className="adm-editor-grid">
        <div className="adm-editor-col">

          <div className="adm-due-colonne">
            <div className="adm-field">
              <span className="adm-label">Squadra</span>
              <Tendina
                valore={form.squadraId}
                onChange={(v) => aggiorna({ squadraId: v })}
                opzioni={opzioniSquadra}
                segnaposto="Scegli…"
                disabilitato={occupato}
                etichettaAria="Squadra"
                vuoto="Nessuna squadra fra quelle che gestisci."
              />
            </div>

            <div className="adm-field">
              <span className="adm-label">Tipo</span>
              <Tendina
                valore={form.tipo}
                onChange={(v) => aggiorna({ tipo: v })}
                opzioni={ePartita ? TIPI_PARTITA : TIPI_EVENTO}
                disabilitato={occupato}
                etichettaAria="Tipo di evento"
              />
            </div>
          </div>

          {/* Lo sport di norma viene dalla squadra. Questo campo serve solo
              quando non basta: un evento del calendario di società che
              riguarda una disciplina precisa. */}
          <div className="adm-field">
            <span className="adm-label">
              Sport <em>(solo se diverso da quello della squadra)</em>
            </span>
            <Tendina
              valore={form.sport}
              onChange={(v) => aggiorna({ sport: v })}
              opzioni={opzioniSport}
              disabilitato={occupato}
              etichettaAria="Sport dell'evento"
            />
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
            <div className="adm-field">
              <span className="adm-label">Inizio</span>
              <CampoData
                valore={form.inizio}
                onChange={(v) => aggiorna({ inizio: v })}
                conOra={!form.tuttoIlGiorno}
                disabilitato={occupato}
                etichettaAria="Inizio dell'evento"
              />
            </div>

            <div className="adm-field">
              <span className="adm-label">Fine <em>(facoltativa)</em></span>
              <CampoData
                valore={form.fine}
                onChange={(v) => aggiorna({ fine: v })}
                conOra={!form.tuttoIlGiorno}
                minimo={form.inizio || null}
                disabilitato={occupato}
                etichettaAria="Fine dell'evento"
              />
            </div>
          </div>

          <SceltaLuogo
            luogo={form.luogo}
            latitudine={form.latitudine}
            longitudine={form.longitudine}
            onChange={aggiorna}
            disabilitato={occupato}
          />

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
          {/* ---------- Quando si vede sul sito ----------
              Solo per gli eventi. Una partita si sa che si gioca, e tenerla
              nascosta fino al giorno prima non serve a nessuno: il campo
              era una domanda in più a cui si rispondeva sempre allo stesso
              modo. Il server lo ignora comunque per chi gestisce solo
              partite. */}
          {!ePartita && <div className="adm-panel">
            <h2 className="adm-panel-title">
              <FaEye aria-hidden="true" /> Quando si vede sul sito
            </h2>

            <div className="adm-scelta-uscita">
              <label className="adm-check">
                <input
                  type="radio"
                  name="visibilita"
                  checked={!form.visibileDal}
                  onChange={() => aggiorna({ visibileDal: null })}
                  disabled={occupato}
                />
                <span className="adm-check-box adm-check-tondo" aria-hidden="true" />
                <span>Subito, appena lo salvo</span>
              </label>

              <label className="adm-check">
                <input
                  type="radio"
                  name="visibilita"
                  checked={!!form.visibileDal}
                  onChange={() => aggiorna({ visibileDal: fraUnOra() })}
                  disabled={occupato}
                />
                <span className="adm-check-box adm-check-tondo" aria-hidden="true" />
                <span>Da una data che scelgo io</span>
              </label>
            </div>

            {form.visibileDal ? (
              <>
                <CampoData
                  valore={form.visibileDal}
                  onChange={(v) => aggiorna({ visibileDal: v || null })}
                  conOra
                  disabilitato={occupato}
                  etichettaAria="Da quando si vede sul sito"
                />
                <p className="adm-hint">
                  Fino ad allora resta solo qui dentro: serve a preparare il
                  calendario del mese e mostrarlo quando è completo. Non
                  c&apos;entra con la data della partita, che resta quella
                  scritta sopra.
                </p>
              </>
            ) : (
              <p className="adm-hint" style={{ marginTop: 0 }}>
                Comparirà nel calendario del sito non appena salvi.
              </p>
            )}
          </div>}

          <div className="adm-panel">
            <h2 className="adm-panel-title">
              <FaTrophy aria-hidden="true" /> Esito
              {sportInVigore && <span className="adm-sport-tag">{sportInVigore}</span>}
            </h2>

            {!eUnaPartita && (
              <div className="adm-hint">
                <FaInfoCircle /> Si compila per partite e tornei.
              </div>
            )}

            {esito.risultato && (
              <label className="adm-field">
                <span className="adm-label">{esito.risultato.etichetta}</span>
                <input
                  type="text"
                  className="adm-input"
                  value={form.risultato}
                  onChange={(e) => aggiorna({ risultato: e.target.value })}
                  placeholder={esito.risultato.segnaposto}
                  disabled={occupato}
                />
              </label>
            )}

            {esito.parziali && (
              <label className="adm-field">
                <span className="adm-label">{esito.parziali.etichetta}</span>
                <input
                  type="text"
                  className="adm-input"
                  value={form.parziali}
                  onChange={(e) => aggiorna({ parziali: e.target.value })}
                  placeholder={esito.parziali.segnaposto}
                  disabled={occupato}
                />
                <span className="adm-hint">Separati da virgola, nell&apos;ordine in cui si sono giocati.</span>
              </label>
            )}

            {esito.marcatori && (
              <label className="adm-field">
                <span className="adm-label">{esito.marcatori.etichetta}</span>
                <input
                  type="text"
                  className="adm-input"
                  value={form.marcatori}
                  onChange={(e) => aggiorna({ marcatori: e.target.value })}
                  placeholder={esito.marcatori.segnaposto}
                  disabled={occupato}
                />
                <span className="adm-hint">Separati da virgola.</span>
              </label>
            )}

            {fuoriPosto.length > 0 && (
              <div className="adm-alert adm-alert-info">
                <FaInfoCircle />
                <span>
                  Questo evento ha ancora {fuoriPosto.join(" e ")} scritti da prima,
                  ma nel {sportInVigore?.toLowerCase()} non si usano: restano in
                  archivio e non li tocca nessuno.
                </span>
              </div>
            )}

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
