// ==============================
// 📦 api.mjs — API Client Ottimizzato per WordPress/React
// ==============================

const WP_API_BASE = "https://polisportivasandonato.org/index.php";
const WP_REST_PATH = "/wp/v2";

// 🔹 Cache in memoria (Singleton pattern)
let cachedPosts = null;
let cachedAuthors = null;

/* =====================================================
   🔹 Recupera tutti i post (Paginazione Automatica)
   ===================================================== */
export async function getAllPosts(perPage = 100) {
  if (cachedPosts) return cachedPosts;

  try {
    // 1. Recupera autori per la mappa (necessario per normalizzare)
    const authors = await getAuthors();
    const authorMap = new Map(authors.map(a => [a.id, a.name]));

    // 2. Costruisci URL per la prima pagina
    const buildUrl = (page) => {
      const url = new URL(WP_API_BASE);
      url.searchParams.set("rest_route", `${WP_REST_PATH}/posts`);
      url.searchParams.set("per_page", perPage);
      url.searchParams.set("page", page);
      url.searchParams.set("_embed", "true");
      return url.toString();
    };

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

    // Attende tutte le richieste (Promise.all è più veloce di allSettled se ci aspettiamo successo, 
    // ma gestiamo l'errore nel catch globale per sicurezza)
    const otherPages = await Promise.all(promises);
    
    // 5. Unifica e Normalizza
    const rawPosts = [firstPosts, ...otherPages].flat();
    
    // La normalizzazione avviene qui una volta sola
    cachedPosts = rawPosts.map(p => normalizePost(p, authorMap));

    return cachedPosts;

  } catch (error) {
    console.error("❌ Errore critico nel recupero post:", error);
    return []; // Fallback array vuoto per non rompere la UI
  }
}

/* =====================================================
   🔹 Recupera Autori
   ===================================================== */
export async function getAuthors() {
  if (cachedAuthors) return cachedAuthors;

  try {
    const url = new URL(WP_API_BASE);
    url.searchParams.set("rest_route", `${WP_REST_PATH}/users`);
    
    const response = await fetch(url.toString());
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
  try {
    const posts = await getAllPosts();
    if (!posts.length) return {};

    // Raggruppa per sport
    const grouped = {};
    
    // Usiamo un singolo ciclo per raggruppare
    for (const post of posts) {
      const category = post.sport; // Già calcolato in normalizePost
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(post);
    }

    // Ordina e taglia
    Object.keys(grouped).forEach(cat => {
      grouped[cat]
        // Ordinamento molto più veloce usando il timestamp numerico o ISO
        .sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO)) 
        .slice(0, 4);
    });

    return grouped;
  } catch (error) {
    console.error("❌ Errore filtraggio notizie:", error);
    return {};
  }
}

/* =====================================================
   🧩 Utility e Normalizzazione
   ===================================================== */

function normalizePost(post, authorMap) {    
  const title = decodeHTML(post.title?.rendered || "");
  
  return {
    id: post.id,
    title: title,
    // Passiamo il limite caratteri a cleanExcerpt
    preview: cleanExcerpt(post.excerpt?.rendered || "", 200),
    image: post._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null,
    sport: detectSport(title),
    author: authorMap.get(post.author) || post._embedded?.author?.[0]?.name || "Staff",
    date: formatDate(post.date),
    dateISO: post.date,
    link: post.link || "",
  };
}

function detectSport(title = "") {
  const t = title.toLowerCase();
  if (t.includes("minivolley")) return "Minivolley";
  if (t.includes("calcio")) return "Calcio";
  if (t.includes("pallavolo") || t.includes("volley")) return "Pallavolo";
  if (t.includes("basket")) return "Basket";
  return "Altro";
}

function cleanExcerpt(html = "", limit = 200) {
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