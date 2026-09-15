import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FaSearch, FaTimes, FaNewspaper, FaSlidersH, FaArrowRight, FaCalendarAlt
} from "react-icons/fa";
import { getAllPosts, CATEGORIE, NOME_CATEGORIA } from "../../api/API.mjs";
import Tendina from "../Admin/Tendina";
import CampoData from "../Admin/CampoData";
import "../../css/Admin.css";
import "../../css/Tendina.css";
import "../../css/CampoData.css";
import "../../css/NewsPage.css";

/**
 * L'archivio delle notizie.
 *
 * Rifatta con la stessa lingua visiva della home: fondo chiaro, schede
 * bianche, una notizia in evidenza e le altre in griglia. Prima era una
 * colonna di filtri a sinistra e una lista di schede tutte uguali a destra —
 * novantotto articoli senza niente che li distinguesse.
 *
 * Sono sparite due librerie da questa pagina: react-bootstrap, di cui si
 * usavano tre componenti, e react-datepicker, che pesava 176 KB per un
 * calendario che il sito ha già suo (CampoData). Quei due controlli vivono
 * dentro al pannello e portano la tavolozza --adm-*: la si dichiara sulla
 * radice di questa pagina, come si fa per le finestre di dialogo.
 *
 * IL FILTRO PER CATEGORIA è la novità che conta: lo sport divideva male un
 * archivio in cui otto articoli su dieci non parlano di sport ma di
 * assemblee, feste e iscrizioni.
 */

const ORDINI = [
  { valore: "desc", etichetta: "Dalla più recente" },
  { valore: "asc", etichetta: "Dalla più vecchia" }
];

const PER_PAGINA = 12;

/* Minivolley è pallavolo per chi legge: come filtro a sé faceva una voce in
   più che quasi nessuno avrebbe premuto. */
const sportVisibile = (sport) => (sport === "Minivolley" ? "Pallavolo" : sport);

/**
 * La data di una notizia, dal campo ISO.
 *
 * Mai da `date`: quello è già formattato all'italiana ("07/09/2026"), e
 * new Date() lo legge come mese/giorno — o non lo legge affatto sopra il
 * dodici.
 */
function quando(post) {
  const d = new Date(post?.dateISO ?? "");
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function fineGiornata(iso) {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Una scheda della griglia. Grande per la prima, normale per le altre. */
function Scheda({ post, grande = false }) {
  const sfondo = post.image || "/logo-poli-sfondo.jpg";

  return (
    <Link
      to={`/news/${post.id}`}
      state={{ post }}
      className={`nws-scheda ${grande ? "nws-scheda-grande" : ""}`}
    >
      <span className="nws-foto" style={{ backgroundImage: `url(${sfondo})` }} aria-hidden="true" />
      {grande && <span className="nws-velo" aria-hidden="true" />}

      <span className="nws-testi">
        <span className="nws-etichette">
          {post.categoria && post.categoria !== "altro" && (
            <span className="nws-categoria">
              {NOME_CATEGORIA[post.categoria] ?? post.categoria}
            </span>
          )}
          {post.sport && post.sport !== "Altro" && (
            <span className="nws-sport">{sportVisibile(post.sport)}</span>
          )}
          <span className="nws-data">{post.date}</span>
        </span>

        <span className="nws-titolo">{post.title}</span>

        {post.preview && <span className="nws-sommario">{post.preview}</span>}

        <span className="nws-leggi">Leggi <FaArrowRight aria-hidden="true" /></span>
      </span>
    </Link>
  );
}

export default function NewsPage() {
  const [notizie, setNotizie] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");

  const [sport, setSport] = useState("");
  const [categoria, setCategoria] = useState("");
  const [ordine, setOrdine] = useState("desc");
  const [da, setDa] = useState("");
  const [a, setA] = useState("");
  const [scritto, setScritto] = useState("");
  const [cerca, setCerca] = useState("");

  const [pagina, setPagina] = useState(1);
  const [filtriAperti, setFiltriAperti] = useState(false);

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

  const opzioniSport = useMemo(() => {
    const presenti = [...new Set(notizie.map((n) => sportVisibile(n.sport)).filter(Boolean))];
    presenti.sort();

    return [
      { valore: "", etichetta: "Tutti gli sport" },
      ...presenti.map((s) => ({ valore: s, etichetta: s }))
    ];
  }, [notizie]);

  const opzioniCategoria = useMemo(() => {
    // Solo le categorie che hanno davvero qualcosa dentro: una voce che
    // torna sempre vuota è una promessa non mantenuta.
    const presenti = new Set(notizie.map((n) => n.categoria));

    return [
      { valore: "", etichetta: "Tutte le categorie" },
      ...CATEGORIE.filter((c) => c.valore !== "altro" && presenti.has(c.valore))
    ];
  }, [notizie]);

  const filtrate = useMemo(() => {
    const cercato = cerca.trim().toLowerCase();

    return notizie
      .filter((n) => !sport || sportVisibile(n.sport) === sport)
      .filter((n) => !categoria || n.categoria === categoria)
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
  }, [notizie, sport, categoria, da, a, cerca, ordine]);

  const pagine = Math.max(1, Math.ceil(filtrate.length / PER_PAGINA));
  const paginaValida = Math.min(pagina, pagine);
  const dellaPagina = filtrate.slice((paginaValida - 1) * PER_PAGINA, paginaValida * PER_PAGINA);

  /* In evidenza solo sulla prima pagina e solo senza filtri: una scheda
     grande in cima alla pagina quattro non è "in evidenza", è disordine. */
  const conEvidenza = paginaValida === 1 && ordine === "desc";
  const [primo, ...altre] = dellaPagina;

  const cambia = (azione) => (valore) => {
    setPagina(1);
    azione(valore);
  };

  const azzera = () => {
    setSport("");
    setCategoria("");
    setDa("");
    setA("");
    setCerca("");
    setScritto("");
    setOrdine("desc");
    setPagina(1);
  };

  const conFiltri = Boolean(sport || categoria || da || a || cerca);

  return (
    <div className="nws">
      <header className="nws-intestazione">
        <span className="nws-occhiello">Archivio</span>
        <h1 className="nws-titolo-pagina">Le notizie della Polisportiva</h1>
        <p className="nws-sottotitolo">
          Assemblee, feste, risultati e comunicazioni: tutto quello che è stato
          pubblicato, dal più recente.
        </p>
      </header>

      <div className="nws-contenitore">

        {/* ---------- Filtri ---------- */}
        <div className={`nws-filtri ${filtriAperti ? "is-aperti" : ""}`}>
          <form
            className="nws-cerca"
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
          </form>

          <div className="nws-filtri-campi">
            <Tendina
              valore={categoria}
              onChange={cambia(setCategoria)}
              opzioni={opzioniCategoria}
              segnaposto="Tutte le categorie"
              etichettaAria="Filtra per categoria"
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

            {conFiltri && (
              <button type="button" className="nws-azzera" onClick={azzera}>
                <FaTimes aria-hidden="true" /> Togli i filtri
              </button>
            )}
          </div>
        </div>

        {/* Su un telefono i filtri stanno dietro a un pulsante: cinque
            controlli in cima alla pagina spingerebbero le notizie sotto la
            piega, e le notizie sono quello che si è venuti a leggere. */}
        <button
          type="button"
          className="nws-apri-filtri"
          onClick={() => setFiltriAperti((v) => !v)}
          aria-expanded={filtriAperti}
        >
          <FaSlidersH aria-hidden="true" />
          {filtriAperti ? "Nascondi i filtri" : "Filtra e cerca"}
          {conFiltri && <span className="nws-pallino" aria-hidden="true" />}
        </button>

        {/* ---------- Le notizie ---------- */}
        {caricamento ? (
          <div className="nws-griglia">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="nws-sagoma" />
            ))}
          </div>
        ) : errore ? (
          <p className="nws-vuoto">
            {errore}<br />Riprova fra qualche minuto o ricarica la pagina.
          </p>
        ) : filtrate.length === 0 ? (
          <p className="nws-vuoto">
            <FaNewspaper aria-hidden="true" />
            {conFiltri
              ? "Nessuna notizia corrisponde a questi filtri."
              : "Non c'è ancora nessuna notizia pubblicata."}
          </p>
        ) : (
          <>
            <p className="nws-conto">
              {filtrate.length === 1 ? "Una notizia" : `${filtrate.length} notizie`}
              {conFiltri && " con questi filtri"}
            </p>

            <div className="nws-griglia">
              {conEvidenza
                ? <>
                  <Scheda post={primo} grande />
                  {altre.map((n) => <Scheda key={n.id} post={n} />)}
                </>
                : dellaPagina.map((n) => <Scheda key={n.id} post={n} />)}
            </div>

            {pagine > 1 && (
              <nav className="nws-pagine" aria-label="Pagine">
                <button
                  type="button"
                  onClick={() => { setPagina(paginaValida - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={paginaValida === 1}
                >
                  Precedente
                </button>

                <span>
                  <FaCalendarAlt aria-hidden="true" /> Pagina {paginaValida} di {pagine}
                </span>

                <button
                  type="button"
                  onClick={() => { setPagina(paginaValida + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={paginaValida === pagine}
                >
                  Successiva
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
