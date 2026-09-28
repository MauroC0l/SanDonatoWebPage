import { useEffect, useId, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { FaBars, FaTimes, FaExternalLinkAlt, FaSignOutAlt } from "react-icons/fa";

/**
 * La navigazione dell'area riservata sul telefono.
 *
 * Sul computer le sezioni stanno in una riga sotto al marchio. Sul telefono
 * quella riga andava a capo cinque volte: per un amministratore erano 274
 * pixel su 844, un terzo dello schermo, fermi in cima mentre si scorreva.
 *
 * Qui fa come le applicazioni: in basso, dove arriva il pollice, le quattro
 * sezioni che quel ruolo usa di più, e un pulsante "Menu" che apre tutte le
 * altre insieme a profilo, sito ed uscita. Quali siano le quattro lo decide
 * chi chiama, perché dipende dal ruolo: a un allenatore servono le partite,
 * alla segreteria le quote.
 *
 * Si vede solo sotto i 760px (sotto i 1100 per chi ha la colonna delle
 * sezioni a sinistra, che su un tablet non ci sta): sopra, questo
 * componente c'è ma il CSS lo nasconde, e resta la navigazione del computer.
 *
 * @param sezioni     [{ a, etichetta, Icona, esatta }] già filtrate per ruolo
 * @param principali  quante mostrare nella barra; le altre vanno nel menu
 * @param extra       voci in più del menu, dopo le sezioni (es. il profilo)
 * @param gruppi      [nomi] facoltativo: se c'è, il menu divide le voci per
 *                    gruppo (la voce dice il suo in "gruppo"), in quest'ordine;
 *                    le voci senza gruppo vanno in fondo, senza titolo
 * @param onEsci      uscita dall'account
 */
export default function NavigazioneMobile({ sezioni, principali = 4, extra = [], gruppi = null, onEsci }) {
  const [aperto, setAperto] = useState(false);
  const location = useLocation();
  const idPannello = useId();
  const pannello = useRef(null);

  const inBarra = sezioni.slice(0, principali);
  const nelMenu = [...sezioni.slice(principali), ...extra];

  /* Con molte voci il menu è una griglia di dodici tessere tutte uguali, e
     si legge a caso. Divise per argomento, con il nome sopra, si trovano:
     è lo stesso ordine della colonna del computer. */
  const blocchi = gruppi
    ? [
        ...gruppi.map((nome) => ({ nome, voci: nelMenu.filter((s) => s.gruppo === nome) })),
        { nome: null, voci: nelMenu.filter((s) => !s.gruppo || !gruppi.includes(s.gruppo)) }
      ].filter((b) => b.voci.length > 0)
    : [{ nome: null, voci: nelMenu }];

  const griglia = (voci) => (
    <ul className="adm-menu-griglia">
      {voci.map(({ a, etichetta, Icona, esatta }) => (
        <li key={a}>
          <NavLink
            to={a}
            end={esatta}
            className={({ isActive }) => `adm-menu-voce ${isActive ? "is-active" : ""}`}
          >
            <Icona aria-hidden="true" />
            <span>{etichetta}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );

  // Si chiude da solo quando si cambia pagina: la voce toccata ha già fatto
  // il suo lavoro, e un menu che resta aperto sopra la pagina nuova la copre.
  const [percorso, setPercorso] = useState(location.pathname);
  if (percorso !== location.pathname) {
    setPercorso(location.pathname);
    setAperto(false);
  }

  useEffect(() => {
    if (!aperto) return undefined;

    const tasti = (e) => { if (e.key === "Escape") setAperto(false); };
    document.addEventListener("keydown", tasti);

    // Sotto al menu la pagina non deve scorrere: il dito che scorre
    // l'elenco delle voci finirebbe a muovere la pagina dietro.
    const prima = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    pannello.current?.querySelector("a, button")?.focus();

    return () => {
      document.removeEventListener("keydown", tasti);
      document.body.style.overflow = prima;
    };
  }, [aperto]);

  /* La voce del menu è accesa se la pagina aperta sta lì dentro: altrimenti,
     su una sezione del menu, nella barra non si accenderebbe niente e non si
     capirebbe dove si è. */
  const menuAcceso = aperto || nelMenu.some((s) => s.a && (
    location.pathname === s.a || (!s.esatta && location.pathname.startsWith(`${s.a}/`))
  ));

  return (
    <>
      <nav className="adm-barra-basso" aria-label="Sezioni principali">
        {inBarra.map(({ a, etichetta, Icona, esatta }) => (
          <NavLink
            key={a}
            to={a}
            end={esatta}
            className={({ isActive }) => `adm-barra-voce ${isActive && !aperto ? "is-active" : ""}`}
          >
            <Icona aria-hidden="true" />
            <span>{etichetta}</span>
          </NavLink>
        ))}

        <button
          type="button"
          className={`adm-barra-voce ${menuAcceso ? "is-active" : ""}`}
          onClick={() => setAperto((v) => !v)}
          aria-expanded={aperto}
          aria-controls={idPannello}
        >
          {aperto ? <FaTimes aria-hidden="true" /> : <FaBars aria-hidden="true" />}
          <span>Menu</span>
        </button>
      </nav>

      {aperto && (
        <>
          <div className="adm-menu-velo" onClick={() => setAperto(false)} aria-hidden="true" />

          <div
            id={idPannello}
            ref={pannello}
            className="adm-menu-foglio"
            role="dialog"
            aria-modal="true"
            aria-label="Tutte le sezioni"
          >
            {nelMenu.length > 0 && (gruppi
              ? blocchi.map(({ nome, voci }) => (
                  <section key={nome || "altro"} className="adm-menu-gruppo" aria-label={nome || undefined}>
                    {nome && <p className="adm-menu-gruppo-titolo" aria-hidden="true">{nome}</p>}
                    {griglia(voci)}
                  </section>
                ))
              : griglia(nelMenu)
            )}

            <div className="adm-menu-fondo">
              <a href="/" className="adm-menu-azione" target="_blank" rel="noreferrer">
                <FaExternalLinkAlt aria-hidden="true" /> Vedi il sito
              </a>
              <button type="button" className="adm-menu-azione adm-menu-esci" onClick={onEsci}>
                <FaSignOutAlt aria-hidden="true" /> Esci
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
