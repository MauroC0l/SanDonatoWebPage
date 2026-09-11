// ==============================
// 📦 api.mjs — API Client Ottimizzato per WordPress/React
// ==============================

import { wpUrl, wpMediaUrl, wpRewriteMediaUrls } from "./wpConfig";

// Quante notizie tenere per ogni sport in getLatestPostsByCategory()
const MAX_POSTS_PER_CATEGORY = 4;

// 🔹 Cache in memoria (Singleton pattern)
let cachedPosts = null;
let cachedAuthors = null;

/**
 * Svuota la cache. Va chiamata dopo ogni scrittura dall'area admin,
 * altrimenti il sito continuerebbe a mostrare la versione precedente
 * finché l'utente non ricarica la pagina.
 */
export function clearPostsCache() {
  cachedPosts = null;
}

/* =====================================================
   🔹 Recupera tutti i post (Paginazione Automatica)
   ===================================================== */
export async function getAllPosts(perPage = 100) {
  if (cachedPosts) return cachedPosts;

  try {
    // 1. Recupera autori per la mappa (necessario per normalizzare)
    const authorMap = await getAuthorMap();

    // 2. Costruisci URL per la prima pagina
    const buildUrl = (page) =>
      wpUrl("/posts", { per_page: perPage, page, _embed: "true" });

    // 3. Fetch Prima Pagina
    const firstRes = await fetch(buildUrl(1));
    if (!firstRes.ok) throw new Error(`Errore HTTP ${firstRes.status} recuperando pagina 1`);

    const firstPosts = await firstRes.json();
    const totalPages = parseInt(firstRes.headers.get("X-WP-TotalPages") || "1", 10);

    // 4. Fetch parallelo delle pagine successive (se esistono)
    const promises = [];
    for (let page = 2; page <= totalPages; page++) {
      promises.push(
        fetch(buildUrl(page)).then(res => {
          if (!res.ok) throw new Error(`Errore Pagina ${page}`);
          return res.json();
        })
      );
    }

    const otherPages = await Promise.all(promises);

    // 5. Unifica e Normalizza
    const rawPosts = [firstPosts, ...otherPages].flat();
    cachedPosts = rawPosts.map(p => normalizePost(p, authorMap));

    return cachedPosts;

  } catch (error) {
    console.error("❌ Errore critico nel recupero post:", error);
    // Rilanciamo: le pagine devono poter distinguere "nessuna notizia"
    // da "non sono riuscito a raggiungere WordPress". Con un array vuoto
    // il sito è rimasto senza notizie per mesi senza segnalare nulla.
    throw new Error(
      "Non è stato possibile caricare le notizie. Il servizio potrebbe essere temporaneamente non raggiungibile.",
      { cause: error }
    );
  }
}

/* =====================================================
   🔹 Recupera Autori
   ===================================================== */
export async function getAuthors() {
  if (cachedAuthors) return cachedAuthors;

  try {
    const response = await fetch(wpUrl("/users"));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    cachedAuthors = data.map(a => ({ id: a.id, name: a.name }));

    return cachedAuthors;
  } catch (error) {
    console.warn("⚠️ Impossibile recuperare autori, uso fallback:", error);
    return [];
  }
}

/* =====================================================
   🔹 Ultime notizie per categoria (Ottimizzata)
   ===================================================== */
export async function getLatestPostsByCategory() {
  const posts = await getAllPosts();
  if (!posts.length) return {};

  // Raggruppa per sport
  const grouped = {};
  for (const post of posts) {
    const category = post.sport; // Già calcolato in normalizePost
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(post);
  }

  // Ordina e taglia (il risultato di slice va riassegnato, non è in-place)
  Object.keys(grouped).forEach(cat => {
    grouped[cat] = grouped[cat]
      .sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO))
      .slice(0, MAX_POSTS_PER_CATEGORY);
  });

  return grouped;
}

/* =====================================================
   🔹 Singolo post per ID
   Serve alle pagine /news/:id aperte da link diretto,
   preferito o refresh, quando non arriva nulla dal router.
   ===================================================== */
export async function getPostById(id) {
  if (!id) return null;

  // Se la lista completa è già in cache evitiamo del tutto la rete
  if (cachedPosts) {
    const cached = cachedPosts.find(p => String(p.id) === String(id));
    if (cached) return cached;
  }

  try {
    const authorMap = await getAuthorMap();

    const response = await fetch(wpUrl(`/posts/${id}`, { _embed: "true" }));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return normalizePost(await response.json(), authorMap);
  } catch (error) {
    console.error(`❌ Errore nel recupero del post ${id}:`, error);
    return null;
  }
}

/* =====================================================
   🧩 Utility e Normalizzazione
   ===================================================== */

async function getAuthorMap() {
  const authors = await getAuthors();
  return new Map(authors.map(a => [a.id, a.name]));
}

export function normalizePost(post, authorMap = new Map()) {
  const title = decodeHTML(post.title?.rendered || "");

  return {
    id: post.id,
    title: title,
    // Questo è il riassunto per la lista (NewsList)
    preview: cleanExcerpt(post.excerpt?.rendered || "", 200),

    // Contenuto completo HTML, con le immagini riportate sull'indirizzo giusto
    content: wpRewriteMediaUrls(post.content?.rendered || ""),

    image: wpMediaUrl(post._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null),
    sport: detectSport(title),
    author: authorMap.get(post.author) || post._embedded?.author?.[0]?.name || "Staff",
    date: formatDate(post.date),
    dateISO: post.date,
    status: post.status || "publish",
    link: post.link || "",
  };
}

/**
 * Lo sport di una notizia è dedotto dal titolo: non esiste un campo dedicato
 * in WordPress. È esportata perché l'editor mostra all'operatore, mentre
 * scrive, in quale sezione del sito finirà la notizia.
 */
export function detectSport(title = "") {
  const t = title.toLowerCase();
  if (t.includes("minivolley")) return "Minivolley";
  if (t.includes("calcio")) return "Calcio";
  if (t.includes("pallavolo") || t.includes("volley")) return "Pallavolo";
  if (t.includes("basket")) return "Basket";
  return "Altro";
}

export function cleanExcerpt(html = "", limit = 200) {
  if (!html) return "";

  let text = html;

  // 1. Rimuovi specifici artefatti di WordPress PRIMA di togliere i tag
  text = text.replace(/\[&hellip;\]/g, ""); // Rimuove "[...]" di WP
  text = text.replace(/&#8230;/g, "");      // Rimuove i tre puntini se sono alla fine

  // 2. Rimuovi tutti i tag HTML (<p>, <br>, ecc.)
  text = text.replace(/<[^>]+>/g, "");

  // 3. Decodifica le entità (es. virgolette, accenti)
  text = decodeHTML(text);

  // 4. Pulisci spazi doppi e trim
  text = text.replace(/\s+/g, " ").trim();

  // 5. Taglia se troppo lungo
  if (text.length > limit) {
    return text.slice(0, limit - 3) + "...";
  }

  return text;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Data non valida";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

// ✅ Decodificatore HTML Sicuro (Senza DOM/Textarea per compatibilità SSR)
function decodeHTML(str) {
  if (!str) return "";

  const map = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',

    // WordPress Specific entities (Smart Quotes & Typography)
    '&#038;': '&',
    '&#039;': "'",
    '&#8211;': '-',  // En dash
    '&#8212;': '—',  // Em dash
    '&#8216;': "'",  // Left single quote
    '&#8217;': "'",  // Right single quote (apostrophe)
    '&#8218;': ",",  // Single low-9 quotation mark
    '&#8220;': '"',  // Left double quote
    '&#8221;': '"',  // Right double quote
    '&#8222;': '"',  // Double low-9 quotation mark
    '&#8230;': '...', // Ellipsis (...)
    '&hellip;': '...',
    '&copy;': '©',
    '&reg;': '®',
    '&euro;': '€'
  };

  return str.replace(/&[#\w]+;/g, (match) => map[match] || match);
}
