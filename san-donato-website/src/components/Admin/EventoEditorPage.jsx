import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FaArrowLeft, FaSave, FaExclamationCircle,
  FaImage, FaTrashAlt, FaInfoCircle, FaTrophy, FaEye, FaUsers, FaClock,
  FaMapMarkerAlt, FaStickyNote, FaChevronDown
} from "react-icons/fa";
import {
  getEvento, createEvento, updateEvento, deleteEvento, listSquadre, listEventi,
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
import { esitoDi } from "./esitoPerSport";
import "../../css/Admin.css";
import "../../css/admin/Partite.css";

/* Quello che di una partita ufficiale si può scrivere dal pannello: la
   federazione non lo conosce, quindi non lo riscrive. Il resto è suo. */
const CAMPI_LIBERI = new Set(["descrizione", "marcatori", "diretta"]);

/* Cosa dicono i campi del risultato, vuoti, in una partita ufficiale.
   Con l'esempio di sempre ("3 - 1", "25-20, 25-18, 23-25") un campo bloccato
   sembrava compilato: si leggeva un risultato per partite non ancora giocate. */
const DALLA_FEDERAZIONE = "Arriva dalla federazione";

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

/* La sezione Eventi di chi amministra raccoglie tutto quello che non arriva
   dai calendari ufficiali: gli appuntamenti della società, ma anche le
   amichevoli e gli allenamenti. Le partite ufficiali stanno in Partite. */
const TIPI_EVENTI_ADMIN = [
  { valore: "partita", etichetta: "Partita amichevole" },
  { valore: "torneo", etichetta: "Torneo" },
  { valore: "allenamento", etichetta: "Allenamento" },
  ...TIPI_EVENTO
];

const SPORT_SQUADRA = ["Calcio", "Pallavolo", "Basket", "Societa"];

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
  const { avvisa, conferma } = useDialoghi();
  const [parametri] = useSearchParams();

  /* Dall'elenco si arriva anche con il tipo già scelto ("+ Allenamento")
     o chiedendo il risultato ("?esito=1"): due gesti in meno per le due
     cose che un allenatore fa ogni settimana. */
  const tipiProponibili = ePartita ? TIPI_PARTITA : TIPI_EVENTI_ADMIN;
  const chiedeEsito = parametri.get("esito") === "1";

  const [form, setForm] = useState(() => {
    const richiesto = parametri.get("tipo");
    const tipo = tipiProponibili.some((t) => t.valore === richiesto)
      ? richiesto
      : (ePartita ? "partita" : "evento");
    return { ...VUOTO, tipo };
  });
  // Fissato all'apertura, come nell'elenco: serve a dire "già giocata"
  const [adesso] = useState(() => new Date());
  const campoRisultato = useRef(null);
  const riquadroEsito = useRef(null);
  const [squadre, setSquadre] = useState([]);
  const [squadreAmmesse, setSquadreAmmesse] = useState(null);
  const [media, setMedia] = useState([]);
  const [caricamento, setCaricamento] = useState(!nuovo);
  const [salvataggio, setSalvataggio] = useState(false);
  const [caricandoFile, setCaricandoFile] = useState(false);
  const [errore, setErrore] = useState("");
  // Pieno solo per le partite del calendario ufficiale: vedi "bloccato" più in basso
  const [ufficiale, setUfficiale] = useState(null);
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

        /* Chi allena una squadra sola non deve sceglierla ogni volta: in
           una partita nuova è già messa. Solo se il campo è ancora vuoto. */
        const proponibili = Array.isArray(ammesse)
          ? elenco.filter((s) => ammesse.includes(s.id))
          : elenco;
        if (nuovo && proponibili.length === 1) {
          setForm((prima) => (prima.squadraId ? prima : { ...prima, squadraId: String(proponibili[0].id) }));
        }
      })
      .catch(gestisciErrore);

    return () => { attivo = false; };
  }, [gestisciErrore, nuovo]);

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
        setUfficiale(evento.ufficiale
          ? { sparitaIl: evento.sparitaIl, note: evento.noteUfficiali, inCasa: evento.inCasa }
          : null);
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

  const esito = esitoDi(sportInVigore);

  /* Il titolo che si scriverebbe comunque: "Allievi - Rivoli". Lasciato
     vuoto, si usa questo — chi aggiunge un'amichevole dal telefono ha già
     scelto squadra e avversario, e riscriverli tutti e due in un terzo
     campo era una fatica senza motivo. */
  const titoloProposto = useMemo(() => {
    if (!squadraScelta) return "";
    if (form.tipo === "allenamento") return `Allenamento ${squadraScelta.nome}`;
    const avversario = form.avversario.trim();
    return avversario ? `${squadraScelta.nome} - ${avversario}` : "";
  }, [squadraScelta, form.tipo, form.avversario]);

  const titoloFinale = form.titolo.trim() || titoloProposto;

  /* ---------- Salvataggio ---------- */

  const salva = async (evento) => {
    evento.preventDefault();
    setErrore("");

    if (!form.squadraId) return setErrore("Scegli la squadra.");
    if (!titoloFinale) return setErrore("Scrivi l'avversario o un titolo: serve a riconoscerla nel calendario.");
    if (!form.inizio) return setErrore("Indica quando comincia.");

    setSalvataggio(true);

    const tutti = {
      squadraId: Number(form.squadraId),
      tipo: form.tipo,
      sport: form.sport || null,
      titolo: titoloFinale,
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
      // Il modulo lo chiedeva ma non lo mandava: il collegamento si perdeva
      // al salvataggio senza che nessuno se ne accorgesse.
      diretta: form.diretta.trim() || null,

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

    /* Di una partita ufficiale partono solo i campi che la federazione non
       conosce: il resto lo riscrive la lettura notturna, e il server
       rifiuterebbe comunque di cambiarlo. */
    const dati = ufficiale
      ? Object.fromEntries(Object.entries(tutti).filter(([campo]) => CAMPI_LIBERI.has(campo)))
      : tutti;

    try {
      if (nuovo) {
        const creato = await createEvento(dati);
        avvisa(ePartita ? "Partita aggiunta: è nel calendario del sito." : "Evento creato: è nel calendario del sito.");
        navigate(`${area}/${sezione}/${creato.id}`, { replace: true });
        return;
      }
      await updateEvento(id, dati);
      avvisa("Salvato: il calendario del sito è già aggiornato.");
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

  /* ---------- Eliminazione ----------
     C'era solo nell'elenco, con il cestino accanto a ogni riga. Sul
     telefono quel cestino stava a un centimetro da "Apri": qui, dentro
     alla partita, lo si preme solo volendo. Stessa regola dell'elenco: una
     partita ufficiale si toglie solo quando la federazione l'ha tolta. */
  const elimina = async () => {
    const ok = await conferma({
      titolo: ePartita ? "Eliminare questa partita?" : "Eliminare questo evento?",
      testo: `"${form.titolo}" sparisce dal calendario del sito. Questa non si annulla.`,
      conferma: "Elimina",
      pericolo: true
    });
    if (!ok) return;

    try {
      await deleteEvento(id);
      avvisa(ePartita ? "Partita eliminata." : "Evento eliminato.");
      navigate(`${area}/${sezione}`, { replace: true });
    } catch (err) {
      gestisciErrore(err);
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

  /* ---------- Il risultato in primo piano ----------

     Di una partita già giocata, la domanda è una sola: com'è finita. Il
     riquadro dell'esito sale in cima al modulo e, se si è arrivati da
     "Risultato" nell'elenco, il cursore è già nel campo: si scrive e si
     salva, senza scorrere oltre la mappa. */
  const eUnaPartita = form.tipo === "partita" || form.tipo === "torneo";
  const giaGiocata = !nuovo && Boolean(form.inizio) && new Date(form.fine || form.inizio) <= adesso;
  const esitoInCima = eUnaPartita && (chiedeEsito || giaGiocata);

  useEffect(() => {
    if (caricamento || !chiedeEsito) return;
    const campo = campoRisultato.current;
    // In una partita ufficiale il risultato è bloccato: si porta lì la
    // vista, e basta
    if (campo && !campo.disabled) {
      campo.focus({ preventScroll: true });
    }
    riquadroEsito.current?.scrollIntoView({ block: "center" });
  }, [caricamento, chiedeEsito]);

  /* ---------- Render ---------- */

  if (caricamento) {
    return (
      <div className="adm-page ev-attesa-editor" aria-busy="true">
        <span className="adm-sagoma adm-sagoma-titolo" />
        <span className="adm-sagoma adm-sagoma-scheda" />
        <span className="adm-sagoma adm-sagoma-scheda" />
      </div>
    );
  }

  const occupato = salvataggio || caricandoFile;
  // I campi che in una partita ufficiale scrive la federazione
  const bloccato = occupato || Boolean(ufficiale);

  /* Campi che questo sport non prevede ma che hanno già qualcosa scritto:
     vanno detti, non nascosti in silenzio. */
  const fuoriPosto = [
    !esito.parziali && form.parziali ? "i parziali" : null,
    !esito.marcatori && form.marcatori ? "i marcatori" : null
  ].filter(Boolean);

  const nomeCosa = ePartita ? "partita" : "evento";
  const titoloPagina = nuovo
    ? (form.tipo === "allenamento" ? "Nuovo allenamento" : ePartita ? "Nuova partita" : "Nuovo evento")
    : (form.titolo || (ePartita ? "Partita" : "Evento"));

  const esci = () => navigate(`${area}/${sezione}`);

  /* Il riquadro dell'esito, disegnato una volta sola e messo dove serve:
     in cima per una partita giocata, di lato per una ancora da giocare. */
  const pannelloEsito = (
    <section
      ref={riquadroEsito}
      className={`adm-panel ev-esito ${esitoInCima ? "is-in-cima" : ""}`}
      aria-labelledby="ev-esito-titolo"
    >
      <h2 className="adm-panel-title" id="ev-esito-titolo">
        <FaTrophy aria-hidden="true" /> {!eUnaPartita ? "Diretta" : esitoInCima ? "Com'è finita?" : "Risultato e diretta"}
        {sportInVigore && eUnaPartita && <span className="adm-sport-tag">{sportInVigore}</span>}
      </h2>

      {/* Un allenamento non ha un risultato: i campi restano in archivio
          (e il modulo li rimanda uguali), ma non li si propone. */}
      {eUnaPartita && (
        <>
          {!giaGiocata && !ufficiale && (
            <p className="adm-hint ev-esito-nota">
              {nuovo
                ? "Solo se la partita è già stata giocata: altrimenti lo scrivi dopo."
                : "Si compila dopo il fischio finale."}
            </p>
          )}

          {esito.risultato && (
            <label className="adm-field">
              <span className="adm-label">{esito.risultato.etichetta}</span>
              <input
                ref={campoRisultato}
                type="text"
                className="adm-input ev-esito-punteggio"
                value={form.risultato}
                onChange={(e) => aggiorna({ risultato: e.target.value })}
                placeholder={ufficiale ? DALLA_FEDERAZIONE : esito.risultato.segnaposto}
                autoComplete="off"
                disabled={bloccato}
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
                placeholder={ufficiale ? DALLA_FEDERAZIONE : esito.parziali.segnaposto}
                autoComplete="off"
                disabled={bloccato}
              />
              {!ufficiale && (
                <span className="adm-hint">Separati da virgola, nell&apos;ordine in cui si sono giocati.</span>
              )}
            </label>
          )}

          {esito.marcatori && (
            <label className="adm-field">
              <span className="adm-label">{esito.marcatori.etichetta} <em>(facoltativi)</em></span>
              <input
                type="text"
                className="adm-input"
                value={form.marcatori}
                onChange={(e) => aggiorna({ marcatori: e.target.value })}
                placeholder={esito.marcatori.segnaposto}
                autoComplete="off"
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
        </>
      )}

      <label className="adm-field">
        <span className="adm-label">Link della diretta <em>(facoltativo)</em></span>
        <input
          type="url"
          className="adm-input"
          value={form.diretta}
          onChange={(e) => aggiorna({ diretta: e.target.value })}
          placeholder="https://…"
          disabled={occupato}
        />
        <span className="adm-hint">YouTube, Facebook o altro: sul sito compare il pulsante per guardarla.</span>
      </label>
    </section>
  );

  return (
    <form className="adm-page adm-editor-page ev-editor" onSubmit={salva} noValidate>
      <header className="ev-editor-testa">
        <button type="button" className="adm-btn adm-btn-ghost ev-indietro" onClick={esci}>
          <FaArrowLeft aria-hidden="true" /> {ePartita ? "Partite" : "Eventi"}
        </button>

        <div className="ev-editor-titoli">
          <p className="adm-occhiello">
            {nuovo ? (ePartita ? "Aggiungi al calendario" : "Nuovo nel calendario") : (ufficiale ? "Partita ufficiale" : `Modifica ${nomeCosa}`)}
          </p>
          <h1 className="adm-page-title">{titoloPagina}</h1>
        </div>

        {/* Sul computer il Salva sta anche qui in alto; sul telefono c'è la
            barra in fondo, sempre a portata di pollice */}
        <button type="submit" className="adm-btn adm-btn-primary ev-salva-alto" disabled={occupato}>
          <FaSave aria-hidden="true" /> {salvataggio ? "Salvataggio…" : "Salva"}
        </button>
      </header>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {ufficiale && (
        <div className={`adm-alert ${ufficiale.sparitaIl ? "adm-alert-warn" : "adm-alert-info"}`}>
          <FaInfoCircle />
          <span>
            <strong>Partita del calendario ufficiale.</strong>{" "}
            {ufficiale.sparitaIl
              ? "La federazione non la elenca più: sul sito non si vede. Se ricompare, torna da sola. "
              : "Data, ora, campo, avversario e risultato li aggiorna la federazione, ogni notte. "}
            Qui puoi aggiungere marcatori, diretta, note e foto.
            {ufficiale.note && <> Nota della federazione: <em>{ufficiale.note}</em>.</>}
          </span>
        </div>
      )}

      <div className="adm-editor-grid">
        <div className="adm-editor-col ev-editor-col">

          {esitoInCima && pannelloEsito}

          {/* ---------- Chi gioca ---------- */}
          <section className="adm-panel ev-blocco" aria-labelledby="ev-chi">
            <h2 className="adm-panel-title" id="ev-chi">
              <FaUsers aria-hidden="true" /> {ePartita ? "Chi gioca" : "Cosa e per chi"}
            </h2>

            {/* Il tipo con dei pulsanti e non una tendina: le scelte sono
                poche, e si vedono tutte senza aprire niente */}
            <div className="adm-field">
              <span className="adm-label" id="ev-tipo-etichetta">Che cos&apos;è</span>
              <div className="ev-tipi" role="radiogroup" aria-labelledby="ev-tipo-etichetta">
                {tipiProponibili.map((t) => (
                  <button
                    key={t.valore}
                    type="button"
                    role="radio"
                    aria-checked={form.tipo === t.valore}
                    className={`ev-tipo ${form.tipo === t.valore ? "is-scelto" : ""}`}
                    onClick={() => aggiorna({ tipo: t.valore })}
                    disabled={bloccato}
                  >
                    {t.etichetta}
                  </button>
                ))}
              </div>
            </div>

            <div className="adm-field">
              <span className="adm-label">Squadra</span>
              <Tendina
                valore={form.squadraId}
                onChange={(v) => aggiorna({ squadraId: v })}
                opzioni={opzioniSquadra}
                segnaposto="Scegli la squadra…"
                disabilitato={bloccato}
                etichettaAria="Squadra"
                vuoto="Nessuna squadra fra quelle che gestisci."
              />
            </div>

            {form.tipo !== "allenamento" && (
              <label className="adm-field">
                <span className="adm-label">Contro chi <em>(facoltativo)</em></span>
                <input
                  type="text"
                  className="adm-input"
                  value={form.avversario}
                  onChange={(e) => aggiorna({ avversario: e.target.value })}
                  placeholder="Es. Rivoli"
                  autoComplete="off"
                  disabled={bloccato}
                />
              </label>
            )}

            <label className="adm-field">
              <span className="adm-label">
                Titolo nel calendario {titoloProposto && <em>(facoltativo)</em>}
              </span>
              <input
                type="text"
                className="adm-input"
                value={form.titolo}
                onChange={(e) => aggiorna({ titolo: e.target.value })}
                placeholder={titoloProposto || (ePartita ? "Es. Allievi - Rivoli" : "Es. Assemblea dei soci")}
                disabled={bloccato}
              />
              {titoloProposto && !form.titolo && !ufficiale && (
                <span className="adm-hint">Se lo lasci vuoto si usa quello scritto in grigio.</span>
              )}
            </label>

            {/* Lo sport di norma viene dalla squadra: questo serve di rado
                (un evento di società che riguarda una disciplina precisa),
                e sta chiuso finché non lo si cerca. Aperto da solo quando
                è già scelto, per non nascondere un valore diverso. */}
            <details className="ev-altro" open={Boolean(form.sport) || undefined}>
              <summary>
                <FaChevronDown aria-hidden="true" className="ev-altro-freccia" />
                Sport diverso da quello della squadra?
              </summary>
              <div className="adm-field">
                <span className="adm-label">Sport</span>
                <Tendina
                  valore={form.sport}
                  onChange={(v) => aggiorna({ sport: v })}
                  opzioni={opzioniSport}
                  disabilitato={bloccato}
                  etichettaAria="Sport dell'evento"
                />
              </div>
            </details>
          </section>

          {/* ---------- Quando ---------- */}
          <section className="adm-panel ev-blocco" aria-labelledby="ev-quando">
            <h2 className="adm-panel-title" id="ev-quando">
              <FaClock aria-hidden="true" /> Quando
            </h2>

            <div className="adm-due-colonne">
              <div className="adm-field">
                <span className="adm-label">Inizio</span>
                <CampoData
                  valore={form.inizio}
                  onChange={(v) => aggiorna({ inizio: v })}
                  conOra={!form.tuttoIlGiorno}
                  disabilitato={bloccato}
                  etichettaAria="Inizio"
                />
              </div>

              <div className="adm-field">
                <span className="adm-label">Fine <em>(facoltativa)</em></span>
                <CampoData
                  valore={form.fine}
                  onChange={(v) => aggiorna({ fine: v })}
                  conOra={!form.tuttoIlGiorno}
                  minimo={form.inizio || null}
                  disabilitato={bloccato}
                  etichettaAria="Fine"
                />
              </div>
            </div>

            <label className="adm-check">
              <input
                type="checkbox"
                checked={form.tuttoIlGiorno}
                onChange={(e) => aggiorna({ tuttoIlGiorno: e.target.checked })}
                disabled={bloccato}
              />
              <span className="adm-check-box" aria-hidden="true" />
              <span>Dura tutto il giorno (senza orario)</span>
            </label>
          </section>

          {/* ---------- Dove ---------- */}
          <section className="adm-panel ev-blocco" aria-labelledby="ev-dove">
            <h2 className="adm-panel-title" id="ev-dove">
              <FaMapMarkerAlt aria-hidden="true" /> Dove
            </h2>
            <SceltaLuogo
              luogo={form.luogo}
              latitudine={form.latitudine}
              longitudine={form.longitudine}
              onChange={aggiorna}
              disabilitato={bloccato}
            />
          </section>

          {/* ---------- Note ---------- */}
          <section className="adm-panel ev-blocco" aria-labelledby="ev-note">
            <h2 className="adm-panel-title" id="ev-note">
              <FaStickyNote aria-hidden="true" /> Note <span className="adm-panel-sotto">(facoltative)</span>
            </h2>
            <label className="adm-field ev-note">
              <textarea
                aria-labelledby="ev-note"
                className="adm-input adm-textarea"
                rows={3}
                value={form.descrizione}
                onChange={(e) => aggiorna({ descrizione: e.target.value })}
                placeholder={ePartita ? "Es. ritrovo alle 14:30 davanti alla palestra, divisa blu" : ""}
                disabled={occupato}
              />
            </label>
          </section>
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

          {!esitoInCima && pannelloEsito}

          {/* I file si collegano a un evento che esiste già: prima di
              salvarlo non c'è nulla a cui attaccarli. */}
          <div className="adm-panel">
            <h2 className="adm-panel-title"><FaImage aria-hidden="true" /> Foto e video</h2>

            {nuovo ? (
              <p className="adm-hint ev-esito-nota">
                Dopo aver salvato potrai aggiungere le foto della {nomeCosa}.
              </p>
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
                  <FaImage /> {caricandoFile ? "Caricamento…" : "Aggiungi una foto o un video"}
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* In fondo al modulo sul computer, attaccata sopra alla barra delle
          sezioni sul telefono: Salva sempre a un pollice */}
      <div className="adm-barra-azioni-fissa">
        {!nuovo && (!ufficiale || ufficiale.sparitaIl) && (
          <button
            type="button"
            className="adm-btn adm-btn-ghost ev-elimina-editor"
            onClick={elimina}
            disabled={occupato}
            aria-label={ePartita ? "Elimina la partita" : "Elimina l'evento"}
            title={ePartita ? "Elimina la partita" : "Elimina l'evento"}
          >
            <FaTrashAlt aria-hidden="true" /> <span className="ev-elimina-testo">Elimina</span>
          </button>
        )}
        <button type="button" className="adm-btn adm-btn-ghost" onClick={esci} disabled={salvataggio}>
          Annulla
        </button>
        <button type="submit" className={`adm-btn ${esitoInCima ? "adm-btn-arancio" : "adm-btn-primary"}`} disabled={occupato}>
          <FaSave aria-hidden="true" />{" "}
          {salvataggio ? "Salvataggio…" : (esitoInCima && !ufficiale ? "Salva il risultato" : "Salva")}
        </button>
      </div>
    </form>
  );
}
