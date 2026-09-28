import React from "react";
import { FaEye, FaMapMarkerAlt, FaHeart, FaHandshake, FaEnvelope, FaPhoneAlt, FaArrowDown } from "react-icons/fa";
import "../css/SponsorPage.css";
import sponsorsData from "../data/Sponsor.json";
import contatti from "../data/Contatti.json";
import NastroLoghi from "./Sponsor/NastroLoghi";
import SchedaSponsor from "./Sponsor/SchedaSponsor";

/* Alcuni loghi sono quadrati con il marchio piccolo nel mezzo e tanto
   trasparente attorno: in un riquadro largo diventerebbero francobolli.
   Qui si dice di quanto ingrandirli, invece di ritagliare i file. */
const INGRANDIMENTO = { Brillo: 1.7, "Terzo Tempo": 2.1 };

const VANTAGGI = [
  {
    icona: <FaEye />,
    titolo: "Visibilità",
    testo: "Il tuo logo su questa pagina, accanto alle realtà che già ci sostengono."
  },
  {
    icona: <FaMapMarkerAlt />,
    titolo: "Territorio",
    testo: "Un legame diretto con le famiglie del Borgo San Donato che vivono lo sport con noi."
  },
  {
    icona: <FaHeart />,
    titolo: "Valori",
    testo: "Sport per tutti, dai più piccoli agli adulti: un messaggio che fa bene anche al tuo marchio."
  },
  {
    icona: <FaHandshake />,
    titolo: "Su misura",
    testo: "Ogni collaborazione si costruisce insieme: parliamone e troviamo la formula giusta."
  }
];

const PAROLE_NASTRO = ["Grazie", "Sport per tutti", "Borgo San Donato", "Insieme in campo", "Torino"];

export default function SponsorPage() {
  const { header, sponsors: grezzi } = sponsorsData;
  const sponsors = grezzi.map((s) => ({ ...s, zoom: INGRANDIMENTO[s.name] ?? 1 }));
  // La seconda fila parte da metà elenco: le due file non mostrano mai lo
  // stesso logo uno sopra l'altro
  const meta = Math.ceil(sponsors.length / 2);
  const rimescolati = [...sponsors.slice(meta), ...sponsors.slice(0, meta)];

  const { email } = contatti.recapiti;
  const { phoneDisplay, phoneLink, contactName } = contatti.segreteria;
  const oggetto = encodeURIComponent("Diventare sponsor della Polisportiva San Donato");

  /* I link interni scorrono con dolcezza, ma solo per chi non ha chiesto
     meno movimento; senza JavaScript resta il salto normale dell'ancora. */
  const vaiA = (id) => (e) => {
    const bersaglio = document.getElementById(id);
    if (!bersaglio) return;
    e.preventDefault();
    const ridotto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bersaglio.scrollIntoView({ behavior: ridotto ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="spn">
      {/* ---------- Apertura ---------- */}
      <section className="spn-eroe" aria-labelledby="spn-titolo">
        <div className="mv-aurora spn-eroe-aurora" aria-hidden="true" />
        <div className="spn-eroe-griglia" aria-hidden="true" />
        <div className="spn-eroe-fantasma" aria-hidden="true" data-parallasse="0.12">
          PARTNER
        </div>

        <div className="spn-eroe-dentro">
          {/* Il sigillo che gira: solo decorazione, il numero lo dicono già
              le cifre sotto al titolo */}
          <div className="spn-sigillo" aria-hidden="true" data-parallasse="0.18">
            <div className="spn-sigillo-disco mv-vetro">
              <svg className="spn-sigillo-anello" viewBox="0 0 200 200">
                <defs>
                  <path id="spn-cerchio" d="M100,100 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0" />
                </defs>
                <text>
                  <textPath href="#spn-cerchio" textLength="496" lengthAdjust="spacing">
                    Sponsor ✦ Partner ✦ Amici ✦ Grazie ✦
                  </textPath>
                </text>
              </svg>
              <span className="spn-sigillo-numero">{sponsors.length}</span>
            </div>
          </div>
          <p className="spn-occhiello" data-rivela>
            <span className="spn-punto" aria-hidden="true" /> Chi ci sostiene
          </p>
          <h1 id="spn-titolo" className="spn-titolo" data-rivela>
            <span className="spn-titolo-riga">{header.titlePrefix}</span>
            <span className="spn-titolo-riga mv-testo-vivo">{header.titleHighlight}</span>
          </h1>
          <div className="spn-eroe-basso" data-rivela>
            <p className="spn-sottotitolo">{header.subtitle}</p>
            <div className="spn-azioni">
              <a href="#spn-diventa" className="spn-btn spn-btn--pieno" data-magnete onClick={vaiA("spn-diventa")}>
                Diventa sponsor
              </a>
              <a href="#spn-partner" className="spn-btn spn-btn--vetro mv-vetro" onClick={vaiA("spn-partner")}>
                Scopri i partner <FaArrowDown aria-hidden="true" />
              </a>
            </div>
          </div>
          <dl className="spn-numeri" data-rivela-gruppo>
            <div>
              <dt>Partner</dt>
              <dd>{sponsors.length}</dd>
            </div>
            <div>
              <dt>Quartiere</dt>
              <dd>San Donato</dd>
            </div>
            <div>
              <dt>Obiettivo</dt>
              <dd>Sport per tutti</dd>
            </div>
          </dl>
        </div>

        <div className="spn-nastri" aria-label="Loghi dei partner" role="region">
          <NastroLoghi sponsors={sponsors} durata="52s" />
          <NastroLoghi sponsors={rimescolati} durata="60s" inverso />
        </div>
      </section>

      {/* ---------- Nastro di ringraziamento ---------- */}
      <div className="spn-fascia" aria-hidden="true">
        <div className="mv-nastro" style={{ "--mv-nastro-durata": "28s" }}>
          <div className="mv-nastro-traccia">
            {[0, 1].map((copia) => (
              <span className="spn-fascia-giro" key={copia}>
                {PAROLE_NASTRO.map((p) => (
                  <span key={p}>
                    {p} <span className="spn-stella">✦</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Il muro dei partner ---------- */}
      <section id="spn-partner" className="spn-muro" aria-labelledby="spn-muro-titolo">
        <header className="spn-sezione-testa">
          <p className="spn-occhiello spn-occhiello--scuro" data-rivela>Il muro dei partner</p>
          <h2 id="spn-muro-titolo" className="spn-sezione-titolo" data-rivela>
            {sponsors.length} realtà, <em>una squadra</em>.
          </h2>
          <p className="spn-sezione-testo" data-rivela>
            Negozi, ristoranti e aziende che hanno scelto di stare dalla nostra parte. Passaci a trovarli.
          </p>
        </header>

        <ul className="spn-griglia" data-rivela-gruppo>
          {sponsors.map((s, i) => (
            <li key={s.name} className="spn-griglia-cella">
              <SchedaSponsor sponsor={s} numero={i + 1} />
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Diventa sponsor ---------- */}
      <section id="spn-diventa" className="spn-diventa" aria-labelledby="spn-diventa-titolo">
        <div className="spn-diventa-dentro">
          <div className="spn-diventa-testo">
            <p className="spn-occhiello spn-occhiello--scuro" data-rivela>Diventa sponsor</p>
            <h2 id="spn-diventa-titolo" className="spn-sezione-titolo" data-rivela>
              Metti il tuo nome <em>dove si gioca</em>.
            </h2>
            <p className="spn-sezione-testo" data-rivela>
              Sostenere la Polisportiva vuol dire stare accanto a ragazzi, ragazze e famiglie del
              quartiere, ogni settimana, in palestra e sul campo.
            </p>

            <ol className="spn-vantaggi" data-rivela-gruppo>
              {VANTAGGI.map((v, i) => (
                <li key={v.titolo} className="spn-vantaggio">
                  <span className="spn-vantaggio-icona" aria-hidden="true">{v.icona}</span>
                  <span className="spn-vantaggio-numero" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{v.titolo}</h3>
                  <p>{v.testo}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="spn-invito-cornice" data-rivela="zoom">
            <aside className="spn-invito" aria-label="Contatti per diventare sponsor">
              <div className="mv-aurora spn-invito-aurora" aria-hidden="true" />
              <div className="spn-invito-dentro">
                <p className="spn-invito-occhiello">Parliamone</p>
                <p className="spn-invito-titolo">
                  Il prossimo logo sul muro <span className="mv-testo-vivo">può essere il tuo.</span>
                </p>
                <a
                  href={`mailto:${email}?subject=${oggetto}`}
                  className="spn-btn spn-btn--pieno spn-btn--grande"
                  data-magnete
                >
                  <FaEnvelope aria-hidden="true" /> Scrivici
                </a>
                <ul className="spn-invito-recapiti">
                  <li>
                    <a href={`mailto:${email}?subject=${oggetto}`}>
                      <FaEnvelope aria-hidden="true" /> <span>{email}</span>
                    </a>
                  </li>
                  <li>
                    <a href={`tel:${phoneLink}`}>
                      <FaPhoneAlt aria-hidden="true" /> <span>{phoneDisplay} · {contactName}</span>
                    </a>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
