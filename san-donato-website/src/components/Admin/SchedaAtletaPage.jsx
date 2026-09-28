import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft, FaArrowRight, FaSave, FaExclamationCircle, FaHeartbeat, FaEuroSign,
  FaUserCircle, FaFileMedical, FaExternalLinkAlt,
  FaInfoCircle, FaUsers, FaUpload, FaCheckCircle, FaTimesCircle,
  FaHourglassHalf, FaPhoneAlt, FaDoorOpen, FaUndo, FaHistory
} from "react-icons/fa";
import {
  getAtleta, salvaSchedaAtleta,
  uploadMedia, validaCertificato, decidiParentela, listTariffe,
  segnaRitiro, annullaRitiro, segnaAbbandono, annullaAbbandono, AuthError
} from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { useDialoghi } from "../../context/dialoghi";
import { useStagione } from "../../context/stagione";
import { euro } from "../../utils/soldi";
import { raggruppaPerAnno } from "../../utils/versamenti";
import { statoCertificato, quantoManca } from "../../utils/certificato";
import { anni } from "../../utils/eta";
import Tendina from "./Tendina";
import CampoData from "./CampoData";
import Ritratto from "./Ritratto";
import "../../css/Admin.css";
import "../../css/Ritratto.css";
import "../../css/admin/Persone.css";

const TIPI_CERTIFICATO = [
  { valore: "", etichetta: "Non indicato" },
  { valore: "non_agonistico", etichetta: "Non agonistico" },
  { valore: "agonistico", etichetta: "Agonistico" }
];

const METODI = [
  { valore: "bonifico", etichetta: "Bonifico" },
  { valore: "contanti", etichetta: "Contanti" },
  { valore: "pos", etichetta: "Bancomat o carta" },
  { valore: "altro", etichetta: "Altro" }
];

const NOME_METODO = Object.fromEntries(METODI.map((m) => [m.valore, m.etichetta]));

/**
 * I campi dell'anagrafica, raggruppati per argomento.
 *
 * Prima erano sette caselle di fila dentro a una griglia sola: la data di
 * nascita accanto al telefono del genitore, il codice fiscale in mezzo
 * all'indirizzo. Tre gruppetti con un titolo si leggono in un colpo d'occhio
 * e si compilano nell'ordine in cui la gente ha i dati sottomano.
 */
const GRUPPI = [
  {
    titolo: "Chi è",
    campi: [
      { chiave: "dataNascita", etichetta: "Data di nascita", tipo: "date" },
      { chiave: "luogoNascita", etichetta: "Comune di nascita", max: 120 },
      { chiave: "provinciaNascita", etichetta: "Provincia di nascita", max: 60 },
      { chiave: "codiceFiscale", etichetta: "Codice fiscale", max: 16, maiuscolo: true },
      // La taglia della maglia è la domanda che la segreteria fa a sessanta
      // famiglie ogni settembre: qui la trova già scritta.
      { chiave: "tagliaMaglietta", etichetta: "Taglia della maglia", max: 20 }
    ]
  },
  {
    titolo: "Dove abita",
    campi: [
      { chiave: "indirizzo", etichetta: "Via o piazza", max: 200, largo: true },
      { chiave: "civico", etichetta: "Civico", max: 20 },
      { chiave: "cap", etichetta: "CAP", max: 5 },
      { chiave: "citta", etichetta: "Comune", max: 120 },
      { chiave: "provincia", etichetta: "Provincia", max: 60 }
    ]
  }
];

/*
 * I contatti hanno una scheda loro, e non una riga in fondo all'anagrafica.
 *
 * Sono l'unica cosa di questa pagina che si cerca di corsa: un ragazzo si
 * fa male, e chi è in palestra apre la scheda dal telefono per chiamare
 * qualcuno. Sepolti fra il codice fiscale e il CAP si trovavano tardi.
 */
const CONTATTI = [
  { prefisso: "tutore", titolo: "Chi chiamare per primo" },
  { prefisso: "tutore2", titolo: "Se non risponde" }
];

/** Dalla data ISO al solo giorno "2026-05-14", in ora locale. */
function giornoLocale(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

function dataLeggibile(iso) {
  if (!iso) return "—";
  // Le date della scheda sono "2026-05-14", senza ora: aggiungere mezzanotte
  // evita che il fuso le sposti al giorno prima.
  return new Date(`${iso}T00:00:00`).toLocaleDateString("it-IT", {
    day: "2-digit", month: "long", year: "numeric"
  });
}

/** Una voce in sola lettura. */
function Dato({ etichetta, children }) {
  return (
    <div className="adm-dato">
      <dt className="adm-dato-etichetta">{etichetta}</dt>
      <dd className="adm-dato-valore">{children || <em>non indicato</em>}</dd>
    </div>
  );
}


/**
 * La scheda di un atleta: chi è, se può giocare, se ha pagato.
 *
 * Si LEGGE, quasi tutto. Anagrafica, recapiti, tutore e note sono dati della
 * persona e li scrive lei dalla propria area: nemmeno un amministratore li
 * tocca da qui.
 *
 * Restano scrivibili due cose, con due permessi diversi:
 *
 *   quote.gestisci        la quota della stagione e i versamenti, che non
 *                         sono dati personali ma i conti della società
 *   certificato.registra  tipo, scadenza e copia del certificato, per chi
 *                         lo consegna su carta in sede
 *
 * Un allenatore non ha né l uno né l altro, e le quote non gli arrivano
 * proprio: il server non gliele manda. I campi in sola lettura sono la stessa
 * regola che applica il server — un modulo che il salvataggio rifiuterebbe
 * sarebbe solo un modo elaborato di far perdere tempo a chi lo compila.
 */
export default function SchedaAtletaPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();
  const area = useArea();
  const { avvisa, chiediTesto, conferma } = useDialoghi();
  // La stagione scelta in alto: le passate si guardano e basta
  const { stagioneId, scegli: scegliStagione } = useStagione();

  const [atleta, setAtleta] = useState(null);
  const [tariffe, setTariffe] = useState([]);
  const [form, setForm] = useState(null);
  /* Due viste della stessa scheda e non due pagine: i contatti si cercano
     di corsa — un ragazzo si è fatto male e serve un numero — e cambiare
     indirizzo per arrivarci vuol dire perdere quello che si stava
     guardando. Il modulo è lo stesso, quindi non si perde niente di
     scritto passando dall'una all'altra. */
  const [vista, setVista] = useState("scheda");

  const [caricamento, setCaricamento] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState("");

  const [caricandoFile, setCaricandoFile] = useState(false);

  // Il giorno del ritiro: vuoto vuol dire oggi, il caso normale
  const [dataRitiro, setDataRitiro] = useState("");
  const inputFile = useRef(null);

  // Fissato all'apertura: leggere l'orologio mentre si disegna darebbe al
  // componente un risultato diverso a ogni passaggio.
  const [oggi] = useState(() => new Date());

  const capacita = user?.capabilities ?? [];

  /**
   * Due permessi distinti, e non uno solo chiamato "puo gestire".
   *
   * Chi tiene i conti vede e scrive quote e versamenti. Chi registra i
   * certificati carica la copia consegnata a mano e ne scrive tipo e
   * scadenza. Un allenatore non ha ne l uno ne l altro: della sua squadra
   * gli serve sapere chi puo scendere in campo, non chi ha pagato.
   */
  const tieneIConti = capacita.includes("quote.gestisci");
  const registraCertificati = capacita.includes("certificato.registra");
  const puoScrivere = tieneIConti || registraCertificati;

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    setErrore(err.message || "Operazione non riuscita.");
    avvisa(err.message || "Operazione non riuscita.", "errore");
  }, [navigate, sessionExpired, avvisa]);

  const daAtleta = (a) => ({
    dataNascita: a.dataNascita ?? "",
    luogoNascita: a.luogoNascita ?? "",
    codiceFiscale: a.codiceFiscale ?? "",
    telefono: a.telefono ?? "",
    indirizzo: a.indirizzo ?? "",
    tutoreNome: a.tutoreNome ?? "",
    tutoreTelefono: a.tutoreTelefono ?? "",
    tipoCertificato: a.tipoCertificato ?? "",
    certificatoScadenza: a.certificatoScadenza ?? "",
    tipoQuotaId: a.tipoQuotaId ? String(a.tipoQuotaId) : "",
    note: a.note ?? ""
  });

  /* Le tariffe si leggono una volta sola: servono a riempire la tendina, e
     non cambiano mentre si guarda una scheda. Un errore qui non ferma la
     pagina — la scheda si legge lo stesso, si resta senza scelte. */
  useEffect(() => {
    if (!tieneIConti) return;

    let attivo = true;
    listTariffe()
      .then((elenco) => attivo && setTariffe(elenco))
      .catch(() => {});

    return () => { attivo = false; };
  }, [tieneIConti]);

  const carica = useCallback(() => {
    return getAtleta(id, { stagioneId })
      .then((a) => {
        setAtleta(a);
        setForm(daAtleta(a));
        setCaricamento(false);
      })
      .catch((err) => {
        gestisciErrore(err);
        setCaricamento(false);
      });
  }, [id, stagioneId, gestisciErrore]);

  useEffect(() => { carica(); }, [carica]);

  /**
   * Porta a una linguetta e, se serve, a un riquadro preciso dentro.
   *
   * È il gesto dei pulsanti "Controlla il certificato", "Conferma
   * fratello": dicono cosa fare, e poi ci portano. Si aspetta che la
   * linguetta sia disegnata (due giri di schermo) prima di scorrere, o il
   * riquadro ancora non c'è. Il fuoco segue, per chi usa la tastiera.
   */
  const vai = (nuovaVista, ancora) => {
    setVista(nuovaVista);
    if (!ancora) return;

    const piano = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(ancora);
      if (!el) return;
      el.scrollIntoView({ behavior: piano ? "auto" : "smooth", block: "start" });
      el.focus?.({ preventScroll: true });
    }));
  };

  /* ---------- Salvataggio della scheda ---------- */

  const salva = async (evento) => {
    evento.preventDefault();
    setErrore("");
    setSalvataggio(true);

    try {
      // Parte solo ciò che questo permesso apre. Il resto è dell atleta: il
      // server lo rifiuterebbe comunque, e mandarglielo sarebbe solo un modo
      // di scoprirlo più tardi.
      const aggiornato = await salvaSchedaAtleta(id, {
        ...(tieneIConti ? {
          // Stringa vuota vuol dire "nessuna quota", che è diverso da una
          // quota di zero euro: la prima toglie l'importo, la seconda è una
          // tariffa gratuita e ha un suo id.
          tipoQuotaId: form.tipoQuotaId ? Number(form.tipoQuotaId) : null
        } : {}),
        ...(registraCertificati ? {
          tipoCertificato: form.tipoCertificato || null,
          certificatoScadenza: form.certificatoScadenza || null
        } : {})
      });

      setAtleta(aggiornato);
      setForm(daAtleta(aggiornato));
      avvisa("Scheda salvata.");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  /**
   * Accetta o respinge il certificato consegnato.
   *
   * Il motivo del rifiuto lo chiede il server, non per burocrazia: senza,
   * la famiglia si vede il certificato respinto e deve telefonare in
   * segreteria per sapere cosa rifare — la telefonata che questo sito
   * dovrebbe risparmiare.
   */
  const decidiCertificato = async (approva) => {
    let motivo;

    if (!approva) {
      motivo = await chiediTesto({
        titolo: "Perché lo respingi?",
        testo: "Lo legge l'atleta nella sua pagina: scrivi cosa deve rifare.",
        segnaposto: "Es. manca la seconda pagina, quella con la firma.",
        conferma: "Respingi"
      });
      if (!motivo) return;
    }

    setSalvataggio(true);
    try {
      setAtleta(await validaCertificato(id, { approva, motivo }));
      avvisa(approva ? "Certificato accettato." : "Certificato respinto.", approva ? "ok" : "info");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  /**
   * Conferma o respinge una parentela dichiarata.
   *
   * Confermare applica da sé la tariffa Famiglia (deciso dalla società il 28
   * settembre 2026), ma solo al posto di una quota vuota o automatica: una
   * tariffa scelta a mano dalla segreteria resta. Lo fa il server
   * (applicaTariffaFamiglia), e l'avviso dice qual è stato l'esito.
   */
  const decidiLegame = async (legameId, conferma) => {
    let motivo;

    if (!conferma) {
      motivo = await chiediTesto({
        titolo: "Perché non la riconosci?",
        testo: "Lo legge chi l'ha dichiarata, nella sua pagina.",
        segnaposto: "Es. il codice fiscale è di un genitore, non di un fratello.",
        conferma: "Respingi"
      });
      if (!motivo) return;
    }

    setSalvataggio(true);
    try {
      const esito = await decidiParentela(id, { legameId, conferma, motivo });
      setAtleta(esito.atleta);
      setForm(daAtleta(esito.atleta));
      avvisa(
        !conferma
          ? "Parentela respinta."
          : esito.tariffaApplicata
            ? `Parentela confermata: applicata la tariffa "${esito.tariffaApplicata}".`
            // Una tariffa scelta a mano resta, oppure la famiglia è spenta
            : "Parentela confermata. La tariffa attuale è stata lasciata com'era.",
        conferma ? "ok" : "info"
      );
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  /**
   * Segna che la persona ha smesso durante la stagione.
   *
   * Non la toglie dalla squadra né chiude l'account: cambia il conto — prima
   * di gennaio la seconda metà non è più dovuta — e mette il segno accanto
   * al nome. Si annulla, per chi ci ripensa.
   */
  const ritira = async () => {
    const motivo = await chiediTesto({
      titolo: `Segnare il ritiro di ${atleta.nomeCompleto}?`,
      testo: "Resta nell'elenco con i suoi conti. Il motivo è facoltativo e lo legge solo lo staff.",
      segnaposto: "Es. si è trasferito, ha cambiato sport.",
      conferma: "Segna il ritiro",
      obbligatorio: false
    });
    if (motivo === null) return;

    setSalvataggio(true);
    try {
      setAtleta(await segnaRitiro(id, { data: dataRitiro || undefined, motivo: motivo || undefined }));
      setDataRitiro("");
      avvisa("Ritiro segnato.", "ok");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  const riapri = async () => {
    setSalvataggio(true);
    try {
      setAtleta(await annullaRitiro(id));
      avvisa("Ritiro annullato: l'iscrizione è di nuovo attiva.", "ok");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  /**
   * "Abbandonato": per la stagione in corso non c'è — non ha rinnovato, o
   * non ha mai versato. Non chiude l'account e non cancella niente; il
   * conto segue la regola del ritiro: prima di gennaio la seconda metà non
   * è dovuta. Si riattiva con un clic.
   */
  const abbandona = async () => {
    const ok = await conferma({
      titolo: `Segnare ${atleta.nomeCompleto} come abbandonato?`,
      testo: "Per questa stagione non risulterà iscritto. Se è prima di gennaio non deve la seconda metà della quota; la prima sì. L'account resta: può ancora entrare, e lo si riattiva quando vuoi.",
      conferma: "Segna come abbandonato"
    });
    if (!ok) return;

    setSalvataggio(true);
    try {
      setAtleta(await segnaAbbandono(id));
      avvisa("Segnato come abbandonato.", "ok");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  const riattiva = async () => {
    setSalvataggio(true);
    try {
      setAtleta(await annullaAbbandono(id));
      avvisa("Riattivato: di nuovo iscritto alla stagione.", "ok");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  /* ---------- Copia del certificato ---------- */

  // Apre la scelta del file: dal pulsante del riquadro e da quello in cima
  const scegliFile = () => inputFile.current?.click();

  const caricaCertificato = async (evento) => {
    const file = evento.target.files?.[0];
    evento.target.value = "";
    if (!file) return;

    setErrore("");
    setCaricandoFile(true);

    try {
      // Niente prepareImage: un certificato è quasi sempre un PDF o una
      // scansione, e ricomprimerlo rischia di renderlo illeggibile proprio
      // dove conta, cioè sulla data.
      const salvato = await uploadMedia(file, {
        title: `Certificato medico — ${atleta.nomeCompleto}`,
        cartella: "certificati",
        tag: ["certificato"]
      });

      setAtleta(await salvaSchedaAtleta(id, { certificatoMediaId: salvato.id }));
      avvisa("Copia del certificato caricata.");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setCaricandoFile(false);
    }
  };

  /* ---------- Render ---------- */

  if (caricamento) {
    return (
      <div className="adm-page" aria-busy="true" aria-label="Caricamento della scheda">
        <span className="adm-sagoma adm-sagoma-titolo" />
        <span className="adm-sagoma adm-sagoma-riga" style={{ width: "50%" }} />
        <span className="adm-sagoma adm-sagoma-scheda" />
        <span className="adm-sagoma adm-sagoma-scheda" />
      </div>
    );
  }

  if (!atleta) {
    return (
      <div className="adm-page">
        <div className="adm-vuoto-amico">
          <span className="adm-vuoto-icona"><FaUserCircle aria-hidden="true" /></span>
          <h2>Scheda non trovata</h2>
          <p>{errore || "Questa persona non c'è più, oppure non è in una delle tue squadre."}</p>
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => navigate(`${area}/atleti`)}>
            <FaArrowLeft /> Torna agli atleti
          </button>
        </div>
      </div>
    );
  }

  /*
   * Le tariffe proponibili.
   *
   * Le spente non si propongono più, tranne quella che questa persona ha
   * già: toglierla dall'elenco farebbe comparire la tendina vuota, e
   * salvando le si cancellerebbe la quota senza averlo chiesto.
   */
  const opzioniTariffa = [
    { valore: "", etichetta: "Nessuna quota" },
    ...tariffe
      .filter((t) => t.attiva || t.id === atleta.tipoQuotaId)
      .map((t) => ({
        valore: String(t.id),
        etichetta: `${t.nome} — ${euro(t.importoCentesimi)}`,
        nota: t.attiva ? t.descrizione : "spenta"
      }))
  ];

  /*
   * C'è davvero qualcosa da salvare?
   *
   * Un pulsante "Salva" sempre acceso su una scheda che si apre soprattutto
   * per guardare chiede di premerlo, e chi lo preme non sa mai se ha
   * cambiato qualcosa. Compare quando serve e sparisce quando non serve
   * più: la sua presenza è essa stessa l'avviso che ci sono modifiche
   * non salvate.
   */
  const originale = daAtleta(atleta);
  const sporco = Object.keys(originale).some((c) => (form[c] ?? "") !== (originale[c] ?? ""));

  const eta = anni(atleta.dataNascita);
  const minore = eta != null && eta < 18;

  const cert = statoCertificato(atleta.certificatoScadenza, oggi, {
    fileCaricato: Boolean(atleta.certificatoMediaId),
    validazione: atleta.certificatoStato
  });

  /*
   * Il controllo riguarda il FILE, non la scadenza.
   *
   * Una data battuta a mano dall'atleta non è qualcosa che la segreteria
   * possa approvare: senza il foglio da guardare non c'è niente da
   * accettare né da respingere. Prima il riquadro compariva anche lì, e
   * diceva "controllato e accettato" accanto a "file non caricato".
   */
  const haCertificato = Boolean(atleta.certificatoMediaId);
  /* Sul DOVUTO, non sulla quota intera: chi si è ritirato prima di gennaio
     deve solo la prima metà. Il conto lo fa il server, qui si legge. */
  const conto = atleta.conto ?? null;
  // Una stagione passata si legge e basta: quota e ritiro non si toccano più
  const soloLettura = Boolean(atleta.stagione && !atleta.stagione.inCorso);
  const manca = conto?.dovuto == null ? null : conto.residuo;
  const attivo = !atleta.ritirato && !atleta.abbandonato;
  const senzaQuota = atleta.quotaStagionaleCentesimi == null;

  const legamiInAttesa = (atleta.legami ?? []).filter((l) => l.stato === "in_attesa").length;

  const tonoCert = cert.chiave === "scaduto" || cert.chiave === "respinto" ? "is-allarme"
    : ["in_scadenza", "da_controllare", "senza_file", "mancante"].includes(cert.chiave) ? "is-attenzione"
      : cert.chiave === "valido" ? "is-ok" : "";

  const tonoQuota = senzaQuota ? (attivo ? "is-attenzione" : "")
    : manca > 0 ? "is-allarme" : "is-ok";

  /*
   * Cosa c'è da fare su questa scheda, detto in parole e con il pulsante
   * accanto.
   *
   * Prima le stesse cose erano sparse: il certificato da controllare nella
   * colonna di destra, il fratello da confermare in fondo alla linguetta
   * della quota — dove nessuno lo trovava se non andava a cercarlo. Qui
   * stanno tutte in cima, e ogni pulsante porta dove si risolve.
   */
  const daFare = [];

  if (registraCertificati && haCertificato && atleta.certificatoStato === "da_validare" && cert.chiave !== "scaduto") {
    daFare.push({
      chiave: "cert-controllo",
      tono: "is-attenzione",
      Icona: FaFileMedical,
      testo: <>Ha caricato il certificato: <strong>aspetta il tuo controllo</strong>.</>,
      azione: { etichetta: "Controlla il certificato", primaria: true, vista: "scheda", ancora: "prs-certificato" }
    });
  } else if (cert.chiave === "scaduto" || cert.chiave === "mancante" || cert.chiave === "senza_file" || cert.chiave === "respinto") {
    daFare.push({
      chiave: "cert-manca",
      tono: cert.chiave === "senza_file" || cert.chiave === "mancante" ? "is-attenzione" : "is-allarme",
      Icona: FaHeartbeat,
      testo: cert.chiave === "scaduto"
        ? <>Il certificato è <strong>scaduto</strong>: non può scendere in campo finché non ne consegna uno nuovo.</>
        : cert.chiave === "respinto"
          ? <>Il certificato è stato <strong>respinto</strong>: deve consegnarne uno giusto.</>
          : cert.chiave === "senza_file"
            ? <>Ha scritto la scadenza ma <strong>manca la copia</strong> del certificato.</>
            : <>Non ha ancora consegnato il <strong>certificato medico</strong>.</>,
      azione: registraCertificati
        ? { etichetta: "Carica tu la copia", file: true }
        : null
    });
  } else if (cert.chiave === "in_scadenza") {
    daFare.push({
      chiave: "cert-scade",
      tono: "is-attenzione",
      Icona: FaHourglassHalf,
      testo: <>Il certificato <strong>{quantoManca(cert.giorni)}</strong>: conviene ricordarglielo.</>,
      azione: null
    });
  }

  if (tieneIConti && legamiInAttesa > 0) {
    daFare.push({
      chiave: "fratelli",
      tono: "is-attenzione",
      Icona: FaUsers,
      testo: legamiInAttesa === 1
        ? <>Un <strong>fratello o sorella</strong> dichiarato da confermare.</>
        : <><strong>{legamiInAttesa} fratelli o sorelle</strong> dichiarati da confermare.</>,
      azione: { etichetta: "Conferma fratello", primaria: true, vista: "quota", ancora: "prs-fratelli" }
    });
  }

  if (tieneIConti && senzaQuota && attivo && !soloLettura) {
    daFare.push({
      chiave: "quota",
      tono: "is-attenzione",
      Icona: FaEuroSign,
      testo: <><strong>Nessuna quota assegnata</strong>: vede <em>da definire</em> e non può pagare.</>,
      azione: { etichetta: "Scegli la tariffa", primaria: true, vista: "quota", ancora: "prs-tariffa" }
    });
  }

  /* Cosa manca perché l'iscrizione sia completa. Lo dice il server, che
     è lo stesso conto che vede l'atleta nella sua area: così segreteria e
     atleta leggono la stessa frase. Il certificato è già detto sopra. */
  const altroChemanca = (atleta.manca ?? []).filter((m) => !/certificato/i.test(m));
  if (altroChemanca.length > 0) {
    daFare.push({
      chiave: "manca",
      tono: "",
      Icona: FaInfoCircle,
      testo: <>Deve ancora inserire <strong>{altroChemanca.join(", ")}</strong> dalla sua area.</>,
      azione: null
    });
  }

  // Un minorenne senza nessuno da chiamare: va visto subito, non la sera
  // che serve.
  if (minore && !atleta.tutoreTelefono) {
    daFare.push({
      chiave: "tutore",
      tono: "is-attenzione",
      Icona: FaPhoneAlt,
      testo: <>È minorenne e <strong>non ha indicato un adulto da chiamare</strong>.</>,
      azione: { etichetta: "Vedi i contatti", vista: "contatti" }
    });
  }

  const nomeTariffa = atleta.tipoQuota
    ?? tariffe.find((t) => t.id === atleta.tipoQuotaId)?.nome
    ?? null;

  const percento = conto?.dovuto > 0
    ? Math.min(100, Math.round((atleta.versatoCentesimi / conto.dovuto) * 100))
    : 0;

  const viste = [
    { valore: "scheda", etichetta: "Scheda", Icona: FaUserCircle, conta: registraCertificati && daFare.some((d) => d.chiave === "cert-controllo") ? 1 : 0 },
    { valore: "contatti", etichetta: "Contatti", Icona: FaPhoneAlt, conta: 0 },
    /* La quota solo a chi tiene i conti: a un allenatore quei numeri non
       arrivano nemmeno dal server, e una linguetta che apre una pagina
       vuota è peggio di una linguetta che non c'è. */
    ...(tieneIConti
      ? [{
        valore: "quota",
        etichetta: "Quota",
        Icona: FaEuroSign,
        conta: legamiInAttesa + (senzaQuota && attivo && !soloLettura ? 1 : 0)
      }]
      : [])
  ];

  return (
    <div className="adm-page prs-pagina prs-scheda">
      <button
        type="button"
        className="adm-btn adm-btn-ghost adm-btn-piccolo prs-indietro"
        onClick={() => navigate(`${area}/atleti`)}
      >
        <FaArrowLeft /> Tutti gli atleti
      </button>

      {/* ---------- Chi è ----------
          Foto e nome sulla stessa riga: aprendo una scheda la prima domanda
          è sempre "di chi è", e la faccia risponde prima del nome. Email,
          stato e data dell'account accanto: sono l'etichetta di chi si sta
          guardando, non un riquadro da leggere. */}
      <header className="prs-testata">
        <Ritratto nome={atleta.nomeCompleto} url={atleta.immagineUrl} dimensione="l" />

        <div className="prs-testata-chi">
          <p className="adm-occhiello">
            Atleta{atleta.stagione ? ` · stagione ${atleta.stagione.nome}` : ""}
          </p>
          <h1 className="adm-page-title">
            {atleta.nomeCompleto}
            {atleta.ritirato && <span className="adm-badge-ritirato">Ritirato</span>}
            {atleta.abbandonato && <span className="adm-badge-ritirato is-abbandonato">Abbandonato</span>}
          </h1>
          <p className="prs-testata-dati">
            <span>{atleta.squadre.map((s) => s.nome).join(", ") || "Nessuna squadra"}</span>
            {eta != null && <span>{eta} anni</span>}
            <a href={`mailto:${atleta.email}`} className="adm-email">{atleta.email}</a>
            {atleta.stato !== "attivo" && (
              <span className="adm-status adm-status-draft">{atleta.stato}</span>
            )}
            <span className="prs-testata-nota">
              {atleta.ultimoAccesso
                ? `ultimo accesso ${new Date(atleta.ultimoAccesso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}`
                : "mai entrato nel sito"}
              {" · account dal "}
              {new Date(atleta.creatoIl).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </p>
        </div>
      </header>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {soloLettura && (
        <div className="adm-alert adm-alert-info" role="status">
          <FaHistory aria-hidden="true" />
          <span>
            Stai guardando la stagione <strong>{atleta.stagione.nome}</strong>: quota,
            versamenti e ritiro sono quelli di allora e non si modificano.{" "}
            <button type="button" className="adm-link-btn" onClick={() => scegliStagione(null)}>
              Torna alla stagione in corso
            </button>
          </span>
        </div>
      )}

      {/* ---------- Le due domande ----------
          Può giocare? Ha pagato? Prima di leggere qualunque altra cosa. Sono
          anche pulsanti: toccarle porta dove si guarda il dettaglio. */}
      <div className="prs-stati">
        <button
          type="button"
          className={`prs-stato-carta ${tonoCert}`}
          onClick={() => vai("scheda", "prs-certificato")}
        >
          <span className="prs-stato-icona"><FaHeartbeat aria-hidden="true" /></span>
          <span className="prs-stato-cosa">Certificato medico</span>
          <span className="prs-stato-valore">{cert.etichetta}</span>
          <span className="prs-stato-nota">
            {cert.giorni != null ? quantoManca(cert.giorni) : "nessuna scadenza registrata"}
          </span>
        </button>

        {tieneIConti && (
          <button
            type="button"
            className={`prs-stato-carta ${tonoQuota}`}
            onClick={() => vai("quota", "prs-quota")}
          >
            <span className="prs-stato-icona"><FaEuroSign aria-hidden="true" /></span>
            <span className="prs-stato-cosa">Quota{nomeTariffa ? ` · ${nomeTariffa}` : ""}</span>
            <span className="prs-stato-valore">
              {manca == null ? "Da impostare"
                : manca > 0 ? `${euro(manca)} da versare`
                  : "Saldata"}
            </span>
            <span className="prs-stato-nota">
              {manca == null
                ? "nessuna tariffa scelta"
                : `versati ${euro(atleta.versatoCentesimi)} su ${euro(conto.dovuto)}`}
            </span>
          </button>
        )}
      </div>

      {/* ---------- Cosa c'è da fare ---------- */}
      {daFare.length > 0 ? (
        <section className="prs-cosa-fare" aria-labelledby="scheda-da-fare">
          <h2 className="prs-cosa-fare-titolo" id="scheda-da-fare">
            {daFare.length === 1 ? "C'è una cosa da sistemare" : `Ci sono ${daFare.length} cose da sistemare`}
          </h2>
          <ul>
            {daFare.map((d) => (
              <li key={d.chiave} className={d.tono}>
                <span className="prs-cosa-icona"><d.Icona aria-hidden="true" /></span>
                <span className="prs-cosa-testo">{d.testo}</span>
                {d.azione && (
                  <button
                    type="button"
                    className={`adm-btn ${d.azione.primaria ? "adm-btn-primary" : "adm-btn-ghost"}`}
                    onClick={() => (d.azione.file ? scegliFile() : vai(d.azione.vista, d.azione.ancora))}
                    disabled={salvataggio || caricandoFile}
                  >
                    {d.azione.etichetta} <FaArrowRight aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="prs-tutto-ok" role="status">
          <FaCheckCircle aria-hidden="true" />
          <span><strong>Tutto in ordine.</strong> Per {atleta.nome || atleta.nomeCompleto} non c&apos;è niente da sistemare.</span>
        </p>
      )}

      {/* Il file del certificato si sceglie da qui, fuori dalle linguette:
          lo apre anche il pulsante "Carica tu la copia" in cima, che deve
          funzionare qualunque linguetta sia aperta. */}
      {registraCertificati && (
        <input
          ref={inputFile}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          hidden
          onChange={caricaCertificato}
        />
      )}

      {/* ---------- Le linguette ----------
          Tre viste della stessa scheda e non tre pagine: i contatti si
          cercano di corsa, e cambiare indirizzo per arrivarci vorrebbe dire
          perdere quello che si stava guardando. Con le parole sempre
          scritte, anche sul telefono: tre icone da sole non si capiscono. */}
      <div className="prs-viste" role="group" aria-label="Cosa guardare di questa persona">
        {viste.map(({ valore, etichetta, Icona, conta }) => (
          <button
            key={valore}
            type="button"
            className={`prs-vista ${vista === valore ? "is-active" : ""}`}
            onClick={() => setVista(valore)}
            aria-pressed={vista === valore}
          >
            <Icona aria-hidden="true" />
            <span>{etichetta}</span>
            {conta > 0 && <span className="adm-badge-conta is-attenzione">{conta}</span>}
          </button>
        ))}
      </div>

      {/* Un modulo solo per tutta la scheda: certificato e quota stanno in
          due linguette diverse ma si salvano con un gesto solo, dalla barra
          in fondo che compare quando c'è qualcosa di cambiato. */}
      <form id="scheda-atleta" onSubmit={salva}>
        {/* ---------- Scheda: certificato e anagrafica ---------- */}
        {vista === "scheda" && (
          <div className="adm-editor-grid prs-scheda-griglia">
            <div className="adm-editor-col">
              <section className="adm-panel">
                <h2 className="adm-panel-title">
                  <FaUserCircle aria-hidden="true" /> Anagrafica
                </h2>

                {/* Sempre in sola lettura, per chiunque.
                    I dati di una persona li scrive quella persona, dalla sua
                    area: dall'altra parte si leggono e basta. Non è un
                    permesso mancante da aggiungere un giorno, è la regola. */}
                {GRUPPI.map((gruppo) => (
                  <div className="adm-gruppo" key={gruppo.titolo}>
                    <p className="adm-gruppo-titolo">{gruppo.titolo}</p>
                    <dl className="adm-scheda-dati">
                      {gruppo.campi.map((c) => (
                        <Dato etichetta={c.etichetta} key={c.chiave}>
                          {c.tipo === "date" ? dataLeggibile(atleta[c.chiave]) : atleta[c.chiave]}
                        </Dato>
                      ))}
                    </dl>
                  </div>
                ))}

                {atleta.note && (
                  <div className="adm-gruppo">
                    <p className="adm-gruppo-titolo">Cose da sapere</p>
                    <p className="adm-nota-richiesta">{atleta.note}</p>
                  </div>
                )}

                <p className="adm-hint">
                  Questi dati li compila {atleta.nomeCompleto} dalla propria area,
                  nella pagina Iscrizione. Se c&apos;è un errore, il modo di
                  correggerlo è chiederglielo.
                </p>
              </section>
            </div>

            {/* Il certificato prima dell'anagrafica sul telefono (vedi il
                CSS): è la cosa che si viene a fare, l'anagrafica si legge. */}
            <aside className="adm-editor-side">
              <section className="adm-panel prs-ancora" id="prs-certificato" tabIndex={-1}>
                <h2 className="adm-panel-title">
                  <FaHeartbeat aria-hidden="true" /> Certificato medico
                </h2>

                <p className={`adm-cert adm-cert-grande ${cert.classe}`}>
                  {cert.etichetta}
                  {cert.giorni != null && <span className="adm-cert-nota">{quantoManca(cert.giorni)}</span>}
                </p>

                {/* Il controllo della segreteria è un'altra cosa dalla
                    scadenza: un foglio può essere in corso di validità e
                    comunque sbagliato — pagina mancante, sport sbagliato,
                    nome di un altro. */}
                {haCertificato && (
                  <div className={`adm-validazione is-${atleta.certificatoStato}`}>
                    <span className="adm-validazione-stato">
                      {atleta.certificatoStato === "valido" && <><FaCheckCircle aria-hidden="true" /> Controllato e accettato</>}
                      {atleta.certificatoStato === "da_validare" && <><FaHourglassHalf aria-hidden="true" /> Da controllare</>}
                      {atleta.certificatoStato === "rifiutato" && <><FaTimesCircle aria-hidden="true" /> Respinto</>}
                    </span>

                    {atleta.certificatoStato === "rifiutato" && atleta.certificatoMotivo && (
                      <span className="adm-validazione-motivo">{atleta.certificatoMotivo}</span>
                    )}

                    {registraCertificati && atleta.certificatoStato !== "valido" && (
                      <>
                        {/* Il controllo in due passi, detti: prima si
                            guarda il foglio, poi si decide. Il pulsante
                            per aprirlo sta qui e non più in fondo. */}
                        <span className="adm-validazione-motivo">
                          Apri la copia e guarda che nome, tipo e scadenza siano giusti.
                        </span>
                        {atleta.certificatoUrl && (
                          <a
                            href={atleta.certificatoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="adm-btn adm-btn-ghost adm-btn-block"
                          >
                            <FaFileMedical /> Apri la copia <FaExternalLinkAlt />
                          </a>
                        )}
                        <div className="adm-validazione-azioni">
                          <button
                            type="button"
                            className="adm-btn adm-btn-primary"
                            onClick={() => decidiCertificato(true)}
                            disabled={salvataggio}
                          >
                            <FaCheckCircle /> Accetta
                          </button>
                          <button
                            type="button"
                            className="adm-btn adm-btn-ghost"
                            onClick={() => decidiCertificato(false)}
                            disabled={salvataggio}
                          >
                            <FaTimesCircle /> Respingi
                          </button>
                        </div>
                      </>
                    )}

                    {registraCertificati && atleta.certificatoStato === "valido" && (
                      <button
                        type="button"
                        className="adm-btn adm-btn-ghost adm-btn-piccolo"
                        onClick={() => decidiCertificato(false)}
                        disabled={salvataggio}
                      >
                        Revoca l&apos;approvazione
                      </button>
                    )}
                  </div>
                )}

                {registraCertificati ? (
                  <div className="prs-campi-cert">
                    <div className="adm-field">
                      <span className="adm-label">Tipo</span>
                      <Tendina
                        valore={form.tipoCertificato}
                        onChange={(v) => setForm({ ...form, tipoCertificato: v })}
                        opzioni={TIPI_CERTIFICATO}
                        disabilitato={salvataggio}
                        etichettaAria="Tipo di certificato"
                      />
                    </div>

                    <div className="adm-field">
                      <span className="adm-label">Scadenza</span>
                      <CampoData
                        valore={form.certificatoScadenza ? `${form.certificatoScadenza}T00:00:00` : ""}
                        onChange={(v) => setForm({
                          ...form,
                          // La colonna e un date senza ora: si tiene solo la parte
                          // del giorno, in ora locale, o il fuso la sposterebbe.
                          certificatoScadenza: v ? giornoLocale(v) : ""
                        })}
                        disabilitato={salvataggio}
                        etichettaAria="Scadenza del certificato"
                      />
                    </div>
                  </div>
                ) : (
                  <dl className="adm-dati">
                    <Dato etichetta="Tipo">
                      {atleta.tipoCertificato === "agonistico" ? "Agonistico"
                        : atleta.tipoCertificato === "non_agonistico" ? "Non agonistico" : null}
                    </Dato>
                    <Dato etichetta="Scadenza">{dataLeggibile(atleta.certificatoScadenza)}</Dato>
                  </dl>
                )}

                {/* Il file e una cosa a parte dalla scadenza: si puo sapere quando
                    scade senza averne la copia, ed e il caso piu comune. */}
                <div className="adm-cert-file">
                  {/* Se c'è da controllarlo, il pulsante per aprirlo sta già
                      nel riquadro qui sopra: due uguali confondono */}
                  {atleta.certificatoUrl && !(registraCertificati && atleta.certificatoStato !== "valido") && (
                    <a
                      href={atleta.certificatoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="adm-btn adm-btn-ghost adm-btn-block"
                    >
                      <FaFileMedical /> Apri il certificato <FaExternalLinkAlt />
                    </a>
                  )}
                  {!atleta.certificatoUrl && (
                    <p className="adm-hint" style={{ marginTop: 0 }}>
                      Nessun file caricato.
                    </p>
                  )}

                  {registraCertificati ? (
                    <>
                      <button
                        type="button"
                        className="adm-btn adm-btn-secondary adm-btn-block"
                        onClick={scegliFile}
                        disabled={caricandoFile || salvataggio}
                      >
                        <FaUpload />
                        {caricandoFile
                          ? "Caricamento…"
                          : atleta.certificatoUrl ? "Sostituisci la copia" : "Carica la copia"}
                      </button>
                      <p className="adm-hint">
                        Per chi lo consegna su carta in sede: lo carichi tu al
                        posto suo. Chi ce l&apos;ha in digitale fa prima a
                        caricarlo dalla propria pagina Iscrizione.
                      </p>
                    </>
                  ) : (
                    <p className="adm-hint">
                      Lo consegna l&apos;atleta dalla propria pagina Iscrizione, oppure
                      su carta in segreteria. Se manca o è scaduto, va sollecitato.
                    </p>
                  )}
                </div>
              </section>
            </aside>
          </div>
        )}

        {/* ---------- Contatti ----------
            Chi c'è dietro al ragazzo, e come lo si chiama. Visibile anche
            all'allenatore: è lui che è in campo quando serve davvero. Il
            numero è un pulsante grande: si preme col pollice, di corsa. */}
        {vista === "contatti" && (
          <section className="adm-panel prs-contatti">
            <h2 className="adm-panel-title">
              <FaPhoneAlt aria-hidden="true" /> Contatti
            </h2>

            {minore && !atleta.tutoreTelefono && (
              <p className="adm-alert adm-alert-warn" role="status">
                <FaExclamationCircle aria-hidden="true" />
                <span>
                  {atleta.nomeCompleto} è minorenne e non ha indicato nessun
                  adulto da chiamare. Glielo si può chiedere: lo compila
                  dalla sua pagina Iscrizione.
                </span>
              </p>
            )}

            <div className="prs-contatti-griglia">
              {CONTATTI.map((contatto, indice) => {
                const nome = atleta[`${contatto.prefisso}Nome`];
                const parentela = atleta[`${contatto.prefisso}Parentela`];
                const telefono = atleta[`${contatto.prefisso}Telefono`];
                const email = atleta[`${contatto.prefisso}Email`];

                /* Il secondo contatto compare solo se c'è: un riquadro
                   di "non indicato" ripetuto fa sembrare incompleta una
                   scheda che non lo è. */
                if (indice > 0 && !nome && !telefono && !email) return null;

                return (
                  <div className="prs-contatto" key={contatto.prefisso}>
                    <p className="prs-contatto-titolo">{contatto.titolo}</p>
                    <p className="prs-contatto-nome">
                      {nome || <em>non indicato</em>}
                      {parentela && <span> · {parentela}</span>}
                    </p>
                    {telefono ? (
                      <a href={`tel:${telefono}`} className="adm-btn adm-btn-primary prs-chiama">
                        <FaPhoneAlt aria-hidden="true" /> {telefono}
                      </a>
                    ) : (
                      <p className="adm-hint">Nessun telefono indicato.</p>
                    )}
                    {email && <a href={`mailto:${email}`} className="adm-email">{email}</a>}
                  </div>
                );
              })}

              {/* I suoi recapiti dopo quelli degli adulti: per un
                  ragazzo, chi si chiama per primo è un genitore. */}
              <div className="prs-contatto">
                <p className="prs-contatto-titolo">{minore ? "Il ragazzo" : "I suoi recapiti"}</p>
                <p className="prs-contatto-nome">{atleta.nomeCompleto}</p>
                {atleta.telefono ? (
                  <a href={`tel:${atleta.telefono}`} className="adm-btn adm-btn-secondary prs-chiama">
                    <FaPhoneAlt aria-hidden="true" /> {atleta.telefono}
                  </a>
                ) : (
                  <p className="adm-hint">Nessun cellulare indicato.</p>
                )}
                {/* L'email sta sull'account e non sulla scheda, ma si
                    cerca qui insieme al telefono. */}
                {atleta.email && <a href={`mailto:${atleta.email}`} className="adm-email">{atleta.email}</a>}
              </div>
            </div>

            <p className="adm-hint">
              Anche questi li scrive {atleta.nomeCompleto} dalla propria
              area, secondo contatto compreso.
            </p>
          </section>
        )}

        {/* ---------- Quota e versamenti ----------
            Solo a chi tiene i conti. Per un allenatore non è nascosta:
            non arriva proprio, il server non gliela manda. */}
        {vista === "quota" && tieneIConti && (
          <div className="prs-quota-griglia">
            <div className="prs-colonna">
              <section className="adm-panel prs-ancora" id="prs-quota" tabIndex={-1}>
                <h2 className="adm-panel-title">
                  <FaEuroSign aria-hidden="true" /> Quota della stagione
                  {atleta.stagione && <span className="adm-panel-sotto">{atleta.stagione.nome}</span>}
                </h2>

                {/* Il saldo per primo e grande: è la risposta che si cerca */}
                <div className={`prs-saldo ${tonoQuota}`}>
                  <span className="prs-saldo-cifra">
                    {conto?.dovuto == null ? "Da impostare"
                      : manca > 0 ? euro(manca)
                        : manca < 0 ? "Saldata, con un avanzo" : "Saldata"}
                  </span>
                  <span className="prs-saldo-testo">
                    {conto?.dovuto == null
                      ? "Nessuna tariffa scelta: non può ancora pagare."
                      : manca > 0
                        ? `ancora da versare · versati ${euro(atleta.versatoCentesimi)} su ${euro(conto.dovuto)}`
                        : manca < 0
                          ? `versati ${euro(atleta.versatoCentesimi)}: ${euro(-manca)} in più del dovuto`
                          : `${euro(atleta.versatoCentesimi)} versati`}
                  </span>
                  {conto?.dovuto > 0 && (
                    <span
                      className="prs-barra"
                      role="img"
                      aria-label={`Versato il ${percento}% di ${euro(conto.dovuto)}`}
                    >
                      <span style={{ width: `${percento}%` }} />
                    </span>
                  )}
                </div>

                {/* Le due metà: la seconda è dovuta da gennaio, e solo da
                    chi a gennaio c'è ancora. */}
                {conto?.quota != null && (
                  <div className="prs-meta">
                    <div className="prs-meta-una">
                      <span className="prs-stato-cosa">Prima metà</span>
                      <strong>{euro(conto.primaMeta)}</strong>
                      <span className="prs-stato-nota">
                        {atleta.stagione?.scadenzaPrimaMeta
                          ? `entro il ${dataLeggibile(atleta.stagione.scadenzaPrimaMeta)}`
                          : "all'iscrizione"}
                      </span>
                    </div>
                    <div className={`prs-meta-una ${conto.secondaDovuta ? "" : "is-annullata"}`}>
                      <span className="prs-stato-cosa">Seconda metà</span>
                      <strong>{euro(conto.secondaMeta)}</strong>
                      <span className="prs-stato-nota">
                        {conto.secondaDovuta
                          ? `da gennaio ${atleta.stagione?.inizioSecondaMeta?.slice(0, 4) ?? ""}`
                          : "non dovuta: ha smesso prima di gennaio"}
                      </span>
                    </div>
                  </div>
                )}

                <label className="adm-field prs-ancora" id="prs-tariffa">
                  <span className="adm-label">Tariffa</span>
                  {/* Si SCEGLIE fra le tariffe, non si batte un importo:
                      sessanta cifre scritte a mano ogni anno vogliono dire
                      qualche 200 al posto di 250 e gli sconti applicati a
                      memoria, senza poter più rispondere a "quanti hanno
                      lo sconto fratello". Le tariffe stanno in Quote. */}
                  <Tendina
                    valore={form.tipoQuotaId}
                    onChange={(v) => setForm({ ...form, tipoQuotaId: v })}
                    opzioni={opzioniTariffa}
                    disabilitato={salvataggio || soloLettura}
                    segnaposto="Nessuna quota"
                    etichettaAria="Tariffa applicata"
                  />
                  <span className="adm-hint">
                    {tariffe.length === 0
                      ? "Non c'è ancora nessuna tariffa: le crea un amministratore dalla sezione Quote."
                      : soloLettura
                        ? "Stagione passata: la quota di allora resta com'era."
                        : "Prima iscrizione, rinnovo o famiglia li assegna il sito da solo. Si cambia qui solo per un caso particolare."}
                  </span>
                </label>

                {/* Iscritto dal giorno del PRIMO versamento, non da quello
                    in cui si è creato l'account: è la data che vale sul
                    tesseramento, ed è l'unica che la società può mostrare a
                    un genitore che la chiede. */}
                <p className="prs-riga-dato">
                  <span>Iscritto dal</span>
                  {atleta.iscrittoDal
                    ? <strong>{dataLeggibile(atleta.iscrittoDal)}</strong>
                    : <em>non ancora: nessun versamento registrato</em>}
                </p>
              </section>

              {/* ---------- Fratelli e sorelle dichiarati ----------

                  Accanto alla quota: è lì che serve, nel momento in cui si
                  sceglie la tariffa. Compare solo se qualcosa è stato
                  dichiarato — un pannello vuoto su ogni scheda sarebbe una
                  domanda in più su centocinquanta pagine.

                  Il sistema ha già cercato la persona e confrontato cognome
                  e indirizzo; quello che NON può fare è dire se sono davvero
                  fratelli, perché il codice fiscale non contiene la
                  famiglia. Perciò decide una persona. */}
              {(atleta.legami ?? []).length > 0 && (
                <section className="adm-panel prs-ancora" id="prs-fratelli" tabIndex={-1}>
                  <h2 className="adm-panel-title">
                    <FaUsers aria-hidden="true" /> Fratelli e sorelle
                    {legamiInAttesa > 0 && <span className="adm-badge-conta is-attenzione">{legamiInAttesa}</span>}
                  </h2>

                  <ul className="adm-legami">
                    {atleta.legami.map((l) => (
                      <li key={l.id} className={`adm-legame prs-legame is-${l.stato}`}>
                        <div className="adm-legame-chi">
                          <span className="adm-legame-titolo">
                            {/* Chi ha dichiarato chi. Sulla scheda di un
                                ragazzo conta sapere anche quando è stato
                                NOMINATO da qualcun altro: la tariffa ridotta
                                riguarda uno dei due, e per deciderlo bisogna
                                vedere la coppia intera. */}
                            {l.laSua
                              ? <>Ha dichiarato <strong>{l.codiceFiscale}</strong></>
                              : <><strong>{l.dichiarataDa}</strong> ha dichiarato lui</>}
                            {l.stagione && <span className="adm-hint"> · {l.stagione}</span>}
                          </span>

                          <span className="adm-legame-esito">
                            {l.trovato ? (
                              <>
                                Il sito ha trovato <strong>{l.trovato.nomeCompleto}</strong>
                                {l.trovato.stessoCognome && ", stesso cognome"}
                                {l.trovato.stessoIndirizzo && ", stesso indirizzo"}
                                {!l.trovato.stessoCognome && !l.trovato.stessoIndirizzo
                                  && " — ma cognome e indirizzo non coincidono"}
                                {/* Il sito lo segnala e basta: decide la
                                    segreteria, che sa se sta per rinnovare. */}
                                {!l.trovato.iscrittoNellaStagione && (
                                  <strong className="adm-legame-avviso">
                                    {" "}Attenzione: nella stagione {l.stagione} non risulta iscritto.
                                  </strong>
                                )}
                              </>
                            ) : (
                              /* Due cose diverse, e le distingue solo una
                                 persona: un errore di battitura, oppure un
                                 fratello che non si è ancora iscritto. */
                              <>Nessun iscritto ha questo codice fiscale: o è
                                scritto male, o quel fratello non si è ancora iscritto.</>
                            )}
                          </span>

                          {l.stato === "respinto" && l.motivo && (
                            <span className="adm-legame-motivo">{l.motivo}</span>
                          )}
                        </div>

                        {l.stato === "in_attesa" ? (
                          <div className="adm-legame-azioni">
                            <button
                              type="button"
                              className="adm-btn adm-btn-primary"
                              onClick={() => decidiLegame(l.id, true)}
                              disabled={salvataggio}
                            >
                              <FaCheckCircle /> Sì, sono fratelli
                            </button>
                            <button
                              type="button"
                              className="adm-btn adm-btn-ghost"
                              onClick={() => decidiLegame(l.id, false)}
                              disabled={salvataggio}
                            >
                              <FaTimesCircle /> No
                            </button>
                          </div>
                        ) : (
                          <span className={`adm-status ${l.stato === "confermato" ? "adm-status-publish" : "adm-status-respinta"}`}>
                            {l.stato === "confermato" ? "Confermati" : "Respinta"}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  <p className="adm-hint">
                    Confermando, il sito passa da solo alla tariffa Famiglia se
                    la quota era stata assegnata in automatico; una tariffa
                    scelta a mano resta com&apos;è.
                  </p>
                </section>
              )}

              <section className="adm-panel">
                <h2 className="adm-panel-title">
                  <FaHistory aria-hidden="true" /> Versamenti
                </h2>

                {atleta.pagamenti.length === 0 ? (
                  <p className="adm-hint" style={{ margin: 0 }}>Nessun versamento registrato.</p>
                ) : (
                  /* Divisi per anno, con il totale di ciascuno: la quota è di
                     una stagione ma i versamenti si accumulano per sempre, e
                     in un elenco unico "quanto ha pagato quest'anno" non si
                     risponde più. */
                  raggruppaPerAnno(atleta.pagamenti).map(({ anno, righe, totale }) => (
                    <div key={anno} className="adm-pagamenti-anno">
                      <p className="adm-gruppo-titolo">
                        {anno} <span className="adm-pagamenti-totale">{euro(totale)}</span>
                      </p>

                      <ul className="adm-pagamenti">
                        {righe.map((p) => (
                          <li key={p.id} className="adm-pagamento">
                            <span className={`adm-pagamento-importo ${p.importoCentesimi < 0 ? "is-rimborso" : ""}`}>
                              {euro(p.importoCentesimi)}
                            </span>
                            <span className="adm-pagamento-quando">{dataLeggibile(p.pagatoIl)}</span>
                            <span className="adm-pagamento-come">{NOME_METODO[p.metodo] ?? p.metodo}</span>
                            <span className="adm-pagamento-causale">{p.causale || "—"}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}

                {/*
                  * Qui non c'è niente da premere, ed è voluto.
                  *
                  * I versamenti non si scrivono a mano da nessun ruolo: un
                  * importo battuto a mano non ha riscontro da nessuna parte,
                  * e la cassa tornerebbe solo perché qualcuno ha scritto il
                  * numero giusto. A scriverli sarà la notifica del fornitore
                  * del pagamento online.
                  */}
              </section>
            </div>

            <div className="prs-colonna">
              {/* ---------- Ritiro e abbandono ----------
                  Accanto alla quota perché è lì che si vede cosa cambia: la
                  seconda metà che non è più dovuta. Due casi diversi, due
                  riquadri: chi ha smesso durante la stagione e chi per la
                  stagione non c'è mai stato. */}
              {!soloLettura && (
                <section className="adm-panel">
                  <h2 className="adm-panel-title">
                    <FaDoorOpen aria-hidden="true" /> Ha smesso?
                  </h2>

                  {atleta.abbandonato ? (
                    <div className="prs-esito is-attenzione">
                      <strong>Abbandonato dal {dataLeggibile(atleta.abbandonatoIl)}</strong>
                      <span>
                        {atleta.abbandonoAutomatico
                          ? "L'ha segnato il sito: non ha rinnovato, o non ha versato la prima metà. Se la versa, torna attivo da solo."
                          : "L'ha segnato la segreteria."}
                      </span>
                      <button
                        type="button"
                        className="adm-btn adm-btn-secondary"
                        onClick={riattiva}
                        disabled={salvataggio}
                      >
                        <FaUndo /> Riattiva per questa stagione
                      </button>
                    </div>
                  ) : atleta.ritirato ? (
                    <div className="prs-esito is-attenzione">
                      <strong>Ritirato il {dataLeggibile(atleta.ritiratoIl)}</strong>
                      {atleta.motivoRitiro && <span>{atleta.motivoRitiro}</span>}
                      <button
                        type="button"
                        className="adm-btn adm-btn-secondary"
                        onClick={riapri}
                        disabled={salvataggio}
                      >
                        <FaUndo /> Annulla il ritiro
                      </button>
                    </div>
                  ) : (
                    <div className="prs-scelte">
                      <div className="prs-scelta">
                        <strong>Si è ritirato durante la stagione</strong>
                        <span className="adm-hint">
                          Resta nell&apos;elenco e nella squadra con i suoi conti;
                          se smette prima di gennaio la seconda metà non è più dovuta.
                        </span>
                        <div className="adm-ritiro-azioni">
                          <CampoData
                            valore={dataRitiro ? `${dataRitiro}T00:00:00` : ""}
                            onChange={(v) => setDataRitiro(v ? giornoLocale(v) : "")}
                            disabilitato={salvataggio}
                            segnaposto="Oggi"
                            etichettaAria="Giorno del ritiro"
                          />
                          <button
                            type="button"
                            className="adm-btn adm-btn-ghost"
                            onClick={ritira}
                            disabled={salvataggio}
                          >
                            <FaDoorOpen /> Segna il ritiro
                          </button>
                        </div>
                      </div>

                      <div className="prs-scelta">
                        <strong>Non ha rinnovato, o non ha mai cominciato</strong>
                        <span className="adm-hint">
                          Per la stagione non c&apos;è; prima di gennaio non deve la
                          seconda metà. Si riattiva quando vuoi.
                        </span>
                        <div>
                          <button
                            type="button"
                            className="adm-btn adm-btn-ghost"
                            onClick={abbandona}
                            disabled={salvataggio}
                          >
                            Segna come abbandonato
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* ---------- Le stagioni passate ----------
                  Quello che resta per sempre: dove giocava, quanto doveva,
                  quanto ha versato. Non si modifica. */}
              {(atleta.storico ?? []).length > 0 && (
                <section className="adm-panel">
                  <h2 className="adm-panel-title">
                    <FaHistory aria-hidden="true" /> Stagioni passate
                  </h2>
                  <ul className="adm-storico">
                    {atleta.storico.map((st) => (
                      <li key={st.stagioneId} className="adm-storico-riga">
                        <span className="adm-storico-nome">{st.nome}</span>
                        <span className="adm-storico-squadre">
                          {st.squadre.map((q) => q.nome).join(", ") || "—"}
                        </span>
                        <span className="adm-storico-conto">
                          {st.conto?.dovuto == null
                            ? "nessuna quota"
                            : `${euro(st.conto.versato)} su ${euro(st.conto.dovuto)}`}
                          {st.conto?.residuo > 0 && <strong> · mancano {euro(st.conto.residuo)}</strong>}
                        </span>
                        {st.stato === "ritirata" && (
                          <span className="adm-badge-ritirato">Ritirato il {dataLeggibile(st.ritiratoIl)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        )}

        {/* ---------- Salva ----------
            In fondo e attaccata al bordo mentre si scorre, su ogni schermo:
            le cose che si cambiano stanno in due linguette diverse, e chi
            le cambia non deve andarsi a cercare il pulsante. */}
        {puoScrivere && (sporco || salvataggio) && (
          <div className="adm-barra-azioni-fissa prs-salva" role="region" aria-label="Modifiche da salvare">
            <span className="prs-salva-testo">Hai cambiato qualcosa: ricordati di salvare.</span>
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              onClick={() => setForm(daAtleta(atleta))}
              disabled={salvataggio}
            >
              Annulla
            </button>
            <button type="submit" className="adm-btn adm-btn-primary" disabled={salvataggio}>
              <FaSave /> {salvataggio ? "Salvataggio…" : "Salva"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
