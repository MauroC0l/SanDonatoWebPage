import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaUserGroup,
  FaHandshake,
  FaScaleBalanced,
  FaChildren,
  FaHeartPulse,
  FaMapLocationDot,
  FaCheck,
  FaUserTie,
  FaUsersGear,
  FaFileSignature,
  FaWallet,
  FaGraduationCap,
  FaArrowRight,
  FaArrowDown,
  FaRegCopy,
} from "react-icons/fa6";
import { IoRibbon, IoBusiness } from "react-icons/io5";
import { GiWhistle } from "react-icons/gi";
import "../css/ChiSiamoPage.css";
import chiSiamoData from "../data/ChiSiamo.json";
import dynamicData from "../data/Data.json";
import Contatore from "./Sport/Contatore";
import { leggiAnno, leggiElenco, leggiNumeri, leggiTesseramenti, tappeStoria } from "./ChiSiamo/dati";

// Il JSON contiene stringhe (es: "balance"), qui diventano icone
const ICONE = {
  balance: FaScaleBalanced,
  heart: FaHeartPulse,
  handshake: FaHandshake,
  group: FaUserGroup,
  child: FaChildren,
  map: FaMapLocationDot,
  tie: FaUserTie,
  business: IoBusiness,
  wallet: FaWallet,
  signature: FaFileSignature,
  gears: FaUsersGear,
  gradcap: FaGraduationCap,
  whistle: GiWhistle,
};

function Icona({ chiave, ...resto }) {
  const Componente = ICONE[chiave];
  return Componente ? <Componente aria-hidden="true" {...resto} /> : null;
}

const { hero, manifesto, organigramma, staff = [], kits, impact } = chiSiamoData;
const STAGIONE = dynamicData.anno;
const TAPPE = tappeStoria(chiSiamoData, STAGIONE);
const TESSERATI = leggiTesseramenti(hero.subtitle);
const ANNO_NASCITA = leggiAnno(hero.badgeText);
const PER_SPORT = leggiNumeri(impact.numeri);
const MASSIMO_SPORT = Math.max(1, ...PER_SPORT.map((s) => s.quanti));
const AFFILIAZIONI = leggiElenco(impact.affiliazioni);
const VALORI = manifesto.map((v) => v.title);
const doppia = (n) => String(n).padStart(2, "0");

/* Copia negli appunti, con il ripiego sul vecchio textarea dove
   navigator.clipboard non c'è (fuori da https, dentro alcune app). */
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

/* Il codice fiscale per il 5x1000 si copia con un tocco: chi compila la
   dichiarazione dal telefono non deve selezionare undici cifre a mano. */
function CodiceFiscale({ codice }) {
  const [stato, setStato] = useState(null); // null | "ok" | "no"
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  const copia = async () => {
    const ok = await copiaTesto(codice);
    setStato(ok ? "ok" : "no");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStato(null), 2200);
  };

  return (
    <div className="chs-cf">
      <code className="chs-cf-codice">{codice}</code>
      <button type="button" className={`chs-cf-copia${stato === "ok" ? " is-fatto" : ""}`} onClick={copia}>
        {stato === "ok" ? <FaCheck aria-hidden="true" /> : <FaRegCopy aria-hidden="true" />}
        <span>{stato === "ok" ? "Copiato" : "Copia"}</span>
      </button>
      {/* L'esito arriva anche a chi usa un lettore di schermo */}
      <span className="sp-solo-lettori" aria-live="polite">
        {stato === "ok" ? "Codice fiscale copiato" : stato === "no" ? "Copia non riuscita" : ""}
      </span>
    </div>
  );
}

export default function ChiSiamoPage() {
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
    <div className="chs">

      {/* ---------- Apertura ---------- */}
      <section className="chs-eroe" aria-labelledby="chs-titolo">
        <div className="mv-aurora" aria-hidden="true" />
        <div className="chs-eroe-griglia" aria-hidden="true" />
        <div className="chs-eroe-fantasma" aria-hidden="true" data-parallasse="0.12">INSIEME</div>

        <div className="chs-eroe-dentro">
          <div className="chs-eroe-testo">
            <p className="chs-occhiello" data-rivela="sfuma">
              <span className="chs-punto" aria-hidden="true" /> {hero.badgeText}
            </p>
            <h1 id="chs-titolo" className="chs-titolo">
              <span className="chs-titolo-riga" data-rivela>{hero.titlePrefix}</span>
              <span className="chs-titolo-riga" data-rivela>
                <span className="mv-testo-vivo">{hero.titleHighlight}</span>
              </span>
            </h1>
            {/* Il sottotitolo arriva dal nostro JSON, con il grassetto sul numero */}
            <p className="chs-sottotitolo" data-rivela dangerouslySetInnerHTML={{ __html: hero.subtitle }} />
            <div className="chs-azioni" data-rivela>
              <Link to="/iscrizione" className="chs-btn chs-btn--pieno" data-magnete>
                Iscriviti <FaArrowRight aria-hidden="true" />
              </Link>
              <a href="#chs-storia" className="chs-btn chs-btn--vetro mv-vetro" onClick={vaiA("chs-storia")}>
                La nostra storia <FaArrowDown aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* La foto delle mani unite, in un oblò con i valori che girano
              attorno. Parallasse sul contenitore, rotazione sull'anello:
              due transform su due elementi diversi. */}
          <div className="chs-oblo-cornice" data-rivela="zoom">
            <div className="chs-oblo" data-parallasse="0.08">
              <svg className="chs-oblo-anello" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
                <defs>
                  <path id="chs-cerchio" d="M100,100 m-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0" />
                </defs>
                <text>
                  <textPath href="#chs-cerchio" textLength="548" lengthAdjust="spacing">
                    {VALORI.map((v) => `${v} ✦ `).join("")}
                  </textPath>
                </text>
              </svg>
              <div className="chs-oblo-foto">
                <img
                  src="/chiSiamoPage/Sfondo_sito.jpg"
                  alt="Le mani di atleti e atlete unite al centro del cerchio, viste dal basso"
                  width="1536"
                  height="1024"
                  fetchpriority="high"
                />
              </div>
              {ANNO_NASCITA && (
                <span className="chs-oblo-bollo" aria-hidden="true">
                  <small>dal</small>{ANNO_NASCITA}
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="chs-eroe-numeri" data-rivela-gruppo>
          {TESSERATI && (
            <div>
              <dt>{TESSERATI.nome}</dt>
              <dd><Contatore valore={TESSERATI.quanti} /></dd>
            </div>
          )}
          {PER_SPORT.length > 0 && (
            <div>
              <dt>Sport</dt>
              <dd><Contatore valore={PER_SPORT.length} /></dd>
            </div>
          )}
          <div>
            <dt>Affiliazioni</dt>
            <dd><Contatore valore={AFFILIAZIONI.length} /></dd>
          </div>
          <div>
            <dt>Valori</dt>
            <dd><Contatore valore={manifesto.length} /></dd>
          </div>
        </dl>
      </section>

      {/* ---------- Nastro dei valori ----------
          Ripetuto due volte perché il giro non si veda. Per i lettori di
          schermo è decorazione: i valori sono elencati nel manifesto. */}
      <div className="chs-fascia" aria-hidden="true">
        <div className="mv-nastro" style={{ "--mv-nastro-durata": "30s" }}>
          <div className="mv-nastro-traccia">
            {[0, 1].map((copia) => (
              <span className="chs-fascia-giro" key={copia}>
                {VALORI.map((v) => (
                  <span key={v}>{v} <span className="chs-stella">✦</span></span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- La storia ---------- */}
      <section id="chs-storia" className="chs-sezione chs-storia" aria-labelledby="chs-storia-titolo">
        <header className="chs-testa">
          <p className="chs-occhiello chs-occhiello--scuro" data-rivela>La nostra storia</p>
          <h2 id="chs-storia-titolo" className="chs-sezione-titolo" data-rivela>
            Dal {ANNO_NASCITA ?? "primo giorno"} <em>a oggi</em>.
          </h2>
        </header>

        {/* La linea si disegna quando la sezione entra nello schermo, e le
            tappe si accendono una dopo l'altra lungo il tratto. */}
        <div className="chs-linea-tempo" data-rivela="sfuma">
          <span className="chs-linea" aria-hidden="true"><span className="chs-linea-piena" /></span>
          <ol className="chs-tappe" style={{ "--chs-tappe": TAPPE.length }}>
            {TAPPE.map((t, i) => (
              <li key={t.quando} className="chs-tappa" style={{ "--chs-i": i }}>
                <span className="chs-tappa-nodo" aria-hidden="true" />
                <p className="chs-tappa-quando">{t.quando}</p>
                <h3 className="chs-tappa-titolo">
                  {t.numero != null && <span className="chs-tappa-numero"><Contatore valore={t.numero} /> </span>}
                  {t.titolo}
                </h3>
                {t.testo && <p className="chs-tappa-testo">{t.testo}</p>}
                {t.ancora && (
                  <a href={`#${t.ancora}`} className="chs-tappa-link" onClick={vaiA(t.ancora)}>
                    Membership {STAGIONE} <FaArrowDown aria-hidden="true" />
                  </a>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Il manifesto ---------- */}
      <section className="chs-sezione chs-manifesto" aria-labelledby="chs-manifesto-titolo">
        <header className="chs-testa">
          <p className="chs-occhiello chs-occhiello--scuro" data-rivela>In cosa crediamo</p>
          <h2 id="chs-manifesto-titolo" className="chs-sezione-titolo" data-rivela>
            Il <em>Manifesto</em>.
          </h2>
        </header>

        {/* Un mosaico e non una scacchiera: la prima e l'ultima tessera
            sono doppie, e la prima è scura. */}
        <ul className="chs-bento" data-rivela-gruppo>
          {manifesto.map((v, i) => (
            <li key={v.title} className="chs-bento-cella">
              <article className="chs-valore" data-inclina="5">
                <span className="chs-valore-numero" aria-hidden="true">{doppia(i + 1)}</span>
                <span className="chs-valore-icona"><Icona chiave={v.iconKey} /></span>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
                <Icona chiave={v.iconKey} className="chs-valore-filigrana" />
              </article>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Gli organi ---------- */}
      <section className="chs-organi" aria-labelledby="chs-organi-titolo">
        <div className="mv-aurora chs-organi-aurora" aria-hidden="true" />
        <div className="chs-organi-dentro">
          <header className="chs-testa chs-testa--chiara">
            <p className="chs-occhiello" data-rivela>Chi guida la Polisportiva</p>
            <h2 id="chs-organi-titolo" className="chs-sezione-titolo" data-rivela>
              Gli Organi <em>della PSD</em>.
            </h2>
            <p className="chs-sezione-testo" data-rivela>
              La professionalità dei volontari al servizio della comunità.
            </p>
          </header>

          <ul className="chs-organi-griglia" data-rivela-gruppo>
            {organigramma.map((o, i) => (
              <li key={o.role} className="chs-organi-cella">
                <article className="chs-organo" data-inclina="6">
                  <div className="chs-organo-testa">
                    <span className="chs-organo-icona"><Icona chiave={o.iconKey} /></span>
                    <span className="chs-organo-numero" aria-hidden="true">{doppia(i + 1)}</span>
                  </div>
                  <h3>{o.role}</h3>
                  <span className="chs-organo-riga" aria-hidden="true" />
                  <p>{o.desc}</p>
                  <Icona chiave={o.iconKey} className="chs-organo-filigrana" />
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Lo staff ---------- */}
      {staff.length > 0 && (
        <section className="chs-sezione chs-staff" aria-labelledby="chs-staff-titolo">
          <header className="chs-testa">
            <p className="chs-occhiello chs-occhiello--scuro" data-rivela>In campo</p>
            <h2 id="chs-staff-titolo" className="chs-sezione-titolo" data-rivela>
              Staff Tecnico <em>&amp; Educativo</em>.
            </h2>
            <p className="chs-sezione-testo" data-rivela>Il cuore pulsante della nostra attività in campo.</p>
          </header>

          <ul className="chs-staff-griglia" data-rivela-gruppo>
            {staff.map((s) => (
              <li key={s.role} className="chs-staff-cella">
                <article className="chs-persona" data-inclina="5">
                  <span className="chs-persona-icona"><Icona chiave={s.iconKey} /></span>
                  <div>
                    <h3>{s.role}</h3>
                    <p>{s.desc}</p>
                  </div>
                  <Icona chiave={s.iconKey} className="chs-persona-filigrana" />
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- Membership ---------- */}
      <section id="chs-membership" className="chs-sezione chs-membership" aria-labelledby="chs-membership-titolo">
        <header className="chs-testa chs-testa--centro">
          <p className="chs-occhiello chs-occhiello--scuro" data-rivela>Sostieni il progetto</p>
          <h2 id="chs-membership-titolo" className="chs-sezione-titolo" data-rivela>
            Membership <em>{STAGIONE}</em>
          </h2>
          <p className="chs-sezione-testo" data-rivela>Partecipa al progetto e al nuovo Murales.</p>
        </header>

        <ul className="chs-kit-griglia" data-rivela-gruppo>
          {kits.map((k) => (
            <li key={k.name} className={`chs-kit-cella${k.isPopular ? " is-scelto" : ""}`}>
              <article className={`chs-kit${k.isPopular ? " chs-kit--scelto" : ""}`} data-inclina="5">
                {k.isPopular && <div className="mv-aurora chs-kit-aurora" aria-hidden="true" />}
                <div className="chs-kit-dentro">
                  <div className="chs-kit-testa">
                    <h3>Kit {k.name}</h3>
                    {k.isPopular && <span className="chs-kit-bollino">Consigliato</span>}
                  </div>
                  <p className="chs-kit-prezzo">
                    <span className="chs-kit-valuta">€</span>{k.price}
                  </p>
                  <ul className="chs-kit-voci">
                    {k.features.map((f) => (
                      <li key={f}><FaCheck aria-hidden="true" /> {f}</li>
                    ))}
                  </ul>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- I numeri ---------- */}
      <section className="chs-sezione chs-numeri" aria-labelledby="chs-numeri-titolo">
        <header className="chs-testa">
          <p className="chs-occhiello chs-occhiello--scuro" data-rivela>In numeri</p>
          <h2 id="chs-numeri-titolo" className="chs-sezione-titolo" data-rivela>
            Chi siamo, <em>in cifre</em>.
          </h2>
        </header>

        <div className="chs-numeri-griglia" data-rivela-gruppo>
          {/* Le barre sono proporzionate fra loro: si vede a colpo d'occhio
              quale sport è più grande, il numero preciso è scritto accanto */}
          <article className="chs-cifre chs-cifre--sport">
            <h3 className="chs-cifre-titolo"><FaUserGroup aria-hidden="true" /> Numeri</h3>
            <ul className="chs-barre">
              {PER_SPORT.map((s) => (
                <li key={s.nome} style={{ "--chs-livello": s.quanti / MASSIMO_SPORT }}>
                  <span className="chs-barra-nome">{s.nome}</span>
                  <span className="chs-barra-valore"><Contatore valore={s.quanti} /></span>
                  <span className="chs-barra-binario" aria-hidden="true"><span className="chs-barra-piena" /></span>
                </li>
              ))}
            </ul>
            <p className="sp-solo-lettori">{impact.numeri}</p>
          </article>

          <article className="chs-cifre">
            <h3 className="chs-cifre-titolo"><IoRibbon aria-hidden="true" /> Affiliazioni</h3>
            <ul className="chs-sigle">
              {AFFILIAZIONI.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </article>

          <article className="chs-cifre chs-cifre--5x1000">
            <h3 className="chs-cifre-titolo">5x1000</h3>
            <CodiceFiscale codice={impact.cf} />
            <Link to="/cinquepermille" className="chs-cifre-link">
              Come funziona il 5x1000 <FaArrowRight aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>

      {/* ---------- Invito finale ---------- */}
      <section className="chs-sezione chs-invito-sezione" aria-labelledby="chs-invito-titolo">
        <div className="chs-invito-cornice" data-rivela="zoom">
          <div className="chs-invito">
            <div className="mv-aurora" aria-hidden="true" />
            <div className="chs-invito-fantasma" aria-hidden="true">PSD</div>
            <div className="chs-invito-dentro">
              <p className="chs-occhiello">Entra in squadra</p>
              <h2 id="chs-invito-titolo" className="chs-invito-titolo">
                Il prossimo capitolo <span className="mv-testo-vivo">lo scriviamo insieme.</span>
              </h2>
              <div className="chs-azioni">
                <Link to="/iscrizione" className="chs-btn chs-btn--pieno chs-btn--grande" data-magnete>
                  Iscriviti <FaArrowRight aria-hidden="true" />
                </Link>
                <Link to="/contatti" className="chs-btn chs-btn--vetro mv-vetro chs-btn--grande" data-magnete>
                  Contattaci
                </Link>
                <Link to="/sports" className="chs-btn chs-btn--testo">
                  Scopri gli sport <FaArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
