import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft, FaSave, FaExclamationCircle, FaHeartbeat, FaEuroSign,
  FaUserCircle, FaPlus, FaTrashAlt, FaFileMedical, FaExternalLinkAlt,
  FaInfoCircle, FaUsers, FaClock, FaUpload, FaCheckCircle, FaTimesCircle,
  FaHourglassHalf, FaPhoneAlt
} from "react-icons/fa";
import {
  getAtleta, salvaSchedaAtleta,
  uploadMedia, validaCertificato, listTariffe, AuthError
} from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { useDialoghi } from "../../context/dialoghi";
import { euro } from "../../utils/soldi";
import { raggruppaPerAnno } from "../../utils/versamenti";
import { statoCertificato, quantoManca } from "../../utils/certificato";
import { anni } from "../../utils/eta";
import Tendina from "./Tendina";
import CampoData from "./CampoData";
import Ritratto from "./Ritratto";
import ScambiaVista from "./ScambiaVista";
import "../../css/Admin.css";
import "../../css/Ritratto.css";

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


/** Un riquadro della striscia di riepilogo in cima. */
function Riquadro({ icona: Icona, valore, testo, tono = "" }) {
  return (
    <div className={`adm-riquadro adm-riquadro-statico ${tono}`}>
      <span className="adm-riquadro-numero adm-riquadro-breve">
        <Icona aria-hidden="true" /> {valore}
      </span>
      <span className="adm-riquadro-testo">{testo}</span>
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
  const { avvisa, chiediTesto } = useDialoghi();

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
    return getAtleta(id)
      .then((a) => {
        setAtleta(a);
        setForm(daAtleta(a));
        setCaricamento(false);
      })
      .catch((err) => {
        gestisciErrore(err);
        setCaricamento(false);
      });
  }, [id, gestisciErrore]);

  useEffect(() => { carica(); }, [carica]);

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

  /* ---------- Copia del certificato ---------- */

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
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Caricamento della scheda…</p>
      </div>
    );
  }

  if (!atleta) {
    return (
      <div className="adm-page">
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore || "Atleta non trovato."}</span>
        </div>
        <button type="button" className="adm-btn adm-btn-ghost" onClick={() => navigate(`${area}/atleti`)}>
          <FaArrowLeft /> Torna agli atleti
        </button>
      </div>
    );
  }

  /*
   * C'è davvero qualcosa da salvare?
   *
   * Un pulsante "Salva" sempre acceso su una scheda che si apre soprattutto
   * per guardare chiede di premerlo, e chi lo preme non sa mai se ha
   * cambiato qualcosa. Compare quando serve e sparisce quando non serve
   * più: la sua presenza è essa stessa l'avviso che ci sono modifiche
   * non salvate.
   */
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
  const manca = atleta.quotaStagionaleCentesimi == null
    ? null
    : atleta.quotaStagionaleCentesimi - atleta.versatoCentesimi;

  const tonoCert = cert.chiave === "scaduto" ? "is-allarme"
    : cert.chiave === "in_scadenza" ? "is-attenzione" : "";

  return (
    <div className="adm-page adm-editor-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            onClick={() => navigate(`${area}/atleti`)}
          >
            <FaArrowLeft /> Atleti
          </button>

          {/* Foto e nome sulla stessa riga: aprendo una scheda la prima
              domanda è sempre "di chi è", e la faccia risponde prima del
              nome. */}
          <div className="adm-titolo-con-foto">
            <Ritratto
              nome={atleta.nomeCompleto}
              url={atleta.immagineUrl}
              dimensione="l"
            />

            <div className="adm-testata-atleta">
              <h1 className="adm-page-title">{atleta.nomeCompleto}</h1>

              {/* Email, stato e data di apertura stavano in un riquadro
                  loro in fondo alla colonna di destra: tre righe che non si
                  cambiano mai, messe dove si guarda per ultimo. Accanto al
                  nome sono quello che sono — l'etichetta di chi si sta
                  guardando — e liberano un riquadro intero. */}
              <div className="adm-testata-dati">
                <a href={`mailto:${atleta.email}`} className="adm-email">{atleta.email}</a>

                <span className={`adm-status ${atleta.stato === "attivo" ? "adm-status-publish" : "adm-status-draft"}`}>
                  {atleta.stato === "attivo" ? "Attivo" : atleta.stato}
                </span>

                <span className="adm-testata-dal">
                  account dal {new Date(atleta.creatoIl).toLocaleDateString("it-IT", {
                    day: "2-digit", month: "short", year: "numeric"
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {puoScrivere && (sporco || salvataggio) && (
          <div className="adm-head-actions">
            {/* In cima e non solo in fondo all'anagrafica: la scadenza del
                certificato e la quota stanno nella colonna di destra, e chi
                le cambia non deve andarsi a cercare il pulsante altrove. */}
            <button
              type="submit"
              form="scheda-atleta"
              className="adm-btn adm-btn-primary"
              disabled={salvataggio}
            >
              <FaSave /> {salvataggio ? "Salvataggio…" : "Salva la scheda"}
            </button>
          </div>
        )}
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}


      {/* Le tre domande che ci si fa aprendo una scheda, prima di leggere
          qualunque altra cosa: può giocare? ha pagato? in che squadra sta? */}
      <div className="adm-riepilogo">
        <Riquadro
          icona={FaHeartbeat}
          valore={cert.etichetta}
          testo={cert.giorni != null ? quantoManca(cert.giorni) : "nessuna scadenza registrata"}
          tono={tonoCert}
        />
        {tieneIConti && <Riquadro
          icona={FaEuroSign}
          valore={manca == null ? "—" : manca > 0 ? euro(manca) : "Saldata"}
          testo={manca == null
            ? "quota non impostata"
            : manca > 0
              ? `versati ${euro(atleta.versatoCentesimi)} su ${euro(atleta.quotaStagionaleCentesimi)}`
              : `${euro(atleta.versatoCentesimi)} incassati`}
          tono={manca > 0 ? "is-attenzione" : ""}
        />}
        <Riquadro
          icona={FaUsers}
          valore={atleta.squadre.map((s) => s.nome).join(", ") || "—"}
          testo={atleta.squadre.length === 1 ? "squadra" : "squadre"}
        />
        <Riquadro
          icona={FaClock}
          valore={atleta.ultimoAccesso
            ? new Date(atleta.ultimoAccesso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })
            : "Mai"}
          testo="ultimo accesso al sito"
        />
      </div>

      {/* Cosa manca perché l'iscrizione sia completa.

          Lo dice il server, che è lo stesso conto che vede l'atleta nella
          sua area: così segreteria e atleta leggono la stessa frase, e
          nessuno dei due deve indovinare cosa aspetta l'altro. */}
      {atleta.manca?.length > 0 && (
        <div className="adm-alert adm-alert-warn" role="status">
          <FaExclamationCircle aria-hidden="true" />
          <span>
            L&apos;atleta deve ancora inserire{" "}
            <strong>{atleta.manca.join(", ")}</strong>.
          </span>
        </div>
      )}

      {/* La quota non decisa è un buco di chi tiene i conti, non
          dell'atleta: lui vede scritto "da definire" e non può farci
          niente, e intanto non gli si può chiedere di pagare. Per
          l'allenatore l'avviso non compare: la quota non gli arriva
          proprio, e segnalargli una mancanza che non può colmare sarebbe
          solo un rimprovero a vuoto. */}
      {tieneIConti && atleta.quotaStagionaleCentesimi == null && (
        <div className="adm-alert adm-alert-warn" role="status">
          <FaEuroSign aria-hidden="true" />
          <span>
            Nessuna quota assegnata: {atleta.nomeCompleto} vede
            {" "}<em>da definire</em> e non può pagare. Si sceglie la
            tariffa in <strong>Quota e versamenti</strong>.
          </span>
        </div>
      )}

      <div className="adm-viste">
        <ScambiaVista
          vista={vista}
          onCambia={setVista}
          etichetta="Cosa guardare di questa persona"
          /* La quota solo a chi tiene i conti: a un allenatore quei numeri
             non arrivano nemmeno dal server, e una linguetta che apre una
             pagina vuota è peggio di una linguetta che non c'è. */
          opzioni={[
            { valore: "scheda", etichetta: "Scheda", Icona: FaUserCircle },
            { valore: "contatti", etichetta: "Contatti", Icona: FaPhoneAlt },
            ...(tieneIConti
              ? [{ valore: "quota", etichetta: "Quota e versamenti", Icona: FaEuroSign }]
              : [])
          ]}
        />
      </div>

      {/* Un modulo solo per tutta la scheda, anagrafica e colonna di destra
          insieme: i campi stanno in due posti ma sono la stessa cosa, e si
          salvano con un gesto solo. Il pulsante sta in cima e li raggiunge
          entrambi con l'attributo form. */}
      <form id="scheda-atleta" onSubmit={salva}>
        <div className="adm-editor-grid">
          <div className="adm-editor-col">
            {/* ---------- Anagrafica ---------- */}
            {vista === "scheda" && (
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
                    {gruppo.conEmail && (
                      <Dato etichetta="Email">
                        <a href={`mailto:${atleta.email}`} className="adm-email">
                          {atleta.email}
                        </a>
                      </Dato>
                    )}
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
            )}

            {/* ---------- Contatti ----------
                Chi c'è dietro al ragazzo, e come lo si chiama. Visibile
                anche all'allenatore: è lui che è in campo quando serve
                davvero, e non gli si può chiedere di passare dalla
                segreteria per avere un numero di telefono. */}
            {vista === "contatti" && (
            <section className="adm-panel">
              <h2 className="adm-panel-title">
                <FaPhoneAlt aria-hidden="true" /> Contatti
              </h2>

              <div className="adm-gruppo">
                <p className="adm-gruppo-titolo">I suoi recapiti</p>
                <dl className="adm-scheda-dati">
                  <Dato etichetta="Cellulare">
                    {atleta.telefono && (
                      <a href={`tel:${atleta.telefono}`} className="adm-email">
                        {atleta.telefono}
                      </a>
                    )}
                  </Dato>

                  {/* L'email sta sull'account e non sulla scheda, ma si
                      cerca qui insieme al telefono. */}
                  <Dato etichetta="Email">
                    {atleta.email && (
                      <a href={`mailto:${atleta.email}`} className="adm-email">
                        {atleta.email}
                      </a>
                    )}
                  </Dato>
                </dl>
              </div>

              {CONTATTI.map((contatto, indice) => {
                const nome = atleta[`${contatto.prefisso}Nome`];
                const parentela = atleta[`${contatto.prefisso}Parentela`];
                const telefono = atleta[`${contatto.prefisso}Telefono`];
                const email = atleta[`${contatto.prefisso}Email`];

                /* Il secondo contatto compare solo se c'è: un riquadro
                    di "non indicato" ripetuto quattro volte fa sembrare
                    incompleta una scheda che non lo è. */
                if (indice > 0 && !nome && !telefono && !email) return null;

                return (
                  <div className="adm-gruppo" key={contatto.prefisso}>
                    <p className="adm-gruppo-titolo">{contatto.titolo}</p>
                    <dl className="adm-scheda-dati">
                      <Dato etichetta={parentela || "Nome e cognome"}>{nome}</Dato>

                      <Dato etichetta="Telefono">
                        {telefono && (
                          <a href={`tel:${telefono}`} className="adm-email">{telefono}</a>
                        )}
                      </Dato>

                      {email && (
                        <Dato etichetta="Email">
                          <a href={`mailto:${email}`} className="adm-email">{email}</a>
                        </Dato>
                      )}
                    </dl>
                  </div>
                );
              })}

              {/* Un minorenne senza nessuno da chiamare è un buco che va
                  visto subito, non scoperto la sera che serve. */}
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

              <p className="adm-hint">
                Anche questi li scrive {atleta.nomeCompleto} dalla propria
                area, secondo contatto compreso.
              </p>
            </section>
            )}

            {/* ---------- Quota e versamenti ----------
                Solo a chi tiene i conti. Per un allenatore non e nascosta:
                non arriva proprio, il server non gliela manda. */}
            {vista === "quota" && tieneIConti && (
            <section className="adm-panel">
              <h2 className="adm-panel-title">
                <FaEuroSign aria-hidden="true" /> Quota e versamenti
              </h2>

              <div className="adm-campi">
                {tieneIConti && (
                  <label className="adm-field">
                    <span className="adm-label">Quota della stagione</span>
                    {/* Si SCEGLIE fra le tariffe, non si batte un importo:
                        sessanta cifre scritte a mano ogni anno vogliono dire
                        qualche 200 al posto di 250 e gli sconti applicati a
                        memoria, senza poter più rispondere a "quanti hanno
                        lo sconto fratello". Le tariffe stanno in Quote. */}
                    <Tendina
                      valore={form.tipoQuotaId}
                      onChange={(v) => setForm({ ...form, tipoQuotaId: v })}
                      opzioni={opzioniTariffa}
                      disabilitato={salvataggio}
                      segnaposto="Nessuna quota"
                      etichettaAria="Tariffa applicata"
                    />
                    <span className="adm-hint">
                      {tariffe.length === 0
                        ? "Non c'è ancora nessuna tariffa: le crea un amministratore dalla sezione Quote."
                        : "Le tariffe si decidono nella sezione Quote. Cambiandone una là, le quote già assegnate restano quelle."}
                    </span>
                  </label>
                )}

                {/* Iscritto dal giorno del PRIMO versamento, non da quello
                    in cui si è creato l'account: è la data che vale sul
                    tesseramento, ed è l'unica che la società può mostrare a
                    un genitore che la chiede. */}
                <div className="adm-field">
                  <span className="adm-label">Iscritto dal</span>
                  <p className="adm-conto">
                    {atleta.iscrittoDal
                      ? <span>{dataLeggibile(atleta.iscrittoDal)}</span>
                      : <span className="adm-hint">non ancora: nessun versamento registrato</span>}
                  </p>
                </div>

                <div className="adm-field">
                  <span className="adm-label">Situazione</span>
                  <p className="adm-conto">
                    <span>{euro(atleta.versatoCentesimi)} versati</span>
                    {atleta.quotaStagionaleCentesimi != null && (
                      <span className={`adm-quota ${manca > 0 ? "is-aperta" : "is-saldata"}`}>
                        {manca > 0
                          ? `${euro(manca)} ancora da versare`
                          : manca < 0 ? `${euro(-manca)} in più` : "Saldata"}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {atleta.pagamenti.length === 0 ? (
                <p className="adm-hint">Nessun versamento registrato.</p>
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
                * del pagamento online. La spiegazione sta nel codice e non
                * a schermo: a chi guarda la scheda di un atleta non serve
                * sapere perché un pulsante che non ha mai visto non c'è.
                */}
            </section>)}
          </div>

          {vista === "scheda" && (
          <aside className="adm-editor-side">
            {/* ---------- Certificato medico ---------- */}
            <section className="adm-panel">
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
                        Respingi
                      </button>
                    </div>
                  )}

                  {registraCertificati && atleta.certificatoStato === "valido" && (
                    <button
                      type="button"
                      className="adm-btn adm-btn-ghost adm-btn-block"
                      onClick={() => decidiCertificato(false)}
                      disabled={salvataggio}
                    >
                      Revoca l&apos;approvazione
                    </button>
                  )}
                </div>
              )}

              {registraCertificati ? (
                <>
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
                </>
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
                {atleta.certificatoUrl ? (
                  <a
                    href={atleta.certificatoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="adm-btn adm-btn-ghost adm-btn-block"
                  >
                    <FaFileMedical /> Apri il certificato <FaExternalLinkAlt />
                  </a>
                ) : (
                  <p className="adm-hint" style={{ marginTop: 0 }}>
                    Nessun file caricato.
                  </p>
                )}

                {registraCertificati ? (
                  <>
                    <input
                      ref={inputFile}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      hidden
                      onChange={caricaCertificato}
                    />
                    <button
                      type="button"
                      className="adm-btn adm-btn-secondary adm-btn-block"
                      onClick={() => inputFile.current?.click()}
                      disabled={caricandoFile || salvataggio}
                    >
                      <FaUpload />
                      {caricandoFile
                        ? "Caricamento…"
                        : atleta.certificatoUrl ? "Sostituisci la copia" : "Carica la copia"}
                    </button>
                    <p className="adm-hint">
                      Serve a chi consegna il certificato su carta in sede: lo
                      carichi tu al posto suo. Chi ce l'ha in formato digitale
                      fa prima a caricarlo dalla propria pagina Iscrizione.
                    </p>
                  </>
                ) : (
                  <p className="adm-hint">
                    Lo consegna l'atleta dalla propria pagina Iscrizione, oppure
                    su carta in segreteria. Se manca o e scaduto, va sollecitato.
                  </p>
                )}
              </div>
            </section>

          </aside>
          )}
        </div>
      </form>
    </div>
  );
}
