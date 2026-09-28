import { useEffect, useRef, useState } from "react";
import { FaArrowDown, FaCheck, FaRegCopy } from "react-icons/fa6";
import "../css/CinquePerMillePage.css";
import pageData from "../data/CinquePerMille.json";
import AperturaDocumento, { FasciaParole } from "./Documenti/AperturaDocumento";
import IndiceDocumento from "./Documenti/IndiceDocumento";
import AltriDocumenti from "./Documenti/AltriDocumenti";

const { fiscalCode, hero, codeSection, facsimile, deadlines, whySection, reportsSection } = pageData;
const REPORTS = reportsSection?.reports ?? [];

/* Gli importi dei rendiconti sono scritti all'italiana ("€ 2.973,00"):
   servono numeri solo per disegnare la barra di ogni anno. */
const cifra = (s) => Number(String(s).replace(/[^\d,]/g, "").replace(",", ".")) || 0;
const MASSIMO = Math.max(1, ...REPORTS.map((r) => cifra(r.amount)));

const VOCI = [
  { id: "c5xm-perche", testo: whySection.title },
  { id: "c5xm-come", testo: facsimile.sectionTitle },
  { id: "c5xm-quando", testo: deadlines.title },
  ...(REPORTS.length ? [{ id: "c5xm-rendiconti", testo: reportsSection.title }] : []),
];

const PAROLE = [hero.titleLine1, `C.F. ${fiscalCode}`, "Sport di base", hero.tag];

/* Copia negli appunti, con il ripiego sul vecchio textarea dove
   navigator.clipboard non c'è (fuori da https, dentro alcune app): prima
   il pulsante, lì, semplicemente non faceva niente. */
async function copiaTesto(testo) {
  try {
    await navigator.clipboard.writeText(testo);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = testo;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let riuscito;
    try { riuscito = document.execCommand("copy"); } catch { riuscito = false; }
    area.remove();
    return riuscito;
  }
}

/**
 * 5x1000: la pagina serve a una cosa sola, far arrivare il codice fiscale
 * nella dichiarazione. Per questo il codice sta già nell'apertura, con il
 * pulsante per copiarlo; sotto, il perché, come si compila il riquadro,
 * con quale modello, e i rendiconti degli anni passati.
 */
export default function CinquePerMillePage() {
  const [copiato, setCopiato] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copia = async () => {
    if (!(await copiaTesto(fiscalCode))) return;
    setCopiato(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiato(false), 2000);
  };

  const codice = (
    <div className="c5xm-codice mv-vetro">
      <p className="c5xm-codice-etichetta">{codeSection.title}</p>
      <p className="c5xm-codice-cifre" translate="no">
        {fiscalCode.split("").map((c, i) => <span key={i}>{c}</span>)}
      </p>
      <button
        type="button"
        className={`doc-btn doc-btn--pieno c5xm-copia ${copiato ? "fatto" : ""}`}
        onClick={copia}
        aria-label="Copia codice fiscale"
        data-magnete
      >
        {copiato ? <FaCheck aria-hidden="true" /> : <FaRegCopy aria-hidden="true" />}
        <span>{copiato ? codeSection.btnCopied : codeSection.btnDefault}</span>
      </button>
      {/* Chi usa un lettore di schermo sente la conferma */}
      <span className="doc-solo-lettori" aria-live="polite">{copiato ? codeSection.btnCopied : ""}</span>
      <p className="c5xm-codice-testo">
        {codeSection.description} <strong>Polisportiva San Donato</strong>.
      </p>
    </div>
  );

  return (
    <div className="doc c5xm">
      <AperturaDocumento
        id="c5xm-titolo"
        occhiello={hero.tag}
        prima={hero.titleLine1}
        accesa={hero.titleLine2}
        sottotitolo={hero.subtitle}
        fantasma="5×1000"
        laterale={codice}
        numeri={REPORTS.length ? [
          { dt: "Anni rendicontati", dd: REPORTS.length },
          { dt: "Dal", dd: REPORTS.at(-1).year },
          { dt: `Rendiconto ${REPORTS[0].year}`, dd: REPORTS[0].amount },
        ] : []}
      />
      <FasciaParole parole={PAROLE} />

      <div className="doc-corpo doc-corpo--indice">
        <IndiceDocumento voci={VOCI} />

        <div className="doc-corpo-colonna">
          {/* ---------- Perché ---------- */}
          <section id="c5xm-perche" className="doc-sezione" aria-labelledby="c5xm-perche-titolo">
            <p className="doc-etichetta">01 · Perché</p>
            <h2 id="c5xm-perche-titolo" className="doc-h2">{whySection.title}</h2>
            {/* Testo da leggere: nessuna comparsa. I paragrafi arrivano dal
                JSON con il grassetto già dentro. */}
            <div className="doc-prosa c5xm-prosa">
              {whySection.paragraphs.map((p, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
              ))}
            </div>
          </section>

          {/* ---------- Come ---------- */}
          <section id="c5xm-come" className="doc-sezione" aria-labelledby="c5xm-come-titolo">
            <p className="doc-etichetta" data-rivela>02 · Come</p>
            <h2 id="c5xm-come-titolo" className="doc-h2" data-rivela>{facsimile.sectionTitle}</h2>
            <p className="c5xm-guida" data-rivela>{facsimile.subtitle}</p>

            {/* Il riquadro della dichiarazione, disegnato come sul modulo:
                la firma e il codice nelle caselle */}
            <div className="c5xm-modulo-cornice" data-rivela="zoom">
              <div className="c5xm-modulo">
                <div className="c5xm-modulo-testa">{facsimile.moduleHeader}</div>
                <div className="c5xm-modulo-corpo">
                  <p className="c5xm-modulo-testo">{facsimile.moduleBody}</p>
                  <div className="c5xm-modulo-campi">
                    <div className="c5xm-campo">
                      <span className="c5xm-campo-etichetta">{facsimile.labelSignature}</span>
                      <span className="c5xm-firma">{facsimile.placeholderSignature}</span>
                    </div>
                    <div className="c5xm-campo">
                      <span className="c5xm-campo-etichetta">{facsimile.labelCode}</span>
                      <span className="c5xm-caselle" translate="no">
                        {fiscalCode.split("").map((c, i) => <span key={i}>{c}</span>)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <span className="c5xm-modulo-segno" aria-hidden="true">✓</span>
            </div>
          </section>

          {/* ---------- Quando ---------- */}
          <section id="c5xm-quando" className="doc-sezione" aria-labelledby="c5xm-quando-titolo">
            <p className="doc-etichetta" data-rivela>03 · Con quale modello</p>
            <h2 id="c5xm-quando-titolo" className="doc-h2" data-rivela>{deadlines.title}</h2>
            <ul className="c5xm-modelli" data-rivela-gruppo>
              {deadlines.items.map((m) => (
                <li key={m.id}>
                  <div className="c5xm-modello" data-inclina="5">
                    <span className="c5xm-modello-sigla">{m.date}</span>
                    <h3 className="c5xm-modello-nome">{m.model}</h3>
                    <p className="c5xm-modello-testo">{m.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* ---------- Rendiconti ---------- */}
          {REPORTS.length > 0 && (
            <section id="c5xm-rendiconti" className="doc-sezione" aria-labelledby="c5xm-rend-titolo">
              <p className="doc-etichetta" data-rivela>04 · Trasparenza</p>
              <h2 id="c5xm-rend-titolo" className="doc-h2" data-rivela>{reportsSection.title}</h2>
              <p className="doc-prosa c5xm-rend-testo">{reportsSection.description}</p>

              {/* Tabella vera sul computer, pila di schede sul telefono.
                  Entra intera: sono dati da confrontare anno per anno. */}
              <div className="c5xm-rend-scheda">
                <table className="c5xm-rend">
                  <caption className="doc-solo-lettori">{reportsSection.title}</caption>
                  <thead>
                    <tr>
                      {reportsSection.tableHeaders.map((h) => <th key={h} scope="col">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {REPORTS.map((r) => (
                      <tr key={r.id}>
                        <th scope="row" className="c5xm-rend-anno" data-label={reportsSection.tableHeaders[0]}>{r.year}</th>
                        <td className="c5xm-rend-importo" data-label={reportsSection.tableHeaders[1]}>
                          <span className="c5xm-rend-cifra">{r.amount}</span>
                          <span className="c5xm-barra" aria-hidden="true">
                            <span style={{ "--c5xm-quota": cifra(r.amount) / MASSIMO }} />
                          </span>
                        </td>
                        <td className="c5xm-rend-data" data-label={reportsSection.tableHeaders[2]}>
                          <span className="c5xm-rend-mini">{reportsSection.tableHeaders[2]}</span> {r.date}
                        </td>
                        <td className="c5xm-rend-file" data-label={reportsSection.tableHeaders[3]}>
                          <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="c5xm-scarica">
                            <FaArrowDown aria-hidden="true" />
                            <span>Scarica File</span>
                            <span className="doc-solo-lettori"> del rendiconto {r.year}</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>

      <AltriDocumenti />
    </div>
  );
}
