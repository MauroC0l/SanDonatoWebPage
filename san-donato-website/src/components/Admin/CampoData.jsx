import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaCalendarAlt, FaChevronLeft, FaChevronRight, FaClock, FaTimes } from "react-icons/fa";
import "../../css/CampoData.css";

/**
 * Selettore di data e ora, scritto per intero qui dentro.
 *
 * Niente <input type="date">: quello lo disegna il browser, cambia faccia su
 * ogni sistema, non si può vestire, e il formato segue la lingua del computer
 * — chi ha Windows in inglese si trova mm/gg/aaaa mentre compila per un sito
 * italiano. E niente libreria: react-datepicker portava 176 KB e un vestito
 * suo da combattere riga per riga, per una cosa che sono due cicli e una
 * griglia.
 *
 * Quello che fa:
 *   · calendario del mese, lunedì per primo, in italiano
 *   · mese e anno si scelgono a tendina, non solo con le frecce
 *   · scorciatoie "Oggi" e "Domani", che sono il 90% dei casi
 *   · l'ora a intervalli di un quarto d'ora, in colonna accanto
 *   · si può anche scrivere la data a mano, per chi va di tastiera
 *   · Esc chiude, le frecce muovono il giorno, Invio conferma
 *
 * Lavora in stringhe ISO come il resto del pannello, non in oggetti Date: chi
 * lo usa non converte avanti e indietro, e il fuso resta un problema di
 * questo file soltanto.
 */

const GIORNI = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"
];

/** Ogni quarto d'ora: 96 voci, che in una colonna che scorre si girano bene. */
const PASSO_MINUTI = 15;

const p2 = (n) => String(n).padStart(2, "0");

/** Il primo del mese di una data: e da li che parte la griglia. */
const primoDelMese = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

/** Il giorno di una data, senza ora: serve a confrontare due giorni. */
const soloGiorno = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const stessoGiorno = (a, b) => a && b && soloGiorno(a).getTime() === soloGiorno(b).getTime();

/**
 * Le caselle del mese, sempre sei righe da sette.
 *
 * Sei righe fisse e non "quante ne servono": un mese ne occupa cinque o sei
 * a seconda di dove cade il primo, e un calendario che cambia altezza mentre
 * si sfoglia fa saltare il contenuto sotto.
 */
function caselleDelMese(anno, mese) {
  const primo = new Date(anno, mese, 1);
  // getDay() dà 0 per domenica: qui la settimana comincia di lunedì
  const scarto = (primo.getDay() + 6) % 7;

  const partenza = new Date(anno, mese, 1 - scarto);

  return Array.from({ length: 42 }, (_, i) =>
    new Date(partenza.getFullYear(), partenza.getMonth(), partenza.getDate() + i)
  );
}

function scriviData(d, conOra) {
  if (!d) return "";
  const base = `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
  return conOra ? `${base} ${p2(d.getHours())}:${p2(d.getMinutes())}` : base;
}

/**
 * Dalla data scritta a mano a un oggetto Date.
 *
 * Accetta 14/5/2026, 14-05-2026, 14.5.26 e con o senza ora: chi batte veloce
 * non mette gli zeri davanti né sceglie il separatore, e rifiutargli quello
 * che ha scritto sarebbe pedanteria.
 */
function leggiData(testo, conOra) {
  const pezzi = String(testo).trim().match(
    /^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2,4})(?:[ ,]+(\d{1,2})[:.](\d{2}))?$/
  );
  if (!pezzi) return null;

  const [, g, m, a, ore, min] = pezzi;
  const anno = Number(a) < 100 ? 2000 + Number(a) : Number(a);

  const d = new Date(anno, Number(m) - 1, Number(g), conOra ? Number(ore ?? 0) : 0, conOra ? Number(min ?? 0) : 0, 0, 0);

  // Il 31 febbraio diventerebbe il 3 marzo senza accorgersene: se i pezzi
  // non tornano, la data non era valida.
  if (d.getDate() !== Number(g) || d.getMonth() !== Number(m) - 1) return null;
  return d;
}

export default function CampoData({
  valore,
  onChange,
  conOra = false,
  disabilitato = false,
  minimo = null,
  etichettaAria,
  segnaposto
}) {
  const contenitore = useRef(null);
  const listaOre = useRef(null);

  const [aperto, setAperto] = useState(false);

  /**
   * Quello che si sta battendo, oppure null quando nessuno sta battendo.
   *
   * Non una copia del valore tenuta allineata a colpi di effetto: il testo
   * mostrato si RICAVA — se c è qualcosa in corso di scrittura si mostra
   * quello, altrimenti la data scelta scritta per esteso. Così non esiste
   * un istante in cui i due dicono cose diverse.
   */
  const [scritto, setScritto] = useState(null);

  const scelta = useMemo(() => {
    if (!valore) return null;
    const d = new Date(valore);
    return isNaN(d.getTime()) ? null : d;
  }, [valore]);

  // Fissato all apertura del componente: leggere l orologio mentre si
  // disegna darebbe un risultato diverso a ogni passaggio.
  const [oggi] = useState(() => new Date());

  /**
   * Il mese sfogliato a mano, oppure null.
   *
   * Anche questo si ricava invece di essere risincronizzato: null significa
   * "quello della data scelta", e riaprendo il calendario si riparte da lì
   * senza che nessun effetto debba rimetterlo a posto.
   */
  const [meseScelto, setMeseScelto] = useState(null);

  const vista = meseScelto ?? primoDelMese(scelta ?? oggi);
  const testo = scritto ?? scriviData(scelta, conOra);

  const chiudi = useCallback(() => {
    setAperto(false);
    setMeseScelto(null);
  }, []);

  useEffect(() => {
    if (!aperto) return;

    const fuori = (e) => { if (!contenitore.current?.contains(e.target)) chiudi(); };
    const tasto = (e) => { if (e.key === "Escape") chiudi(); };

    document.addEventListener("mousedown", fuori);
    document.addEventListener("keydown", tasto);
    return () => {
      document.removeEventListener("mousedown", fuori);
      document.removeEventListener("keydown", tasto);
    };
  }, [aperto, chiudi]);

  // L'ora scelta va portata in vista: con 96 voci, aprire la colonna a
  // mezzanotte quando l'appuntamento è alle 18 vuol dire scorrere a lungo.
  useEffect(() => {
    if (!aperto || !conOra) return;
    listaOre.current?.querySelector(".cda-ora.is-scelta")?.scrollIntoView({ block: "center" });
  }, [aperto, conOra]);

  /* ---------- Scelta ---------- */

  const scegli = (giorno, { chiudiDopo = !conOra } = {}) => {
    const d = new Date(giorno);

    // Cambiando giorno l'ora resta quella che c'era: chi sposta una partita
    // da sabato a domenica non vuole rimettere anche le 18:30.
    if (conOra && scelta) d.setHours(scelta.getHours(), scelta.getMinutes(), 0, 0);
    else if (conOra) d.setHours(18, 0, 0, 0);
    else d.setHours(0, 0, 0, 0);

    onChange(d.toISOString());
    if (chiudiDopo) chiudi();
  };

  const scegliOra = (ore, minuti) => {
    const base = scelta ? new Date(scelta) : new Date();
    base.setHours(ore, minuti, 0, 0);
    onChange(base.toISOString());
  };

  const confermaScritto = () => {
    // Nessuno stava scrivendo: non c è niente da confermare.
    if (scritto === null) return;

    const pulito = scritto.trim();

    // In ogni caso si smette di "stare scrivendo": il campo torna a mostrare
    // il valore vero, che sia quello nuovo o quello di prima. Una data
    // incomprensibile non resta lì a far credere che sia stata registrata.
    setScritto(null);

    if (pulito === "") { onChange(""); return; }

    const d = leggiData(pulito, conOra);
    if (d) onChange(d.toISOString());
  };

  const muoviGiorni = (quanti) => {
    const base = scelta ? new Date(scelta) : new Date();
    base.setDate(base.getDate() + quanti);
    scegli(base, { chiudiDopo: false });
  };

  /* ---------- Dati del calendario ---------- */

  const caselle = useMemo(
    () => caselleDelMese(vista.getFullYear(), vista.getMonth()),
    [vista]
  );

  const ore = useMemo(() => {
    if (!conOra) return [];
    const voci = [];
    for (let m = 0; m < 24 * 60; m += PASSO_MINUTI) {
      voci.push({ ore: Math.floor(m / 60), minuti: m % 60 });
    }
    return voci;
  }, [conOra]);

  const anni = useMemo(() => {
    const centro = vista.getFullYear();
    // Cinquant'anni indietro per le date di nascita, cinque avanti per le
    // programmazioni: sono i due usi veri di questo campo.
    return Array.from({ length: 56 }, (_, i) => centro - 50 + i);
  }, [vista]);

  const minimoGiorno = minimo ? soloGiorno(new Date(minimo)) : null;

  const tastiCampo = (e) => {
    if (disabilitato) return;

    if (e.key === "Enter") { e.preventDefault(); confermaScritto(); chiudi(); return; }
    if (e.key === "ArrowDown" && !aperto) { e.preventDefault(); setAperto(true); return; }
    if (!aperto) return;

    if (e.key === "ArrowLeft") { e.preventDefault(); muoviGiorni(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); muoviGiorni(1); }
    if (e.key === "ArrowUp") { e.preventDefault(); muoviGiorni(-7); }
    if (e.key === "ArrowDown") { e.preventDefault(); muoviGiorni(7); }
  };

  return (
    <div className={`cda ${aperto ? "is-aperto" : ""}`} ref={contenitore}>
      <div className="cda-campo">
        <FaCalendarAlt className="cda-icona" aria-hidden="true" />

        <input
          type="text"
          className="adm-input"
          value={testo}
          onChange={(e) => setScritto(e.target.value)}
          onBlur={confermaScritto}
          onFocus={() => setAperto(true)}
          onKeyDown={tastiCampo}
          placeholder={segnaposto ?? (conOra ? "gg/mm/aaaa hh:mm" : "gg/mm/aaaa")}
          disabled={disabilitato}
          aria-label={etichettaAria}
          aria-expanded={aperto}
          autoComplete="off"
          inputMode="numeric"
        />

        {scelta && !disabilitato && (
          <button
            type="button"
            className="cda-svuota"
            onClick={() => { onChange(""); setScritto(null); }}
            title="Svuota"
            aria-label={`Svuota ${etichettaAria ?? "la data"}`}
          >
            <FaTimes />
          </button>
        )}
      </div>

      {aperto && !disabilitato && (
        <div className="cda-pannello">
          <div className="cda-calendario">
            {/* ---------- Intestazione ---------- */}
            <div className="cda-testa">
              <button
                type="button"
                className="cda-freccia"
                onClick={() => setMeseScelto(new Date(vista.getFullYear(), vista.getMonth() - 1, 1))}
                aria-label="Mese precedente"
              >
                <FaChevronLeft />
              </button>

              <div className="cda-scelte">
                <select
                  className="cda-select"
                  value={vista.getMonth()}
                  onChange={(e) => setMeseScelto(new Date(vista.getFullYear(), Number(e.target.value), 1))}
                  aria-label="Mese"
                >
                  {MESI.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>

                <select
                  className="cda-select"
                  value={vista.getFullYear()}
                  onChange={(e) => setMeseScelto(new Date(Number(e.target.value), vista.getMonth(), 1))}
                  aria-label="Anno"
                >
                  {anni.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <button
                type="button"
                className="cda-freccia"
                onClick={() => setMeseScelto(new Date(vista.getFullYear(), vista.getMonth() + 1, 1))}
                aria-label="Mese successivo"
              >
                <FaChevronRight />
              </button>
            </div>

            {/* ---------- Griglia ---------- */}
            <div className="cda-griglia" role="grid">
              {GIORNI.map((g) => (
                <span key={g} className="cda-nome-giorno" role="columnheader">{g}</span>
              ))}

              {caselle.map((d) => {
                const altroMese = d.getMonth() !== vista.getMonth();
                const prestoTroppo = minimoGiorno && soloGiorno(d) < minimoGiorno;

                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    className={`cda-giorno
                      ${altroMese ? "is-altro-mese" : ""}
                      ${stessoGiorno(d, oggi) ? "is-oggi" : ""}
                      ${stessoGiorno(d, scelta) ? "is-scelto" : ""}`}
                    disabled={prestoTroppo}
                    onClick={() => scegli(d)}
                    aria-label={`${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`}
                    aria-current={stessoGiorno(d, scelta) ? "date" : undefined}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            {/* ---------- Scorciatoie ---------- */}
            <div className="cda-scorciatoie">
              <button type="button" className="cda-scorciatoia" onClick={() => scegli(new Date())}>
                Oggi
              </button>
              <button
                type="button"
                className="cda-scorciatoia"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  scegli(d);
                }}
              >
                Domani
              </button>
              <button
                type="button"
                className="cda-scorciatoia"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  scegli(d);
                }}
              >
                Fra una settimana
              </button>

              {conOra && (
                <button type="button" className="cda-scorciatoia cda-fatto" onClick={chiudi}>
                  Fatto
                </button>
              )}
            </div>
          </div>

          {/* ---------- Ora ---------- */}
          {conOra && (
            <div className="cda-ore">
              <p className="cda-ore-titolo"><FaClock aria-hidden="true" /> Ora</p>
              <div className="cda-ore-lista" ref={listaOre}>
                {ore.map(({ ore: h, minuti: m }) => {
                  const attiva = scelta && scelta.getHours() === h && scelta.getMinutes() === m;
                  return (
                    <button
                      key={`${h}:${m}`}
                      type="button"
                      className={`cda-ora ${attiva ? "is-scelta" : ""}`}
                      onClick={() => scegliOra(h, m)}
                    >
                      {p2(h)}:{p2(m)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
