import { FaEnvelope, FaUserShield } from "react-icons/fa6";
import "../css/TutelaMinoriPage.css";
import pageData from "../data/TutelaMinori.json";
import AperturaDocumento, { FasciaParole } from "./Documenti/AperturaDocumento";
import { spezzaTitolo } from "./Documenti/spezzaTitolo";
import SchedaFile from "./Documenti/SchedaFile";
import IndiceDocumento from "./Documenti/IndiceDocumento";
import AltriDocumenti from "./Documenti/AltriDocumenti";

const { header, intro, documents, safeguarding } = pageData;
const DOC_SAFEGUARDING = safeguarding.documents ?? [];

/* Le voci dell'indice fuori dal componente: un elenco nuovo a ogni disegno
   farebbe ripartire l'osservatore dell'indice ogni volta. */
const VOCI = [
  { id: "tml-impegno", testo: intro.title },
  { id: "tml-responsabile", testo: safeguarding.title },
  ...(DOC_SAFEGUARDING.length ? [{ id: "tml-safeguarding", testo: "Documentazione Safeguarding" }] : []),
  { id: "tml-ufficiali", testo: "Documenti Ufficiali" },
];

const PAROLE = ["Ambiente sicuro", "Inclusivo", "Rispettoso", "Tutela dei minori", "Safeguarding"];

/**
 * Tutela dei minori: l'impegno, la persona a cui scrivere e i documenti.
 * La persona sta anche nell'apertura, a destra: chi arriva qui per una
 * segnalazione deve trovare l'indirizzo senza scorrere.
 */
export default function TutelaMinoriPage() {
  const { prima, accesa } = spezzaTitolo(header.title);
  const mail = `mailto:${safeguarding.contactEmail}`;

  const referente = (
    <aside className="tml-referente mv-vetro" aria-label={safeguarding.title}>
      <span className="tml-referente-icona" aria-hidden="true"><FaUserShield /></span>
      <p className="tml-referente-ruolo">{safeguarding.title}</p>
      <p className="tml-referente-nome">{safeguarding.officerName}</p>
      <a href={mail} className="doc-btn doc-btn--pieno tml-referente-btn" data-magnete>
        <FaEnvelope aria-hidden="true" /> Scrivi alla responsabile
      </a>
    </aside>
  );

  return (
    <div className="doc tml">
      <AperturaDocumento
        id="tml-titolo"
        occhiello="Safeguarding"
        prima={prima}
        accesa={accesa}
        sottotitolo={header.subtitle}
        fantasma="TUTELA"
        laterale={referente}
        numeri={[
          { dt: "Documenti", dd: documents.length + DOC_SAFEGUARDING.length },
          { dt: "Policy federali", dd: documents.length },
          { dt: "Responsabile", dd: safeguarding.officerName },
        ]}
      />
      <FasciaParole parole={PAROLE} />

      <div className="doc-corpo doc-corpo--indice">
        <IndiceDocumento voci={VOCI} />

        <div className="doc-corpo-colonna">
          {/* L'impegno: la frase grande, senza comparsa — si legge subito */}
          <section id="tml-impegno" className="doc-sezione tml-impegno" aria-labelledby="tml-impegno-titolo">
            <p className="doc-etichetta">01 · Impegno</p>
            <h2 id="tml-impegno-titolo" className="doc-h2">{intro.title}</h2>
            <p className="doc-attacco tml-attacco">{intro.text}</p>
          </section>

          <section id="tml-responsabile" className="doc-sezione" aria-labelledby="tml-resp-titolo">
            <div className="tml-blocco-cornice" data-rivela="zoom">
              <div className="tml-blocco">
                <div className="mv-aurora tml-blocco-aurora" aria-hidden="true" />
                <div className="tml-blocco-dentro">
                  <span className="tml-blocco-icona" aria-hidden="true"><FaUserShield /></span>
                  <p className="tml-blocco-occhiello">02 · Segnalazioni e informazioni</p>
                  <h2 id="tml-resp-titolo" className="tml-blocco-titolo">{safeguarding.title}</h2>
                  <p className="tml-blocco-testo">{safeguarding.description}</p>
                  <div className="tml-contatto">
                    <span className="tml-contatto-ruolo">
                      Contatto Ufficiale: <strong>{safeguarding.officerName}</strong>
                    </span>
                    <a href={mail} className="tml-contatto-mail">
                      <FaEnvelope aria-hidden="true" />
                      <span>{safeguarding.contactEmail}</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {DOC_SAFEGUARDING.length > 0 && (
            <section id="tml-safeguarding" className="doc-sezione" aria-labelledby="tml-sg-titolo">
              <p className="doc-etichetta" data-rivela>03 · Policy interne</p>
              <h2 id="tml-sg-titolo" className="doc-h2" data-rivela>
                Documentazione <em>Safeguarding</em>
              </h2>
              <ul className="doc-file-griglia doc-file-griglia--tre" data-rivela-gruppo>
                {DOC_SAFEGUARDING.map((doc, i) => (
                  <li key={doc.id}>
                    <SchedaFile titolo={doc.title} testo={doc.description} href={doc.fileUrl} numero={i + 1} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section id="tml-ufficiali" className="doc-sezione" aria-labelledby="tml-uff-titolo">
            <p className="doc-etichetta" data-rivela>
              {DOC_SAFEGUARDING.length ? "04" : "03"} · Federazioni ed enti
            </p>
            <h2 id="tml-uff-titolo" className="doc-h2" data-rivela>
              Documenti <em>Ufficiali</em>
            </h2>
            <ul className="doc-file-griglia doc-file-griglia--tre" data-rivela-gruppo>
              {documents.map((doc, i) => (
                <li key={doc.id}>
                  <SchedaFile titolo={doc.title.trim()} testo={doc.description} href={doc.fileUrl} numero={i + 1} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <AltriDocumenti />
    </div>
  );
}
