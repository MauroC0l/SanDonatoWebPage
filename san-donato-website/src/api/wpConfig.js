// ==============================
// Configurazione dell'accesso a WordPress
// ==============================

// Installazione WordPress, sul sottodominio dedicato.
//
// Nota sul percorso: il sottodominio è stato configurato puntando direttamente
// alla cartella "wp", non a quella che la contiene. Di conseguenza WordPress
// risponde alla radice del sottodominio e NON sotto /wp/:
//
//   https://wp.polisportivasandonato.org/index.php        ✅
//   https://wp.polisportivasandonato.org/wp/index.php     ❌ errore 500
//
// Sovrascrivibile con VITE_WP_API_BASE senza toccare il codice.
const DEFAULT_API_BASE = "https://wp.polisportivasandonato.org/index.php";

export const WP_API_BASE = import.meta.env.VITE_WP_API_BASE || DEFAULT_API_BASE;

export const WP_REST_PATH = "/wp/v2";

// Cartella che contiene WordPress: ".../wp/index.php" -> ".../wp/"
const WP_BASE_DIR = WP_API_BASE.replace(/index\.php$/, "");

// Cartella dei file caricati, come compare nelle URL salvate nei post.
// WordPress continua a scriverle sul dominio storico, che oggi porta al sito
// React: vanno riportate sull'indirizzo da cui WordPress risponde davvero.
const LEGACY_UPLOADS = "https://polisportivasandonato.org/wp/wp-content/";
const CURRENT_UPLOADS = `${WP_BASE_DIR}wp-content/`;

/**
 * Costruisce l'URL di una rotta REST.
 * Usa la forma ?rest_route=... invece di /wp-json/, che funziona anche
 * quando i permalink di WordPress non sono configurati.
 */
export function wpUrl(route, params = {}) {
  const url = new URL(WP_API_BASE, window.location.origin);
  url.searchParams.set("rest_route", `${WP_REST_PATH}${route}`);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, value);
  }

  return url.toString();
}

/** Immagine di copertina di un articolo. */
export function wpMediaUrl(url) {
  if (!url || !url.startsWith(LEGACY_UPLOADS)) return url;
  return CURRENT_UPLOADS + url.slice(LEGACY_UPLOADS.length);
}

/**
 * Stessa correzione applicata all'HTML di un articolo.
 *
 * Serve per le immagini inserite dentro al testo: senza questo passaggio
 * comparirebbe la copertina ma non le foto nel corpo dell'articolo, che
 * verrebbero cercate su un indirizzo che risponde con il sito React.
 * Copre anche gli attributi srcset, che contengono più URL per volta.
 *
 * Sono riscritti solo i file caricati (wp-content): i collegamenti ad altre
 * pagine restano intatti, altrimenti manderebbero il lettore su WordPress.
 */
export function wpRewriteMediaUrls(html) {
  if (!html || !html.includes(LEGACY_UPLOADS)) return html;
  return html.split(LEGACY_UPLOADS).join(CURRENT_UPLOADS);
}
