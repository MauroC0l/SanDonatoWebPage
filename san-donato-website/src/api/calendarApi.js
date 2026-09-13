// ==============================
// Calendario ed eventi, dal nostro back-end.
//
// Prima questo file interrogava venti calendari Google, uno per squadra,
// con la chiave API esposta nel bundle del browser, e ricostruiva risultati
// e marcatori leggendo righe di testo dentro alla descrizione degli eventi
// ("Partita: 3 - 1", "Marcatori: Rossi, Bianchi").
//
// Ora gli eventi stanno nel nostro database: una richiesta sola, i dati
// sportivi sono colonne, e l'elenco delle squadre non è più scritto nel
// codice ma in tabella.
//
// La forma degli oggetti restituiti è rimasta quella di prima, così i
// componenti che li usano non sono stati riscritti.
// ==============================

const BASE = "/api";

// Le squadre cambiano di rado: si chiedono una volta per sessione
let cacheSquadre = null;

async function chiedi(percorso) {
  const risposta = await fetch(`${BASE}${percorso}`, {
    headers: { Accept: "application/json" }
  });

  if (!risposta.ok) {
    const dettaglio = await risposta.json().catch(() => ({}));
    throw new Error(dettaglio.errore || `Errore HTTP ${risposta.status}`);
  }
  return risposta.json();
}

/* =====================================================
   Squadre (le "categorie" dei filtri)
   ===================================================== */

async function categorie() {
  if (cacheSquadre) return cacheSquadre;

  const { squadre } = await chiedi("/squadre");

  cacheSquadre = squadre.map((s) => ({
    id: s.nome,
    label: s.nome,
    color: s.colore,
    cssVar: s.cssVar,
    sport: s.sport
  }));

  return cacheSquadre;
}

export function svuotaCacheCalendario() {
  cacheSquadre = null;
}

/* =====================================================
   Normalizzazione
   ===================================================== */

/** Dalla forma del back-end a quella che usano i componenti. */
function normalizza(e) {
  return {
    id: e.id,
    title: e.titolo,
    start: new Date(e.inizio),
    end: e.fine ? new Date(e.fine) : new Date(e.inizio),
    location: e.luogo || "",
    description: e.descrizione || "",

    // Erano dedotti da un testo libero, ora arrivano già separati
    result: e.risultato || null,
    scorers: e.marcatori ?? [],
    partials: e.parziali || null,
    diretta: e.diretta || null,

    category: e.squadra,
    color: e.colore,
    cssVar: e.cssVar,
    sport: e.sport,
    tipo: e.tipo,
    avversario: e.avversario || null,

    // Un evento "tutto il giorno" non ha un'ora da mostrare
    hasTime: !e.tuttoIlGiorno
  };
}

async function eventiTra(inizio, fine) {
  const parametri = new URLSearchParams({
    da: inizio.toISOString(),
    a: fine.toISOString(),
    limite: "1000"
  });

  const [{ eventi }, elencoCategorie] = await Promise.all([
    chiedi(`/eventi?${parametri}`),
    categorie()
  ]);

  return {
    events: eventi.map(normalizza).sort((a, b) => a.start - b.start),
    categories: elencoCategorie
  };
}

/* =====================================================
   API pubbliche
   ===================================================== */

/** Intervallo qualsiasi: la pagina del calendario carica mese per mese. */
export async function fetchEventsByRange(start, end) {
  if (!start || !end) return { events: [], categories: [] };

  try {
    return await eventiTra(start, end);
  } catch (errore) {
    console.error("Calendario non caricato:", errore.message);
    return { events: [], categories: [] };
  }
}

/**
 * Eventi per la home: quelli di oggi e quelli che restano nella settimana.
 *
 * Una sola passata da mezzanotte a domenica sera, come prima: erano due
 * richieste su intervalli sovrapposti.
 */
export async function fetchHomeEvents() {
  const adesso = new Date();

  const inizioOggi = new Date(adesso);
  inizioOggi.setHours(0, 0, 0, 0);

  const fineOggi = new Date(adesso);
  fineOggi.setHours(23, 59, 59, 999);

  // getDay(): 0 = domenica
  const giorno = adesso.getDay();
  const domenica = new Date(adesso);
  domenica.setDate(adesso.getDate() + (giorno === 0 ? 0 : 7 - giorno));
  domenica.setHours(23, 59, 59, 999);

  try {
    const { events, categories } = await eventiTra(inizioOggi, domenica);

    return {
      categories,
      // Comprende anche le partite già iniziate oggi
      todayEvents: events.filter((e) => e.start >= inizioOggi && e.start <= fineOggi),
      // Qui invece solo ciò che deve ancora cominciare
      weekEvents: events.filter((e) => e.start >= adesso)
    };
  } catch (errore) {
    console.error("Eventi della home non caricati:", errore.message);
    return { categories: [], todayEvents: [], weekEvents: [] };
  }
}

/**
 * I risultati della settimana in corso, dal lunedì alla domenica.
 *
 * Il filtro "ha un risultato" lo applica il back-end: una partita passata
 * senza punteggio non è un risultato, è un esito che nessuno ha aggiornato.
 */
export async function fetchPastResults() {
  const adesso = new Date();

  const giorno = adesso.getDay();
  const lunedi = new Date(adesso);
  lunedi.setDate(adesso.getDate() - (giorno === 0 ? 6 : giorno - 1));
  lunedi.setHours(0, 0, 0, 0);

  const domenica = new Date(lunedi);
  domenica.setDate(lunedi.getDate() + 6);
  domenica.setHours(23, 59, 59, 999);

  try {
    const { events } = await eventiTra(lunedi, domenica);

    return {
      events: events
        .filter((e) => e.result || e.partials)
        .sort((a, b) => b.start - a.start)
    };
  } catch (errore) {
    console.error("Risultati non caricati:", errore.message);
    return { events: [] };
  }
}
