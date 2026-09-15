import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import AboutSection from "./AboutSection";
import EventDetailsModal from "../../components/EventDetailsModal";
import ResultsModal from "../../components/ResultsModal";
import NewsletterForm from "./NewsletterForm";
import { getLatestPostsByCategory, NOME_CATEGORIA } from "../../api/API.mjs";
import { fetchHomeEvents } from "../../api/calendarApi";
import {
  FaCalendarAlt, FaClock, FaYoutube, FaNewspaper, FaArrowRight,
  FaMapMarkerAlt, FaLock, FaTrophy, FaEnvelopeOpenText, FaPlay
} from "react-icons/fa";
import "../../css/HomePage.css";

// Per quanti giorni una notizia resta marcata come "NUOVA"
const GIORNI_BADGE_NUOVA = 2;

// Si basa sul campo ISO, l'unico confrontabile in modo affidabile:
// post.date è già formattato "gg/mm/aaaa" e new Date() lo interpreterebbe male.
// Sta fuori dal componente e riceve "adesso" perché il calcolo va fatto al
// caricamento dei dati, non a ogni render.
function eRecente(post, adesso, finestra = GIORNI_BADGE_NUOVA) {
  const data = new Date(post?.dateISO ?? "");
  if (isNaN(data.getTime())) return false;

  const giorni = (adesso - data.getTime()) / (1000 * 3600 * 24);
  return giorni >= 0 && giorni <= finestra;
}

/** Quanto manca alla diretta, aggiornato ogni secondo. */
function ContoAllaRovescia({ quando, alTermine }) {
  const [mancano, setMancano] = useState("");

  useEffect(() => {
    const obiettivo = new Date(quando).getTime();

    const battito = setInterval(() => {
      const distanza = obiettivo - Date.now();

      if (distanza < 0) {
        clearInterval(battito);
        if (alTermine) alTermine();
        return;
      }

      const ore = Math.floor((distanza % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minuti = Math.floor((distanza % (1000 * 60 * 60)) / (1000 * 60));
      const secondi = Math.floor((distanza % (1000 * 60)) / 1000);

      setMancano([ore, minuti, secondi].map((n) => String(n).padStart(2, "0")).join(":"));
    }, 1000);

    return () => clearInterval(battito);
  }, [quando, alTermine]);

  if (!mancano) return null;

  return (
    <div className="hs-conto">
      <span className="hs-conto-etichetta">Si comincia fra</span>
      <span className="hs-conto-cifre">{mancano}</span>
    </div>
  );
}

export default function HomePage() {
  const [ultimeNotizie, setUltimeNotizie] = useState([]);
  const [eventiSettimana, setEventiSettimana] = useState([]);
  const [eventiOggi, setEventiOggi] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [erroreNotizie, setErroreNotizie] = useState("");

  const [eventoScelto, setEventoScelto] = useState(null);
  const [mostraRisultati, setMostraRisultati] = useState(false);
  const [mostraNewsletter, setMostraNewsletter] = useState(false);

  // Serve solo a ridisegnare quando il conto alla rovescia arriva a zero:
  // da quel momento "fra poco" diventa "in onda".
  const [, setBattito] = useState(0);

  const navigate = useNavigate();

  const nomeGiorno = (d) => new Date(d)
    .toLocaleDateString("it-IT", { weekday: "short" })
    .toUpperCase()
    .replace(".", "");

  const giornoMese = (d) => new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
  const oraDi = (d) => new Date(d).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  /** In onda da un quarto d'ora prima fino a due ore e mezza dopo l'inizio. */
  const eInOnda = (quando) => {
    if (!quando) return false;
    const minuti = Math.floor((new Date(quando) - new Date()) / 60000);
    return minuti <= 15 && minuti > -150;
  };

  const finitoIlConto = useCallback(() => setBattito((b) => b + 1), []);

  useEffect(() => {
    let attivo = true;

    async function carica() {
      // allSettled e non all: se le notizie non rispondono il calendario deve
      // comunque comparire, e viceversa. Un guasto solo non svuota la home.
      const [notizie, calendario] = await Promise.allSettled([
        getLatestPostsByCategory(),
        fetchHomeEvents()
      ]);

      if (!attivo) return;

      if (notizie.status === "fulfilled") {
        const tutte = [];
        Object.values(notizie.value || {}).forEach((perSport) => {
          if (Array.isArray(perSport)) tutte.push(...perSport);
        });
        tutte.sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));

        // "Nuova" si decide una volta sola, qui: la finestra è di giorni, e
        // ricalcolarla a ogni ridisegno non cambierebbe mai niente.
        const adesso = Date.now();
        setUltimeNotizie(
          tutte.slice(0, 5).map((post) => ({ ...post, recente: eRecente(post, adesso) }))
        );
      } else {
        console.error("Errore caricamento notizie:", notizie.reason);
        setErroreNotizie(notizie.reason?.message || "Notizie non disponibili.");
      }

      if (calendario.status === "fulfilled") {
        setEventiOggi(calendario.value.todayEvents || []);
        setEventiSettimana(calendario.value.weekEvents || []);
      } else {
        console.error("Errore caricamento calendario:", calendario.reason);
      }

      setCaricamento(false);
    }

    carica();
    return () => { attivo = false; };
  }, []);

  /* Le dirette che ha senso mostrare adesso: da due ore fa alle prossime
     dodici. Più indietro è finita, più avanti non interessa ancora. */
  const dirette = eventiOggi.filter((ev) => {
    if (!ev.hasTime) return false;
    const ore = (ev.start - new Date()) / (1000 * 60 * 60);
    return ore >= -2 && ore <= 12;
  });

  /* La prima notizia fa da copertina, le altre le stanno sotto in fila.
     Dare a tutte e cinque lo stesso peso vuol dire non dire quale conta. */
  const [inEvidenza, ...altreNotizie] = ultimeNotizie;

  return (
    <div className="hp-root">
      <AboutSection />

      <section className="hs-sezione">
        <div className="hs-contenitore">

          <header className="hs-intestazione">
            <span className="hs-occhiello">In Polisportiva</span>
            <h2 className="hs-titolo">Cosa succede in questi giorni</h2>
            <p className="hs-sottotitolo">
              Le ultime notizie, le partite in diretta e gli appuntamenti della settimana.
            </p>
          </header>

          <div className="hs-griglia">

            {/* ---------- Notizie ---------- */}
            <div className="hs-notizie">
              <div className="hs-blocco-testa">
                <h3 className="hs-blocco-titolo">
                  <FaNewspaper aria-hidden="true" /> Ultime notizie
                </h3>
                <button type="button" className="hs-vedi-tutte" onClick={() => navigate("/news")}>
                  Vedi tutte <FaArrowRight aria-hidden="true" />
                </button>
              </div>

              {caricamento ? (
                /* Rettangoli grigi della forma giusta invece di una rotella:
                   la pagina non salta quando i dati arrivano, perché lo
                   spazio è già quello definitivo. */
                <div className="hs-notizie-griglia">
                  <div className="hs-scheletro hs-scheletro-grande" />
                  <div className="hs-scheletro" />
                  <div className="hs-scheletro" />
                </div>
              ) : erroreNotizie ? (
                <p className="hs-vuoto">{erroreNotizie}</p>
              ) : ultimeNotizie.length === 0 ? (
                <p className="hs-vuoto">Nessuna notizia pubblicata.</p>
              ) : (
                <div className="hs-notizie-griglia">
                  <NotiziaGrande notizia={inEvidenza} />

                  <div className="hs-notizie-fila">
                    {altreNotizie.map((n) => (
                      <NotiziaPiccola key={n.id} notizia={n} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ---------- Colonna di fianco ---------- */}
            <aside className="hs-lato">

              <section className="hs-scheda">
                <div className="hs-scheda-testa">
                  <h3 className="hs-blocco-titolo">
                    <span className="hs-pulsante-live" aria-hidden="true" /> Live center
                  </h3>
                  <FaYoutube className="hs-youtube" aria-hidden="true" />
                </div>

                {caricamento ? (
                  <div className="hs-scheletro hs-scheletro-riga" />
                ) : dirette.length === 0 ? (
                  <p className="hs-vuoto hs-vuoto-piccolo">
                    Nessuna diretta in programma per oggi.
                  </p>
                ) : (
                  <ul className="hs-dirette">
                    {dirette.map((diretta, posizione) => {
                      const inOnda = eInOnda(diretta.start);
                      // La prossima resta chiusa finché non comincia: un
                      // collegamento che porta a una diretta non ancora
                      // aperta è solo un vicolo cieco.
                      const chiusa = posizione === 0 && !inOnda;
                      const dove = diretta.diretta || "https://youtube.com/@PolisportivaSanDonato";

                      return (
                        <li key={diretta.id} className={`hs-diretta ${inOnda ? "is-onda" : ""}`}>
                          <div className="hs-diretta-alto">
                            {inOnda
                              ? <span className="hs-targhetta hs-targhetta-onda">In onda</span>
                              : <span className="hs-targhetta">Oggi {oraDi(diretta.start)}</span>}
                            <span className="hs-targhetta hs-targhetta-categoria">{diretta.category}</span>
                          </div>

                          <p className="hs-diretta-titolo">{diretta.title}</p>

                          <p className="hs-diretta-dove">
                            <FaMapMarkerAlt aria-hidden="true" />
                            {diretta.location || "Sede da definire"}
                          </p>

                          {chiusa && (
                            <ContoAllaRovescia quando={diretta.start} alTermine={finitoIlConto} />
                          )}

                          {chiusa ? (
                            <span className="hs-bottone hs-bottone-chiuso">
                              <FaLock aria-hidden="true" /> In attesa dell&apos;inizio
                            </span>
                          ) : (
                            <a
                              href={dove}
                              target="_blank"
                              rel="noreferrer"
                              className={`hs-bottone ${inOnda ? "hs-bottone-onda" : "hs-bottone-vuoto"}`}
                            >
                              <FaPlay aria-hidden="true" />
                              {inOnda ? "Guarda ora" : "Vai al canale"}
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="hs-scheda">
                <div className="hs-scheda-testa">
                  <h3 className="hs-blocco-titolo">
                    <FaCalendarAlt aria-hidden="true" /> Questa settimana
                  </h3>
                  {!caricamento && (
                    <button
                      type="button"
                      className="hs-risultati"
                      onClick={() => setMostraRisultati(true)}
                    >
                      <FaTrophy aria-hidden="true" /> Risultati
                    </button>
                  )}
                </div>

                {caricamento ? (
                  <div className="hs-scheletro hs-scheletro-riga" />
                ) : eventiSettimana.length === 0 ? (
                  <p className="hs-vuoto hs-vuoto-piccolo">Nessun appuntamento in programma.</p>
                ) : (
                  <ul className="hs-agenda">
                    {eventiSettimana.map((evento) => (
                      <li key={evento.id}>
                        <button
                          type="button"
                          className="hs-appuntamento"
                          onClick={() => setEventoScelto(evento)}
                        >
                          <span className="hs-quando" style={{ backgroundColor: evento.color }}>
                            <span className="hs-quando-giorno">{nomeGiorno(evento.start)}</span>
                            <span className="hs-quando-data">{giornoMese(evento.start)}</span>
                          </span>

                          <span className="hs-appuntamento-testi">
                            <span className="hs-appuntamento-titolo">{evento.title}</span>
                            <span className="hs-appuntamento-meta">
                              <span>
                                <FaClock aria-hidden="true" />
                                {evento.hasTime ? oraDi(evento.start) : "tutto il giorno"}
                              </span>
                              <span className="hs-appuntamento-luogo">
                                <FaMapMarkerAlt aria-hidden="true" />
                                {evento.location || "da definire"}
                              </span>
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <button
                type="button"
                className="hs-newsletter"
                onClick={() => setMostraNewsletter(true)}
              >
                <FaEnvelopeOpenText className="hs-newsletter-icona" aria-hidden="true" />
                <span className="hs-newsletter-testi">
                  <strong>Resta aggiornato</strong>
                  <span>Risultati e notizie nella tua posta.</span>
                </span>
                <FaArrowRight className="hs-newsletter-freccia" aria-hidden="true" />
              </button>

            </aside>
          </div>
        </div>
      </section>

      {eventoScelto && (
        <EventDetailsModal event={eventoScelto} onClose={() => setEventoScelto(null)} />
      )}

      {mostraRisultati && <ResultsModal onClose={() => setMostraRisultati(false)} />}
      {mostraNewsletter && <NewsletterForm onClose={() => setMostraNewsletter(false)} />}
    </div>
  );
}

/* =====================================================
   Le schede delle notizie
   ===================================================== */

/**
 * L'etichetta della categoria, quando dice qualcosa.
 *
 * "altro" è il valore di chi non ha ancora scelto: mostrarlo lo farebbe
 * sembrare una scelta, e riempirebbe la home di targhette che non
 * distinguono niente.
 */
function Categoria({ valore }) {
  if (!valore || valore === "altro") return null;
  return <span className="hs-categoria">{NOME_CATEGORIA[valore] ?? valore}</span>;
}

function NotiziaGrande({ notizia }) {
  if (!notizia) return null;

  const sfondo = notizia.image || "/logo-poli-sfondo.jpg";

  return (
    /* La scheda È il collegamento, invece di contenerne uno che si allarga
       con un riempimento trasparente: così tutta l'area è cliccabile, si
       raggiunge con il tabulatore e si può aprire in una scheda nuova col
       tasto centrale — cosa che un div con onClick non permette. */
    <Link
      to={`/news/${notizia.id}`}
      state={{ post: notizia }}
      className="hs-notizia hs-notizia-grande"
    >
      <span className="hs-foto" style={{ backgroundImage: `url(${sfondo})` }} aria-hidden="true" />
      <span className="hs-velo" aria-hidden="true" />

      <span className="hs-notizia-testi">
        <span className="hs-notizia-etichette">
          {notizia.recente && <span className="hs-nuova">Nuova</span>}
          <Categoria valore={notizia.categoria} />
          <span className="hs-data">{notizia.date}</span>
        </span>

        <span className="hs-notizia-titolo">{notizia.title}</span>
      </span>
    </Link>
  );
}

function NotiziaPiccola({ notizia }) {
  const sfondo = notizia.image || "/logo-poli-sfondo.jpg";

  return (
    <Link
      to={`/news/${notizia.id}`}
      state={{ post: notizia }}
      className="hs-notizia hs-notizia-piccola"
    >
      <span className="hs-miniatura" style={{ backgroundImage: `url(${sfondo})` }} aria-hidden="true" />

      <span className="hs-notizia-testi">
        <span className="hs-notizia-etichette">
          {notizia.recente && <span className="hs-nuova">Nuova</span>}
          <Categoria valore={notizia.categoria} />
          <span className="hs-data">{notizia.date}</span>
        </span>

        <span className="hs-notizia-titolo">{notizia.title}</span>
      </span>
    </Link>
  );
}
