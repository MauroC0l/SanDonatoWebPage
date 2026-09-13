// ==============================
// Lettura delle notizie dal nostro back-end.
//
// Prima questo file parlava con la REST API di WordPress. Ora parla con
// /api/notizie, sulla stessa origine del sito: niente CORS, niente
// riscrittura degli indirizzi delle immagini a ogni lettura, niente
// deduzione dello sport dal titolo.
//
// La forma degli oggetti restituiti è rimasta identica a prima, così i
// componenti che li usano non sono stati toccati.
// ==============================

const BASE = "/api";

// Cache in memoria: la stessa pagina non richiede due volte le stesse cose
let cacheElenco = null;
let cachePerSport = null;

/**
 * Svuota la cache. Va chiamata dopo ogni scrittura dall'area riservata,
 * altrimenti il sito continuerebbe a mostrare la versione precedente
 * finché l'utente non ricarica la pagina.
 */
export function clearPostsCache() {
  cacheElenco = null;
  cachePerSport = null;
}

/* =====================================================
   Normalizzazione
   ===================================================== */

/** Dalla forma del nostro back-end a quella che usano i componenti. */
export function normalizePost(n) {
  return {
    id: n.id,
    wpId: n.wpId ?? null,
    slug: n.slug,
    title: n.titolo,
    preview: n.sommario || "",
    content: n.contenuto ?? "",
    image: n.copertina || null,
    imageAlt: n.copertinaAlt || "",
    sport: n.sport,
    author: n.autore || "Staff",
    date: formatDate(n.pubblicataIl),
    dateISO: n.pubblicataIl,
    status: n.stato
  };
}

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
   Elenco completo
   ===================================================== */

/**
 * Tutte le notizie pubblicate.
 *
 * La pagina /news filtra e impagina lato browser, quindi le vuole tutte.
 * Il contenuto completo non viene scaricato: serve solo nella pagina di
 * dettaglio, e per 97 articoli sarebbe qualche centinaio di kilobyte
 * trasferiti per niente.
 */
export async function getAllPosts() {
  if (cacheElenco) return cacheElenco;

  const tutte = [];
  let pagina = 1;
  let pagine;

  do {
    const risultato = await chiedi(`/notizie?pagina=${pagina}&perPagina=50`);
    tutte.push(...risultato.notizie.map(normalizePost));
    pagine = risultato.pagine;
    pagina++;
  } while (pagina <= pagine);

  cacheElenco = tutte;
  return tutte;
}

/* =====================================================
   Ultime notizie per sport
   ===================================================== */

/**
 * Le ultime notizie di ogni disciplina, per la home.
 *
 * Una sola richiesta al posto dello scaricamento dell'intero archivio:
 * prima la home caricava tutti gli articoli per poi tenerne quattro per
 * sport e buttare il resto.
 */
export async function getLatestPostsByCategory() {
  if (cachePerSport) return cachePerSport;

  const { perSport } = await chiedi("/notizie/ultime-per-sport?quante=4");

  const raggruppate = {};
  for (const [sport, notizie] of Object.entries(perSport)) {
    raggruppate[sport] = notizie.map(normalizePost);
  }

  cachePerSport = raggruppate;
  return raggruppate;
}

/* =====================================================
   Singola notizia
   ===================================================== */

/**
 * Una notizia sola, per /news/:id.
 *
 * L'identificativo può essere lo slug o un numero. I collegamenti già
 * condivisi contengono il vecchio id di WordPress: il back-end li risolve
 * lo stesso, quindi non si rompono.
 */
export async function getPostById(identificativo) {
  if (!identificativo) return null;

  try {
    const { notizia } = await chiedi(`/notizie/${encodeURIComponent(identificativo)}`);
    return normalizePost(notizia);
  } catch (errore) {
    console.error(`Notizia ${identificativo} non recuperata:`, errore.message);
    return null;
  }
}

/* =====================================================
   Utilità
   ===================================================== */

export function formatDate(iso) {
  if (!iso) return "";

  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

/**
 * Gli sport previsti, nell'ordine in cui si mostrano.
 *
 * Prima questo elenco non esisteva e lo sport si indovinava dal titolo con
 * detectSport(): una notizia di pallavolo il cui titolo non conteneva la
 * parola "volley" finiva in "Altro". Ora è un campo scelto da chi scrive.
 */
export const SPORT = ["Calcio", "Pallavolo", "Minivolley", "Basket", "Altro"];

/** Testo semplice da un frammento HTML, per anteprime e ricerche. */
export function cleanExcerpt(html = "", limite = 200) {
  const testo = String(html)
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .replace(/<\/\s*(p|div|li|h[1-6]|blockquote)\s*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (testo.length <= limite) return testo;
  const tagliato = testo.slice(0, limite);
  return tagliato.slice(0, tagliato.lastIndexOf(" ")).trimEnd() + "…";
}
