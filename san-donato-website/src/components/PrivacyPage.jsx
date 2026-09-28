import { FaEnvelope, FaShieldHalved } from "react-icons/fa6";
import "../css/PrivacyPage.css";
import privacyData from "../data/Privacy.json";
import headerData from "../data/TopHeader.json";
import AperturaDocumento, { FasciaParole } from "./Documenti/AperturaDocumento";
import { spezzaTitolo } from "./Documenti/spezzaTitolo";
import SchedaFile from "./Documenti/SchedaFile";
import AltriDocumenti from "./Documenti/AltriDocumenti";
import { useDocumenti, formatoDi } from "../hooks/useDocumenti";

const PAROLE = ["Privacy", "Trasparenza", "Protezione dei dati", "GDPR"];

/**
 * Privacy: poco testo e un documento. La pagina non finge di essere più
 * lunga di così: l'apertura, e sotto la frase che spiega affiancata alla
 * scheda del file, grande, da prendere al volo.
 */
export default function PrivacyPage() {
  // I documenti non stanno più in Privacy.json: li gestisce
  // l'amministratore e arrivano da /api/documenti (vedi useDocumenti.js)
  const { header, content } = privacyData;
  const { documenti, caricamento, errore } = useDocumenti("privacy");
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
          { dt: "Documenti", dd: caricamento ? "…" : documenti.length },
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

        {/* La chiave cambia quando i documenti arrivano: l'elenco nasce di
            nuovo e il movimento lo fa comparire, invece di trovarsi dentro
            schede nuove in un gruppo che ha già fatto la sua entrata. */}
        <ul
          key={caricamento ? "attesa" : "pronto"}
          className="doc-file-griglia prv-documenti"
          data-rivela-gruppo={caricamento ? undefined : ""}
          aria-label="Documenti da scaricare"
          aria-busy={caricamento || undefined}
        >
          {caricamento && <li><span className="doc-sagoma" /></li>}
          {errore && <li><p className="doc-avviso" role="status">{errore}</p></li>}
          {documenti.map((doc, i) => (
            <li key={doc.id}>
              <SchedaFile
                titolo={doc.titolo}
                testo={doc.descrizione}
                href={doc.url}
                formato={formatoDi(doc.url)}
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
