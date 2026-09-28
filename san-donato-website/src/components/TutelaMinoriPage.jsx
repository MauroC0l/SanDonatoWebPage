import { useMemo } from "react";
import { FaEnvelope, FaUserShield } from "react-icons/fa6";
import "../css/TutelaMinoriPage.css";
import pageData from "../data/TutelaMinori.json";
import AperturaDocumento, { FasciaParole } from "./Documenti/AperturaDocumento";
import { spezzaTitolo } from "./Documenti/spezzaTitolo";
import SchedaFile from "./Documenti/SchedaFile";
import IndiceDocumento from "./Documenti/IndiceDocumento";
import AltriDocumenti from "./Documenti/AltriDocumenti";
import { useDocumenti, formatoDi } from "../hooks/useDocumenti";

/* I documenti non stanno più nel JSON: le policy delle federazioni
   (sezione "tutela_minori") e gli atti della Responsabile ("safeguarding")
   li gestisce l'amministratore e arrivano da /api/documenti. Qui restano
   i testi della pagina. */
const { header, intro, safeguarding } = pageData;

/* Le voci dell'indice cambiano solo se la sezione Safeguarding c'è o non
   c'è: un elenco nuovo a ogni disegno farebbe ripartire l'osservatore
   dell'indice ogni volta. */
function vociIndice(conSafeguarding) {
  return [
    { id: "tml-impegno", testo: intro.title },
    { id: "tml-responsabile", testo: safeguarding.title },
    ...(conSafeguarding ? [{ id: "tml-safeguarding", testo: "Documentazione Safeguarding" }] : []),
    { id: "tml-ufficiali", testo: "Documenti Ufficiali" },
  ];
}

/* Le schede di un elenco: la sagoma mentre arrivano, una riga se non
   arrivano. La chiave dell'elenco cambia quando arrivano, così il
   movimento lo fa comparire da capo invece di lasciarlo a metà. */
function ElencoFile({ documenti, caricamento, errore }) {
  return (
    <ul
      key={caricamento ? "attesa" : "pronto"}
      className="doc-file-griglia doc-file-griglia--tre"
      data-rivela-gruppo={caricamento ? undefined : ""}
      aria-busy={caricamento || undefined}
    >
      {caricamento && [0, 1, 2].map((i) => <li key={i}><span className="doc-sagoma" /></li>)}
      {errore && <li><p className="doc-avviso" role="status">{errore}</p></li>}
      {documenti.map((doc, i) => (
        <li key={doc.id}>
          <SchedaFile
            titolo={doc.titolo.trim()}
            testo={doc.descrizione}
            href={doc.url}
            formato={formatoDi(doc.url)}
            numero={i + 1}
          />
        </li>
      ))}
    </ul>
  );
}

const PAROLE = ["Ambiente sicuro", "Inclusivo", "Rispettoso", "Tutela dei minori", "Safeguarding"];

/**
 * Tutela dei minori: l'impegno, la persona a cui scrivere e i documenti.
 * La persona sta anche nell'apertura, a destra: chi arriva qui per una
 * segnalazione deve trovare l'indirizzo senza scorrere.
 */
export default function TutelaMinoriPage() {
  const { prima, accesa } = spezzaTitolo(header.title);
  const mail = `mailto:${safeguarding.contactEmail}`;

  const policy = useDocumenti("tutela_minori");
  const atti = useDocumenti("safeguarding");
  const caricamento = policy.caricamento || atti.caricamento;
  // La sezione Safeguarding c'è finché si aspetta, e resta se ha documenti
  const conSafeguarding = atti.caricamento || atti.documenti.length > 0;
  const voci = useMemo(() => vociIndice(conSafeguarding), [conSafeguarding]);
  const quanti = (n) => (caricamento ? "…" : n);

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
          { dt: "Documenti", dd: quanti(policy.documenti.length + atti.documenti.length) },
          { dt: "Policy federali", dd: quanti(policy.documenti.length) },
          { dt: "Responsabile", dd: safeguarding.officerName },
        ]}
      />
      <FasciaParole parole={PAROLE} />

      <div className="doc-corpo doc-corpo--indice">
        <IndiceDocumento voci={voci} />

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

          {conSafeguarding && (
            <section id="tml-safeguarding" className="doc-sezione" aria-labelledby="tml-sg-titolo">
              <p className="doc-etichetta" data-rivela>03 · Policy interne</p>
              <h2 id="tml-sg-titolo" className="doc-h2" data-rivela>
                Documentazione <em>Safeguarding</em>
              </h2>
              <ElencoFile {...atti} />
            </section>
          )}

          <section id="tml-ufficiali" className="doc-sezione" aria-labelledby="tml-uff-titolo">
            <p className="doc-etichetta" data-rivela>
              {conSafeguarding ? "04" : "03"} · Federazioni ed enti
            </p>
            <h2 id="tml-uff-titolo" className="doc-h2" data-rivela>
              Documenti <em>Ufficiali</em>
            </h2>
            <ElencoFile {...policy} />
          </section>
        </div>
      </div>

      <AltriDocumenti />
    </div>
  );
}
