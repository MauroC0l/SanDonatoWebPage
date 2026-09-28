import { FaArrowDown, FaCircleInfo, FaScaleBalanced } from "react-icons/fa6";
import "../css/ContributiPage.css";
import pageData from "../data/Contributi.json";
import AperturaDocumento, { FasciaParole } from "./Documenti/AperturaDocumento";
import { spezzaTitolo } from "./Documenti/spezzaTitolo";
import AltriDocumenti from "./Documenti/AltriDocumenti";

const { hero, covidTable, singleDocument, footer } = pageData;

/* Gli importi nel JSON sono scritti all'italiana ("3.549"): per il totale
   e per le barre servono numeri. Il totale non è un dato nuovo, è la somma
   delle righe pubblicate qui sotto. */
const cifra = (s) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
const euro = (n) => n.toLocaleString("it-IT", { maximumFractionDigits: 2 });
const IMPORTI = covidTable.rows.map((r) => cifra(r.amount));
const TOTALE = IMPORTI.reduce((a, b) => a + b, 0);
const MASSIMO = Math.max(1, ...IMPORTI);
const ANNI = covidTable.rows.map((r) => r.date.split(".").at(-1)).filter(Boolean);
const PERIODO = ANNI.length
  ? (ANNI[0] === ANNI.at(-1) ? ANNI[0] : `${ANNI[0]}–${ANNI.at(-1)}`)
  : "";

const PAROLE = ["Trasparenza", hero.legalRef, "Contributi pubblici", "Rendiconto"];

/**
 * Contributi pubblici: l'elenco che la legge chiede di pubblicare. Sul
 * computer è una tabella vera, con una barra che fa vedere a colpo d'occhio
 * il peso di ogni contributo; sul telefono ogni riga diventa una scheda
 * (le intestazioni viaggiano con data-label), invece di una tabella da
 * scorrere di lato.
 */
export default function ContributiPage() {
  const { prima, accesa } = spezzaTitolo(hero.title);

  return (
    <div className="doc cpub">
      <AperturaDocumento
        id="cpub-titolo"
        occhiello={hero.badge}
        prima={prima}
        accesa={accesa}
        sottotitolo={hero.subtitle}
        fantasma="TRASPARENZA"
        nota={(
          <span className="cpub-rif">
            <FaScaleBalanced aria-hidden="true" /> {hero.legalRef}
          </span>
        )}
        azioni={(
          <a
            href={singleDocument.link}
            className="doc-btn doc-btn--pieno"
            data-magnete
            target="_blank"
            rel="noopener noreferrer"
            download
          >
            <FaArrowDown aria-hidden="true" /> Scarica il rendiconto
          </a>
        )}
        numeri={[
          { dt: "Totale ricevuto", dd: `€ ${euro(TOTALE)}` },
          { dt: "Contributi", dd: covidTable.rows.length },
          { dt: "Periodo", dd: PERIODO },
        ]}
      />
      <FasciaParole parole={PAROLE} />

      <div className="doc-corpo cpub-corpo">
        {/* ---------- L'elenco ---------- */}
        <section className="cpub-elenco" aria-labelledby="cpub-elenco-titolo">
          <p className="doc-etichetta" data-rivela>01 · Elenco</p>
          <h2 id="cpub-elenco-titolo" className="doc-h2" data-rivela>{covidTable.title}</h2>

          {/* La tabella entra intera, senza comparsa riga per riga: sono
              dati da confrontare, devono esserci tutti insieme */}
          <div className="cpub-tabella-scheda">
            <table className="cpub-tabella">
              <caption className="doc-solo-lettori">{covidTable.title}</caption>
              <thead>
                <tr>
                  {covidTable.headers.map((h) => <th key={h} scope="col">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {covidTable.rows.map((row, i) => (
                  <tr key={row.id}>
                    <td className="cpub-data" data-label={covidTable.headers[0]}>{row.date}</td>
                    <td className="cpub-ente" data-label={covidTable.headers[1]}>
                      <span className="cpub-ente-nome">{row.entity}</span>
                      <span className="cpub-ente-causale">{row.details}</span>
                    </td>
                    <td className="cpub-importo" data-label={covidTable.headers[2]}>
                      <span className="cpub-importo-cifra">€ {row.amount}</span>
                      <span className="cpub-barra" aria-hidden="true">
                        <span style={{ "--cpub-quota": IMPORTI[i] / MASSIMO }} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2}>Totale</th>
                  <td className="cpub-importo" data-label="Totale">
                    <span className="cpub-importo-cifra">€ {euro(TOTALE)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* ---------- Il rendiconto ---------- */}
        <section className="cpub-scarica-cornice" aria-labelledby="cpub-scarica-titolo" data-rivela="zoom">
          <div className="cpub-scarica">
            <div className="mv-aurora cpub-scarica-aurora" aria-hidden="true" />
            <div className="cpub-scarica-dentro">
              <div className="cpub-scarica-foglio" aria-hidden="true">
                <span>{singleDocument.fileSize}</span>
              </div>
              <div className="cpub-scarica-testo">
                <p className="cpub-scarica-occhiello">02 · Documento ufficiale</p>
                <h2 id="cpub-scarica-titolo">{singleDocument.title}</h2>
                <p>{singleDocument.description}</p>
              </div>
              <a
                href={singleDocument.link}
                className="doc-btn doc-btn--pieno cpub-scarica-btn"
                data-magnete
                target="_blank"
                rel="noopener noreferrer"
                download
              >
                <FaArrowDown aria-hidden="true" /> Scarica {singleDocument.fileSize}
              </a>
            </div>
          </div>
        </section>

        {/* ---------- Nota ---------- */}
        <aside className="cpub-nota" aria-labelledby="cpub-nota-titolo">
          <span className="cpub-nota-icona" aria-hidden="true"><FaCircleInfo /></span>
          <div>
            <h2 id="cpub-nota-titolo" className="cpub-nota-titolo">{footer.title}</h2>
            <p className="cpub-nota-testo">{footer.text}</p>
          </div>
        </aside>
      </div>

      <AltriDocumenti />
    </div>
  );
}
