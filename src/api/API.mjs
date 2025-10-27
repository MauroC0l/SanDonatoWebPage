// ==============================
// 📦 api.mjs — Funzioni ottimizzate per comunicare con WordPress
// ==============================

const WP_BASE_URL = "https://polisportivasandonato.org/index.php?rest_route=/wp/v2";

// 🔹 Cache in memoria per evitare richieste duplicate
let cachedPosts = null;
let cachedAuthors = null;

/* =====================================================
   🔹 Recupera tutti i post da WordPress (paginati)
   ===================================================== */
export async function getAllPosts(perPage = 100) {
  if (cachedPosts) return cachedPosts; // ✅ ritorna cache se esistente

  try {
    const authors = await getAuthors();
    const authorMap = Object.fromEntries(authors.map(a => [a.id, a.name]));

    // Prima richiesta per sapere quante pagine ci sono
    const firstUrl = `${WP_BASE_URL}/posts&per_page=${perPage}&page=1&_embed`;
    const firstRes = await fetch(firstUrl);

    if (!firstRes.ok) throw new Error(`HTTP ${firstRes.status}`);
    const firstPosts = await firstRes.json();
    const totalPages = parseInt(firstRes.headers.get("X-WP-TotalPages") || "1", 10);

    // 🔹 Recupera in parallelo le altre pagine (se esistono)
    const fetches = [];
    for (let page = 2; page <= totalPages; page++) {
      fetches.push(fetch(`${WP_BASE_URL}/posts&per_page=${perPage}&page=${page}&_embed`));
    }

    const responses = await Promise.allSettled(fetches);
    const allJson = await Promise.all(
      responses
        .filter(r => r.status === "fulfilled" && r.value.ok)
        .map(r => r.value.json())
    );

    // Combina e normalizza tutti i post
    const allPosts = [firstPosts, ...allJson].flat();
    cachedPosts = allPosts.map(p => normalizePost(p, authorMap)); // ✅ memorizza in cache

    return cachedPosts;
  } catch (error) {
    console.error("❌ Errore recupero post:", error);
    return [];
  }
}

/* =====================================================
   🔹 Recupera tutti gli autori
   ===================================================== */
export async function getAuthors() {
  if (cachedAuthors) return cachedAuthors; // ✅ ritorna cache se esistente

  try {
    const response = await fetch(`${WP_BASE_URL}/users`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const authors = await response.json();
    cachedAuthors = authors.map(a => ({ id: a.id, name: a.name }));

    return cachedAuthors;
  } catch (error) {
    console.error("❌ Errore recupero autori:", error);
    return [];
  }
}

/* =====================================================
   🧩 Supporto — Normalizzazione e utility
   ===================================================== */
function normalizePost(post, authorMap) {    
  return {
    id: post.id,
    title: decodeHTML(post.title?.rendered || ""),
    preview: cleanExcerpt(post.excerpt?.rendered || ""),
    content: post.content?.rendered || "",
    image: post._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null,
    sport: detectSport(post.title?.rendered || ""),
    author: authorMap[post.author] || post._embedded?.author?.[0]?.name || "Staff",
    date: formatDate(post.date),
    link: post.link || "",
  };
}

function detectSport(title = "") {
  const t = title.toLowerCase();
  if (t.includes("calcio")) return "Calcio";
  if (t.includes("pallavolo")) return "Pallavolo";
  if (t.includes("basket")) return "Basket";
  if (t.includes("minivolley")) return "Minivolley";
  return "Altro";
}

function cleanExcerpt(html = "") {
  const text = html.replace(/<[^>]*>/g, "").trim();
  return text.length > 200 ? text.slice(0, 197) + "..." : text;
}

function formatDate(dateString) {
    const date = new Date(dateString);

    if (isNaN(date)) return "Data non valida";

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Mese parte da 0
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}

// ✅ Decodificatore HTML ottimizzato (una sola istanza di <textarea>)
const textDecoder = document.createElement("textarea");
function decodeHTML(html = "") {
  textDecoder.innerHTML = html;
  return textDecoder.value;
}

/* =====================================================
   🔹 Ultime notizie per categoria (4 per sport)
   ===================================================== */
export async function getLatestPostsByCategory() {
  try {
    const posts = await getAllPosts();
    if (!Array.isArray(posts)) return {};

    // Raggruppa per sport
    const grouped = posts.reduce((acc, post) => {
      const category = post.sport || "Altro";
      (acc[category] ||= []).push(post);
      return acc;
    }, {});

    // Ordina per data e limita a 4 per gruppo
    Object.keys(grouped).forEach(cat => {
      grouped[cat] = grouped[cat]
        .sort((a, b) => {
          const dateA = new Date(a.date.split("/").reverse().join("-"));
          const dateB = new Date(b.date.split("/").reverse().join("-"));
          return dateB - dateA;
        })
        .slice(0, 4);
    });

    return grouped;
  } catch (error) {
    console.error("❌ Errore nel recupero delle ultime notizie per categoria:", error);
    return {};
  }
}
