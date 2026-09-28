import { FaEnvelope, FaShieldHalved } from "react-icons/fa6";
import "../css/PrivacyPage.css";
import privacyData from "../data/Privacy.json";
import headerData from "../data/TopHeader.json";
import AperturaDocumento, { FasciaParole } from "./Documenti/AperturaDocumento";
import { spezzaTitolo } from "./Documenti/spezzaTitolo";
import SchedaFile from "./Documenti/SchedaFile";
import AltriDocumenti from "./Documenti/AltriDocumenti";

const PAROLE = ["Privacy", "Trasparenza", "Protezione dei dati", "GDPR"];

/**
 * Privacy: poco testo e un documento. La pagina non finge di essere più
 * lunga di così: l'apertura, e sotto la frase che spiega affiancata alla
 * scheda del file, grande, da prendere al volo.
 */
export default function PrivacyPage() {
  const { header, content, documents } = privacyData;
  const { email } = headerData.contactInfo;
  const { prima, accesa } = spezzaTitolo(header.title);

  return (
    <div className="doc prv">
      <AperturaDocumento
        id="prv-titolo"
        occhiello="Documenti · Privacy"
        prima={prima}
        accesa={accesa}
        sottotitolo={header.subtitle}
        fantasma="GDPR"
        numeri={[
          { dt: "Documenti", dd: documents.length },
          { dt: "Normativa", dd: "GDPR" },
          { dt: "Formato", dd: "PDF" },
        ]}
      />
      <FasciaParole parole={PAROLE} />

      <div className="doc-corpo prv-corpo">
        <section className="prv-intro" aria-labelledby="prv-intro-titolo">
          <p className="doc-etichetta" data-rivela>
            <FaShieldHalved aria-hidden="true" /> Dati personali
          </p>
          <h2 id="prv-intro-titolo" className="doc-h2" data-rivela>{content.introTitle}</h2>
          {/* Il testo non entra con una comparsa: è da leggere, subito */}
          <p className="doc-attacco prv-attacco">{content.introText}</p>
          <a className="prv-domande" href={`mailto:${email}`}>
            <span className="prv-domande-icona" aria-hidden="true"><FaEnvelope /></span>
            <span>
              <span className="prv-domande-sopra">Hai una domanda sui tuoi dati?</span>
              <span className="prv-domande-sotto">{email}</span>
            </span>
          </a>
        </section>

        <ul className="doc-file-griglia prv-documenti" data-rivela-gruppo aria-label="Documenti da scaricare">
          {documents.map((doc, i) => (
            <li key={doc.id}>
              <SchedaFile
                titolo={doc.label}
                testo={doc.description}
                href={doc.fileUrl}
                scarica
                numero={i + 1}
              />
            </li>
          ))}
        </ul>
      </div>

      <AltriDocumenti />
    </div>
  );
}
