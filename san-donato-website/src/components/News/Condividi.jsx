import { useEffect, useRef, useState } from "react";
import { FaWhatsapp, FaFacebookF, FaLink, FaCheck, FaShareAlt } from "react-icons/fa";

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

/**
 * I pulsanti per condividere una notizia.
 *
 * WhatsApp prima di tutto: è lì che le famiglie delle squadre si passano
 * le comunicazioni. Poi Facebook, il link da copiare e, sui telefoni che
 * lo offrono, il foglio di condivisione del sistema (che contiene tutto
 * il resto: Telegram, email, messaggi).
 *
 * Nessuno script di terze parti: sono semplici collegamenti, niente che
 * tracci chi legge.
 */
export default function Condividi({ titolo, verticale = false }) {
  const [copiato, setCopiato] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  // L'indirizzo si legge al clic: quello della pagina in quel momento
  const indirizzo = () => window.location.href;
  const puoCondividere = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const apri = (url) => window.open(url, "_blank", "noopener,noreferrer");

  const copia = async () => {
    const ok = await copiaTesto(indirizzo());
    setCopiato(ok);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiato(false), 2200);
  };

  const sistema = () => {
    navigator.share({ title: titolo, url: indirizzo() }).catch(() => {});
  };

  return (
    <div className={`nzd-condividi${verticale ? " nzd-condividi-verticale" : ""}`}>
      {verticale && <span className="nzd-condividi-etichetta">Condividi</span>}

      <button
        type="button"
        className="nzd-condividi-tasto nzd-condividi-wa"
        onClick={() => apri(`https://wa.me/?text=${encodeURIComponent(`${titolo} ${indirizzo()}`)}`)}
        aria-label="Condividi su WhatsApp"
        title="WhatsApp"
      >
        <FaWhatsapp aria-hidden="true" />
      </button>

      <button
        type="button"
        className="nzd-condividi-tasto nzd-condividi-fb"
        onClick={() => apri(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(indirizzo())}`)}
        aria-label="Condividi su Facebook"
        title="Facebook"
      >
        <FaFacebookF aria-hidden="true" />
      </button>

      <button
        type="button"
        className={`nzd-condividi-tasto${copiato ? " is-fatto" : ""}`}
        onClick={copia}
        aria-label="Copia il link della notizia"
        title="Copia il link"
      >
        {copiato ? <FaCheck aria-hidden="true" /> : <FaLink aria-hidden="true" />}
      </button>

      {puoCondividere && (
        <button
          type="button"
          className="nzd-condividi-tasto"
          onClick={sistema}
          aria-label="Altri modi per condividere"
          title="Altro"
        >
          <FaShareAlt aria-hidden="true" />
        </button>
      )}

      {/* L'esito arriva anche a chi usa un lettore di schermo */}
      <span className="nzd-solo-lettori" aria-live="polite">{copiato ? "Link copiato" : ""}</span>
      {copiato && !verticale && <span className="nzd-condividi-esito" aria-hidden="true">Link copiato</span>}
    </div>
  );
}
