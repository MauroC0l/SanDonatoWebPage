import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaImages, FaSearch, FaExclamationCircle, FaTimes, FaTags, FaFolder,
  FaFolderOpen, FaFolderPlus, FaPencilAlt, FaTrashAlt, FaUpload,
  FaFileAlt, FaVideo, FaSave, FaLink, FaCheck, FaExternalLinkAlt,
  FaInfoCircle, FaUserCircle, FaUndo, FaUsers
} from "react-icons/fa";
import {
  listMedia, getMedia, aggiornaMedia, eliminaMedia, uploadMedia,
  eliminaMediaPerSempre, ripristinaMedia,
  creaCartellaMedia, rinominaCartellaMedia, eliminaCartellaMedia, AuthError
} from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import Tendina from "./Tendina";
import Paginazione from "./Paginazione";
import "../../css/Admin.css";
import "../../css/Libreria.css";

/**
 * La libreria dei file.
 *
 * Prima l'unico modo di riusare un'immagine era ricordarsi in quale
 * articolo stava: chi cercava "la foto della festa di due anni fa" non
 * aveva strumenti, e finiva per ricaricare la stessa immagine una terza
 * volta. Sono già quattrocento file.
 *
 * Certificati medici e foto del profilo NON compaiono qui, ed è voluto:
 * vedi la nota in server/media.js.
 */

const TIPI = [
  { valore: "", etichetta: "Tutti i tipi" },
  { valore: "immagine", etichetta: "Immagini" },
  { valore: "video", etichetta: "Video" },
  { valore: "documento", etichetta: "Documenti" }
];

/*
 * Quello che la libreria accetta.
 *
 * Il server ha il suo elenco ed è quello che conta; questo serve a non far
 * aspettare venticinque megabyte a chi sta per sentirsi dire di no.
 */
const TIPI_AMMESSI = [
  "image/jpeg", "image/png", "image/webp", "image/avif", "image/gif",
  "application/pdf", "video/mp4", "video/webm"
];

const BYTE_MASSIMI = 25 * 1024 * 1024;

/** Byte in una misura che si legge: 1,4 MB invece di 1468006. */
function peso(byte) {
  if (!byte) return null;
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`;
  return `${(byte / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function quando(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

/** L'anteprima di un file: l'immagine se c'è, altrimenti un'icona. */
/*
 * L'anteprima di un file, nella griglia e dentro al cassetto.
 *
 * "subito" è per il cassetto: lì l'immagine è già in pagina — la si è
 * appena vista nella griglia, e il browser ce l'ha in mano — e caricarla
 * pigramente vuol dire un lampo di riquadro vuoto ogni volta che si passa
 * da un file all'altro. Nella griglia invece la pigrizia serve: le foto
 * sono centinaia e quasi tutte fuori schermo.
 */
function Anteprima({ file, subito = false }) {
  if (file.tipo === "immagine" && file.url) {
    return (
      <img
        src={file.url}
        alt={file.alt || file.titolo || ""}
        loading={subito ? "eager" : "lazy"}
      />
    );
  }

  return (
    <span className="lib-icona">
      {file.tipo === "video" ? <FaVideo /> : <FaFileAlt />}
    </span>
  );
}

export default function LibreriaPage() {
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();
  const { avvisa, conferma, confermaConSpunta, chiediTesto } = useDialoghi();

  const [etichette, setEtichette] = useState([]);
  const [cartelle, setCartelle] = useState([]);
  const [senzaCartella, setSenzaCartella] = useState(0);
  const [cestinati, setCestinati] = useState(0);
  const [giorniCestino, setGiorniCestino] = useState(10);

  /* Parte acceso: se la risposta non lo dice, il pulsante funziona come
     ha sempre funzionato. Lo si spegne solo quando il server dice
     esplicitamente che l'archivio non c'è. */
  const [archivioPronto, setArchivioPronto] = useState(true);

  /* Chi non scrive le notizie vede solo i propri file: lo decide il
     server, qui si legge la risposta per cambiare quello che si mostra. */
  const [soloMie, setSoloMie] = useState(false);
  const [persone, setPersone] = useState([]);
  const [persona, setPersona] = useState("");
  const [errore, setErrore] = useState("");

  const [pagina, setPagina] = useState(1);
  const [cartellaId, setCartellaId] = useState("");
  const [tipo, setTipo] = useState("");
  const [tag, setTag] = useState("");
  const [scritto, setScritto] = useState("");
  const [cerca, setCerca] = useState("");

  const [aperto, setAperto] = useState(null);
  const [form, setForm] = useState({ titolo: "", alt: "", tag: "", cartellaId: "" });
  const [salvataggio, setSalvataggio] = useState(false);
  const [copiato, setCopiato] = useState(false);
  const [caricando, setCaricando] = useState(false);

  // Il campo file vive fuori dal flusso: si apre da un pulsante vero,
  // perché una label travestita non si disabilita durante il caricamento.
  const campoFile = useRef(null);

  const cassetto = useRef(null);

  /* Lo stato di caricamento si RICAVA confrontando la richiesta in corso con
     quella dei dati arrivati, invece di accenderlo a mano dentro l'effetto:
     così ogni cambio di filtro produce un solo render. */
  /* La cartella aperta adesso, se è una cartella vera: "senza" e
     "cestino" non sono posti in cui si può mettere qualcosa. */
  const cartellaScelta = cartelle.find((c) => String(c.id) === cartellaId) ?? null;

  /* Le condivise stanno con le voci fisse in cima, non in mezzo alle altre:
     ci sono sempre, non si rinominano e riguardano tutti. */
  const condivise = cartelle.filter((c) => c.condivisa);
  const altre = cartelle.filter((c) => !c.condivisa);

  /* Un solo gesto per cambiare vista: cartella e persona insieme, perché
     "I miei file" è la prima azzerata e il secondo impostato — farli in
     due tempi lasciava per un istante una combinazione che nessuno aveva
     chiesto. */
  const vaiA = ({ cartella = "", persona: chi }) => {
    setPagina(1);
    setCartellaId(cartella);
    if (chi !== undefined) setPersona(chi);
  };

  const tuttiIFile = cartellaId === "" && persona === "";
  const mieiFile = cartellaId === ""
    && (soloMie || persona === String(user?.id ?? ""));

  /* Due cartelle non si spiegano da sole: in una quello che si mette lo
     vedono tutti, dall'altra le cose spariscono da sole. Una riga sopra
     alla griglia, solo dove serve. */
  const descrizione = cartellaId === "cestino"
    ? `Qui finiscono i file tolti dalla libreria. Restano ${giorniCestino} giorni,`
      + " poi vengono cancellati davvero — file compreso. Da qui si possono"
      + " ripescare, o buttare via subito."
    : cartellaScelta?.condivisa
      ? "I file di tutti: quello che metti qui lo vedono tutte le persone che"
        + " usano la libreria, e chiunque può aggiungerne. Accanto a ogni file"
        + " c'è chi l'ha caricato e quando."
      : null;

  const chiave = `${pagina}|${cartellaId}|${tipo}|${tag}|${cerca}|${persona}`;
  const [dati, setDati] = useState({ chiave: null, media: [], totale: 0, pagine: 1 });
  const caricamento = dati.chiave !== chiave;

  /*
   * Quanto è alta la barra in cima, misurata e non indovinata.
   *
   * Il cassetto è fissato alla finestra e la barra gli sta davanti: senza
   * saperne l'altezza, la sua testa — titolo e X per chiudere — finisce
   * sotto a quella. E l'altezza cambia: una riga o due a seconda del
   * ruolo, di più quando le sezioni vanno a capo su schermo stretto.
   */
  useEffect(() => {
    const misura = () => {
      const barra = document.querySelector(".adm-topbar");
      cassetto.current?.style.setProperty(
        "--lib-sotto-barra",
        `${Math.round(barra?.getBoundingClientRect().height ?? 0)}px`
      );
    };

    misura();
    window.addEventListener("resize", misura);
    return () => window.removeEventListener("resize", misura);
  }, [aperto]);

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    setErrore(err.message || "Operazione non riuscita.");
    avvisa(err.message || "Operazione non riuscita.", "errore");
  }, [navigate, sessionExpired, avvisa]);

  /** Ricarica l'elenco così com'è, dopo una scrittura. */
  const [riletture, setRiletture] = useState(0);
  const rileggi = useCallback(() => setRiletture((n) => n + 1), []);

  useEffect(() => {
    let attivo = true;

    listMedia({
      pagina,
      cestino: cartellaId === "cestino" || undefined,

      /* Un ternario e non una "&&": `cartellaId && cartellaId !== "cestino"`
         vale l'ULTIMO operando, cioè true, e al server arrivava
         "cartellaId=true" — che diventava NaN in un confronto fra numeri e
         faceva fallire l'interrogazione. */
      cartellaId: cartellaId === "cestino" ? undefined : (cartellaId || undefined),
      tipo: tipo || undefined,
      tag: tag || undefined,
      cerca: cerca || undefined,
      persona: persona || undefined
    })
      .then((risultato) => {
        if (!attivo) return;
        setDati({ ...risultato, chiave });
        if (risultato.etichette) setEtichette(risultato.etichette);
        if (risultato.cartelle) setCartelle(risultato.cartelle);
        if (risultato.senzaCartella !== undefined) setSenzaCartella(risultato.senzaCartella);
        if (risultato.cestinati !== undefined) setCestinati(risultato.cestinati);
        if (risultato.giorniCestino) setGiorniCestino(risultato.giorniCestino);
        if (risultato.archivioPronto !== undefined) setArchivioPronto(risultato.archivioPronto);
        if (risultato.persone) setPersone(risultato.persone);
        if (risultato.soloMie !== undefined) setSoloMie(risultato.soloMie);
        setErrore("");
      })
      .catch((err) => {
        if (!attivo) return;
        gestisciErrore(err);
        setDati({ chiave, media: [], totale: 0, pagine: 1 });
      });

    return () => { attivo = false; };
    // riletture non entra nella chiave: una rilettura deve rifare la stessa
    // richiesta, non farla sembrare una richiesta diversa.
  }, [chiave, pagina, cartellaId, tipo, tag, cerca, persona, riletture, gestisciErrore]);

  const opzioniTag = useMemo(() => [
    { valore: "", etichetta: "Tutte le etichette" },
    ...etichette.map((e) => ({ valore: e.tag, etichetta: `${e.tag} (${e.quanti})` }))
  ], [etichette]);

  const opzioniCartella = useMemo(() => [
    { valore: "", etichetta: "Senza cartella" },
    ...cartelle.map((c) => ({ valore: String(c.id), etichetta: c.nome }))
  ], [cartelle]);

  const cambiaFiltro = (azione) => (valore) => {
    setPagina(1);
    azione(valore);
  };

  /* ---------- Il file aperto nel pannello ---------- */

  const apri = async (file) => {
    setCopiato(false);

    // Si mostra subito quello che l'elenco ha già in mano: aprire un
    // pannello vuoto in attesa di una richiesta, per dei dati che ci sono
    // quasi tutti, è un'attesa regalata.
    setAperto({ ...file, uso: null });
    setForm({
      titolo: file.titolo ?? "",
      alt: file.alt ?? "",
      tag: (file.tag ?? []).join(", "),
      cartellaId: file.cartellaId ? String(file.cartellaId) : ""
    });

    try {
      const dettaglio = await getMedia(file.id);
      setAperto((prima) => (prima?.id === file.id ? { ...prima, uso: dettaglio.uso } : prima));
    } catch (err) {
      gestisciErrore(err);
    }
  };

  const salva = async (evento) => {
    evento.preventDefault();
    setSalvataggio(true);

    try {
      const aggiornato = await aggiornaMedia(aperto.id, {
        titolo: form.titolo.trim(),
        alt: form.alt.trim(),
        // Qui sì che si spezza sulle virgole: il campo è uno solo e chi
        // scrive sta buttando giù un elenco.
        tag: form.tag.split(",").map((t) => t.trim()).filter(Boolean),
        cartellaId: form.cartellaId ? Number(form.cartellaId) : null
      });

      setAperto((prima) => ({ ...prima, ...aggiornato }));
      rileggi();
      avvisa("Informazioni salvate.");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  const cancella = async (file) => {
    const ok = await conferma({
      titolo: `Mettere "${file.titolo || "questo file"}" nel cestino?`,
      testo: `Sparisce dalla libreria e resta nel cestino ${giorniCestino} giorni, `
        + "poi viene cancellato davvero. Se è ancora usato da qualche parte, "
        + "l'operazione viene rifiutata.",
      conferma: "Cestina",
      pericolo: true
    });
    if (!ok) return;

    try {
      await eliminaMedia(file.id);
      if (aperto?.id === file.id) setAperto(null);
      rileggi();
      avvisa("File nel cestino.", "info");
    } catch (err) {
      gestisciErrore(err);
    }
  };

  const ripesca = async (file) => {
    try {
      await ripristinaMedia(file.id);
      setAperto(null);
      rileggi();
      avvisa("File ripescato dal cestino.");
    } catch (err) {
      gestisciErrore(err);
    }
  };

  const cancellaPerSempre = async (file) => {
    const ok = await conferma({
      titolo: `Cancellare per sempre "${file.titolo || "questo file"}"?`,
      testo: "Questa non si annulla: spariscono la riga e il file stesso. "
        + "Lasciandolo nel cestino succede lo stesso, ma fra qualche giorno.",
      conferma: "Cancella per sempre",
      pericolo: true
    });
    if (!ok) return;

    try {
      await eliminaMediaPerSempre(file.id);
      setAperto(null);
      rileggi();
      avvisa("File cancellato.", "info");
    } catch (err) {
      gestisciErrore(err);
    }
  };

  const copiaIndirizzo = async () => {
    try {
      await navigator.clipboard.writeText(new URL(aperto.url, window.location.origin).href);
      setCopiato(true);
    } catch {
      avvisa("Il browser non ha permesso di copiare. Apri il file e copia l'indirizzo dalla barra.", "errore");
    }
  };

  /* ---------- Caricamento ---------- */

  const carica = async (evento) => {
    const scelti = [...(evento.target.files ?? [])];
    // Il campo si svuota subito: senza, riscegliere lo stesso file dopo un
    // errore non farebbe scattare niente.
    evento.target.value = "";
    if (scelti.length === 0) return;

    setCaricando(true);
    let riusciti = 0;

    for (const file of scelti) {
      if (!TIPI_AMMESSI.includes(file.type)) {
        avvisa(`"${file.name}": tipo di file non ammesso.`, "errore");
        continue;
      }
      if (file.size > BYTE_MASSIMI) {
        avvisa(`"${file.name}" supera i 25 MB.`, "errore");
        continue;
      }

      try {
        await uploadMedia(file, {
          title: file.name,
          // La cartella dentro al bucket resta "notizie": è dove il file
          // viene scritto, e non c'entra con la cartella della libreria.
          cartella: "notizie",
          // Se si sta guardando una cartella, il file finisce lì: è dove
          // chi carica si aspetta di ritrovarlo.
          cartellaId: cartellaId && cartellaId !== "senza" ? Number(cartellaId) : undefined
        });
        riusciti += 1;
      } catch (err) {
        gestisciErrore(err);
      }
    }

    setCaricando(false);

    if (riusciti > 0) {
      rileggi();
      avvisa(riusciti === 1 ? "File caricato." : `${riusciti} file caricati.`);
    }
  };

  /* ---------- Cartelle ---------- */

  const nuovaCartella = async () => {
    const nome = await chiediTesto({
      titolo: "Nuova cartella",
      testo: "Come si chiama?",
      segnaposto: "Es. Feste e tornei",
      conferma: "Crea"
    });
    if (!nome) return;

    try {
      const creata = await creaCartellaMedia(nome);
      rileggi();
      avvisa(`Cartella "${creata.nome}" creata.`);
    } catch (err) {
      gestisciErrore(err);
    }
  };

  const rinomina = async (cartella) => {
    const nome = await chiediTesto({
      titolo: "Rinomina la cartella",
      testo: "Il nome nuovo:",
      valoreIniziale: cartella.nome,
      conferma: "Rinomina"
    });
    if (!nome || nome === cartella.nome) return;

    try {
      await rinominaCartellaMedia(cartella.id, nome);
      rileggi();
      avvisa("Cartella rinominata.");
    } catch (err) {
      gestisciErrore(err);
    }
  };

  const cancellaCartella = async (cartella) => {
    /* La casella parte spenta e il testo dice cosa succede senza
       spuntarla: chi vuole solo disfare un raggruppamento non deve
       leggere niente per essere al sicuro. */
    const { ok, spuntato } = await confermaConSpunta({
      titolo: `Eliminare la cartella "${cartella.nome}"?`,
      testo: cartella.quanti > 0
        ? `I ${cartella.quanti} file che contiene restano nella libreria, `
          + "senza cartella."
        : "La cartella è vuota.",
      spunta: cartella.quanti > 0
        ? `Cestina anche i ${cartella.quanti} file che contiene `
          + `(restano recuperabili ${giorniCestino} giorni)`
        : null,
      conferma: "Elimina",
      pericolo: true
    });
    if (!ok) return;

    try {
      const esito = await eliminaCartellaMedia(cartella.id, { conFile: spuntato });
      if (String(cartella.id) === cartellaId) setCartellaId("");
      rileggi();

      if (!spuntato) {
        avvisa("Cartella eliminata. I file sono rimasti.", "info");
      } else if (esito.saltati > 0) {
        avvisa(
          `Cartella eliminata, ${esito.cestinati} file nel cestino. `
          + `${esito.saltati} sono rimasti perché ancora usati da qualche parte.`,
          "info"
        );
      } else {
        avvisa(`Cartella eliminata e ${esito.cestinati} file nel cestino.`, "info");
      }
    } catch (err) {
      gestisciErrore(err);
    }
  };

  const nessunFiltro = !cerca && !tag && !cartellaId && !tipo && !persona;

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">
            {soloMie ? "La tua libreria" : "Libreria"}
          </h1>
          <p className="adm-page-sub">
            {soloMie
              ? "Foto e video che carichi tu, per la tua squadra. Cartelle ed etichette servono a ritrovarli."
              : "I file già caricati. Cartelle ed etichette servono a ritrovarli: sono parole tue, senza un elenco da rispettare."}
          </p>
        </div>

        <div className="adm-head-actions">
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            onClick={() => campoFile.current?.click()}
            disabled={caricando || !archivioPronto}
            title={archivioPronto
              ? "Scegli uno o più file"
              : "I caricamenti non sono ancora attivi su questa versione"}
          >
            <FaUpload /> {caricando
              ? "Caricamento…"
              : cartellaScelta
                ? `Carica in ${cartellaScelta.nome}`
                : "Carica file"}
          </button>

          <input
            ref={campoFile}
            type="file"
            accept={TIPI_AMMESSI.join(",")}
            multiple
            onChange={carica}
            hidden
          />
        </div>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {/* Detto subito e non in fondo: chi carica una foto deve saperlo
          PRIMA di caricarla, non dopo. "La tua libreria" non vuol dire
          privata, vuol dire che ci metti le cose tue. */}
      {soloMie && (
        <div className="adm-alert adm-alert-info">
          <FaInfoCircle />
          <span>
            Qui vedi soltanto i file che hai caricato tu. <strong>Chi
            amministra il sito li vede tutti</strong>, insieme a quelli di
            tutti gli altri, nella libreria principale: non è uno spazio
            privato, è il tuo scaffale dentro all'archivio della società.
          </span>
        </div>
      )}

      <div className="adm-toolbar">
        <Tendina
          className="adm-filter-select"
          valore={tipo}
          onChange={cambiaFiltro(setTipo)}
          opzioni={TIPI}
          segnaposto="Tutti i tipi"
          etichettaAria="Filtra per tipo di file"
        />

        <Tendina
          className="adm-filter-select"
          valore={tag}
          onChange={cambiaFiltro(setTag)}
          opzioni={opzioniTag}
          segnaposto="Tutte le etichette"
          etichettaAria="Filtra per etichetta"
        />

        <form
          className="adm-search"
          role="search"
          onSubmit={(e) => { e.preventDefault(); setPagina(1); setCerca(scritto.trim()); }}
        >
          <FaSearch className="adm-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="adm-input"
            value={scritto}
            onChange={(e) => setScritto(e.target.value)}
            placeholder="Cerca nel nome o nella descrizione…"
            aria-label="Cerca fra i file"
          />
          <button type="submit" className="adm-btn adm-btn-ghost">Cerca</button>
        </form>
      </div>

      <div className="lib-impianto">

        {/* ---------- Le cartelle ---------- */}
        <nav className="lib-cartelle" aria-label="Cartelle">

          {/* Le voci fisse tutte insieme in cima: ci sono sempre, non si
              rinominano e non si cancellano. Sotto, le cartelle che le
              persone creano — che un giorno saranno tante, e infatti
              scorrono per conto loro. */}
          <div className="lib-fisse">
            {!soloMie && (
              <button
                type="button"
                className={`lib-cartella ${tuttiIFile ? "is-scelta" : ""}`}
                onClick={() => vaiA({ cartella: "", persona: "" })}
              >
                <FaImages aria-hidden="true" />
                <span className="lib-cartella-nome">Tutti i file</span>
              </button>
            )}

            {/* Per chi vede solo la propria roba è l'unica voce e vuol
                dire "tutto"; per chi vede l'archivio intero è il filtro
                sulle proprie cose, che altrimenti si perdono in mezzo a
                quelle di tutti. */}
            <button
              type="button"
              className={`lib-cartella ${mieiFile ? "is-scelta" : ""}`}
              onClick={() => vaiA({
                cartella: "",
                persona: soloMie ? "" : String(user?.id ?? "")
              })}
            >
              <FaUserCircle aria-hidden="true" />
              <span className="lib-cartella-nome">I miei file</span>
            </button>

            {condivise.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`lib-cartella ${cartellaId === String(c.id) ? "is-scelta" : ""}`}
                onClick={() => vaiA({ cartella: String(c.id) })}
              >
                <FaUsers aria-hidden="true" />
                <span className="lib-cartella-nome">{c.nome}</span>
                <span className="lib-cartella-quanti">{c.quanti}</span>
              </button>
            ))}

            {/* I file non ancora ordinati sono quelli su cui c'è da
                lavorare: in coda all'elenco non li apriva nessuno. */}
            <button
              type="button"
              className={`lib-cartella ${cartellaId === "senza" ? "is-scelta" : ""}`}
              onClick={() => vaiA({ cartella: "senza" })}
            >
              <FaFolder aria-hidden="true" />
              <span className="lib-cartella-nome">Senza cartella</span>
              <span className="lib-cartella-quanti">{senzaCartella}</span>
            </button>

            <button
              type="button"
              className={`lib-cartella lib-cestino ${cartellaId === "cestino" ? "is-scelta" : ""}`}
              onClick={() => vaiA({ cartella: "cestino" })}
              title={`I file cestinati spariscono da soli dopo ${giorniCestino} giorni`}
            >
              <FaTrashAlt aria-hidden="true" />
              <span className="lib-cartella-nome">Cestino</span>
              <span className="lib-cartella-quanti">{cestinati}</span>
            </button>
          </div>

          {altre.length > 0 && (
            <>
              <span className="lib-gruppo-titolo">Cartelle</span>

              {/* Scorre per conto suo: con venti cartelle, senza questo la
                  barra laterale diventa più alta della pagina e il cestino
                  finisce sotto ai piedi di tutto. */}
              <div className="lib-cartelle-elenco">
                {altre.map((c) => {
                  const scelta = cartellaId === String(c.id);

                  return (
                    <div key={c.id} className={`lib-cartella-riga ${scelta ? "is-scelta" : ""}`}>
                      <button
                        type="button"
                        className="lib-cartella"
                        onClick={() => vaiA({ cartella: String(c.id) })}
                      >
                        {/* La condivisa ha un'icona sua: è l'unica cartella in
                            cui quello che si mette lo vedono tutti, e va
                            riconosciuta prima di trascinarci dentro qualcosa. */}
                        {c.condivisa
                          ? <FaUsers aria-hidden="true" />
                          : scelta ? <FaFolderOpen aria-hidden="true" /> : <FaFolder aria-hidden="true" />}
                        <span className="lib-cartella-nome">{c.nome}</span>
                        <span className="lib-cartella-quanti">{c.quanti}</span>
                      </button>

                      {/* I comandi compaiono al passaggio: sono tre righe fisse e
                          sei pulsanti sempre accesi le farebbero sembrare una
                          barra degli strumenti invece di un elenco. */}
                      {/* Rinomina ed elimina solo a chi governa l'archivio: le
                          cartelle sono di tutti, e un allenatore che ne rinomina
                          una la rinomina anche agli altri. */}
                      {!soloMie && <span className="lib-cartella-comandi">
                        <button
                          type="button"
                          className="adm-icon-btn"
                          onClick={() => rinomina(c)}
                          title={`Rinomina ${c.nome}`}
                          aria-label={`Rinomina la cartella ${c.nome}`}
                        >
                          <FaPencilAlt />
                        </button>
                        <button
                          type="button"
                          className="adm-icon-btn adm-icon-danger"
                          onClick={() => cancellaCartella(c)}
                          title={`Elimina ${c.nome}`}
                          aria-label={`Elimina la cartella ${c.nome}`}
                        >
                          <FaTrashAlt />
                        </button>
                      </span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!soloMie && (
            <button type="button" className="lib-nuova-cartella" onClick={nuovaCartella}>
              <FaFolderPlus aria-hidden="true" /> Nuova cartella
            </button>
          )}

          {/* ---------- Per persona ----------
              Ogni persona che ha caricato qualcosa diventa una cartella:
              con quattro allenatori che mettono le foto delle proprie
              partite, un elenco unico ordinato per data è illeggibile, e la
              domanda che ci si fa è "cosa ha messo il mister del volley". */}
          {persone.length > 0 && (
            <div className="lib-persone">
              <span className="lib-gruppo-titolo">Chi ha caricato</span>

              <button
                type="button"
                className={`lib-cartella ${persona === "" ? "is-scelta" : ""}`}
                onClick={() => cambiaFiltro(setPersona)("")}
              >
                <FaUserCircle aria-hidden="true" />
                <span className="lib-cartella-nome">Tutti</span>
              </button>

              {persone.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`lib-cartella ${persona === String(p.id) ? "is-scelta" : ""}`}
                  onClick={() => cambiaFiltro(setPersona)(String(p.id))}
                >
                  <FaUserCircle aria-hidden="true" />
                  <span className="lib-cartella-nome">{p.nome}</span>
                  <span className="lib-cartella-quanti">{p.quanti}</span>
                </button>
              ))}
            </div>
          )}
        </nav>

        {/* ---------- I file ---------- */}
        <div className="lib-elenco">
          {descrizione && (
            <p className="lib-descrizione">
              <FaInfoCircle aria-hidden="true" /> <span>{descrizione}</span>
            </p>
          )}

          {/*
            * L'attesa sta SOPRA alla griglia, non prima.
            *
            * Stando nel flusso, la riga "Carico i file…" compariva e spingeva
            * in giù tutte le schede, poi spariva e le tirava su: a ogni
            * cambio di cartella la griglia faceva un salto. Adesso galleggia
            * al centro e sotto non si muove niente — e quando i file di
            * prima ci sono ancora restano lì, appena sbiaditi, invece di
            * essere sostituiti da dodici sagome grigie.
            */}
          <div className="lib-risultati">
            {caricamento && (
              <p className="lib-attesa" role="status">
                <span className="adm-spinner adm-spinner-piccolo" aria-hidden="true" />
                Carico i file…
              </p>
            )}

            {dati.media.length === 0 && caricamento ? (
              <ul className="lib-griglia is-attesa" aria-hidden="true">
                {Array.from({ length: 12 }, (_, i) => (
                  <li key={i}><span className="lib-sagoma" /></li>
                ))}
              </ul>
            ) : dati.media.length === 0 ? (
              <div className="adm-empty">
                <FaImages className="adm-empty-icon" />
                <p>
                  {cartellaId === "cestino"
                    ? "Il cestino è vuoto."
                    : nessunFiltro
                      ? "Non c'è ancora nessun file. Caricane uno con il pulsante in alto."
                      : "Nessun file corrisponde a questi filtri."}
                </p>
              </div>
            ) : (
              <ul className={`lib-griglia ${caricamento ? "is-attesa" : ""}`}>
              {dati.media.map((file) => (
                <li key={file.id} className="lib-cella">
                  <button
                    type="button"
                    className={`lib-scheda ${aperto?.id === file.id ? "is-scelta" : ""}`}
                    onClick={() => apri(file)}
                    aria-pressed={aperto?.id === file.id}
                  >
                    <span className="lib-anteprima">
                      <Anteprima file={file} />
                    </span>

                    <span className="lib-nome">{file.titolo || "senza titolo"}</span>

                    <span className="lib-sotto">
                      {quando(file.creatoIl)}
                      {peso(file.byte) && ` · ${peso(file.byte)}`}
                    </span>

                    {/* Chi l'ha caricato: nella cartella condivisa è la
                        domanda che ci si fa per prima, perché lì dentro
                        mettono tutti. Sui propri file non serve dirlo. */}
                    {file.caricatoDa && (file.cartellaCondivisa || !soloMie) && (
                      <span className="lib-chi">di {file.caricatoDa}</span>
                    )}

                    {file.tag.length > 0 && (
                      <span className="lib-etichette">
                        {file.tag.slice(0, 3).map((t) => (
                          <span key={t} className="lib-etichetta">{t}</span>
                        ))}
                        {file.tag.length > 3 && (
                          <span className="lib-etichetta">+{file.tag.length - 3}</span>
                        )}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    className="adm-icon-btn adm-icon-danger lib-cancella"
                    onClick={() => cancella(file)}
                    title="Cancella"
                    aria-label={`Cancella ${file.titolo || "il file"}`}
                  >
                    <FaTrashAlt />
                  </button>
                </li>
              ))}
              </ul>
            )}
          </div>

          {!caricamento && (
            <Paginazione
              pagina={dati.pagina ?? pagina}
              pagine={dati.pagine}
              onCambia={setPagina}
              totale={dati.totale}
              nome={["file", "file"]}
            />
          )}
        </div>

        {/* ---------- Il file scelto ---------- */}
        {aperto && (
          <button
            type="button"
            className="lib-velo"
            onClick={() => setAperto(null)}
            aria-label="Chiudi le informazioni"
          />
        )}

        {aperto && (
          <aside ref={cassetto} className="lib-pannello" aria-label="Informazioni sul file">
            <div className="lib-pannello-testa">
              <h2 className="adm-panel-title">Informazioni</h2>
              <button
                type="button"
                className="adm-icon-btn"
                onClick={() => setAperto(null)}
                aria-label="Chiudi le informazioni sul file"
                title="Chiudi"
              >
                <FaTimes />
              </button>
            </div>

            {/* Solo questa parte scorre: testa e comandi restano fermi, così
                "Salva" è sempre raggiungibile anche su un file con dieci
                etichette. */}
            <div className="lib-pannello-corpo">
            <div className="lib-grande">
              <Anteprima file={aperto} subito />
            </div>

            {/* Il modulo ha un nome perché "Salva" sta nel piede, fuori da
                lui: senza, il pulsante non saprebbe cosa inviare. */}
            <form id="modulo-media" onSubmit={salva}>
              <label className="adm-field">
                <span className="adm-label">Titolo</span>
                <input
                  type="text"
                  className="adm-input"
                  value={form.titolo}
                  onChange={(e) => setForm({ ...form, titolo: e.target.value })}
                  maxLength={300}
                  disabled={salvataggio}
                />
              </label>

              <label className="adm-field">
                <span className="adm-label">Descrizione per chi non vede l&apos;immagine</span>
                <input
                  type="text"
                  className="adm-input"
                  value={form.alt}
                  onChange={(e) => setForm({ ...form, alt: e.target.value })}
                  maxLength={300}
                  disabled={salvataggio}
                />
                <span className="adm-hint">
                  La legge chi usa un lettore di schermo, e compare al posto
                  della foto quando non si carica.
                </span>
              </label>

              <div className="adm-field">
                <span className="adm-label">Cartella</span>
                <Tendina
                  valore={form.cartellaId}
                  onChange={(v) => setForm({ ...form, cartellaId: v })}
                  opzioni={opzioniCartella}
                  segnaposto="Senza cartella"
                  disabilitato={salvataggio}
                  etichettaAria="Cartella del file"
                />
              </div>

              <label className="adm-field">
                <span className="adm-label">
                  <FaTags aria-hidden="true" /> Etichette
                </span>
                <input
                  type="text"
                  className="adm-input"
                  value={form.tag}
                  onChange={(e) => setForm({ ...form, tag: e.target.value })}
                  placeholder="natale, festa, under 14"
                  disabled={salvataggio}
                />
                <span className="adm-hint">
                  Separate da virgola. Vanno tutte in minuscolo: così
                  &quot;Natale&quot; e &quot;natale&quot; restano la stessa cosa.
                </span>
              </label>

              {etichette.length > 0 && (
                <div className="lib-suggerite">
                  <span className="adm-hint">Già in uso:</span>
                  {etichette.slice(0, 12).map((e) => (
                    <button
                      key={e.tag}
                      type="button"
                      className="lib-etichetta lib-etichetta-clic"
                      onClick={() => {
                        const attuali = form.tag.split(",").map((t) => t.trim()).filter(Boolean);
                        if (attuali.includes(e.tag)) return;
                        setForm({ ...form, tag: [...attuali, e.tag].join(", ") });
                      }}
                    >
                      {e.tag}
                    </button>
                  ))}
                </div>
              )}

            </form>
            </div>

            <div className="lib-pannello-piede">
              {/* Un file nel cestino non si modifica: si rimette a posto
                  o si butta via. Mostrare "Salva" qui vorrebbe dire un
                  pulsante che il server rifiuta. */}
              {aperto.cestinatoIl ? (
                <>
                  <p className="adm-hint lib-uso">
                    Nel cestino dal {quando(aperto.cestinatoIl)}. Sparisce da solo
                    {" "}{giorniCestino} giorni dopo.
                  </p>

                  <div className="adm-head-actions">
                    <button
                      type="button"
                      className="adm-btn adm-btn-primary"
                      onClick={() => ripesca(aperto)}
                    >
                      <FaUndo /> Ripesca
                    </button>
                  </div>

                  <button
                    type="button"
                    className="adm-btn adm-btn-pericolo"
                    onClick={() => cancellaPerSempre(aperto)}
                  >
                    <FaTrashAlt /> Cancella per sempre
                  </button>
                </>
              ) : (<>
              {/* Dove è usato: si legge prima di cambiare qualcosa, e prima
                  ancora di cancellare.

                  La riga c'è sempre, anche mentre la risposta è per
                  strada: comparendo e sparendo faceva saltare in su e in
                  giù tutto il piede del cassetto a ogni file aperto. */}
              <p className="adm-hint lib-uso">
                {!aperto.uso
                  ? "Guardo dove è usato…"
                  : aperto.uso.totale === 0
                    ? "Non è usato da nessuna parte."
                    : [
                      aperto.uso.notizie && `${aperto.uso.notizie} notizie`,
                      aperto.uso.eventi && `${aperto.uso.eventi} eventi`
                    ].filter(Boolean).join(", ") + " lo usano."}
              </p>

              <div className="adm-head-actions">
                <button
                  type="submit"
                  form="modulo-media"
                  className="adm-btn adm-btn-primary"
                  disabled={salvataggio}
                >
                  <FaSave /> {salvataggio ? "Salvataggio…" : "Salva"}
                </button>

                <button type="button" className="adm-btn adm-btn-ghost" onClick={copiaIndirizzo}>
                  {copiato ? <><FaCheck /> Copiato</> : <><FaLink /> Copia</>}
                </button>

                {aperto.url && (
                  <a
                    href={aperto.url}
                    target="_blank"
                    rel="noreferrer"
                    className="adm-btn adm-btn-ghost"
                  >
                    <FaExternalLinkAlt /> Apri
                  </a>
                )}
              </div>

              {/* Spento finché non si sa dove il file è usato: cancellare
                  senza saperlo è esattamente quello che questo pulsante
                  non deve permettere. Spento e non assente, se no il piede
                  cambierebbe altezza per mezzo secondo. */}
              <button
                type="button"
                className="adm-btn adm-btn-pericolo"
                onClick={() => cancella(aperto)}
                disabled={!aperto.uso || aperto.uso.totale > 0}
                title={!aperto.uso
                  ? "Un momento: sto guardando dove è usato"
                  : aperto.uso.totale > 0
                    ? "Prima va staccato da dove è usato"
                    : "Cancella il file"}
              >
                <FaTrashAlt /> Metti nel cestino
              </button>
              </>)}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
