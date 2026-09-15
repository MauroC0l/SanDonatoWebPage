import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  FaSearch, FaMapMarkerAlt, FaTimes, FaExternalLinkAlt, FaSpinner, FaCrosshairs
} from "react-icons/fa";
import { linkMappa } from "../../utils/linkMappa";
import "leaflet/dist/leaflet.css";
import "../../css/SceltaLuogo.css";

/**
 * Scelta del luogo di un evento: indirizzo scritto, punto confermato sulla
 * mappa.
 *
 * Perché OpenStreetMap e non Google: la ricerca dei luoghi di Google vuole
 * una chiave con la fatturazione attiva, e la chiave che la società aveva
 * stava per essere cancellata perché non serviva più a nessuno. Qui non
 * serve alcuna chiave, e il risultato per chi legge il sito è lo stesso: il
 * collegamento che si genera apre Google Maps sul punto esatto, perché è
 * quello che la gente ha sul telefono.
 *
 * Il punto è facoltativo. Senza, il collegamento sul sito fa cercare a Google
 * il testo dell'indirizzo, che per "Campo Le Chiuse, Torino" funziona;
 * con le coordinate funziona anche per le palestre che su una mappa hanno
 * tre omonime in tre quartieri.
 */

/* Centro di Torino: da qualche parte la mappa deve partire, e gli eventi
   della Polisportiva sono lì o poco fuori. */
const PARTENZA = { lat: 45.0703, lng: 7.6869, zoom: 12 };

/** Zoom a cui si arriva scegliendo un risultato: si distinguono le vie. */
const ZOOM_SCELTA = 17;

/**
 * Ricerca degli indirizzi con Nominatim, il servizio di OpenStreetMap.
 *
 * Il loro regolamento chiede di non tempestarlo di richieste: per questo la
 * ricerca parte da un pulsante e non a ogni lettera digitata. Un modulo che
 * si compila qualche volta al giorno ci sta abbondantemente dentro.
 */
async function cercaIndirizzo(testo) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", testo);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "6");
  // I risultati italiani per primi: le trasferte non escono dalla regione
  url.searchParams.set("countrycodes", "it");
  url.searchParams.set("accept-language", "it");

  const risposta = await fetch(url, { headers: { Accept: "application/json" } });
  if (!risposta.ok) throw new Error("La ricerca degli indirizzi non ha risposto.");

  const dati = await risposta.json();
  return dati.map((r) => ({
    nome: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon)
  }));
}

export default function SceltaLuogo({
  luogo,
  latitudine,
  longitudine,
  onChange,
  disabilitato = false
}) {
  const contenitore = useRef(null);
  const mappa = useRef(null);
  const segnaposto = useRef(null);
  const idCampo = useId();

  const [risultati, setRisultati] = useState(null);
  const [cercando, setCercando] = useState(false);
  const [erroreRicerca, setErroreRicerca] = useState("");

  const haPunto = latitudine != null && longitudine != null;

  /**
   * onChange in un ref: la mappa si costruisce una volta sola, e i suoi
   * gestori di eventi vivono quanto lei. Mettendo la funzione fra le
   * dipendenze dell'effetto, la mappa verrebbe distrutta e ricostruita a
   * ogni battuta nel campo dell'indirizzo.
   */
  const cambia = useRef(onChange);
  useEffect(() => { cambia.current = onChange; }, [onChange]);

  /* ---------- Costruzione della mappa ---------- */

  useEffect(() => {
    let vivo = true;
    let istanza = null;

    // Import dinamico: Leaflet pesa, e chi apre l'editor di un evento senza
    // toccare il luogo non ha motivo di scaricarlo.
    import("leaflet").then((L) => {
      if (!vivo || !contenitore.current || mappa.current) return;

      istanza = L.map(contenitore.current, {
        center: [PARTENZA.lat, PARTENZA.lng],
        zoom: PARTENZA.zoom,
        // Lo scorrimento della pagina non deve trasformarsi in uno zoom
        // quando il puntatore passa sopra la mappa per caso.
        scrollWheelZoom: false
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(istanza);

      istanza.on("click", (e) => {
        cambia.current?.({ latitudine: e.latlng.lat, longitudine: e.latlng.lng });
      });

      mappa.current = istanza;
      segnaposto.current = { L, marker: null };

      // La mappa nasce spesso dentro a un riquadro che sta ancora
      // assestandosi: senza questo, metà tessere restano grigie.
      setTimeout(() => istanza.invalidateSize(), 60);
    });

    return () => {
      vivo = false;
      mappa.current?.remove();
      mappa.current = null;
      segnaposto.current = null;
    };
  }, []);

  /* ---------- Il segnaposto segue le coordinate ---------- */

  useEffect(() => {
    const stato = segnaposto.current;
    if (!mappa.current || !stato) return;

    if (!haPunto) {
      if (stato.marker) {
        stato.marker.remove();
        stato.marker = null;
      }
      return;
    }

    const posizione = [latitudine, longitudine];

    if (!stato.marker) {
      // divIcon e non l'icona predefinita: quella di Leaflet è un'immagine
      // caricata per percorso relativo, che dopo la compilazione non si
      // trova più e lascia il segnaposto invisibile.
      const icona = stato.L.divIcon({
        className: "slg-segnaposto",
        html: '<span class="slg-segnaposto-punta"></span>',
        iconSize: [24, 24],
        iconAnchor: [12, 24]
      });

      stato.marker = stato.L
        .marker(posizione, { icon: icona, draggable: !disabilitato })
        .addTo(mappa.current);

      stato.marker.on("dragend", (e) => {
        const p = e.target.getLatLng();
        cambia.current?.({ latitudine: p.lat, longitudine: p.lng });
      });
    } else {
      stato.marker.setLatLng(posizione);
    }

    stato.marker.dragging?.[disabilitato ? "disable" : "enable"]();
  }, [latitudine, longitudine, haPunto, disabilitato]);

  /* ---------- Ricerca ---------- */

  const cerca = useCallback(async () => {
    const testo = (luogo ?? "").trim();
    if (!testo) {
      setErroreRicerca("Scrivi prima dove si gioca.");
      return;
    }

    setCercando(true);
    setErroreRicerca("");
    setRisultati(null);

    try {
      const trovati = await cercaIndirizzo(testo);
      setRisultati(trovati);
      if (trovati.length === 0) {
        setErroreRicerca("Nessun indirizzo trovato. Prova ad aggiungere la città.");
      }
    } catch (err) {
      setErroreRicerca(err.message || "La ricerca non è riuscita.");
    } finally {
      setCercando(false);
    }
  }, [luogo]);

  const scegli = (risultato) => {
    onChange({
      luogo: risultato.nome,
      latitudine: risultato.lat,
      longitudine: risultato.lng
    });
    mappa.current?.setView([risultato.lat, risultato.lng], ZOOM_SCELTA);
    setRisultati(null);
  };

  const centra = () => {
    if (haPunto) mappa.current?.setView([latitudine, longitudine], ZOOM_SCELTA);
  };

  const togliPunto = () => onChange({ latitudine: null, longitudine: null });

  const indirizzoMappa = linkMappa({ luogo, latitudine, longitudine });

  return (
    <div className="slg">
      <label className="adm-field" htmlFor={idCampo}>
        <span className="adm-label">Luogo</span>
        <div className="slg-riga-ricerca">
          <input
            id={idCampo}
            type="text"
            className="adm-input"
            value={luogo ?? ""}
            onChange={(e) => onChange({ luogo: e.target.value })}
            onKeyDown={(e) => {
              // Invio cerca invece di inviare il modulo: qui dentro è quasi
              // sempre quello che si voleva fare.
              if (e.key === "Enter") { e.preventDefault(); cerca(); }
            }}
            placeholder="Es. Campo Le Chiuse, Torino"
            disabled={disabilitato}
          />
          <button
            type="button"
            className="adm-btn adm-btn-secondary"
            onClick={cerca}
            disabled={disabilitato || cercando}
          >
            {cercando ? <FaSpinner className="slg-gira" /> : <FaSearch />}
            <span className="adm-hide-sm">Trova</span>
          </button>
        </div>
      </label>

      {erroreRicerca && <p className="slg-errore">{erroreRicerca}</p>}

      {risultati?.length > 0 && (
        <ul className="slg-risultati">
          {risultati.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" className="slg-risultato" onClick={() => scegli(r)}>
                <FaMapMarkerAlt aria-hidden="true" />
                <span>{r.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Mappa e barra degli strumenti sono un blocco solo, con un bordo
          intorno: prima la mappa galleggiava e sotto c'erano quattro
          collegamenti di testo in fila, che sembravano note a piè di pagina
          invece che i comandi della mappa. */}
      <div className={`slg-blocco ${haPunto ? "ha-punto" : ""}`}>
        <div className="slg-mappa" ref={contenitore} />

        <div className="slg-barra">
          {haPunto ? (
            <>
              <span className="slg-coordinate" title="Coordinate del punto scelto">
                <FaMapMarkerAlt aria-hidden="true" />
                {latitudine.toFixed(5)}, {longitudine.toFixed(5)}
              </span>

              <span className="slg-barra-spazio" />

              <button
                type="button"
                className="slg-azione"
                onClick={centra}
                disabled={disabilitato}
                title="Rimetti il punto al centro della mappa"
              >
                <FaCrosshairs aria-hidden="true" /> <span>Centra</span>
              </button>

              <a
                href={indirizzoMappa}
                target="_blank"
                rel="noreferrer"
                className="slg-azione"
                title="Apri su Google Maps come lo vedrà chi legge il sito"
              >
                <FaExternalLinkAlt aria-hidden="true" /> <span>Prova</span>
              </a>

              <button
                type="button"
                className="slg-azione slg-azione-togli"
                onClick={togliPunto}
                disabled={disabilitato}
                title="Togli il punto: resta solo il testo dell'indirizzo"
              >
                <FaTimes aria-hidden="true" /> <span>Togli</span>
              </button>
            </>
          ) : (
            <p className="slg-istruzioni">
              Premi <strong>Trova</strong> o fai clic sulla mappa per fissare il
              punto. Senza, il collegamento sul sito cercherà su Google il testo
              che hai scritto.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
