import { useState } from "react";
import { Link } from "react-router-dom";
import { FaCheck, FaArrowRight } from "react-icons/fa";
import { updateEvento } from "../../api/adminApi";
import { esitoDi, SPORT_CON_PARZIALI } from "./esitoPerSport";

/**
 * "Com'è finita?" — il risultato di una partita già giocata, scritto
 * direttamente dall'elenco.
 *
 * È la cosa che un allenatore fa più spesso dopo il fischio finale, e prima
 * voleva dire: aprire la partita, scorrere oltre la mappa fino all'esito,
 * scrivere, risalire a Salva. Qui è un campo e un pulsante. Il resto
 * (marcatori, diretta, foto) resta nella scheda, a un tocco da "Apri".
 *
 * Manda SOLO risultato e, dove servono, i parziali: la modifica è parziale
 * sul server, e il resto della partita non viene riscritto.
 */
export default function RisultatoVeloce({ evento, area, sezione, onSalvato, onErrore }) {
  const esito = esitoDi(evento.sport);
  const conParziali = Boolean(esito.parziali) && SPORT_CON_PARZIALI.includes(evento.sport);

  const [risultato, setRisultato] = useState(evento.risultato ?? "");
  const [parziali, setParziali] = useState(evento.parziali ?? "");
  const [salvataggio, setSalvataggio] = useState(false);
  const [avviso, setAvviso] = useState("");

  const quando = new Date(evento.inizio).toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long"
  });

  const salva = async (e) => {
    e.preventDefault();
    if (!risultato.trim()) {
      setAvviso("Scrivi il risultato, per esempio 3 - 1.");
      return;
    }

    setAvviso("");
    setSalvataggio(true);
    const dati = {
      risultato: risultato.trim(),
      ...(conParziali ? { parziali: parziali.trim() || null } : {})
    };

    try {
      await updateEvento(evento.id, dati);
      onSalvato({ ...evento, ...dati });
    } catch (err) {
      onErrore(err);
      setSalvataggio(false);
    }
  };

  const idRisultato = `ev-ris-${evento.id}`;
  const idParziali = `ev-parz-${evento.id}`;

  return (
    <li className="ev-veloce">
      <span className="ev-veloce-colore" style={{ backgroundColor: evento.colore || "#999" }} aria-hidden="true" />

      <div className="ev-veloce-testa">
        <strong className="ev-veloce-titolo">{evento.titolo}</strong>
        <span className="ev-veloce-quando">{evento.squadra} · {quando}</span>
      </div>

      <form className="ev-veloce-modulo" onSubmit={salva} noValidate>
        <label className="ev-veloce-campo" htmlFor={idRisultato}>
          {/* L'esempio nell'etichetta e non nel campo: un "3 - 1" grigio
              dentro al riquadro si leggeva come un risultato già scritto */}
          <span>{esito.risultato.etichetta} <em>({esito.risultato.segnaposto.toLowerCase()})</em></span>
          <input
            id={idRisultato}
            type="text"
            className="adm-input ev-veloce-punteggio"
            value={risultato}
            onChange={(e) => { setRisultato(e.target.value); setAvviso(""); }}
            autoComplete="off"
            disabled={salvataggio}
          />
        </label>

        {conParziali && (
          <label className="ev-veloce-campo ev-veloce-campo-largo" htmlFor={idParziali}>
            <span>{esito.parziali.etichetta} <em>(facoltativi)</em></span>
            <input
              id={idParziali}
              type="text"
              className="adm-input"
              value={parziali}
              onChange={(e) => setParziali(e.target.value)}
              placeholder={esito.parziali.segnaposto}
              autoComplete="off"
              disabled={salvataggio}
            />
          </label>
        )}

        <div className="ev-veloce-azioni">
          <button type="submit" className="adm-btn adm-btn-arancio" disabled={salvataggio}>
            <FaCheck aria-hidden="true" /> {salvataggio ? "Salvo…" : "Salva risultato"}
          </button>
          <Link to={`${area}/${sezione}/${evento.id}?esito=1`} className="ev-veloce-apri">
            Apri la partita <FaArrowRight aria-hidden="true" />
          </Link>
        </div>

        {avviso && <p className="ev-veloce-avviso" role="alert">{avviso}</p>}
      </form>
    </li>
  );
}
