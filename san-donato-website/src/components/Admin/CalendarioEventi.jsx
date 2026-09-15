import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FaChevronLeft, FaChevronRight, FaMapMarkerAlt } from "react-icons/fa";
import "../../css/CalendarioEventi.css";

/**
 * Gli eventi disposti su un mese.
 *
 * La lista risponde a "cosa c'è in programma", il calendario a una domanda
 * diversa: "quel sabato siamo già impegnati?". È la domanda che si fa chi
 * fissa un'amichevole o prenota una palestra, e su un elenco ordinato per
 * data ci si risponde solo contando i giorni a mano.
 *
 * Sei righe sempre, anche quando il mese ne riempirebbe cinque: così la
 * griglia non cambia altezza passando da un mese all'altro, e la fila su cui
 * si aveva l'occhio resta dov'era.
 */

const GIORNI = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
const EVENTI_PER_CASELLA = 3;

/** Il lunedì della settimana in cui cade il giorno dato. */
function lunediDi(giorno) {
  const d = new Date(giorno.getFullYear(), giorno.getMonth(), giorno.getDate());
  // getDay(): 0 è domenica. In Italia la settimana comincia di lunedì, e
  // la domenica va spinta in fondo invece che in testa.
  const scarto = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - scarto);
  return d;
}

function stessoGiorno(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/** La chiave con cui si raggruppa per giorno: "2026-09-14". */
function chiaveGiorno(d) {
  const mese = String(d.getMonth() + 1).padStart(2, "0");
  const giorno = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mese}-${giorno}`;
}

export default function CalendarioEventi({ mese, onCambiaMese, eventi, area, oggi, sezione = "partite" }) {
  const caselle = useMemo(() => {
    const partenza = lunediDi(new Date(mese.getFullYear(), mese.getMonth(), 1));

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(partenza);
      d.setDate(partenza.getDate() + i);
      return d;
    });
  }, [mese]);

  /* Gli eventi raggruppati per giorno, e dentro al giorno in ordine di ora.
     Fatto una volta sola invece di filtrare l'elenco dentro a ognuna delle
     42 caselle: con 263 eventi in archivio sarebbero undicimila confronti a
     ogni ridisegno. */
  const perGiorno = useMemo(() => {
    const mappa = new Map();

    for (const e of eventi) {
      const inizio = new Date(e.inizio);
      const chiave = chiaveGiorno(inizio);
      if (!mappa.has(chiave)) mappa.set(chiave, []);
      mappa.get(chiave).push({ ...e, inizioDate: inizio });
    }

    for (const elenco of mappa.values()) {
      elenco.sort((a, b) => a.inizioDate - b.inizioDate);
    }

    return mappa;
  }, [eventi]);

  const spostaMese = (passi) => {
    onCambiaMese(new Date(mese.getFullYear(), mese.getMonth() + passi, 1));
  };

  const titolo = mese.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  return (
    <div className="cal">
      <div className="cal-testa">
        <button
          type="button"
          className="adm-icon-btn"
          onClick={() => spostaMese(-1)}
          aria-label="Mese precedente"
        >
          <FaChevronLeft />
        </button>

        <h2 className="cal-mese">{titolo}</h2>

        <button
          type="button"
          className="adm-icon-btn"
          onClick={() => spostaMese(1)}
          aria-label="Mese successivo"
        >
          <FaChevronRight />
        </button>

        <button
          type="button"
          className="adm-btn adm-btn-ghost cal-oggi"
          onClick={() => onCambiaMese(new Date(oggi.getFullYear(), oggi.getMonth(), 1))}
        >
          Oggi
        </button>
      </div>

      <div className="cal-intestazioni" aria-hidden="true">
        {GIORNI.map((g) => <span key={g}>{g}</span>)}
      </div>

      <div className="cal-griglia">
        {caselle.map((giorno) => {
          const delMese = giorno.getMonth() === mese.getMonth();
          const eDiOggi = stessoGiorno(giorno, oggi);
          const diQuelGiorno = perGiorno.get(chiaveGiorno(giorno)) ?? [];
          const nascosti = diQuelGiorno.length - EVENTI_PER_CASELLA;

          return (
            <div
              key={giorno.toISOString()}
              className={`cal-casella ${delMese ? "" : "is-fuori"} ${eDiOggi ? "is-oggi" : ""}`}
            >
              <span className="cal-numero">{giorno.getDate()}</span>

              {diQuelGiorno.slice(0, EVENTI_PER_CASELLA).map((e) => (
                <Link
                  key={e.id}
                  to={`${area}/${sezione}/${e.id}`}
                  className="cal-evento"
                  style={{ borderLeftColor: e.colore || "#999" }}
                  // Il titolo per esteso nel suggerimento: nella casella è
                  // tagliato, e su una griglia fitta è l'unico modo di
                  // leggerlo senza aprire la scheda.
                  title={[
                    e.titolo,
                    e.squadra,
                    e.luogo && `presso ${e.luogo}`
                  ].filter(Boolean).join(" · ")}
                >
                  {!e.tuttoIlGiorno && (
                    <span className="cal-ora">
                      {e.inizioDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  <span className="cal-titolo">{e.titolo}</span>
                  {e.luogo && <FaMapMarkerAlt className="cal-segno-luogo" aria-hidden="true" />}
                </Link>
              ))}

              {nascosti > 0 && (
                <span className="cal-altri">+{nascosti} altr{nascosti === 1 ? "o" : "i"}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
