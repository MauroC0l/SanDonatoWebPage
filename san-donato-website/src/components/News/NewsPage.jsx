import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  FaSearch, FaTimes, FaNewspaper, FaSlidersH, FaArrowRight, FaArrowLeft
} from "react-icons/fa";
import { getAllPosts } from "../../api/API.mjs";
import Tendina from "../Admin/Tendina";
import CampoData from "../Admin/CampoData";
import Contatore from "../Sport/Contatore";
import SchedaNotizia from "./SchedaNotizia";
import { daQuanto, dataBreve, etichetteDi, quando, sportVisibile } from "./notizieUtili";
import "../../css/Admin.css";
import "../../css/Tendina.css";
import "../../css/CampoData.css";
import "../../css/NewsPage.css";

/**
 * L'archivio delle notizie.
 *
 * Rifatta con la lingua delle pagine Sport, Chi siamo e Contatti: una
 * testata blu attaccata al menu con la copertina dell'ultima uscita, il
 * nastro arancione con le etichette, una barra dei filtri di vetro che
 * resta in alto scorrendo, e le notizie in un mosaico da rivista invece di
 * una griglia di schede tutte uguali.
 *
 * Il comportamento è quello di prima: si scaricano tutte le notizie una
 * volta (getAllPosts, con la sua cache) e filtri, ordine e pagine si fanno
 * qui. I due controlli del pannello (Tendina e CampoData) vivono con la
 * tavolozza --adm-*: la si dichiara sulla radice di questa pagina, come si
 * fa per le finestre di dialogo.
 *
 * IL FILTRO PER ETICHETTA è quello che conta: otto articoli su dieci non
 * parlano di sport ma di assemblee, feste e iscrizioni. Le etichette le
 * decide lo staff, quindi l'elenco nasce dalle notizie caricate.
 */

const ORDINI = [
  { valore: "desc", etichetta: "Dalla più recente" },
  { valore: "asc", etichetta: "Dalla più vecchia" }
];

const PER_PAGINA = 12;

/* Le etichette offerte come scorciatoia nella testata: le più usate. Più
   di sei diventano un muro di pastiglie che nessuno legge. */
const SCORCIATOIE = 6;

/* Le parole del nastro quando lo staff non ha ancora messo etichette */
const NASTRO_RIPIEGO = ["Notizie", "Risultati", "Eventi", "Comunicazioni", "Assemblee", "Feste"];

const RIDOTTO = "(prefers-reduced-motion: reduce)";

function fineGiornata(iso) {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d;
}

/* Le pagine da mostrare nella numerazione: la prima, l'ultima e le vicine
   a quella corrente. Con cento pagine una fila di cento pulsanti sarebbe
   inutilizzabile; i buchi diventano "…". */
function numeriPagine(corrente, totale) {
  const tenute = new Set([1, totale, corrente - 1, corrente, corrente + 1]);
  const elenco = [...tenute].filter((n) => n >= 1 && n <= totale).sort((x, y) => x - y);
  const conBuchi = [];
  elenco.forEach((n, i) => {
    if (i > 0 && n - elenco[i - 1] > 1) conBuchi.push(`buco-${n}`);
    conBuchi.push(n);
  });
  return conBuchi;
}

export default function NewsPage() {
  const [notizie, setNotizie] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");

  const [sport, setSport] = useState("");
  const [etichetta, setEtichetta] = useState("");
  const [ordine, setOrdine] = useState("desc");
  const [da, setDa] = useState("");
  const [a, setA] = useState("");
  const [scritto, setScritto] = useState("");
  const [cerca, setCerca] = useState("");

  const [pagina, setPagina] = useState(1);
  const [filtriAperti, setFiltriAperti] = useState(false);

  // Dove riportare chi cambia pagina o sceglie un'etichetta dalla testata
  const risultatiRef = useRef(null);

  useEffect(() => {
    let attivo = true;

    getAllPosts()
      .then((posts) => {
        if (!attivo) return;
        setNotizie(posts);
        setCaricamento(false);
      })
      .catch((err) => {
        if (!attivo) return;
        console.error("Errore nel recupero delle notizie:", err);
        setErrore(err.message || "Non è stato possibile caricare le notizie.");
        setCaricamento(false);
      });

    return () => { attivo = false; };
  }, []);

  /* Le etichette in uso, con quante notizie ciascuna: servono al filtro,
     alle scorciatoie della testata e al nastro. Per id, così due notizie
     con la stessa etichetta non la fanno comparire due volte. */
  const etichetteInUso = useMemo(() => {
    const conti = new Map();
    for (const n of notizie) {
      for (const e of etichetteDi(n)) {
        const chiave = String(e.id);
        const c = conti.get(chiave);
        conti.set(chiave, { id: chiave, nome: e.nome, quante: (c?.quante ?? 0) + 1 });
      }
    }
    return [...conti.values()];
  }, [notizie]);

  const opzioniEtichetta = useMemo(() => [
    { valore: "", etichetta: "Tutte le etichette" },
    // Solo le etichette che hanno davvero qualcosa dentro: una voce che
    // torna sempre vuota è una promessa non mantenuta.
    ...[...etichetteInUso]
      .sort((x, y) => x.nome.localeCompare(y.nome, "it", { sensitivity: "base" }))
      .map((e) => ({ valore: e.id, etichetta: e.nome }))
  ], [etichetteInUso]);

  const piuUsate = useMemo(
    () => [...etichetteInUso].sort((x, y) => y.quante - x.quante).slice(0, SCORCIATOIE),
    [etichetteInUso]
  );

  const opzioniSport = useMemo(() => {
    const presenti = [...new Set(notizie.map((n) => sportVisibile(n.sport)).filter(Boolean))];
    presenti.sort();
    return [
      { valore: "", etichetta: "Tutti gli sport" },
      ...presenti.map((s) => ({ valore: s, etichetta: s }))
    ];
  }, [notizie]);

  // Le ultime tre uscite, a prescindere dai filtri: la "copertina" della testata
  const ultime = useMemo(
    () => [...notizie].sort((x, y) => quando(y) - quando(x)).slice(0, 3),
    [notizie]
  );

  const filtrate = useMemo(() => {
    const cercato = cerca.trim().toLowerCase();

    return notizie
      .filter((n) => !sport || sportVisibile(n.sport) === sport)
      .filter((n) => !etichetta || etichetteDi(n).some((e) => String(e.id) === etichetta))
      .filter((n) => {
        const d = quando(n);
        if (da && d < new Date(da)) return false;
        if (a && d > fineGiornata(a)) return false;
        return true;
      })
      .filter((n) => !cercato
        || `${n.title} ${n.preview ?? ""}`.toLowerCase().includes(cercato))
      .sort((x, y) => (ordine === "desc"
        ? quando(y) - quando(x)
        : quando(x) - quando(y)));
  }, [notizie, sport, etichetta, da, a, cerca, ordine]);

  const pagine = Math.max(1, Math.ceil(filtrate.length / PER_PAGINA));
  const paginaValida = Math.min(pagina, pagine);
  const dellaPagina = filtrate.slice((paginaValida - 1) * PER_PAGINA, paginaValida * PER_PAGINA);

  /* In evidenza solo sulla prima pagina e dalla più recente: una scheda
     grande in cima alla pagina quattro non è "in evidenza", è disordine. */
  const conEvidenza = paginaValida === 1 && ordine === "desc";

  /* Il mosaico: la prima grande (due colonne per due righe) e, quando i
     conti tornano, una scheda larga più giù che rompe il ritmo. "Quando i
     conti tornano" vuol dire che con quattro colonne le celle riempiono le
     righe senza buchi: grande (4) + larga (2) + le altre fa n + 4. */
  const variante = (i) => {
    if (!conEvidenza) return "normale";
    if (i === 0) return "grande";
    if (i === 7 && dellaPagina.length % 4 === 0) return "larga";
    return "normale";
  };

  const liscio = () => !window.matchMedia(RIDOTTO).matches;

  const vaiAiRisultati = () => {
    const el = risultatiRef.current;
    if (!el) return;
    /* Sopra ai risultati restano l'intestazione (che torna visibile
       salendo) e la barra dei filtri attaccata: si lascia il posto a
       tutte e due, o il conto delle notizie finirebbe dietro al vetro. */
    const testata = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue("--site-header-h")) || 80;
    const barra = document.querySelector(".nz-barra")?.offsetHeight ?? 60;
    const alto = el.getBoundingClientRect().top + window.scrollY - testata - barra - 28;
    window.scrollTo({ top: Math.max(0, alto), behavior: liscio() ? "smooth" : "auto" });
  };

  const cambia = (azione) => (valore) => {
    setPagina(1);
    azione(valore);
  };

  const vaiAPagina = (n) => {
    setPagina(n);
    vaiAiRisultati();
  };

  const scegliEtichetta = (id) => {
    setPagina(1);
    setEtichetta((prima) => (prima === id ? "" : id));
    vaiAiRisultati();
  };

  const azzera = () => {
    setSport("");
    setEtichetta("");
    setDa("");
    setA("");
    setCerca("");
    setScritto("");
    setOrdine("desc");
    setPagina(1);
  };

  const conFiltri = Boolean(sport || etichetta || da || a || cerca);

  /* I filtri accesi, uno per pastiglia, ognuno con la sua crocetta: chi ne
     ha messi tre vuole toglierne uno, non ricominciare da capo. */
  const nomeEtichetta = etichetteInUso.find((e) => e.id === etichetta)?.nome;
  const accesi = [
    etichetta && { chiave: "etichetta", testo: nomeEtichetta || "Etichetta", togli: () => cambia(setEtichetta)("") },
    sport && { chiave: "sport", testo: sport, togli: () => cambia(setSport)("") },
    da && { chiave: "da", testo: `Dal ${dataBreve({ dateISO: da })}`, togli: () => cambia(setDa)("") },
    a && { chiave: "a", testo: `Al ${dataBreve({ dateISO: a })}`, togli: () => cambia(setA)("") },
    cerca && { chiave: "cerca", testo: `“${cerca}”`, togli: () => { setScritto(""); cambia(setCerca)(""); } }
  ].filter(Boolean);

  const quanteSport = opzioniSport.length - 1;
  const parole = etichetteInUso.length
    ? [...etichetteInUso].sort((x, y) => y.quante - x.quante).slice(0, 12).map((e) => e.nome)
    : NASTRO_RIPIEGO;

  return (
    <div className="nz">

      {/* ---------- TESTATA ---------- */}
      <header className="nz-eroe">
        <div className="mv-aurora" aria-hidden="true" />
        <div className="nz-eroe-griglia" aria-hidden="true" />
        <span className="nz-eroe-fantasma" data-parallasse="0.12" aria-hidden="true">NEWS</span>

        <div className="nz-eroe-dentro">
          <div className="nz-eroe-testo">
            <p className="nz-occhiello" data-rivela="sfuma">
              <span className="nz-punto" aria-hidden="true" /> Archivio · Polisportiva San Donato
            </p>
            <h1 className="nz-titolo">
              <span className="nz-titolo-riga" data-rivela>Le notizie</span>
              <span className="nz-titolo-riga" data-rivela>
                <span className="mv-testo-vivo">dal campo.</span>
              </span>
            </h1>
            <p className="nz-sottotitolo" data-rivela>
              Assemblee, feste, risultati e comunicazioni: tutto quello che è
              stato pubblicato, dal più recente.
            </p>

            {/* Le etichette più usate come scorciatoia: un tocco filtra e
                porta giù ai risultati. La chiave cambia all'arrivo dei
                dati, così le pastiglie vere compaiono anche loro. */}
            {piuUsate.length > 0 && (
              <div className="nz-scorciatoie" data-rivela-gruppo key="scorciatoie">
                {piuUsate.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    // La scelta si legge da aria-pressed e non da una classe:
                    // riscrivendo className React toglierebbe le classi della
                    // comparsa, e la pastiglia tornerebbe invisibile.
                    className="nz-scorciatoia"
                    aria-pressed={etichetta === e.id}
                    onClick={() => scegliEtichetta(e.id)}
                  >
                    {e.nome} <small>{e.quante}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* La copertina dell'ultima uscita, con le due precedenti sotto
              a ventaglio. Sugli schermi stretti non c'è: la prima scheda
              del mosaico dice la stessa cosa poco più giù. Comparsa sulla
              cornice, parallasse dentro, inclinazione sulla scheda: tre
              transform, tre elementi. */}
          {ultime.length > 0 && (
            <div className="nz-mazzo" data-rivela="zoom" key={`mazzo-${ultime[0].id}`}>
              <div className="nz-mazzo-dentro" data-parallasse="0.06">
                {ultime.slice(1).map((n, i) => (
                  <span
                    key={n.id}
                    className={`nz-mazzo-foglio nz-mazzo-foglio-${i + 1}`}
                    aria-hidden="true"
                  >
                    <img src={n.image || "/logo-poli-sfondo.jpg"} alt="" loading="lazy" />
                  </span>
                ))}
                <Link
                  to={`/news/${ultime[0].id}`}
                  state={{ post: ultime[0] }}
                  className="nz-mazzo-cima"
                  data-inclina="6"
                >
                  <img src={ultime[0].image || "/logo-poli-sfondo.jpg"} alt="" />
                  <span className="nz-mazzo-velo" aria-hidden="true" />
                  <span className="nz-mazzo-testi">
                    <span className="nz-mazzo-bollo">
                      <span className="nz-punto" aria-hidden="true" /> Ultima uscita · {daQuanto(ultime[0])}
                    </span>
                    <span className="nz-mazzo-titolo">{ultime[0].title}</span>
                    <span className="nz-mazzo-leggi">Leggi <FaArrowRight aria-hidden="true" /></span>
                  </span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* I numeri contano da zero la prima volta che si vedono. Finché
            le notizie non arrivano restano dei trattini: un "0" farebbe
            credere a un archivio vuoto. */}
        <dl
          className="nz-numeri"
          data-rivela-gruppo
          key={caricamento ? "numeri-attesa" : "numeri-pronti"}
        >
          <div>
            <dt>Notizie</dt>
            <dd>{caricamento ? "—" : <Contatore valore={notizie.length} />}</dd>
          </div>
          <div>
            <dt>Etichette</dt>
            <dd>{caricamento ? "—" : <Contatore valore={etichetteInUso.length} />}</dd>
          </div>
          <div>
            <dt>Sport</dt>
            <dd>{caricamento ? "—" : <Contatore valore={quanteSport} />}</dd>
          </div>
          <div>
            <dt>Ultimo aggiornamento</dt>
            <dd className="nz-numero-testo">{caricamento || !ultime[0] ? "—" : daQuanto(ultime[0])}</dd>
          </div>
        </dl>
      </header>

      {/* ---------- NASTRO ----------
          Ripetuto due volte: la seconda metà prende il posto della prima e
          il giro non si vede. Per i lettori di schermo è decorazione. */}
      <div className="nz-fascia-cornice" aria-hidden="true">
        <div className="nz-fascia mv-nastro">
          <div className="mv-nastro-traccia" key={parole.join("|")}>
            {[0, 1].map((copia) => (
              <span className="nz-fascia-giro" key={copia}>
                {parole.map((p, i) => (
                  <span className="nz-fascia-voce" key={i}>
                    {p}<span className="nz-fascia-stella">✦</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="nz-contenitore">

        {/* ---------- FILTRI ----------
            Una barra di vetro che resta in alto scorrendo, sotto
            all'intestazione quando c'è (--testata-visibile la pubblica
            MyNavbar). Niente overflow nascosto: il calendario del filtro
            per data si apre sotto la barra e non deve essere tagliato. */}
        <div className={`nz-barra${filtriAperti ? " is-aperta" : ""}`}>
          <div className="nz-barra-vetro">
            <div className="nz-barra-riga">
              <form
                className="nz-cerca"
                role="search"
                onSubmit={(e) => { e.preventDefault(); setPagina(1); setCerca(scritto.trim()); }}
              >
                <FaSearch aria-hidden="true" />
                <input
                  type="search"
                  value={scritto}
                  onChange={(e) => setScritto(e.target.value)}
                  placeholder="Cerca fra le notizie…"
                  aria-label="Cerca fra le notizie"
                />
                {scritto && (
                  <button
                    type="button"
                    className="nz-cerca-svuota"
                    aria-label="Svuota la ricerca"
                    onClick={() => { setScritto(""); if (cerca) cambia(setCerca)(""); }}
                  >
                    <FaTimes aria-hidden="true" />
                  </button>
                )}
              </form>

              {/* Su un telefono i filtri stanno dietro a un pulsante: cinque
                  controlli in cima spingerebbero le notizie sotto la piega,
                  e le notizie sono quello che si è venuti a leggere. */}
              <button
                type="button"
                className="nz-apri-filtri"
                onClick={() => setFiltriAperti((v) => !v)}
                aria-expanded={filtriAperti}
                aria-controls="nz-campi"
              >
                <FaSlidersH aria-hidden="true" />
                <span>{filtriAperti ? "Chiudi" : "Filtri"}</span>
                {conFiltri && <span className="nz-pallino" aria-hidden="true">{accesi.length}</span>}
              </button>
            </div>

            <div className="nz-campi" id="nz-campi">
              <Tendina
                valore={etichetta}
                onChange={cambia(setEtichetta)}
                opzioni={opzioniEtichetta}
                segnaposto="Tutte le etichette"
                etichettaAria="Filtra per etichetta"
                vuoto="Nessuna etichetta trovata."
              />

              <Tendina
                valore={sport}
                onChange={cambia(setSport)}
                opzioni={opzioniSport}
                segnaposto="Tutti gli sport"
                etichettaAria="Filtra per sport"
              />

              <CampoData
                valore={da}
                onChange={cambia(setDa)}
                etichettaAria="Dal giorno"
                segnaposto="Dal…"
              />

              <CampoData
                valore={a}
                onChange={cambia(setA)}
                minimo={da || null}
                etichettaAria="Al giorno"
                segnaposto="Al…"
              />

              <Tendina
                valore={ordine}
                onChange={cambia(setOrdine)}
                opzioni={ORDINI}
                etichettaAria="Ordine"
              />
            </div>
          </div>
        </div>

        {/* ---------- LE NOTIZIE ---------- */}
        <section className="nz-risultati" ref={risultatiRef} aria-label="Notizie">
          {caricamento ? (
            <div className="nz-mosaico" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className={`nz-sagoma${i === 0 ? " nz-sagoma-grande" : ""}`} />
              ))}
            </div>
          ) : errore ? (
            <div className="nz-vuoto">
              <FaNewspaper aria-hidden="true" />
              <strong>Le notizie non sono arrivate</strong>
              <span>{errore} Riprova fra qualche minuto o ricarica la pagina.</span>
            </div>
          ) : filtrate.length === 0 ? (
            <div className="nz-vuoto">
              <FaNewspaper aria-hidden="true" />
              <strong>
                {conFiltri
                  ? "Nessuna notizia corrisponde a questi filtri."
                  : "Non c'è ancora nessuna notizia pubblicata."}
              </strong>
              {conFiltri && (
                <button type="button" className="nz-azzera" onClick={azzera}>
                  <FaTimes aria-hidden="true" /> Togli i filtri
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="nz-conto-riga">
                <p className="nz-conto" aria-live="polite">
                  <strong>{filtrate.length}</strong>
                  {filtrate.length === 1 ? " notizia" : " notizie"}
                  {conFiltri && <span> con questi filtri</span>}
                </p>

                {accesi.length > 0 && (
                  <ul className="nz-accesi" aria-label="Filtri attivi">
                    {accesi.map((f) => (
                      <li key={f.chiave}>
                        <button type="button" onClick={f.togli} aria-label={`Togli il filtro ${f.testo}`}>
                          {f.testo} <FaTimes aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                    {accesi.length > 1 && (
                      <li>
                        <button type="button" className="nz-accesi-tutti" onClick={azzera}>
                          Togli tutti
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {/* La chiave cambia con pagina e filtri: il mosaico rinasce e
                  le schede ricompaiono in fila invece di cambiare sotto gli
                  occhi senza segno. Serve anche a non riusare schede già
                  comparse, a cui React riscriverebbe le classi del movimento. */}
              <div
                className="nz-mosaico"
                data-rivela-gruppo
                key={[paginaValida, ordine, sport, etichetta, da, a, cerca].join("|")}
              >
                {dellaPagina.map((n, i) => (
                  <SchedaNotizia key={n.id} post={n} variante={variante(i)} />
                ))}
              </div>

              {pagine > 1 && (
                <nav className="nz-pagine" aria-label="Pagine">
                  <button
                    type="button"
                    className="nz-pagina-freccia"
                    onClick={() => vaiAPagina(paginaValida - 1)}
                    disabled={paginaValida === 1}
                    aria-label="Pagina precedente"
                  >
                    <FaArrowLeft aria-hidden="true" />
                  </button>

                  <ol className="nz-pagine-numeri">
                    {numeriPagine(paginaValida, pagine).map((n) => (
                      typeof n === "string"
                        ? <li key={n} className="nz-pagine-buco" aria-hidden="true">…</li>
                        : (
                          <li key={n}>
                            <button
                              type="button"
                              className={n === paginaValida ? "is-corrente" : ""}
                              aria-current={n === paginaValida ? "page" : undefined}
                              aria-label={`Pagina ${n}`}
                              onClick={() => vaiAPagina(n)}
                            >
                              {n}
                            </button>
                          </li>
                        )
                    ))}
                  </ol>

                  <button
                    type="button"
                    className="nz-pagina-freccia"
                    onClick={() => vaiAPagina(paginaValida + 1)}
                    disabled={paginaValida === pagine}
                    aria-label="Pagina successiva"
                  >
                    <FaArrowRight aria-hidden="true" />
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
