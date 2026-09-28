import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaFileAlt, FaPlus, FaPencilAlt, FaSave, FaTimes, FaTrashAlt, FaEye, FaEyeSlash,
  FaArrowUp, FaArrowDown, FaExternalLinkAlt, FaImages, FaUpload, FaLink,
  FaExclamationCircle, FaMapMarkerAlt, FaChevronDown
} from "react-icons/fa";
import {
  listDocumenti, creaDocumento, modificaDocumento, eliminaDocumento,
  riordinaDocumenti, uploadMedia, AuthError
} from "../../api/adminApi";
import { dimenticaDocumenti, dataItaliana } from "../../hooks/useDocumenti";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import Tendina from "./Tendina";
import CampoData from "./CampoData";
import SceltaDallaLibreria from "./SceltaDallaLibreria";
import "../../css/Admin.css";
// I cassetti delle sezioni sono quelli dei tornei, identici
import "../../css/CalendariUfficiali.css";
import "../../css/admin/Documenti.css";

/**
 * I documenti del sito: statuto, vademecum, privacy, policy, rendiconti.
 *
 * Prima stavano scritti a mano nei file di dati delle pagine, e per
 * pubblicare il rendiconto del 5x1000 di quest'anno serviva chi sa mettere
 * le mani nel codice. Qui li cambia chi amministra, da solo: aggiunge,
 * corregge, nasconde, toglie e mette in ordine.
 *
 * La pagina è divisa per SEZIONE, cioè per il punto del sito in cui il
 * documento compare: chi apre questa scheda pensa "la privacy" o "il menu
 * in alto", non "il documento numero 12". Ogni sezione dice dove si vede.
 */

/* Quello che la libreria accetta come documento: il server ha il suo
   elenco ed è quello che conta, questo evita solo un'attesa inutile. */
const TIPI_DOCUMENTO = ["application/pdf"];
const BYTE_MASSIMI = 25 * 1024 * 1024;

/** "2025-12-03T00:00:00" per CampoData, che lavora in ISO con l'ora. */
const versoCampoData = (giorno) => (giorno ? `${giorno}T00:00:00` : "");

/** Da ISO al solo giorno, in ora locale: il fuso lo sposterebbe. */
function giornoLocale(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p2 = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Il nome da mostrare per un indirizzo: l'ultimo pezzo, senza il resto. */
function nomeDaIndirizzo(url) {
  if (!url) return "";
  try {
    const percorso = new URL(url, window.location.origin).pathname;
    return decodeURIComponent(percorso.split("/").filter(Boolean).pop() || url);
  } catch {
    return url;
  }
}

/* Il modulo vuoto. "file" dice da dove viene il documento:
     attuale    quello che ha già (solo in modifica: non si tocca)
     libreria   un file della libreria, scelto o appena caricato
     indirizzo  scritto a mano, /documenti/… o https://… */
function moduloNuovo(sezione) {
  return {
    modo: "nuovo",
    sezione,
    titolo: "",
    descrizione: "",
    anno: "",
    importo: "",
    percepitoIl: "",
    pubblicato: true,
    file: { tipo: "indirizzo", url: "", mediaId: null, nome: "" }
  };
}

function moduloDa(doc) {
  return {
    modo: "modifica",
    id: doc.id,
    sezione: doc.sezione,
    titolo: doc.titolo,
    descrizione: doc.descrizione ?? "",
    anno: doc.anno ?? "",
    importo: doc.importo ?? "",
    percepitoIl: doc.percepitoIl ?? "",
    pubblicato: doc.pubblicato,
    file: { tipo: "attuale", url: doc.url, mediaId: doc.mediaId, nome: doc.nomeFile || nomeDaIndirizzo(doc.url) }
  };
}

export default function DocumentiPage() {
  const navigate = useNavigate();
  const { sessionExpired } = useAuth();
  const { avvisa, conferma } = useDialoghi();

  const [documenti, setDocumenti] = useState([]);
  const [sezioni, setSezioni] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");

  /* Un modulo solo alla volta: due aperti insieme, con un "Salva" in
     ciascuno, non si sa più quale salva cosa. "dove" dice dove si apre:
     in cima alla pagina, dentro una sezione, o al posto di un documento. */
  const [modulo, setModulo] = useState(null);
  const [dove, setDove] = useState(null);
  const [occupato, setOccupato] = useState(false);
  const [libreriaAperta, setLibreriaAperta] = useState(false);
  const [caricandoFile, setCaricandoFile] = useState(false);

  /* Le sezioni aperte. Tutte chiuse all'arrivo, come i tornei dei
     calendari: la pagina si legge come un indice, e si apre solo quella
     che serve. */
  const [aperte, setAperte] = useState(() => new Set());
  const apri = (valore) => setAperte((a) => new Set(a).add(valore));
  const apriChiudi = (valore) => setAperte((a) => {
    const nuove = new Set(a);
    if (nuove.has(valore)) nuove.delete(valore);
    else nuove.add(valore);
    return nuove;
  });

  // Per chi usa un lettore di schermo: dove è finito il documento spostato
  const [annuncio, setAnnuncio] = useState("");
  const campoFile = useRef(null);

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    avvisa(err.message || "Operazione non riuscita.", "errore");
  }, [navigate, sessionExpired, avvisa]);

  const ricarica = useCallback(() => {
    return listDocumenti()
      .then((dati) => {
        setDocumenti(dati.documenti ?? []);
        setSezioni(dati.sezioni ?? []);
        setErrore("");
      })
      .catch((err) => {
        if (err instanceof AuthError) gestisciErrore(err);
        else setErrore(err.message || "I documenti non si sono caricati.");
      })
      .finally(() => setCaricamento(false));
  }, [gestisciErrore]);

  useEffect(() => { ricarica(); }, [ricarica]);

  /* Dopo ogni modifica: il sito pubblico, aperto nella stessa scheda del
     browser, deve rileggere i documenti invece di mostrare la copia vecchia. */
  const cambiato = useCallback(async () => {
    dimenticaDocumenti();
    await ricarica();
  }, [ricarica]);

  const diSezione = (valore) => documenti.filter((d) => d.sezione === valore);
  const sezioneDi = (valore) => sezioni.find((s) => s.valore === valore);

  /* ---------- Modulo ---------- */

  const apriNuovo = (sezione, posto) => {
    setModulo(moduloNuovo(sezione));
    setDove(posto);
    if (posto !== "pagina") apri(sezione);
  };

  const apriModifica = (doc) => {
    setModulo(moduloDa(doc));
    setDove(`doc-${doc.id}`);
  };

  const chiudiModulo = () => {
    setModulo(null);
    setDove(null);
  };

  const campo = (nome) => (valore) => setModulo((m) => ({ ...m, [nome]: valore }));
  const cambiaFile = (file) => setModulo((m) => ({ ...m, file: { ...m.file, ...file } }));

  const caricaDalComputer = async (evento) => {
    const file = evento.target.files?.[0];
    // Svuotato subito: riscegliere lo stesso file dopo un errore deve funzionare
    evento.target.value = "";
    if (!file) return;

    if (!TIPI_DOCUMENTO.includes(file.type)) {
      avvisa(`"${file.name}" non è un PDF. Salvalo come PDF e riprova.`, "errore");
      return;
    }
    if (file.size > BYTE_MASSIMI) {
      avvisa(`"${file.name}" supera i 25 MB.`, "errore");
      return;
    }

    setCaricandoFile(true);
    try {
      // Nella libreria, così lo si ritrova anche da lì
      const caricato = await uploadMedia(file, { title: file.name, cartella: "documenti" });
      cambiaFile({ tipo: "libreria", mediaId: caricato.id, url: caricato.url, nome: file.name });
      avvisa("File caricato. Ricordati di salvare il documento.", "info");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setCaricandoFile(false);
    }
  };

  const salva = async (evento) => {
    evento.preventDefault();
    const m = modulo;
    const sezione = sezioneDi(m.sezione);

    if (m.titolo.trim().length < 2) {
      avvisa("Scrivi il titolo del documento.", "errore");
      return;
    }
    if (m.file.tipo === "indirizzo" && !m.file.url.trim()) {
      avvisa("Manca il file: sceglilo dalla libreria, caricalo, oppure scrivi il suo indirizzo.", "errore");
      return;
    }

    const dati = {
      sezione: m.sezione,
      titolo: m.titolo.trim(),
      descrizione: m.descrizione.trim(),
      pubblicato: m.pubblicato
    };
    // Anno, importo e data servono solo ai rendiconti del 5x1000
    if (sezione?.conRendiconto) {
      dati.anno = m.anno.trim();
      dati.importo = m.importo.trim();
      dati.percepitoIl = m.percepitoIl || null;
    }
    // Il file si manda solo se è nuovo: mandarlo uguale lo "cambierebbe"
    if (m.file.tipo === "libreria") dati.mediaId = m.file.mediaId;
    if (m.file.tipo === "indirizzo") {
      dati.url = m.file.url.trim();
      dati.mediaId = null;
    }

    setOccupato(true);
    try {
      if (m.modo === "nuovo") {
        await creaDocumento(dati);
        avvisa(m.pubblicato
          ? `Documento aggiunto: si vede già in "${sezione?.etichetta ?? m.sezione}".`
          : "Documento aggiunto, per ora nascosto.");
      } else {
        await modificaDocumento(m.id, dati);
        avvisa("Documento salvato.");
      }
      chiudiModulo();
      // Il documento appena salvato si deve vedere: si apre la sua sezione
      apri(m.sezione);
      await cambiato();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setOccupato(false);
    }
  };

  /* ---------- Azioni su un documento ---------- */

  const mostraNascondi = async (doc) => {
    setOccupato(true);
    try {
      await modificaDocumento(doc.id, { pubblicato: !doc.pubblicato });
      avvisa(doc.pubblicato
        ? `"${doc.titolo}" è nascosto: sul sito non si vede più.`
        : `"${doc.titolo}" è di nuovo visibile sul sito.`, "info");
      await cambiato();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setOccupato(false);
    }
  };

  const cancella = async (doc) => {
    const ok = await conferma({
      titolo: `Togliere "${doc.titolo}" dal sito?`,
      testo: "Il documento sparisce dalla pagina. Il file invece resta dov'è "
        + "(nella libreria o nella cartella dei documenti), e lo si può rimettere "
        + "quando serve. Se vuoi solo toglierlo per un po', usa Nascondi.",
      conferma: "Togli dal sito",
      pericolo: true
    });
    if (!ok) return;

    setOccupato(true);
    try {
      await eliminaDocumento(doc.id);
      if (modulo?.id === doc.id) chiudiModulo();
      avvisa("Documento tolto dal sito. Il file è ancora al suo posto.", "info");
      await cambiato();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setOccupato(false);
    }
  };

  /* Su e giù di un posto. L'elenco cambia subito, senza aspettare il
     server: chi sposta un documento di tre posti preme tre volte, e tre
     attese di mezzo secondo lo farebbero sbagliare. Se il server dice di
     no, si rilegge l'ordine vero. */
  const sposta = async (doc, verso) => {
    const elenco = diSezione(doc.sezione);
    const da = elenco.findIndex((d) => d.id === doc.id);
    const a = da + verso;
    if (a < 0 || a >= elenco.length) return;

    const nuovo = [...elenco];
    [nuovo[da], nuovo[a]] = [nuovo[a], nuovo[da]];
    const posizioni = new Map(nuovo.map((d, i) => [d.id, i + 1]));
    setDocumenti((tutti) => tutti
      .map((d) => (posizioni.has(d.id) ? { ...d, ordine: posizioni.get(d.id) } : d))
      .sort((x, y) => x.sezione.localeCompare(y.sezione) || x.ordine - y.ordine || x.id - y.id));

    setAnnuncio(`"${doc.titolo}" ora è ${a + 1}° di ${elenco.length}.`);

    /* Il fuoco resta sulla freccia premuta, così si può premere ancora.
       Se il documento è arrivato in cima (o in fondo) quella freccia si
       spegne, e il fuoco passa all'altra. */
    requestAnimationFrame(() => {
      const stessa = document.getElementById(`dcm-${verso < 0 ? "su" : "giu"}-${doc.id}`);
      const altra = document.getElementById(`dcm-${verso < 0 ? "giu" : "su"}-${doc.id}`);
      (stessa && !stessa.disabled ? stessa : altra)?.focus();
    });

    try {
      await riordinaDocumenti(doc.sezione, nuovo.map((d) => d.id));
      dimenticaDocumenti();
    } catch (err) {
      gestisciErrore(err);
      await ricarica();
    }
  };

  /* ---------- Disegno ---------- */

  if (caricamento) {
    return (
      <div className="adm-page dcm-pagina" aria-busy="true">
        <span className="adm-sagoma adm-sagoma-titolo" />
        <span className="adm-sagoma adm-sagoma-riga" style={{ width: "min(80%, 30rem)" }} />
        {[0, 1, 2].map((i) => (
          <div key={i} className="dcm-sagoma-sezione">
            <span className="adm-sagoma adm-sagoma-riga" style={{ width: "12rem" }} />
            <span className="adm-sagoma adm-sagoma-scheda" />
            <span className="adm-sagoma adm-sagoma-scheda" />
          </div>
        ))}
      </div>
    );
  }

  const opzioniSezione = sezioni.map((s) => ({ valore: s.valore, etichetta: s.etichetta, nota: s.dove }));

  const disegnaModulo = () => {
    const m = modulo;
    const sezione = sezioneDi(m.sezione);
    const nuovo = m.modo === "nuovo";

    return (
      <form className="adm-panel dcm-modulo" onSubmit={salva}>
        <h2 className="adm-panel-title">
          {nuovo ? <FaPlus aria-hidden="true" /> : <FaPencilAlt aria-hidden="true" />}
          {nuovo ? " Nuovo documento" : " Modifica il documento"}
        </h2>

        <div className="adm-field">
          <span className="adm-label" id="dcm-sezione-etichetta">Dove compare sul sito</span>
          <Tendina
            valore={m.sezione}
            onChange={campo("sezione")}
            opzioni={opzioniSezione}
            disabilitato={occupato}
            etichettaAria="Dove compare sul sito"
            cercabile={false}
          />
          {sezione && <span className="adm-hint"><FaMapMarkerAlt aria-hidden="true" className="dcm-dove-icona" /> {sezione.dove}</span>}
        </div>

        <label className="adm-field">
          <span className="adm-label">Titolo</span>
          <input
            type="text"
            className="adm-input"
            value={m.titolo}
            onChange={(e) => campo("titolo")(e.target.value)}
            placeholder={sezione?.conRendiconto ? "Es. Rendiconto 5x1000 2025" : "Es. Statuto della società"}
            maxLength={200}
            disabled={occupato}
            required
          />
          <span className="adm-hint">È quello che legge chi visita il sito.</span>
        </label>

        <label className="adm-field">
          <span className="adm-label">Due righe di spiegazione <em>(facoltativo)</em></span>
          <textarea
            className="adm-input dcm-descrizione"
            value={m.descrizione}
            onChange={(e) => campo("descrizione")(e.target.value)}
            placeholder="Es. Il documento completo sul trattamento dei dati degli iscritti."
            maxLength={600}
            rows={2}
            disabled={occupato}
          />
        </label>

        {/* ---------- Il file ---------- */}
        <fieldset className="dcm-file" disabled={occupato}>
          <legend className="adm-label">Il file</legend>

          {(m.file.tipo === "attuale" || m.file.tipo === "libreria") && (
            <div className="dcm-file-scelto">
              <FaFileAlt aria-hidden="true" />
              <span className="dcm-file-nome">{m.file.nome || nomeDaIndirizzo(m.file.url)}</span>
              {m.file.url && (
                <a href={m.file.url} target="_blank" rel="noopener noreferrer" className="dcm-apri">
                  Apri <FaExternalLinkAlt aria-hidden="true" />
                  <span className="adm-solo-lettori"> (si apre in una nuova scheda)</span>
                </a>
              )}
            </div>
          )}

          <div className="dcm-file-scelte" role="group" aria-label="Da dove prendere il file">
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              onClick={() => setLibreriaAperta(true)}
            >
              <FaImages aria-hidden="true" /> Scegli dalla libreria
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              onClick={() => campoFile.current?.click()}
              disabled={caricandoFile}
            >
              <FaUpload aria-hidden="true" /> {caricandoFile ? "Caricamento…" : "Carica un PDF dal computer"}
            </button>
            <button
              type="button"
              className={`adm-btn adm-btn-ghost ${m.file.tipo === "indirizzo" ? "is-scelto" : ""}`}
              aria-pressed={m.file.tipo === "indirizzo"}
              onClick={() => cambiaFile({
                tipo: "indirizzo",
                // In modifica si parte dall'indirizzo che c'è, da correggere
                url: m.file.tipo === "attuale" ? m.file.url : (m.file.tipo === "indirizzo" ? m.file.url : ""),
                mediaId: null
              })}
            >
              <FaLink aria-hidden="true" /> Scrivi l&apos;indirizzo
            </button>
            <input
              ref={campoFile}
              type="file"
              accept="application/pdf"
              hidden
              onChange={caricaDalComputer}
            />
          </div>

          {m.file.tipo === "indirizzo" && (
            <label className="adm-field dcm-indirizzo">
              <span className="adm-label">Indirizzo del file</span>
              <input
                type="text"
                inputMode="url"
                className="adm-input"
                value={m.file.url}
                onChange={(e) => cambiaFile({ url: e.target.value })}
                placeholder="/documenti/nome-del-file.pdf oppure https://…"
                maxLength={600}
              />
              <span className="adm-hint">
                Un file del sito comincia con <code>/</code> (es. <code>/documenti/statuto.pdf</code>);
                un file su un altro sito con <code>https://</code>.
              </span>
            </label>
          )}
        </fieldset>

        {/* ---------- Solo per i rendiconti del 5x1000 ---------- */}
        {sezione?.conRendiconto && (
          <div className="dcm-rendiconto">
            <label className="adm-field">
              <span className="adm-label">Anno</span>
              <input
                type="text"
                inputMode="numeric"
                className="adm-input"
                value={m.anno}
                onChange={(e) => campo("anno")(e.target.value)}
                placeholder="Es. 2025"
                maxLength={20}
                disabled={occupato}
              />
            </label>
            <label className="adm-field">
              <span className="adm-label">Importo ricevuto</span>
              <input
                type="text"
                inputMode="decimal"
                className="adm-input"
                value={m.importo}
                onChange={(e) => campo("importo")(e.target.value)}
                placeholder="Es. € 2.973,00"
                maxLength={40}
                disabled={occupato}
              />
            </label>
            <div className="adm-field">
              <span className="adm-label">Ricevuto il</span>
              <CampoData
                valore={versoCampoData(m.percepitoIl)}
                onChange={(v) => campo("percepitoIl")(v ? giornoLocale(v) : "")}
                disabilitato={occupato}
                etichettaAria="Data in cui è arrivato l'importo"
                segnaposto="Scegli il giorno"
              />
            </div>
          </div>
        )}

        <label className="adm-check">
          <input
            type="checkbox"
            checked={m.pubblicato}
            onChange={(e) => campo("pubblicato")(e.target.checked)}
            disabled={occupato}
          />
          <span className="adm-check-box" aria-hidden="true" />
          <span>
            Visibile sul sito
            <em> (togli la spunta per prepararlo senza mostrarlo)</em>
          </span>
        </label>

        <div className="adm-barra-azioni-fissa">
          <button type="button" className="adm-btn adm-btn-ghost" onClick={chiudiModulo} disabled={occupato}>
            <FaTimes aria-hidden="true" /> Annulla
          </button>
          <button type="submit" className="adm-btn adm-btn-primary" disabled={occupato || caricandoFile}>
            <FaSave aria-hidden="true" /> {nuovo ? "Aggiungi" : "Salva"}
          </button>
        </div>
      </form>
    );
  };

  const disegnaDocumento = (doc, i, elenco) => {
    if (dove === `doc-${doc.id}` && modulo) {
      return <li key={doc.id} className="dcm-posto-modulo">{disegnaModulo()}</li>;
    }

    const sezione = sezioneDi(doc.sezione);
    const nomeFile = doc.nomeFile || nomeDaIndirizzo(doc.url);

    return (
      <li key={doc.id} className={`adm-scheda dcm-doc ${doc.pubblicato ? "" : "is-nascosto"}`}>
        {/* Le frecce a sinistra, sempre nello stesso punto: si sposta un
            documento premendo più volte senza inseguire il pulsante */}
        <div className="dcm-frecce" role="group" aria-label={`Posizione di ${doc.titolo}`}>
          <button
            id={`dcm-su-${doc.id}`}
            type="button"
            className="adm-icon-btn dcm-freccia"
            onClick={() => sposta(doc, -1)}
            disabled={i === 0}
            aria-label={`Sposta su "${doc.titolo}"`}
            title="Sposta su"
          >
            <FaArrowUp aria-hidden="true" />
          </button>
          <span className="dcm-posizione" aria-hidden="true">{i + 1}</span>
          <button
            id={`dcm-giu-${doc.id}`}
            type="button"
            className="adm-icon-btn dcm-freccia"
            onClick={() => sposta(doc, 1)}
            disabled={i === elenco.length - 1}
            aria-label={`Sposta giù "${doc.titolo}"`}
            title="Sposta giù"
          >
            <FaArrowDown aria-hidden="true" />
          </button>
        </div>

        <div className="dcm-doc-corpo">
          <p className="dcm-doc-titolo">
            {doc.titolo}
            {!doc.pubblicato && (
              <span className="adm-status adm-status-draft" title="Sul sito non si vede">
                <FaEyeSlash aria-hidden="true" /> Nascosto
              </span>
            )}
          </p>

          {doc.descrizione && <p className="dcm-doc-descrizione">{doc.descrizione}</p>}

          {sezione?.conRendiconto && (
            <p className="dcm-doc-dati">
              <span className="adm-status adm-status-pending">Anno {doc.anno || "—"}</span>
              <span className="adm-status adm-status-publish">{doc.importo || "importo mancante"}</span>
              <span className="dcm-doc-data">
                Ricevuto il {doc.percepitoIl ? dataItaliana(doc.percepitoIl) : "—"}
              </span>
            </p>
          )}

          <p className="dcm-doc-file">
            <FaFileAlt aria-hidden="true" />
            <span className="dcm-file-nome" title={doc.url}>{nomeFile}</span>
            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="dcm-apri">
              Apri <FaExternalLinkAlt aria-hidden="true" />
              <span className="adm-solo-lettori"> {doc.titolo} (si apre in una nuova scheda)</span>
            </a>
          </p>

          {/* Le azioni con la parola scritta: chi apre questa scheda due
              volte l'anno non deve indovinare cosa fa un'icona */}
          <div className="dcm-doc-azioni">
            <button
              type="button"
              className="adm-btn adm-btn-ghost adm-btn-piccolo"
              onClick={() => apriModifica(doc)}
              disabled={occupato || !!modulo}
            >
              <FaPencilAlt aria-hidden="true" /> Modifica
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-ghost adm-btn-piccolo"
              onClick={() => mostraNascondi(doc)}
              disabled={occupato}
              title={doc.pubblicato ? "Resta qui, ma sul sito non si vede" : "Torna visibile sul sito"}
            >
              {doc.pubblicato ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
              {doc.pubblicato ? " Nascondi" : " Mostra"}
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-ghost adm-btn-piccolo adm-btn-cancella"
              onClick={() => cancella(doc)}
              disabled={occupato}
            >
              <FaTrashAlt aria-hidden="true" /> Elimina
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="adm-page dcm-pagina">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <p className="adm-occhiello">Sito</p>
          <h1 className="adm-page-title">Documenti</h1>
          <p className="adm-page-sub">
            Statuto, privacy, policy e rendiconti: i file che chiunque può
            scaricare dal sito. Da qui li aggiungi, li correggi, li nascondi
            e decidi in che ordine compaiono.
          </p>
        </div>

        {!modulo && sezioni.length > 0 && (
          <div className="adm-head-actions">
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={() => apriNuovo(sezioni[0].valore, "pagina")}
            >
              <FaPlus aria-hidden="true" /> Aggiungi un documento
            </button>
          </div>
        )}
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle aria-hidden="true" /> <span>{errore}</span>
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-piccolo" onClick={ricarica}>
            Riprova
          </button>
        </div>
      )}

      <p className="adm-solo-lettori" aria-live="polite">{annuncio}</p>

      {modulo && dove === "pagina" && disegnaModulo()}

      {!errore && documenti.length === 0 && !modulo && (
        <div className="adm-vuoto-amico">
          <span className="adm-vuoto-icona"><FaFileAlt aria-hidden="true" /></span>
          <h2>Nessun documento, per ora</h2>
          <p>Aggiungi lo statuto, la privacy o un rendiconto: comparirà nella pagina giusta del sito.</p>
          <button
            type="button"
            className="adm-btn adm-btn-arancio"
            onClick={() => apriNuovo(sezioni[0]?.valore ?? "menu", "pagina")}
          >
            <FaPlus aria-hidden="true" /> Aggiungi un documento
          </button>
        </div>
      )}

      {/* Un cassetto per sezione, come i tornei dei calendari ufficiali:
          chiusi all'arrivo, si aprono col pulsante tondo a destra. Dentro,
          l'elenco scorre per conto suo, così una sezione con venti
          rendiconti non spinge le altre in fondo alla pagina. */}
      {sezioni.map((s) => {
        const elenco = diSezione(s.valore);
        const nascosti = elenco.filter((d) => !d.pubblicato).length;
        // Un modulo aperto dentro alla sezione la tiene aperta
        const conModulo = modulo && (dove === `sezione-${s.valore}` || elenco.some((d) => dove === `doc-${d.id}`));
        const aperta = aperte.has(s.valore) || !!conModulo;
        const idCassetto = `dcm-cassetto-${s.valore}`;

        return (
          <section key={s.valore} className="adm-panel adm-cal-torneo dcm-sezione" aria-labelledby={`dcm-sez-${s.valore}`}>
            <div className="adm-cal-testata">
              <div className="adm-cal-testata-testo dcm-testata-testo">
                <header className="adm-cal-fonte-testa">
                  <h2 className="adm-cal-fonte-nome" id={`dcm-sez-${s.valore}`}>{s.etichetta}</h2>
                  <span className="adm-badge-conta is-neutro" title="Documenti in questa sezione">
                    {elenco.length}
                  </span>
                  {nascosti > 0 && (
                    <span className="adm-status adm-status-draft">
                      {nascosti === 1 ? "1 nascosto" : `${nascosti} nascosti`}
                    </span>
                  )}
                </header>
                <p className="adm-hint dcm-dove">
                  <FaMapMarkerAlt aria-hidden="true" className="dcm-dove-icona" /> {s.dove}
                </p>
              </div>

              <button
                type="button"
                className={`adm-cal-apri ${aperta ? "is-aperto" : ""}`}
                aria-expanded={aperta}
                aria-controls={idCassetto}
                aria-label={aperta ? `Chiudi ${s.etichetta}` : `Apri ${s.etichetta}`}
                title={aperta ? "Chiudi" : "Mostra i documenti"}
                onClick={() => apriChiudi(s.valore)}
                disabled={!!conModulo}
              >
                <FaChevronDown className="adm-cal-freccia" aria-hidden="true" />
              </button>
            </div>

            {/* Nascosto e non smontato, per l'animazione; da chiuso è
                "inert" (vedi CalendariUfficialiPage) */}
            <div
              id={idCassetto}
              className={`adm-cal-cassetto ${aperta ? "is-aperto" : ""}`}
              inert={aperta ? undefined : ""}
            >
              <div className="adm-cal-cassetto-dentro">
                <div className="adm-cal-cassetto-contenuto dcm-cassetto">
                  {!modulo && (
                    <button
                      type="button"
                      className="adm-btn adm-btn-ghost adm-btn-piccolo dcm-aggiungi-qui"
                      onClick={() => apriNuovo(s.valore, `sezione-${s.valore}`)}
                    >
                      <FaPlus aria-hidden="true" /> Aggiungi qui
                    </button>
                  )}

                  {modulo && dove === `sezione-${s.valore}` && disegnaModulo()}

                  {elenco.length > 0 ? (
                    <div className="dcm-scorrevole" tabIndex={-1}>
                      <ul className="adm-schede dcm-elenco">
                        {elenco.map((doc, i) => disegnaDocumento(doc, i, elenco))}
                      </ul>
                    </div>
                  ) : (
                    <p className="dcm-vuoto">
                      Nessun documento: in questo punto il sito non mostra niente.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })}

      {libreriaAperta && (
        <SceltaDallaLibreria
          tipo="documento"
          onScegli={(file) => {
            setLibreriaAperta(false);
            if (!file) return;
            cambiaFile({ tipo: "libreria", mediaId: file.id, url: file.url, nome: file.titolo || nomeDaIndirizzo(file.url) });
          }}
          onChiudi={() => setLibreriaAperta(false)}
        />
      )}
    </div>
  );
}
