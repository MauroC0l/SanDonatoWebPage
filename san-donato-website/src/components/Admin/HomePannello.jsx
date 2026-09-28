import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaUserCheck, FaHeartbeat, FaEuroSign, FaCalendarAlt, FaNewspaper,
  FaTrophy, FaExclamationCircle, FaCheckCircle, FaArrowRight, FaClock,
  FaCheckDouble, FaTag, FaRunning, FaPlus, FaSearch, FaPen, FaSitemap,
  FaUserClock, FaMapMarkerAlt,
  FaUsers
} from "react-icons/fa";
import { getCruscotto, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { euro } from "../../utils/soldi";
import "../../css/Admin.css";
import "../../css/admin/Cruscotto.css";

/* Dove sta un appuntamento nel pannello: sbagliando sezione, un allenatore
   finirebbe su una pagina che non ha il permesso di aprire. */
const SEZIONE_DI = {
  partita: "partite",
  torneo: "partite",
  allenamento: "partite"
};

const NOME_TIPO = {
  partita: "Partita",
  torneo: "Torneo",
  allenamento: "Allenamento"
};

const NOME_RUOLO = {
  admin: "Amministrazione",
  segreteria: "Segreteria",
  editor: "Redazione",
  coach: "Allenatore"
};

function ora(iso) {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Le cose da fare, dalla più urgente.
 *
 * L'ordine non è quello delle sezioni del menu ma quello del danno che fa
 * aspettare: un certificato scaduto vuol dire un ragazzo in campo senza
 * copertura, e viene prima di una persona che aspetta la squadra da due
 * giorni; una quota da incassare può aspettare la settimana prossima.
 *
 * Compare solo quello che ha un numero sopra lo zero: una tessera con scritto
 * "0 richieste" è una cosa in più da leggere per sentirsi dire che non c'è
 * niente da fare, e lo dice meglio il riquadro "Tutto in ordine".
 *
 * Ogni tessera porta alla pagina con il filtro già messo, così chi tocca
 * trova subito le persone giuste invece di doverle ricercare.
 */
function daFare(dati, { area, puoValidare, soloProprie }) {
  const voci = [];
  const cert = dati.certificati;

  if (cert?.scaduti > 0) {
    voci.push({
      chiave: "scaduti",
      icona: FaHeartbeat,
      titolo: "Certificati scaduti",
      conta: cert.scaduti,
      testo: soloProprie
        ? "Non possono allenarsi né giocare finché non lo rinnovano. Avvisali."
        : "Senza certificato valido non si gioca: va chiesto il rinnovo.",
      a: `${area}/atleti?certificato=scaduto`,
      tono: "is-allarme"
    });
  }

  if (dati.richieste > 0) {
    voci.push({
      chiave: "richieste",
      icona: FaUserCheck,
      titolo: "Richieste da decidere",
      conta: dati.richieste,
      testo: soloProprie
        ? "Nuovi iscritti del tuo sport: scegli in quale squadra metterli."
        : "Persone registrate che aspettano una squadra.",
      a: `${area}/richieste`,
      tono: "is-attenzione"
    });
  }

  // Solo a chi li controlla davvero: a un allenatore questo numero non dice
  // niente che possa risolvere lui.
  if (puoValidare && cert?.daValidare > 0) {
    voci.push({
      chiave: "da_validare",
      icona: FaCheckDouble,
      titolo: "Certificati da controllare",
      conta: cert.daValidare,
      testo: "Gli atleti li hanno caricati: guardali e confermali.",
      a: `${area}/atleti?certificato=da_validare`,
      tono: "is-attenzione"
    });
  }

  if (dati.risultatiMancanti > 0) {
    voci.push({
      chiave: "risultati",
      icona: FaTrophy,
      titolo: "Risultati da inserire",
      conta: dati.risultatiMancanti,
      testo: "Partite già giocate a cui manca il punteggio.",
      a: `${area}/partite`,
      tono: "is-attenzione"
    });
  }

  if (dati.quote?.parenteleDaControllare > 0) {
    const una = dati.quote.parenteleDaControllare === 1 && dati.quote.primaParentela;
    voci.push({
      chiave: "fratelli",
      icona: FaUsers,
      titolo: "Fratelli da controllare",
      conta: dati.quote.parenteleDaControllare,
      testo: "Richieste della quota famiglia: guarda se sono davvero fratelli.",
      a: una ? `${area}/atleti/${dati.quote.primaParentela}` : `${area}/atleti?fratelli=da_controllare`,
      tono: "is-attenzione"
    });
  }

  if (dati.quote?.senzaQuota > 0) {
    voci.push({
      chiave: "senza_quota",
      icona: FaTag,
      titolo: "Quote da decidere",
      conta: dati.quote.senzaQuota,
      testo: "Atleti a cui non è ancora stato detto quanto pagano.",
      a: `${area}/atleti?quota=mancante`,
      tono: "is-attenzione"
    });
  }

  if (dati.notizie?.inRevisione > 0) {
    voci.push({
      chiave: "revisione",
      icona: FaNewspaper,
      titolo: "Notizie da rivedere",
      conta: dati.notizie.inRevisione,
      testo: "Scritte e in attesa di un controllo prima di uscire sul sito.",
      a: `${area}/notizie`,
      tono: "is-attenzione"
    });
  }

  if (cert?.inScadenza > 0) {
    voci.push({
      chiave: "in_scadenza",
      icona: FaClock,
      titolo: "Certificati in scadenza",
      conta: cert.inScadenza,
      testo: "Scadono entro un mese: conviene ricordarlo adesso.",
      a: `${area}/atleti?certificato=in_scadenza`,
      tono: ""
    });
  }

  if (dati.quote?.quanti > 0) {
    voci.push({
      chiave: "da_incassare",
      icona: FaEuroSign,
      titolo: "Quote da incassare",
      conta: dati.quote.quanti,
      testo: `In tutto ${euro(dati.quote.daIncassare)} ancora da ricevere.`,
      a: `${area}/atleti?quota=aperta`,
      tono: ""
    });
  }

  if (dati.notizie?.bozze > 0) {
    voci.push({
      chiave: "bozze",
      icona: FaPen,
      titolo: "Bozze da finire",
      conta: dati.notizie.bozze,
      testo: "Notizie cominciate e non ancora pubblicate.",
      a: `${area}/notizie`,
      tono: ""
    });
  }

  return voci;
}

/**
 * Le scorciatoie nella fascia blu: le due cose che questa persona fa più
 * spesso di sua iniziativa, non perché qualcosa glielo chieda.
 */
function scorciatoie(capacita, area) {
  const ha = (c) => capacita.includes(c);
  const voci = [];

  if (ha("eventi.gestisci_tutte") || ha("eventi.gestisci_proprie")) {
    voci.push({ a: `${area}/partite/nuova`, icona: FaPlus, testo: "Nuova partita" });
  }
  if (ha("notizie.scrivi")) {
    const notizia = { a: `${area}/notizie/nuova`, icona: FaPen, testo: "Scrivi una notizia" };
    // Per chi scrive e basta, scrivere è la prima cosa; per chi gestisce
    // tutto il calendario viene dopo le partite
    if (ha("eventi.gestisci_tutte")) voci.push(notizia);
    else voci.unshift(notizia);
  }
  if (ha("atleti.leggi")) {
    voci.push({ a: `${area}/atleti`, icona: FaSearch, testo: "Cerca un atleta" });
  }

  return voci.slice(0, 2);
}

/** Una tessera del "Da fare": tutta cliccabile, porta dove si risolve. */
function TesseraDaFare({ voce, indice }) {
  const Icona = voce.icona;
  const badge = voce.tono === "is-allarme"
    ? "is-allarme"
    : voce.tono === "is-attenzione" ? "is-attenzione" : "";

  return (
    <Link
      to={voce.a}
      className={`adm-tessera-azione cru-tessera ${voce.tono}`}
      style={{ "--cru-ritardo": `${indice * 45}ms` }}
    >
      <span className="adm-tessera-icona"><Icona aria-hidden="true" /></span>
      <span className="adm-tessera-titolo">
        {/* Il numero prima delle parole: "14 certificati scaduti" si legge
            come una frase, e il numerino non resta solo su una riga a capo
            quando il titolo è lungo. */}
        <span className={`adm-badge-conta ${badge}`}>{voce.conta}</span>
        <span className="cru-tessera-parole">{voce.titolo}</span>
      </span>
      <span className="adm-tessera-testo">{voce.testo}</span>
      <FaArrowRight className="adm-tessera-freccia" aria-hidden="true" />
    </Link>
  );
}

/** Un appuntamento: la data grande a sinistra, come su un calendario da muro. */
function Appuntamento({ evento, area, adesso }) {
  const d = new Date(evento.inizio);
  const nonSulSito = evento.visibileDal && new Date(evento.visibileDal) > adesso;

  return (
    <li>
      <Link to={`${area}/${SEZIONE_DI[evento.tipo] ?? "eventi"}/${evento.id}`} className="cru-evento">
        <span className="cru-evento-data" style={{ "--cru-colore": evento.colore || "#8a97aa" }}>
          <span className="cru-evento-giorno">{d.toLocaleDateString("it-IT", { weekday: "short" })}</span>
          <span className="cru-evento-numero">{d.getDate()}</span>
          <span className="cru-evento-mese">{d.toLocaleDateString("it-IT", { month: "short" })}</span>
        </span>

        <span className="cru-evento-corpo">
          <span className="cru-evento-titolo">{evento.titolo}</span>
          <span className="cru-evento-righe">
            <span>
              {NOME_TIPO[evento.tipo] ?? "Evento"}
              {!evento.tuttoIlGiorno && <> · ore {ora(evento.inizio)}</>}
              {" · "}{evento.squadra}
            </span>
            {evento.luogo && (
              <span className="cru-evento-luogo">
                <FaMapMarkerAlt aria-hidden="true" /> {evento.luogo}
              </span>
            )}
          </span>
          {nonSulSito && (
            <span className="adm-status adm-status-future cru-evento-stato">Non ancora sul sito</span>
          )}
        </span>

        <FaArrowRight className="cru-evento-freccia" aria-hidden="true" />
      </Link>
    </li>
  );
}

/** Un numero da leggere, non un compito: sta in fondo, in piccolo. */
function Numero({ icona: Icona, valore, etichetta, a }) {
  return (
    <Link to={a} className="cru-numero">
      <Icona className="cru-numero-icona" aria-hidden="true" />
      <span className="cru-numero-valore">{valore}</span>
      <span className="cru-numero-etichetta">{etichetta}</span>
    </Link>
  );
}

function Attesa() {
  return (
    <div className="adm-page cru" aria-busy="true" aria-label="Un momento…">
      <div className="adm-sagoma cru-sagoma-benvenuto" />
      <div className="adm-sagoma adm-sagoma-titolo" />
      <div className="adm-azioni-rapide">
        <div className="adm-sagoma adm-sagoma-scheda" />
        <div className="adm-sagoma adm-sagoma-scheda" />
        <div className="adm-sagoma adm-sagoma-scheda" />
      </div>
    </div>
  );
}

/**
 * La prima schermata di chi amministra qualcosa.
 *
 * Risponde a una domanda sola, "cosa devo fare adesso?", e lascia farlo con
 * un tocco. Prima era un muro di numeri divisi per argomento — "0 bozze",
 * "65 atleti", "14 certificati scaduti" tutti con lo stesso peso — e toccava
 * a chi guardava capire quali fossero compiti e quali statistiche. Adesso i
 * compiti stanno in cima, in ordine di urgenza, e solo se ci sono; i numeri
 * da leggere e basta scendono in fondo.
 *
 * Quello che compare dipende dalle capacità, non dal nome del ruolo: la
 * risposta arriva già composta dal server, e qui si disegna soltanto.
 */
export default function HomePannello() {
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();
  const area = useArea();

  const capacita = user?.capabilities ?? [];
  // Chi controlla i certificati: segreteria e amministratori.
  const puoValidare = capacita.includes("certificato.registra");
  /* Chi segue solo le proprie squadre — l'allenatore — ha una home sulla
     sua squadra: i prossimi impegni vengono prima dei numeri della società. */
  const soloProprie = capacita.includes("eventi.gestisci_proprie")
    && !capacita.includes("eventi.gestisci_tutte");

  const [dati, setDati] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");

  const [adesso] = useState(() => new Date());

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    setErrore(err.message || "Caricamento non riuscito.");
  }, [navigate, sessionExpired]);

  useEffect(() => {
    let attivo = true;

    getCruscotto()
      .then((c) => {
        if (!attivo) return;
        setDati(c);
        setCaricamento(false);
      })
      .catch((err) => {
        if (!attivo) return;
        gestisciErrore(err);
        setCaricamento(false);
      });

    return () => { attivo = false; };
  }, [gestisciErrore]);

  if (caricamento) return <Attesa />;

  if (!dati) {
    return (
      <div className="adm-page">
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore || "Non riesco a leggere la situazione."}</span>
        </div>
      </div>
    );
  }

  const voci = daFare(dati, { area, puoValidare, soloProprie });
  const azioni = scorciatoie(capacita, area);
  const PrimaIcona = azioni[0]?.icona;
  const nome = (user?.name ?? "").split(" ")[0] || "";
  const prossimo = dati.prossimi?.[0];

  /* La riga sotto al saluto: quante cose aspettano e, per chi allena, il
     prossimo impegno — la domanda che si fa aprendo il telefono prima
     dell'allenamento. */
  let riassunto = voci.length === 0
    ? "Tutto in ordine: non c'è niente che ti aspetta."
    : voci.length === 1
      ? "C'è una cosa da sistemare: la trovi qui sotto."
      : `Ci sono ${voci.length} cose da sistemare. Parti dalla prima: è la più urgente.`;

  if (soloProprie && prossimo) {
    const giorno = new Date(prossimo.inizio).toLocaleDateString("it-IT", {
      weekday: "long", day: "numeric", month: "long"
    });
    riassunto += ` Il prossimo impegno è ${giorno}${prossimo.tuttoIlGiorno ? "" : ` alle ${ora(prossimo.inizio)}`}.`;
  }

  const sezioneProssimi = dati.prossimi && (
    <section className="adm-sezione" aria-labelledby="cru-prossimi">
      <div className="adm-sezione-testa">
        <div>
          <h2 className="adm-sezione-titolo" id="cru-prossimi">
            <FaCalendarAlt aria-hidden="true" />
            {soloProprie ? "I tuoi prossimi impegni" : "I prossimi appuntamenti"}
          </h2>
          <p className="adm-sezione-sotto">Tocca un appuntamento per cambiarlo o scriverne il risultato.</p>
        </div>
        <div className="adm-sezione-azioni">
          <Link to={`${area}/partite`} className="adm-btn adm-btn-ghost">Tutte le partite</Link>
        </div>
      </div>

      {dati.prossimi.length === 0 ? (
        <div className="adm-vuoto-amico">
          <span className="adm-vuoto-icona"><FaCalendarAlt aria-hidden="true" /></span>
          <h3>Niente in calendario</h3>
          <p>Quando aggiungi una partita compare qui e sul calendario del sito.</p>
          <Link to={`${area}/partite/nuova`} className="adm-btn adm-btn-primary">
            <FaPlus aria-hidden="true" /> Aggiungi una partita
          </Link>
        </div>
      ) : (
        <ul className="cru-eventi">
          {dati.prossimi.map((e) => (
            <Appuntamento key={e.id} evento={e} area={area} adesso={adesso} />
          ))}
        </ul>
      )}
    </section>
  );

  /* I numeri da leggere e basta: non chiedono niente a nessuno, ma è
     comodo averli sott'occhio ed entrare da lì nell'elenco. */
  const numeri = [];
  if (dati.iscritti !== undefined) {
    numeri.push(
      <Numero
        key="iscritti"
        icona={FaRunning}
        valore={dati.iscritti}
        etichetta={soloProprie ? "atleti nelle tue squadre" : "atleti in squadra"}
        a={`${area}/atleti`}
      />
    );
  }
  if (dati.squadre) {
    numeri.push(
      <Numero key="squadre" icona={FaSitemap} valore={dati.squadre.attive} etichetta="squadre attive" a={`${area}/squadre`} />
    );
  }
  if (dati.notizie) {
    numeri.push(
      <Numero key="online" icona={FaNewspaper} valore={dati.notizie.online} etichetta="notizie sul sito" a={`${area}/notizie`} />,
      <Numero key="programmate" icona={FaClock} valore={dati.notizie.programmate} etichetta="notizie programmate" a={`${area}/notizie`} />
    );
  }
  if (dati.account) {
    numeri.push(
      <Numero key="mai" icona={FaUserClock} valore={dati.account.maiEntrati} etichetta="account mai usati" a={`${area}/utenti`} />
    );
  }

  return (
    <div className="adm-page cru">
      <header className="adm-benvenuto">
        <p className="adm-occhiello">{NOME_RUOLO[user?.role] ?? "Area riservata"}</p>
        <h1 className="adm-benvenuto-titolo">Ciao{nome && <>, <em>{nome}</em></>}</h1>
        <p className="adm-benvenuto-testo">{riassunto}</p>

        {azioni.length > 0 && (
          <div className="adm-benvenuto-azioni">
            {azioni.map(({ a, icona: Icona, testo }) => (
              <Link key={a} to={a} className="adm-btn adm-btn-ghost">
                <Icona aria-hidden="true" /> {testo}
              </Link>
            ))}
          </div>
        )}
      </header>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {/* ---------- Da fare adesso ---------- */}
      <section className="adm-sezione" aria-labelledby="cru-dafare">
        <div className="adm-sezione-testa">
          <div>
            <h2 className="adm-sezione-titolo" id="cru-dafare">Da fare adesso</h2>
            {voci.length > 0 && (
              <p className="adm-sezione-sotto">
                {voci.length === 1 ? "Una cosa" : `${voci.length} cose`} che {voci.length === 1 ? "aspetta" : "aspettano"} te,
                dalla più urgente. Tocca per andare dritto a sistemarle.
              </p>
            )}
          </div>
        </div>

        {voci.length === 0 ? (
          <div className="adm-vuoto-amico cru-in-ordine">
            <span className="adm-vuoto-icona"><FaCheckCircle aria-hidden="true" /></span>
            <h3>Tutto in ordine</h3>
            <p>
              Nessuna richiesta, nessun certificato da guardare, niente in sospeso.
              {azioni[0] ? " Se vuoi, puoi partire da qui:" : " Puoi chiudere tranquillo."}
            </p>
            {azioni[0] && (
              <Link to={azioni[0].a} className="adm-btn adm-btn-primary">
                <PrimaIcona aria-hidden="true" /> {azioni[0].testo}
              </Link>
            )}
          </div>
        ) : (
          <div className="adm-azioni-rapide cru-dafare">
            {voci.map((v, i) => <TesseraDaFare key={v.chiave} voce={v} indice={i} />)}
          </div>
        )}
      </section>

      {sezioneProssimi}

      {numeri.length > 0 && (
        <section className="adm-sezione" aria-labelledby="cru-numeri">
          <div className="adm-sezione-testa">
            <h2 className="adm-sezione-titolo" id="cru-numeri">In breve</h2>
          </div>
          <div className="cru-numeri">{numeri}</div>
        </section>
      )}
    </div>
  );
}
