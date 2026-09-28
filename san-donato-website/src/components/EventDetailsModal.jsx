import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FiX, FiCalendar, FiClock, FiMapPin, FiVideo, FiRotateCcw, FiList, FiArrowUpRight, FiAward
} from "react-icons/fi";
import { FaFutbol } from "react-icons/fa";
import { linkMappa } from "../utils/linkMappa";
import "../css/EventDetailsModal.css";

/*
 * La scheda di un evento: la apre il calendario e la apre la home.
 *
 * Sta in un portale sul <body> e non dentro alla pagina: la pagina entra
 * con un'animazione, e un elemento "fixed" dentro a un genitore
 * trasformato si posiziona rispetto a lui invece che allo schermo.
 *
 * Classi con il prefisso cpm-: tutto il suo aspetto sta in
 * EventDetailsModal.css, così nella home non dipende dal foglio del
 * calendario.
 */

const formatDate = (date) => new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date));
const formatTime = (date) => new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(date));

const NOME_TIPO = { partita: "Partita", torneo: "Torneo", allenamento: "Allenamento", evento: "Evento" };

const FOCALIZZABILI = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function EventDetailsModal({ event, onClose }) {
  const scheda = useRef(null);
  const chiudi = useRef(null);
  const idTitolo = useId();

  // L'ultima onClose, letta dagli effetti senza doverli rifare quando cambia
  const suChiudi = useRef(onClose);
  useEffect(() => { suChiudi.current = onClose; }, [onClose]);

  /* Esc chiude, Tab gira dentro alla scheda, e chiusa la scheda il fuoco
     torna dov'era (la pillola o la riga da cui si è aperta): chi usa la
     tastiera non si ritrova in cima alla pagina. */
  useEffect(() => {
    if (!event) return undefined;
    const prima = document.activeElement;
    chiudi.current?.focus();

    const tasti = (e) => {
      if (e.key === "Escape") { suChiudi.current(); return; }
      if (e.key !== "Tab" || !scheda.current) return;
      const voci = [...scheda.current.querySelectorAll(FOCALIZZABILI)];
      if (!voci.length) return;
      const primo = voci[0];
      const ultimo = voci[voci.length - 1];
      if (e.shiftKey && document.activeElement === primo) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primo.focus(); }
    };
    window.addEventListener("keydown", tasti);
    return () => {
      window.removeEventListener("keydown", tasti);
      if (prima && typeof prima.focus === "function" && prima.isConnected) prima.focus();
    };
  }, [event]);

  if (!event) return null;

  // Dove si gioca, su una mappa. Con le coordinate porta al punto esatto;
  // senza, fa cercare a Google il nome del luogo. Se non c'è nemmeno quello,
  // è null e il collegamento non compare.
  const mappa = linkMappa({ luogo: event.location, latitudine: event.lat, longitudine: event.lng });

  // Controllo fine evento per decidere tra Live o Replay
  const isEventEnded = (() => {
    const now = new Date();
    const end = event.end ? new Date(event.end) : new Date(event.start);
    return now > end;
  })();

  // "3 - 1" diventa un tabellone; un testo ("Rinviata") resta un testo
  const punti = event.result ? event.result.split('-').map(s => s.trim()) : [];
  const tabellone = punti.length === 2 && punti.every(p => p !== "" && !isNaN(p));

  const data = formatDate(event.start);
  const orario = event.hasTime
    ? `${formatTime(event.start)}${event.end && +new Date(event.end) > +new Date(event.start) ? ` – ${formatTime(event.end)}` : ""}`
    : "Orario da definire";

  return createPortal(
    <div className="cpm-velo" onClick={onClose}>
      <div
        className="cpm-scheda"
        ref={scheda}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitolo}
        onClick={e => e.stopPropagation()}
        style={{ "--cpm-c": event.color || "#ff6600" }}
      >
        <header className="cpm-testa">
          <div className="cpm-testa-luce" aria-hidden="true" />
          <div className="cpm-testa-riga">
            <span className="cpm-squadra">
              <span className="cpm-pallino" aria-hidden="true" />
              {event.category}
            </span>
            {NOME_TIPO[event.tipo] && <span className="cpm-tipo">{NOME_TIPO[event.tipo]}</span>}
            <button type="button" className="cpm-chiudi" onClick={onClose} ref={chiudi} aria-label="Chiudi">
              <FiX size={20} />
            </button>
          </div>
          <h2 className="cpm-titolo" id={idTitolo}>{event.title}</h2>
          <p className="cpm-quando">
            <span>{data}</span>
            <span className="cpm-quando-ora">{orario}</span>
          </p>
        </header>

        <div className="cpm-corpo">
          {event.result && (
            <div className="cpm-risultato">
              <span className="cpm-etichetta"><FiAward aria-hidden="true" /> Risultato</span>
              {tabellone ? (
                <span className="cpm-tabellone">
                  <strong>{punti[0]}</strong><i aria-hidden="true">:</i><strong>{punti[1]}</strong>
                </span>
              ) : (
                <span className="cpm-risultato-testo">{event.result}</span>
              )}
            </div>
          )}

          <div className="cpm-griglia">
            <div className="cpm-tessera">
              <span className="cpm-icona"><FiCalendar /></span>
              <div>
                <span className="cpm-etichetta">Data</span>
                <p className="cpm-valore cpm-maiuscola">{data}</p>
              </div>
            </div>

            <div className="cpm-tessera">
              <span className="cpm-icona"><FiClock /></span>
              <div>
                <span className="cpm-etichetta">Orario</span>
                <p className="cpm-valore">{orario}</p>
              </div>
            </div>

            {/* Luogo: cliccabile quando c'è qualcosa da aprire */}
            <div className="cpm-tessera cpm-larga">
              <span className="cpm-icona"><FiMapPin /></span>
              <div>
                <span className="cpm-etichetta">Luogo</span>
                {mappa ? (
                  <p className="cpm-valore">
                    <a href={mappa} target="_blank" rel="noreferrer" className="cpm-luogo-link">
                      {event.location}
                    </a>
                  </p>
                ) : (
                  <p className="cpm-valore">{event.location !== "" ? event.location : "Luogo da definire"}</p>
                )}
              </div>
            </div>

            {event.partials && (
              <div className="cpm-tessera cpm-larga">
                <span className="cpm-icona"><FiList /></span>
                <div>
                  <span className="cpm-etichetta">Parziali set</span>
                  <p className="cpm-valore cpm-mono">{event.partials}</p>
                </div>
              </div>
            )}

            {event.scorers && event.scorers.length > 0 && (
              <div className="cpm-tessera cpm-larga">
                <span className="cpm-icona"><FaFutbol /></span>
                <div>
                  <span className="cpm-etichetta">Marcatori</span>
                  <ul className="cpm-marcatori">
                    {event.scorers.map((scorer, idx) => (
                      <li key={idx}>{scorer}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Descrizione */}
          {event.description && (
            <div className="cpm-descrizione">
              <span className="cpm-etichetta">Dettagli</span>
              <p>{event.description}</p>
            </div>
          )}

          {(event.diretta || mappa) && (
            <div className="cpm-azioni">
              {/* Collegamenti veri e non finestre aperte da JavaScript: si
                  possono tenere premuti per condividerli, e i blocchi delle
                  finestre a comparsa non li fermano. */}
              {event.diretta && (
                <a className="cpm-bottone cpm-bottone-diretta" href={event.diretta} target="_blank" rel="noopener noreferrer">
                  {isEventEnded ? <FiRotateCcw aria-hidden="true" /> : <FiVideo aria-hidden="true" />}
                  {isEventEnded ? "Rivedi la partita" : "Guarda in diretta"}
                </a>
              )}
              {mappa && (
                <a className="cpm-bottone cpm-bottone-pieno" href={mappa} target="_blank" rel="noreferrer">
                  <FiMapPin aria-hidden="true" /> Apri su Maps <FiArrowUpRight aria-hidden="true" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
