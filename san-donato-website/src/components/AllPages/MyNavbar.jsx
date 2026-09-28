import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation } from "react-router-dom";
import { FaChevronDown, FaDownload } from "react-icons/fa";
import MenuSchermo from "./MenuSchermo";
import { VOCI, PAGINE_DOCUMENTI, useVociDocumenti } from "./vociMenu";
import "../../css/MyNavbar.css";

const RIDOTTO = "(prefers-reduced-motion: reduce)";

/**
 * La riga del menu: sul computer le voci in fila con un segno arancione
 * che scivola sotto a quella della pagina aperta; sotto i 1180 pixel un
 * pulsante che apre il menu a tutto schermo (MenuSchermo.jsx).
 *
 * Qui vive anche il comportamento dell'intestazione intera, perché è il
 * menu a doverla tenere in vista:
 *   - resta attaccata in alto scorrendo (la barra sottile di sopra no);
 *   - dopo il primo scorrimento diventa di vetro, e il contenuto le passa
 *     sotto sfocato;
 *   - scendendo si toglie di mezzo, e torna appena si risale: chi legge
 *     verso il basso ha lo schermo intero, chi torna su ritrova il menu.
 *
 * Nessuno di questi cambia l'altezza dell'intestazione: la home la misura
 * (--site-header-h) per riempire la prima schermata, e un'intestazione che
 * si accorcia scorrendo farebbe saltare tutto quello che sta sotto.
 */
export default function MyNavbar() {
  const { pathname } = useLocation();
  const [docsOpen, setDocsOpen] = useState(false);
  // "chiuso", "aperto" o "chiude": il terzo lascia il tempo all'uscita
  const [menu, setMenu] = useState("chiuso");
  const [paginaVista, setPaginaVista] = useState(pathname);

  const barraRef = useRef(null);
  const navRef = useRef(null);
  const segnoRef = useRef(null);
  const docsRef = useRef(null);
  const burgerRef = useRef(null);
  const menuAperto = menu !== "chiuso";

  const documentoAttivo = PAGINE_DOCUMENTI.some((d) => d.to === pathname);
  const documenti = useVociDocumenti();

  // Cambiando pagina menu e tendina si chiudono da soli. Durante il
  // disegno e non in un effetto: così non c'è un fotogramma con la pagina
  // nuova sotto al menu ancora aperto.
  if (paginaVista !== pathname) {
    setPaginaVista(pathname);
    setDocsOpen(false);
    if (menu === "aperto") setMenu("chiude");
  }

  /* ---------- Menu a tutto schermo ---------- */

  const chiudiMenu = useCallback(() => {
    setMenu((m) => (m === "aperto" ? "chiude" : m));
  }, []);

  useEffect(() => {
    if (menu !== "chiude") return;
    const attesa = window.matchMedia(RIDOTTO).matches ? 0 : 320;
    const t = setTimeout(() => {
      setMenu("chiuso");
      // Il fuoco torna dove era prima di aprire, non in cima alla pagina
      burgerRef.current?.focus({ preventScroll: true });
    }, attesa);
    return () => clearTimeout(t);
  }, [menu]);

  /* ---------- Tendina dei documenti ---------- */

  useEffect(() => {
    if (!docsOpen) return;
    const fuori = (e) => {
      if (docsRef.current && !docsRef.current.contains(e.target)) setDocsOpen(false);
    };
    const esc = (e) => {
      if (e.key === "Escape") {
        setDocsOpen(false);
        docsRef.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("mousedown", fuori);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuori);
      document.removeEventListener("keydown", esc);
    };
  }, [docsOpen]);

  /* ---------- Il segno sotto alla voce attiva ---------- */

  /* Uno solo, misurato, invece di uno per voce: cambiando pagina scivola
     dalla voce di prima a quella nuova invece di spegnersi e riaccendersi.
     Scrive direttamente sullo stile: è una posizione, non un dato che
     debba ridisegnare il componente. Si rimisura quando la riga cambia
     larghezza (finestra, caratteri arrivati in ritardo) perché le voci
     si spostano. */
  useLayoutEffect(() => {
    const nav = navRef.current;
    const segno = segnoRef.current;
    if (!nav || !segno) return;

    const misura = () => {
      const attiva = nav.querySelector(".nb-voce.active");
      const base = nav.getBoundingClientRect();
      if (!attiva || base.width === 0) {
        segno.classList.remove("acceso");
        return;
      }
      const r = attiva.getBoundingClientRect();
      segno.style.setProperty("--nb-x", `${Math.round(r.left - base.left)}px`);
      segno.style.setProperty("--nb-w", `${Math.round(r.width)}px`);
      // Alla prima comparsa niente scivolata: arriverebbe dal bordo
      if (segno.classList.contains("acceso")) segno.classList.add("scivola");
      segno.classList.add("acceso");
    };

    misura();
    const osservatore = new ResizeObserver(misura);
    osservatore.observe(nav);
    return () => osservatore.disconnect();
  }, [pathname]);

  /* ---------- Scorrimento: vetro, e via di mezzo scendendo ---------- */

  useEffect(() => {
    const pila = barraRef.current?.closest(".site-header-stack");
    if (!pila) return;
    const radice = document.documentElement;

    let ultimo = window.scrollY;
    let inAttesa = false;

    const aggiorna = () => {
      inAttesa = false;
      const y = Math.max(0, window.scrollY);
      const alta = pila.offsetHeight;

      pila.classList.toggle("is-scorsa", y > 8);

      /* Sei pixel di tolleranza: il rimbalzo dello scorrimento del telefono
         e il trackpad producono piccoli movimenti all'indietro che, presi
         alla lettera, farebbero lampeggiare l'intestazione. */
      const passo = y - ultimo;
      if (y < alta + 80) {
        pila.classList.remove("is-nascosta");
        ultimo = y;
      } else if (Math.abs(passo) > 6) {
        const tieni = pila.matches(":focus-within") || pila.dataset.tieni === "1";
        pila.classList.toggle("is-nascosta", passo > 0 && !tieni);
        ultimo = y;
      }

      /* Quanto dell'intestazione copre lo schermo in questo momento: chi
         ha qualcosa di attaccato in alto può leggerlo e mettersi sotto.
         Calcolato e non misurato: a metà della ricomparsa la misura
         direbbe zero, mentre fra un attimo la riga sarà tutta in vista.
         La barra sottile (alta quanto la pila meno la riga del menu) se ne
         va scorrendo, la riga resta. */
      const barraSottile = alta - (barraRef.current?.offsetHeight ?? alta);
      const coperto = pila.classList.contains("is-nascosta")
        ? 0
        : Math.max(0, Math.round(alta - Math.min(barraSottile, y)));
      radice.style.setProperty("--testata-visibile", `${coperto}px`);
    };

    const suScorrimento = () => {
      if (inAttesa) return;
      inAttesa = true;
      requestAnimationFrame(aggiorna);
    };

    // Chi arriva col tabulatore deve vedere dove si trova
    const suFuoco = () => pila.classList.remove("is-nascosta");

    aggiorna();
    window.addEventListener("scroll", suScorrimento, { passive: true });
    window.addEventListener("resize", suScorrimento, { passive: true });
    pila.addEventListener("focusin", suFuoco);
    return () => {
      window.removeEventListener("scroll", suScorrimento);
      window.removeEventListener("resize", suScorrimento);
      pila.removeEventListener("focusin", suFuoco);
      pila.classList.remove("is-scorsa", "is-nascosta");
      radice.style.removeProperty("--testata-visibile");
    };
  }, []);

  // Con il menu o la tendina aperti l'intestazione non se ne va
  useEffect(() => {
    const pila = barraRef.current?.closest(".site-header-stack");
    if (!pila) return;
    const tieni = menuAperto || docsOpen;
    pila.dataset.tieni = tieni ? "1" : "0";
    if (tieni) pila.classList.remove("is-nascosta");
    pila.classList.toggle("is-menu-aperto", menu === "aperto");
  }, [menuAperto, docsOpen, menu]);

  return (
    <div className="navbar" ref={barraRef}>
      <nav className="nb-nav" aria-label="Menu principale" ref={navRef}>
        <span className="nb-segno" ref={segnoRef} aria-hidden="true" />

        {VOCI.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.to === "/"} className="nb-voce">
            {link.label}
          </NavLink>
        ))}

        <div className="nb-tendina" ref={docsRef}>
          <button
            type="button"
            className={`nb-voce nb-voce-tendina ${documentoAttivo ? "active" : ""}`}
            aria-expanded={docsOpen}
            aria-controls="nb-documenti"
            onClick={() => setDocsOpen((v) => !v)}
          >
            Documenti
            <FaChevronDown className={`nb-freccia ${docsOpen ? "gira" : ""}`} aria-hidden="true" />
          </button>

          <div id="nb-documenti" className="nb-tendina-menu" hidden={!docsOpen}>
            {documenti.map((link) => (
              link.download ? (
                <a
                  key={link.chiave}
                  href={link.to}
                  className="nb-tendina-voce"
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDocsOpen(false)}
                >
                  <span className="nb-tendina-icona" aria-hidden="true">{link.icon}</span>
                  {link.label}
                  <FaDownload className="nb-tendina-scarica" aria-label="da scaricare" />
                </a>
              ) : (
                <NavLink key={link.chiave} to={link.to} className="nb-tendina-voce" onClick={() => setDocsOpen(false)}>
                  <span className="nb-tendina-icona" aria-hidden="true">{link.icon}</span>
                  {link.label}
                </NavLink>
              )
            ))}
          </div>
        </div>
      </nav>

      {/* Sotto i 1180 pixel: l'iscrizione a portata di pollice e il menu */}
      <div className="nb-compatte">
        <Link to="/iscrizione" className="nb-iscriviti">Iscriviti</Link>
        <button
          type="button"
          ref={burgerRef}
          className={`nb-burger ${menu === "aperto" ? "aperto" : ""}`}
          aria-expanded={menu === "aperto"}
          aria-controls="menu-schermo"
          aria-label={menu === "aperto" ? "Chiudi il menu" : "Apri il menu"}
          onClick={() => setMenu((m) => (m === "aperto" ? "chiude" : "aperto"))}
        >
          <span className="nb-burger-linee" aria-hidden="true"><span /><span /></span>
        </button>
      </div>

      {/* Nel body e non qui dentro: l'intestazione è di vetro (backdrop-filter)
          e scorrendo viene spostata in su, e tutte e due le cose fanno sì che
          un elemento "fixed" al suo interno si posizioni rispetto a lei
          invece che allo schermo. */}
      {menuAperto && createPortal(
        <MenuSchermo
          uscita={menu === "chiude"}
          chiudi={chiudiMenu}
          burgerRef={burgerRef}
          barraRef={barraRef}
          pathname={pathname}
        />,
        document.body
      )}
    </div>
  );
}
