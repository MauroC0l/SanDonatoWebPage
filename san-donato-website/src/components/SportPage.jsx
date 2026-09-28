import { useRef, useState } from "react";
import {
  FaBasketballBall,
  FaFutbol,
  FaVolleyballBall,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaInfoCircle,
  FaArrowRight
} from "react-icons/fa";
import "../css/SportPage.css";

import sportsData from "../data/SportPage.json";
import dynamicData from "../data/Data.json";

import Contatore from "./Sport/Contatore";
import SchedaSquadra from "./Sport/SchedaSquadra";
import { contatto, linkMappa, sedi, settimana, totali } from "./Sport/dati";

// Il JSON contiene stringhe (es: "basket"), qui diventano icone
const ICONE = {
  basket: FaBasketballBall,
  calcio: FaFutbol,
  volley: FaVolleyballBall
};

const CHIAVI = Object.keys(sportsData);
const TOTALI = totali(sportsData);

// Tutti i nomi delle squadre, per il nastro che scorre sotto il titolo
const NOMI_SQUADRE = CHIAVI.flatMap((k) =>
  sportsData[k].groups.map((g) => ({ sport: k, nome: g.name }))
);

const RIDOTTO = "(prefers-reduced-motion: reduce)";

export default function SportPage() {
  const [attivo, setAttivo] = useState("calcio");
  // Da che parte entra il pannello nuovo: segue il verso del selettore
  const [verso, setVerso] = useState("destra");
  const pannelloRef = useRef(null);
  const schedeRef = useRef({});

  const indice = CHIAVI.indexOf(attivo);
  const sport = sportsData[attivo];
  const Icona = ICONE[sport.iconKey];
  const giorni = settimana(sport);
  const massimoGiorno = Math.max(1, ...giorni.map((g) => g.quanti));
  const sediSport = sedi(sport);
  const chiama = contatto(sport.extraInfo);

  const scegli = (chiave) => {
    if (chiave === attivo) return;
    setVerso(CHIAVI.indexOf(chiave) > indice ? "destra" : "sinistra");
    setAttivo(chiave);
    /* Se il selettore è già "attaccato" in alto, chi cambia sport sta
       leggendo più giù: senza questo resterebbe a metà di un elenco che
       non è più quello di prima. */
    const pannello = pannelloRef.current;
    if (pannello && pannello.getBoundingClientRect().top < 0) {
      const liscio = !window.matchMedia(RIDOTTO).matches;
      window.scrollTo({
        top: pannello.getBoundingClientRect().top + window.scrollY - 96,
        behavior: liscio ? "smooth" : "auto"
      });
    }
  };

  // Frecce della tastiera fra le schede, come chiede il ruolo "tablist"
  const suTasto = (e) => {
    const passi = { ArrowRight: 1, ArrowLeft: -1, Home: -indice, End: CHIAVI.length - 1 - indice };
    if (!(e.key in passi)) return;
    e.preventDefault();
    const nuova = CHIAVI[(indice + passi[e.key] + CHIAVI.length) % CHIAVI.length];
    scegli(nuova);
    schedeRef.current[nuova]?.focus();
  };

  return (
    <div className="sp-pagina" style={{ "--sp-c": sport.color }}>

      {/* ---------- TESTATA ---------- */}
      <header className="sp-eroe">
        <div className="mv-aurora" aria-hidden="true" />
        <div className="sp-eroe-griglia" aria-hidden="true" />
        <span className="sp-eroe-fantasma" data-parallasse="0.12" aria-hidden="true">
          SPORT
        </span>

        {/* Le icone degli sport che girano attorno a un centro: solo
            decorazione, e solo dove c'è spazio accanto al titolo */}
        <div className="sp-orbita" data-parallasse="0.08" aria-hidden="true">
          <span className="sp-orbita-alone" />
          <span className="sp-orbita-anello">
            {CHIAVI.map((chiave, i) => {
              const IconaOrbita = ICONE[sportsData[chiave].iconKey];
              return (
                <span className="sp-orbita-palla" key={chiave} style={{ "--sp-i": i, "--sp-n": CHIAVI.length }}>
                  <span className="sp-orbita-dritta"><IconaOrbita /></span>
                </span>
              );
            })}
          </span>
          <span className="sp-orbita-centro">{TOTALI.sport}<small>sport</small></span>
        </div>

        <div className="sp-eroe-contenuto">
          <p className="sp-sopratitolo" data-rivela="sfuma">
            <span className="sp-punto" aria-hidden="true" /> Polisportiva San Donato · Torino
          </p>
          <h1 className="sp-titolo" data-rivela>
            <span className="sp-titolo-riga">Stagione</span>
            <span className="sp-titolo-anno mv-testo-vivo">{dynamicData.anno}</span>
          </h1>
          <p className="sp-sottotitolo" data-rivela>
            Scegli il tuo sport, trova la tua squadra, scendi in campo.
          </p>

          <dl className="sp-numeri" data-rivela-gruppo>
            <div className="sp-numero">
              <dt>Sport</dt>
              <dd><Contatore valore={TOTALI.sport} /></dd>
            </div>
            <div className="sp-numero">
              <dt>Squadre</dt>
              <dd><Contatore valore={TOTALI.squadre} /></dd>
            </div>
            <div className="sp-numero">
              <dt>Sedi</dt>
              <dd><Contatore valore={TOTALI.sedi} /></dd>
            </div>
            <div className="sp-numero">
              <dt>Allenamenti a settimana</dt>
              <dd><Contatore valore={TOTALI.allenamenti} /></dd>
            </div>
          </dl>
        </div>

        {/* Il nastro ripete l'elenco due volte: la seconda metà prende il
            posto della prima e il giro non si vede. Per i lettori di
            schermo è decorazione, le squadre sono elencate più sotto. */}
        <div className="sp-nastro mv-nastro" aria-hidden="true">
          <div className="mv-nastro-traccia">
            {[0, 1].map((copia) => (
              <div className="sp-nastro-giro" key={copia}>
                {NOMI_SQUADRE.map(({ sport: k, nome }, i) => {
                  const IconaNastro = ICONE[sportsData[k].iconKey];
                  return (
                    <span className="sp-nastro-voce" key={i}>
                      <IconaNastro /> {nome}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ---------- SELETTORE ---------- */}
      <div className="sp-selettore-fascia">
        <div
          className="sp-selettore"
          role="tablist"
          aria-label="Scegli lo sport"
          style={{ "--sp-indice": indice, "--sp-quanti": CHIAVI.length }}
          onKeyDown={suTasto}
        >
          {/* L'evidenziatore è uno solo e scivola: si sposta con transform,
              senza ridisegnare la pagina */}
          <span className="sp-selettore-cursore" aria-hidden="true" />
          {CHIAVI.map((chiave) => {
            const s = sportsData[chiave];
            const IconaScheda = ICONE[s.iconKey];
            const scelto = chiave === attivo;
            return (
              <button
                key={chiave}
                ref={(el) => { schedeRef.current[chiave] = el; }}
                type="button"
                role="tab"
                id={`sp-scheda-${chiave}`}
                data-sport={chiave}
                aria-selected={scelto}
                aria-controls="sp-pannello"
                tabIndex={scelto ? 0 : -1}
                className={`sp-scheda${scelto ? " attiva" : ""}`}
                onClick={() => scegli(chiave)}
              >
                <IconaScheda className="sp-scheda-icona" aria-hidden="true" />
                <span className="sp-scheda-nome">{s.title}</span>
                <span className="sp-scheda-conto">{s.groups.length}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------- PANNELLO DELLO SPORT ----------
          La chiave cambia con lo sport: React ricrea il pannello e il CSS
          lo fa entrare dal lato giusto. */}
      <section
        ref={pannelloRef}
        id="sp-pannello"
        role="tabpanel"
        aria-labelledby={`sp-scheda-${attivo}`}
        className={`sp-pannello sp-entra-${verso}`}
        key={attivo}
      >
        <div className="sp-bento" data-rivela-gruppo>

          <div className="sp-tessera sp-tessera-intro">
            <Icona className="sp-intro-filigrana" aria-hidden="true" />
            <span className="sp-intro-icona"><Icona aria-hidden="true" /></span>
            <h2 className="sp-intro-titolo">{sport.title}</h2>
            <p className="sp-intro-testo">{sport.description}</p>
            <p className="sp-intro-conto">
              <strong>{sport.groups.length}</strong>
              {sport.groups.length === 1 ? " squadra" : " squadre"} ·{" "}
              <strong>{sediSport.length}</strong>
              {sediSport.length === 1 ? " sede" : " sedi"}
            </p>
          </div>

          {sport.extraInfo && (
            <div className="sp-tessera sp-tessera-cerca">
              <span className="sp-tessera-etichetta">
                <span className="sp-punto sp-punto-chiaro" aria-hidden="true" /> Info utili
              </span>
              <p className="sp-cerca-testo">{sport.extraInfo.trim()}</p>
              {chiama && (
                <a className="sp-chiama" href={chiama.tel} data-magnete>
                  <FaPhoneAlt aria-hidden="true" />
                  <span>Chiama {chiama.nome}</span>
                  <span className="sp-chiama-numero">{chiama.numero}</span>
                </a>
              )}
            </div>
          )}

          <div className="sp-tessera sp-tessera-settimana">
            <h3 className="sp-tessera-titolo">La settimana</h3>
            <p className="sp-tessera-nota">Allenamenti per giorno, tutte le squadre</p>
            <ol className="sp-settimana">
              {giorni.map((g) => (
                <li
                  key={g.nome}
                  className={`sp-giorno${g.quanti ? "" : " vuoto"}`}
                  style={{ "--sp-livello": g.quanti / massimoGiorno }}
                >
                  <span className="sp-giorno-conto">{g.quanti || ""}</span>
                  <span className="sp-giorno-binario" aria-hidden="true">
                    <span className="sp-giorno-barra" />
                  </span>
                  <abbr className="sp-giorno-nome" title={g.nome}>{g.breve}</abbr>
                  <span className="sp-solo-lettori">
                    {`${g.nome}: ${g.quanti} ${g.quanti === 1 ? "allenamento" : "allenamenti"}`}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="sp-tessera sp-tessera-sedi">
            <h3 className="sp-tessera-titolo">Dove ci alleniamo</h3>
            <ul className="sp-sedi">
              {sediSport.map((s) => (
                <li key={s.nome}>
                  <a
                    className="sp-sede"
                    href={linkMappa(s.indirizzo || `${s.nome}, Torino`)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FaMapMarkerAlt className="sp-sede-icona" aria-hidden="true" />
                    <span className="sp-sede-testo">
                      <strong>{s.nome}</strong>
                      <small>{s.indirizzo || "Sede di alcuni allenamenti"}</small>
                    </span>
                    <span className="sp-sede-conto" title={s.squadre.join(", ")}>
                      {s.squadre.length}
                      <span className="sp-solo-lettori">
                        {s.squadre.length === 1 ? " squadra" : " squadre"}: {s.squadre.join(", ")}
                      </span>
                    </span>
                    <FaArrowRight className="sp-freccia" aria-hidden="true" />
                    <span className="sp-solo-lettori"> (apre la mappa in una nuova scheda)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="sp-squadre-testa" data-rivela>
          <h2 className="sp-squadre-titolo">
            Le squadre <span className="sp-squadre-conto">{sport.groups.length}</span>
          </h2>
          <p>Orari degli allenamenti, annate e sede di ogni gruppo.</p>
        </div>

        <div className="sp-squadre" data-rivela-gruppo>
          {sport.groups.map((gruppo, i) => (
            <div className="sp-squadra-cornice" key={gruppo.name}>
              <SchedaSquadra gruppo={gruppo} numero={i + 1} />
            </div>
          ))}
        </div>
      </section>

      {/* ---------- NOTA IN FONDO ---------- */}
      <aside className="sp-nota" data-rivela="sfuma">
        <FaInfoCircle aria-hidden="true" />
        <p>
          Gli orari potrebbero subire variazioni. Per i gruppi non presenti in elenco,
          contattare direttamente la segreteria o il responsabile tecnico.
        </p>
      </aside>
    </div>
  );
}
