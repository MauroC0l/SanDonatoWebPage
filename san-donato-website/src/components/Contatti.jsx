import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FaMapMarkerAlt, FaPhone, FaEnvelope, FaClock, FaUniversity,
  FaMobileAlt, FaCheck, FaExternalLinkAlt, FaArrowRight, FaRoute
} from "react-icons/fa";
import { FaRegCopy } from "react-icons/fa6";
import "../css/Contatti.css";
import contactsData from "../data/Contatti.json";
import { leggiOrario, statoSegreteria } from "./Contatti/orari";

/* L'orario si legge una volta sola: il JSON non cambia mentre la pagina è
   aperta, cambia solo l'ora */
const ORARIO = leggiOrario(contactsData.segreteria.orariValue);

/* Copia negli appunti. navigator.clipboard esiste solo in un contesto
   sicuro (https o localhost) e alcuni browser dentro le app lo negano: in
   quel caso si ripiega sul vecchio textarea + execCommand, che funziona
   ancora ovunque. */
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

/* Pulsante "copia" piccolo, accanto a ogni dato che si incolla altrove
   (email, codice fiscale…): chi paga o compila un modulo non deve
   selezionare a mano un numero di undici cifre dal telefono. */
function PulsanteCopia({ valore, nome, copiato, onCopia }) {
  const fatto = copiato === nome;
  return (
    <button
      type="button"
      className={`cnt-copia ${fatto ? "is-fatto" : ""}`}
      onClick={() => onCopia(valore, nome)}
      aria-label={`Copia ${nome}`}
      title={`Copia ${nome}`}
      data-copia
    >
      {fatto ? <FaCheck aria-hidden /> : <FaRegCopy aria-hidden />}
    </button>
  );
}

export default function Contacts() {
  const { header, sede, segreteria, recapiti, pagamenti } = contactsData;

  // Quale dato è stato appena copiato, e il messaggio della notifica in basso
  const [copiato, setCopiato] = useState(null);
  const [avviso, setAvviso] = useState(null);
  const timer = useRef();

  // Lo stato della segreteria si ricalcola ogni minuto: chi lascia la
  // pagina aperta alle 18:29 deve vederla aprirsi
  const [stato, setStato] = useState(() => statoSegreteria(ORARIO));
  useEffect(() => {
    const id = setInterval(() => setStato(statoSegreteria(ORARIO)), 60_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copia = async (valore, nome) => {
    const ok = await copiaTesto(valore);
    clearTimeout(timer.current);
    setCopiato(ok ? nome : null);
    setAvviso({
      ok,
      testo: ok ? `${nome} copiato negli appunti` : `Non è stato possibile copiare: ${valore}`,
      chiave: Date.now(),
    });
    timer.current = setTimeout(() => { setCopiato(null); setAvviso(null); }, 2200);
  };

  const indirizzoCompleto = `${sede.address}, ${sede.city}`;

  // Le voci del nastro vanno ripetute due volte perché il giro non si veda
  const vociNastro = [
    sede.address, sede.city, segreteria.orariValue,
    segreteria.phoneDisplay, recapiti.email,
  ];

  return (
    <div className="cnt-pagina">

      {/* ---------- Apertura ---------- */}
      <header className="cnt-eroe">
        <div className="mv-aurora" aria-hidden="true" />
        <div className="cnt-eroe-trama" aria-hidden="true" />

        {/* Scritta che gira: solo decorazione, i lettori di schermo la saltano */}
        <svg className="cnt-sigillo" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
          <defs>
            <path id="cnt-cerchio" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
          </defs>
          <text>
            <textPath href="#cnt-cerchio" startOffset="0">
              CHIAMACI · SCRIVICI · PASSA A TROVARCI ·
            </textPath>
          </text>
        </svg>

        <div className="cnt-eroe-dentro">
          <p className="cnt-occhiello" data-rivela>
            <span className="cnt-punto" aria-hidden="true" /> {header.subtitle}
          </p>

          <h1 className="cnt-titolo">
            <span className="cnt-riga" data-rivela>{header.titlePrefix}</span>{" "}
            <span className="cnt-riga cnt-riga-2" data-rivela>
              <span className="mv-testo-vivo">{header.titleHighlight}</span>
            </span>
          </h1>

          <p className="cnt-indirizzo-eroe" data-rivela>
            <FaMapMarkerAlt aria-hidden /> {indirizzoCompleto}
          </p>

          {stato && (
            <p
              className={`cnt-stato ${stato.aperto ? "is-aperto" : "is-chiuso"}`}
              data-rivela
              aria-live="polite"
            >
              <span className="cnt-stato-luce" aria-hidden="true" />
              {stato.testo}
            </p>
          )}

          <div className="cnt-azioni" data-rivela-gruppo>
            <a href={`tel:${segreteria.phoneLink}`} className="cnt-bottone cnt-bottone-pieno" data-magnete>
              <FaPhone aria-hidden /> Chiama
            </a>
            <a href={`mailto:${recapiti.email}`} className="cnt-bottone cnt-bottone-vetro mv-vetro" data-magnete>
              <FaEnvelope aria-hidden /> Scrivi
            </a>
            <a
              href={sede.googleMapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="cnt-bottone cnt-bottone-vetro mv-vetro"
              data-magnete
            >
              <FaRoute aria-hidden /> Indicazioni
            </a>
          </div>
        </div>
      </header>

      {/* ---------- Nastro ---------- */}
      <div className="mv-nastro cnt-nastro" aria-hidden="true">
        <div className="mv-nastro-traccia">
          {[...vociNastro, ...vociNastro].map((voce, i) => (
            <span className="cnt-nastro-voce" key={i}>{voce}<span className="cnt-nastro-stella">✦</span></span>
          ))}
        </div>
      </div>

      {/* ---------- Dove, quando, come ---------- */}
      <main className="cnt-corpo">
        <div className="cnt-bento" data-rivela-gruppo>

          {/* Sede con la mappa */}
          <section className="cnt-scheda cnt-scheda-sede" aria-labelledby="cnt-t-sede">
            <a
              href={sede.googleMapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="cnt-mappa"
              aria-label={`Apri ${indirizzoCompleto} nel navigatore`}
            >
              <span className="cnt-mappa-cornice">
                <img
                  src={sede.mapImage}
                  alt="Mappa Sede Polisportiva"
                  className="cnt-mappa-img"
                  loading="lazy"
                  width="1057"
                  height="553"
                />
                {/* L'onda sta sopra al segnaposto disegnato nell'immagine:
                    la cornice ha le proporzioni della mappa, così le
                    percentuali cadono sempre nello stesso punto */}
                <span className="cnt-mappa-onda" aria-hidden="true" />
              </span>
              <span className="cnt-mappa-apri">Apri Navigatore <FaArrowRight aria-hidden /></span>
            </a>

            <div className="cnt-sede-testo">
              <span className="cnt-etichetta"><FaMapMarkerAlt aria-hidden /> <span id="cnt-t-sede">{sede.title}</span></span>
              <p className="cnt-sede-indirizzo">
                {sede.address}<br />
                <strong>{sede.city}</strong>
              </p>
              <PulsanteCopia valore={indirizzoCompleto} nome="Indirizzo" copiato={copiato} onCopia={copia} />
            </div>
          </section>

          {/* Segreteria */}
          <section className="cnt-scheda cnt-scheda-segreteria" aria-labelledby="cnt-t-segr">
            <span className="cnt-etichetta"><FaClock aria-hidden /> <span id="cnt-t-segr">{segreteria.title}</span></span>

            <div className="cnt-orario">
              <span className="cnt-orario-etichetta">{segreteria.orariLabel}</span>
              <span className="cnt-orario-valore">{segreteria.orariValue}</span>
              {stato && (
                <span className={`cnt-stato cnt-stato-piccolo ${stato.aperto ? "is-aperto" : "is-chiuso"}`}>
                  <span className="cnt-stato-luce" aria-hidden="true" />
                  {stato.aperto ? "Aperta ora" : "Chiusa ora"}
                </span>
              )}
            </div>

            <div className="cnt-rapidi">
              <h3 className="cnt-sottotitolo"><FaMobileAlt aria-hidden /> {segreteria.mobileTitle}</h3>
              <p className="cnt-nota">{segreteria.mobileNote}</p>
              <div className="cnt-riga-azione">
                <a href={`tel:${segreteria.phoneLink}`} className="cnt-telefono" data-magnete>
                  <span className="cnt-telefono-icona"><FaPhone aria-hidden /></span>
                  <span className="cnt-telefono-testo">
                    <strong>{segreteria.phoneDisplay}</strong>
                    <span className="cnt-nome">{segreteria.contactName}</span>
                  </span>
                </a>
                <PulsanteCopia valore={segreteria.phoneLink} nome="Numero" copiato={copiato} onCopia={copia} />
              </div>
            </div>
          </section>

          {/* Recapiti e dati fiscali */}
          <section className="cnt-scheda cnt-scheda-recapiti" aria-labelledby="cnt-t-rec">
            <span className="cnt-etichetta"><FaEnvelope aria-hidden /> <span id="cnt-t-rec">{recapiti.title}</span></span>

            <ul className="cnt-lista">
              <li className="cnt-voce">
                <a href={`mailto:${recapiti.email}`} className="cnt-voce-link">
                  <span className="cnt-voce-tipo">Email</span>
                  <span className="cnt-voce-valore">{recapiti.email}</span>
                </a>
                <PulsanteCopia valore={recapiti.email} nome="Email" copiato={copiato} onCopia={copia} />
              </li>
              <li className="cnt-voce">
                <a href={`mailto:${recapiti.pec}`} className="cnt-voce-link">
                  <span className="cnt-voce-tipo">PEC</span>
                  <span className="cnt-voce-valore">{recapiti.pec}</span>
                </a>
                <PulsanteCopia valore={recapiti.pec} nome="PEC" copiato={copiato} onCopia={copia} />
              </li>
            </ul>

            <dl className="cnt-fiscali">
              <div className="cnt-fiscale">
                <dt>C.F.</dt>
                <dd>{recapiti.cf}</dd>
                <PulsanteCopia valore={recapiti.cf} nome="Codice fiscale" copiato={copiato} onCopia={copia} />
              </div>
              <div className="cnt-fiscale">
                <dt>P.IVA</dt>
                <dd>{recapiti.piva}</dd>
                <PulsanteCopia valore={recapiti.piva} nome="Partita IVA" copiato={copiato} onCopia={copia} />
              </div>
            </dl>
          </section>
        </div>

        {/* ---------- Pagamenti ---------- */}
        <section className="cnt-pagamenti" aria-labelledby="cnt-t-pag">
          <div className="cnt-sezione-testa" data-rivela>
            <span className="cnt-sezione-numero" aria-hidden="true">€</span>
            <h2 id="cnt-t-pag" className="cnt-sezione-titolo">Pagamenti</h2>
          </div>

          <div className="cnt-pagamenti-griglia" data-rivela-gruppo>

            {/* Il bonifico come una carta: l'inclinazione sta su un involucro
                interno perché data-inclina e data-rivela sullo stesso elemento
                si contenderebbero la trasformazione */}
            <div className="cnt-carta-posto">
              <section className="cnt-carta" data-inclina="6" aria-labelledby="cnt-t-banca">
                <div className="cnt-carta-testa">
                  <span className="cnt-carta-icona"><FaUniversity aria-hidden /></span>
                  <h3 id="cnt-t-banca" className="cnt-carta-titolo">{pagamenti.bancaTitle}</h3>
                  <span className="cnt-carta-chip" aria-hidden="true" />
                </div>

                <p className="cnt-carta-intro">{pagamenti.intro}</p>

                <div className="cnt-iban">
                  <span className="cnt-iban-etichetta">IBAN</span>
                  <code className="cnt-iban-codice">{pagamenti.ibanDisplay}</code>
                </div>

                <div className="cnt-carta-piede">
                  <p className="cnt-intestato">Intestato a: <strong>POLISPORTIVA SAN DONATO ASD</strong></p>
                  <button
                    type="button"
                    className={`cnt-copia-iban ${copiato === "IBAN" ? "is-fatto" : ""}`}
                    onClick={() => copia(pagamenti.ibanClean, "IBAN")}
                    aria-label="Copia IBAN"
                    data-magnete
                  >
                    {copiato === "IBAN" ? <><FaCheck aria-hidden /> Copiato!</> : <><FaRegCopy aria-hidden /> Copia IBAN</>}
                  </button>
                </div>

                <div className="cnt-banca-logo">
                  <img src={pagamenti.logoBanca} alt="Banca" loading="lazy" width="300" height="48" />
                </div>
              </section>
            </div>

            {/* Satispay */}
            <section className="cnt-scheda cnt-satispay" aria-labelledby="cnt-t-satis">
              <div className="cnt-satispay-testo">
                <h3 id="cnt-t-satis" className="cnt-satispay-titolo">{pagamenti.satispayTitle}</h3>
                <p className="cnt-satispay-negozio">{pagamenti.shopName}</p>
                <a
                  href={pagamenti.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cnt-satispay-bottone"
                  data-magnete
                >
                  Paga con Satispay <FaExternalLinkAlt aria-hidden style={{ fontSize: "0.8em" }} />
                </a>
                <p className="cnt-satispay-aiuto">Link diretto al pagamento sicuro</p>
              </div>

              <div className="cnt-qr">
                <img
                  src={pagamenti.qrImage}
                  alt="QR Code Satispay"
                  className="cnt-qr-img"
                  loading="lazy"
                  width="310"
                  height="311"
                />
                <span className="cnt-qr-scansione" aria-hidden="true" />
              </div>
            </section>
          </div>
        </section>
      </main>

      {/* Notifica della copia: role="status" la fa leggere ai lettori di
          schermo senza spostare il focus. Sta nel body e non nella pagina
          perché l'involucro .mv-pagina, animato all'ingresso, ha una
          trasformazione: dentro di lui position:fixed si aggancerebbe a
          lui invece che allo schermo, e la notifica finirebbe fuori vista. */}
      {createPortal(
        <div className="cnt-avviso-posto" role="status" aria-live="polite">
          {avviso && (
            <div className={`cnt-avviso ${avviso.ok ? "" : "is-errore"}`} key={avviso.chiave}>
              {avviso.ok ? <FaCheck aria-hidden /> : null} {avviso.testo}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
