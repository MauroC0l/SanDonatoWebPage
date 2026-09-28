import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaPlus, FaPencilAlt, FaTrashAlt, FaExclamationCircle,
  FaCalendarAlt, FaMapMarkerAlt, FaTrophy, FaThLarge, FaBars, FaRegCalendarAlt,
  FaClock, FaRunning, FaFlagCheckered
} from "react-icons/fa";
import { listEventi, listSquadre, deleteEvento, getCalendariUfficiali, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { useDialoghi } from "../../context/dialoghi";
import Tendina from "./Tendina";
import Paginazione from "./Paginazione";
import ScambiaVista from "./ScambiaVista";
import CalendarioEventi from "./CalendarioEventi";
import RisultatoVeloce from "./RisultatoVeloce";
import { daCompletare } from "./esitoPerSport";
import { usePaginazione } from "../../hooks/usePaginazione";
import { useVista } from "../../hooks/useVista";
import "../../css/Admin.css";
import "../../css/admin/Partite.css";

/*
 * Tre modi di guardare le stesse date.
 *
 * La lista dice cosa viene dopo, la griglia fa vedere le squadre a colpo
 * d'occhio, il calendario risponde a "quel sabato siamo liberi?" — che è
 * la domanda di chi fissa un'amichevole, e sulle altre due si risponde
 * solo contando i giorni a mano.
 */
const VISTE = [
  { valore: "lista", etichetta: "Lista", Icona: FaBars },
  { valore: "griglia", etichetta: "Griglia", Icona: FaThLarge },
  { valore: "calendario", etichetta: "Calendario", Icona: FaRegCalendarAlt }
];

/** Il primo del mese in cui cade la data. */
function primoDelMese(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** I tre modi in cui si guarda un calendario: avanti, indietro, tutto. */
const PERIODI = [
  { chiave: "prossimi", etichetta: "In programma" },
  { chiave: "passati", etichetta: "Già giocate" },
  { chiave: "tutto", etichetta: "Tutte" },
  // Non un periodo ma uno stato: quelli che sul sito non si vedono ancora.
  // Sta con gli altri perche e la stessa domanda — "cosa sto guardando".
  { chiave: "programmati", etichetta: "Non ancora sul sito" }
];

/* Le stesse pillole, al femminile o al maschile: "Già giocate" detto degli
   eventi di società (una riunione, una festa) suonerebbe strano. */
const ETICHETTE_EVENTI = { passati: "Già svolti", tutto: "Tutti" };

function intervalloDi(periodo) {
  const adesso = new Date();
  const unAnno = 365 * 24 * 60 * 60 * 1000;

  if (periodo === "prossimi") return { da: adesso, a: new Date(adesso.getTime() + unAnno) };
  // I programmati si cercano avanti e indietro: uno puo preparare anche il
  // resoconto di una partita gia giocata e mostrarlo lunedi.
  if (periodo === "programmati") return { da: new Date(adesso.getTime() - unAnno), a: new Date(adesso.getTime() + 2 * unAnno) };
  if (periodo === "passati") return { da: new Date(adesso.getTime() - unAnno), a: adesso };
  return { da: new Date(adesso.getTime() - 5 * unAnno), a: new Date(adesso.getTime() + unAnno) };
}

function dataLeggibile(iso, conOra = true) {
  const d = new Date(iso);
  const data = d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  if (!conOra) return data;
  return `${data} · ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
}

/* Quante settimane indietro si cercano le partite senza risultato. Oltre i
   due mesi un risultato non lo ricorda più nessuno, e un elenco di cose
   vecchie da sistemare è un elenco che si smette di guardare. */
const GIORNI_DA_COMPLETARE = 60;
// Quante se ne mostrano in cima: le altre si trovano in "Già giocate"
const MOSTRATE_DA_COMPLETARE = 4;

/**
 * "Oggi", "domani", "fra 3 giorni": come lo direbbe una persona.
 *
 * Accanto alla data e non al suo posto: la data serve a chi deve scriverla
 * sul gruppo delle famiglie, il "fra 3 giorni" a chi deve solo capire se
 * è questo sabato o il prossimo.
 */
function fraQuanto(iso, adesso) {
  const d = new Date(iso);
  const giorno = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const giorni = Math.round((giorno(d) - giorno(adesso)) / 86400000);

  if (giorni === 0) return "Oggi";
  if (giorni === 1) return "Domani";
  if (giorni > 1 && giorni < 14) return `Fra ${giorni} giorni`;
  return null;
}

/* I tipi che un allenatore trova sotto "Partite". Deve combaciare con
   TIPI_ALLENATORE in server/eventi.js, che è quello che il server fa
   rispettare. */
const TIPI_PARTITA = ["partita", "torneo", "allenamento"];

/**
 * @param genere  "partite" oppure "eventi": cambia cosa si elenca, come si
 *                chiama e dove portano i collegamenti. Il calendario del
 *                sito resta uno solo.
 */
export default function EventiListPage({ genere = "partite" }) {
  const ePartite = genere === "partite";
  const sezione = ePartite ? "partite" : "eventi";
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();
  const area = useArea();

  /* Chi amministra divide per PROVENIENZA: in Partite quelle ufficiali,
     che porta la federazione; in Eventi tutto quello che si inserisce a
     mano — amichevoli, allenamenti, appuntamenti della società. Un
     allenatore invece ha solo Partite, e lì trova tutti gli impegni delle
     sue squadre, come prima: la divisione gli toglierebbe le amichevoli. */
  const perProvenienza = (user?.capabilities ?? []).includes("eventi.gestisci_tutte");
  const { avvisa, conferma } = useDialoghi();

  const [eventi, setEventi] = useState([]);
  const [squadre, setSquadre] = useState([]);
  const [squadreAmmesse, setSquadreAmmesse] = useState(null);
  const [periodo, setPeriodo] = useState("prossimi");
  const [vista, setVista] = useVista("eventi", "lista", ["lista", "griglia", "calendario"]);
  const [squadraId, setSquadraId] = useState("");
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  // Le partite tolte dalla federazione, solo nella sezione Partite dell'admin
  const [sparite, setSparite] = useState([]);
  // Le partite degli ultimi due mesi, per trovare quelle senza risultato
  const [recenti, setRecenti] = useState([]);

  // Fissato all'apertura: leggerlo mentre si disegna darebbe un risultato
  // diverso a ogni passaggio.
  const [adesso] = useState(() => new Date());

  // Il mese che il calendario sta mostrando. Vive qui e non dentro al
  // calendario perché decide anche COSA si va a chiedere al server.
  const [mese, setMese] = useState(() => primoDelMese(new Date()));

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
    listSquadre()
      .then((elenco) => attivo && setSquadre(elenco))
      .catch(gestisciErrore);
    return () => { attivo = false; };
  }, [gestisciErrore]);

  useEffect(() => {
    let attivo = true;

    /* Nel calendario il periodo non conta: quello che serve sono gli
       eventi del mese che si sta guardando, più i giorni delle settimane
       che sconfinano nei mesi vicini — la griglia li disegna comunque, e
       vuoti sarebbero una bugia. Sedici giorni di margine coprono i due
       sconfinamenti più lunghi possibili. */
    const { da, a } = vista === "calendario"
      ? {
        da: new Date(mese.getFullYear(), mese.getMonth(), -15),
        a: new Date(mese.getFullYear(), mese.getMonth() + 1, 15)
      }
      : intervalloDi(periodo);

    // Nessun setState prima della richiesta: aggiornare lo stato in modo
    // sincrono dentro un effetto costringe React a un secondo render
    // immediato. Cambiando filtro si continuano a vedere i risultati
    // precedenti finché non arrivano i nuovi, invece di uno sfarfallio.
    listEventi({
      da, a,
      squadraId: squadraId || undefined,
      programmati: vista !== "calendario" && periodo === "programmati"
    })
      .then((risultato) => {
        if (!attivo) return;
        // In "già svolti" i più recenti stanno in cima
        const ordinati = vista !== "calendario" && periodo === "passati"
          ? [...risultato.eventi].reverse()
          : risultato.eventi;

        setEventi(ordinati);
        setSquadreAmmesse(risultato.squadreAmmesse);
        setErrore("");
        setCaricamento(false);
      })
      .catch((err) => {
        if (!attivo) return;
        gestisciErrore(err);
        setCaricamento(false);
      });

    return () => { attivo = false; };
  }, [periodo, squadraId, vista, mese, gestisciErrore]);

  /* Le partite giocate e senza risultato si cercano per conto loro, a
     prescindere dal periodo scelto: chi apre "Partite" il lunedì mattina
     guarda "In programma", e il risultato di sabato deve trovarlo lo
     stesso, in cima, senza dover cambiare filtro. */
  useEffect(() => {
    let attivo = true;
    listEventi({
      da: new Date(adesso.getTime() - GIORNI_DA_COMPLETARE * 86400000),
      a: adesso,
      squadraId: squadraId || undefined
    })
      .then((risultato) => { if (attivo) setRecenti(risultato.eventi); })
      // Non è l'elenco principale: se non arriva, la pagina resta usabile
      .catch(() => {});
    return () => { attivo = false; };
  }, [adesso, squadraId]);

  /* Un coach vede nel filtro solo le proprie squadre: proporgli le altre
     significherebbe offrirgli un elenco che tornerà sempre vuoto. */
  const opzioniSquadra = useMemo(() => {
    const visibili = Array.isArray(squadreAmmesse)
      ? squadre.filter((s) => squadreAmmesse.includes(s.id))
      : squadre;

    return [
      { valore: "", etichetta: "Tutte le squadre" },
      ...[...visibili]
        .sort((a, b) => a.sport.localeCompare(b.sport) || a.nome.localeCompare(b.nome))
        .map((s) => ({
          valore: String(s.id),
          etichetta: s.nome,
          gruppo: s.sport === "Societa" ? "Società" : s.sport,
          colore: s.colore
        }))
    ];
  }, [squadre, squadreAmmesse]);

  /*
   * Partite ed eventi vivono nella stessa tabella e finiscono sullo stesso
   * calendario del sito: qui si separano solo per chi li amministra, che
   * compila due moduli diversi e cerca due cose diverse.
   */
  const dellaSezioneFn = useCallback(
    (e) => (perProvenienza
      ? Boolean(e.ufficiale) === ePartite
      : TIPI_PARTITA.includes(e.tipo) === ePartite),
    [ePartite, perProvenienza]
  );

  const dellaSezione = useMemo(() => eventi.filter(dellaSezioneFn), [eventi, dellaSezioneFn]);

  // Le più recenti in cima: è di sabato che ci si ricorda meglio
  const senzaRisultato = useMemo(
    () => recenti.filter((e) => dellaSezioneFn(e) && daCompletare(e, adesso)).reverse(),
    [recenti, dellaSezioneFn, adesso]
  );

  // Le partite ufficiali non si creano a mano: arrivano dalla federazione
  const siCrea = !(ePartite && perProvenienza);

  // Con 263 eventi in archivio, "Tutti" senza pagine e una schermata
  // lunghissima in cui non si trova niente.
  const { pagina, pagine, setPagina, visibili: dellaPagina, totale } = usePaginazione(dellaSezione, 20);

  useEffect(() => {
    if (!ePartite || !perProvenienza) return undefined;
    let attivo = true;

    getCalendariUfficiali()
      .then((risposta) => { if (attivo) setSparite(risposta.sparite); })
      .catch(gestisciErrore);

    return () => { attivo = false; };
  }, [ePartite, perProvenienza, gestisciErrore]);

  /* Un risultato scritto dal riquadro in cima: la partita si aggiorna in
     tutti e due gli elenchi, e se ora è completa esce da quello in cima. */
  const risultatoSalvato = (aggiornato) => {
    const sostituisci = (prima) => prima.map((e) => (e.id === aggiornato.id ? aggiornato : e));
    setRecenti(sostituisci);
    setEventi(sostituisci);
    avvisa(`Risultato salvato: ${aggiornato.risultato}. È già sul sito.`);
  };

  const togliSparita = async (partita) => {
    const ok = await conferma({
      titolo: `Togliere "${partita.titolo}" dal calendario?`,
      testo: "La federazione non la elenca più. Dal sito è già sparita; qui la si toglie anche "
        + "dal pannello. Se ricomparisse nel calendario ufficiale, tornerà da sola.",
      conferma: "Togli",
      pericolo: true
    });
    if (!ok) return;

    try {
      await deleteEvento(partita.id);
      setSparite((prima) => prima.filter((p) => p.id !== partita.id));
      setEventi((prima) => prima.filter((e) => e.id !== partita.id));
    } catch (err) {
      gestisciErrore(err);
    }
  };

  const elimina = async (evento) => {
    const ok = await conferma({
      titolo: "Eliminare questo evento?",
      testo: `"${evento.titolo}" del ${dataLeggibile(evento.inizio, false)} sparisce `
        + "dal calendario del sito. Questa non si annulla.",
      conferma: "Elimina",
      pericolo: true
    });
    if (!ok) return;

    try {
      await deleteEvento(evento.id);
      setEventi((prima) => prima.filter((e) => e.id !== evento.id));
      setRecenti((prima) => prima.filter((e) => e.id !== evento.id));
      avvisa("Evento eliminato.");
    } catch (err) {
      gestisciErrore(err);
    }
  };

  const indirizzoNuovo = `${area}/${sezione}/${ePartite ? "nuova" : "nuovo"}`;
  const senzaSquadre = Array.isArray(squadreAmmesse) && squadreAmmesse.length === 0;
  // "Già giocate" per le partite, "Già svolti" per gli eventi
  const etichettaPeriodo = (p) => (ePartite ? p.etichetta : (ETICHETTE_EVENTI[p.chiave] ?? p.etichetta));

  return (
    <div className="adm-page ev-pagina">
      {/* La testata: il titolo e, ben visibile, la cosa che si viene a
          fare più spesso — aggiungere una partita. */}
      <header className="ev-testa">
        <div className="ev-testa-testo">
          <p className="adm-occhiello">
            {perProvenienza ? (ePartite ? "Dalle federazioni" : "Calendario della società") : "Le tue squadre"}
          </p>
          <h1 className="adm-page-title">{ePartite ? "Partite" : "Eventi"}</h1>
          <p className="ev-testa-sotto">
            {ePartite && perProvenienza
              ? "Le partite ufficiali, dai calendari delle federazioni: orari e risultati si aggiornano da soli ogni notte. Qui si aggiungono marcatori, diretta e foto."
              : ePartite
                ? "Le partite e gli allenamenti delle tue squadre. Quello che aggiungi qui compare subito nel calendario del sito."
                : "Amichevoli, allenamenti e appuntamenti della società: tutto quello che non arriva dai calendari ufficiali."}
          </p>
        </div>

        <div className="ev-testa-azioni">
          {siCrea ? (
            <>
              <Link to={indirizzoNuovo} className="adm-btn adm-btn-arancio ev-btn-grande">
                <FaPlus aria-hidden="true" /> {ePartite ? "Aggiungi una partita" : "Nuovo evento"}
              </Link>
              {/* L'altro impegno di ogni settimana, a un tocco: arriva nel
                  modulo con il tipo già scelto */}
              {ePartite && (
                <Link to={`${indirizzoNuovo}?tipo=allenamento`} className="adm-btn adm-btn-ghost ev-btn-grande">
                  <FaRunning aria-hidden="true" /> Allenamento
                </Link>
              )}
            </>
          ) : (
            <Link to={`${area}/calendari`} className="adm-btn adm-btn-ghost">
              Calendari ufficiali
            </Link>
          )}
        </div>
      </header>

      {/* Le partite che la federazione non elenca più: dal sito sono già
          sparite, qui si decide se toglierle anche dal pannello. */}
      {ePartite && perProvenienza && sparite.length > 0 && (
        <div className="adm-alert adm-alert-warn adm-sparite">
          <FaExclamationCircle />
          <div>
            <strong>
              {sparite.length === 1
                ? "Una partita è stata tolta dal calendario ufficiale"
                : `${sparite.length} partite sono state tolte dal calendario ufficiale`}
            </strong>
            {" "}— dal sito sono già sparite. Se è un rinvio senza data torneranno da sole; se sono
            cancellate davvero, toglile anche da qui.
            <ul className="adm-sparite-elenco">
              {sparite.map((p) => (
                <li key={p.id}>
                  <span>
                    <strong>{p.titolo}</strong>
                    <span className="adm-hint"> · {p.squadra} · era il {dataLeggibile(p.inizio)}</span>
                  </span>
                  <span className="adm-sparite-azioni">
                    <Link to={`${area}/partite/${p.id}`} className="adm-btn adm-btn-ghost">Apri</Link>
                    <button type="button" className="adm-btn adm-btn-ghost" onClick={() => togliSparita(p)}>
                      Togli
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ---------- Com'è finita? ----------
          In cima, prima di ogni filtro: è l'unica cosa della pagina che
          chiede qualcosa a chi la apre, e si fa senza uscire di qui. */}
      {senzaRisultato.length > 0 && (
        <section className="adm-sezione ev-da-completare" aria-labelledby="ev-da-completare-titolo">
          <div className="adm-sezione-testa">
            <div>
              <h2 className="adm-sezione-titolo" id="ev-da-completare-titolo">
                <FaFlagCheckered aria-hidden="true" /> Com&apos;è finita?
                <span className="adm-badge-conta is-attenzione">{senzaRisultato.length}</span>
              </h2>
              <p className="adm-sezione-sotto">
                {senzaRisultato.length === 1
                  ? "Una partita già giocata aspetta il risultato. Scrivilo qui e premi Salva: finisce subito sul sito."
                  : "Partite già giocate che aspettano il risultato. Scrivilo qui e premi Salva: finisce subito sul sito."}
              </p>
            </div>
          </div>

          <ul className="ev-veloci">
            {senzaRisultato.slice(0, MOSTRATE_DA_COMPLETARE).map((e) => (
              <RisultatoVeloce
                key={e.id}
                evento={e}
                area={area}
                sezione={sezione}
                onSalvato={risultatoSalvato}
                onErrore={gestisciErrore}
              />
            ))}
          </ul>

          {senzaRisultato.length > MOSTRATE_DA_COMPLETARE && (
            <p className="adm-hint ev-veloci-altre">
              E altre {senzaRisultato.length - MOSTRATE_DA_COMPLETARE}: le trovi in{" "}
              <button type="button" className="ev-link" onClick={() => { setVista("lista"); setPeriodo("passati"); }}>
                Già giocate
              </button>, segnate &quot;Manca il risultato&quot;.
            </p>
          )}
        </section>
      )}

      {/* Stessa barra dei filtri delle Notizie, con lo stesso stacco
          dall'elenco. */}
      <div className="adm-toolbar ev-filtri">
        {/* Nel calendario il periodo lo sceglie il mese che si sta
            guardando: lasciare accese anche le pillole darebbe due comandi
            per la stessa cosa, che si contraddicono. */}
        {vista !== "calendario" && <div className="adm-chip-group ev-periodi">
          {PERIODI.map((p) => (
            <button
              key={p.chiave}
              type="button"
              className={`adm-chip ${periodo === p.chiave ? "is-active" : ""}`}
              onClick={() => setPeriodo(p.chiave)}
              aria-pressed={periodo === p.chiave}
            >
              {etichettaPeriodo(p)}
            </button>
          ))}
        </div>}

        <div className="ev-filtri-destra">
          <Tendina
            className="adm-filter-select"
            valore={squadraId}
            onChange={setSquadraId}
            opzioni={opzioniSquadra}
            segnaposto="Tutte le squadre"
            // Senza ricerca: sul telefono apriva la tastiera a ogni tocco
            cercabile={false}
            etichettaAria="Filtra per squadra"
          />
          <ScambiaVista vista={vista} onCambia={setVista} opzioni={VISTE} />
        </div>
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {caricamento ? (
        // La forma dell'elenco che sta arrivando, al posto della rotella
        <div className="ev-attesa" aria-busy="true" aria-label="Caricamento delle partite">
          <span className="adm-sagoma adm-sagoma-scheda" />
          <span className="adm-sagoma adm-sagoma-scheda" />
          <span className="adm-sagoma adm-sagoma-scheda" />
        </div>
      ) : vista === "calendario" ? (
        <CalendarioEventi
          mese={mese}
          onCambiaMese={setMese}
          eventi={dellaSezione}
          area={area}
          oggi={adesso}
          sezione={sezione}
        />
      ) : dellaSezione.length === 0 ? (
        <div className="adm-vuoto-amico">
          <span className="adm-vuoto-icona"><FaCalendarAlt aria-hidden="true" /></span>
          {senzaSquadre ? (
            <>
              <h2>Non hai ancora una squadra</h2>
              <p>Chiedi a chi amministra il sito di collegarti alla tua: da quel momento qui trovi le sue partite.</p>
            </>
          ) : ePartite && perProvenienza ? (
            <>
              <h2>Nessuna partita ufficiale in questo periodo</h2>
              <p>Arrivano da sole collegando i gironi delle federazioni alle squadre.</p>
              <Link to={`${area}/calendari`} className="adm-btn adm-btn-primary">Calendari ufficiali</Link>
            </>
          ) : (
            <>
              <h2>
                {periodo === "prossimi"
                  ? (ePartite ? "Nessuna partita in programma" : "Nessun evento in programma")
                  : "Qui non c'è niente"}
              </h2>
              <p>
                {ePartite
                  ? "Quando ne aggiungi una compare qui e nel calendario del sito, con luogo e orario."
                  : "Quando ne aggiungi uno compare qui e nel calendario del sito."}
              </p>
              <Link to={indirizzoNuovo} className="adm-btn adm-btn-arancio">
                <FaPlus aria-hidden="true" /> {ePartite ? "Aggiungi una partita" : "Nuovo evento"}
              </Link>
            </>
          )}
        </div>
      ) : (
        <ul className={vista === "griglia" ? "ev-elenco ev-griglia" : "ev-elenco"}>
          {dellaPagina.map((evento, i) => {
            const inizio = new Date(evento.inizio);
            const manca = daCompletare(evento, adesso);
            // La prima dell'elenco "In programma" è quella che conta di più
            const prossima = periodo === "prossimi" && pagina === 1 && i === 0;
            const fra = periodo !== "passati" ? fraQuanto(evento.inizio, adesso) : null;
            const siElimina = !evento.ufficiale || evento.sparitaIl;

            return (
              <li key={evento.id} className={`ev-riga ${prossima ? "is-prossima" : ""} ${manca ? "is-manca" : ""}`}>
                {/* Il giorno in grande, come su un calendario da muro: si
                    scorre l'elenco guardando solo questa colonna. */}
                <span className="ev-data" aria-hidden="true">
                  <span className="ev-data-sett">{inizio.toLocaleDateString("it-IT", { weekday: "short" })}</span>
                  <span className="ev-data-num">{inizio.getDate()}</span>
                  <span className="ev-data-mese">{inizio.toLocaleDateString("it-IT", { month: "short" })}</span>
                </span>

                <div className="ev-corpo">
                  {prossima && <span className="ev-prossima-etichetta">La prossima</span>}
                  {/* Il titolo è il collegamento, e copre tutta la scheda:
                      sul telefono si tocca la partita dove capita */}
                  <Link to={`${area}/${sezione}/${evento.id}`} className="ev-titolo">
                    <span className="ev-colore" style={{ backgroundColor: evento.colore || "#999" }} aria-hidden="true" />
                    {evento.titolo}
                  </Link>

                  <div className="ev-meta">
                    {!evento.tuttoIlGiorno && (
                      <span className="ev-ora">
                        <FaClock aria-hidden="true" />
                        {inizio.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    {fra && <span className="ev-fra">{fra}</span>}
                    <span className="ev-squadra">{evento.squadra}</span>
                    {evento.luogo && (
                      <span className="ev-luogo"><FaMapMarkerAlt aria-hidden="true" /> {evento.luogo}</span>
                    )}
                  </div>

                  <div className="ev-stati">
                    {evento.risultato && (
                      <span className="ev-risultato"><FaTrophy aria-hidden="true" /> {evento.risultato}</span>
                    )}
                    {evento.ufficiale && !evento.sparitaIl && (
                      <span className="adm-status adm-status-ufficiale" title="Orari e risultato li aggiorna la federazione">
                        Ufficiale
                      </span>
                    )}
                    {evento.sparitaIl && (
                      <span className="adm-status adm-status-respinta" title="La federazione non la elenca più: sul sito non si vede">
                        Tolta dal calendario ufficiale
                      </span>
                    )}
                    {evento.visibileDal && new Date(evento.visibileDal) > adesso && (
                      <span className="adm-status adm-status-future">
                        Sul sito dal {dataLeggibile(evento.visibileDal)}
                      </span>
                    )}
                    {/* Giocata ma non ancora messa a verbale: è l'unica cosa
                        che chiede qualcosa a chi guarda questo elenco. */}
                    {manca && (
                      <span className="adm-status adm-status-draft">
                        {evento.risultato ? "Mancano i parziali" : "Manca il risultato"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="ev-azioni">
                  {manca ? (
                    <Link to={`${area}/${sezione}/${evento.id}?esito=1`} className="adm-btn adm-btn-arancio">
                      <FaTrophy aria-hidden="true" /> Risultato
                    </Link>
                  ) : (
                    // Doppione del titolo per chi usa la tastiera o un
                    // lettore di schermo: lo si salta
                    <Link
                      to={`${area}/${sezione}/${evento.id}`}
                      className="adm-btn adm-btn-ghost ev-apri"
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      <FaPencilAlt aria-hidden="true" /> Apri
                    </Link>
                  )}
                  {/* Una partita ufficiale tornerebbe alla lettura dopo: si
                      elimina solo quando la federazione l'ha tolta */}
                  {siElimina && (
                    <button
                      type="button"
                      className="adm-icon-btn adm-icon-danger ev-elimina"
                      onClick={() => elimina(evento)}
                      title="Elimina"
                      aria-label={`Elimina ${evento.titolo}`}
                    >
                      <FaTrashAlt />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Il calendario mostra un mese intero per definizione: paginarlo
          vorrebbe dire spezzare il mese, che è l'unica cosa che non deve
          succedere. */}
      {vista !== "calendario" && (
        <Paginazione
          pagina={pagina}
          pagine={pagine}
          onCambia={setPagina}
          totale={totale}
          nome={ePartite ? ["partita", "partite"] : ["evento", "eventi"]}
        />
      )}
    </div>
  );
}
