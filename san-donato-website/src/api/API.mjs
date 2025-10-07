// ==============================
// 📦 api.mjs — Funzioni per comunicare con WordPress
// ==============================

const WP_BASE_URL = "https://polisportivasandonato.org/index.php?rest_route=/wp/v2";

/**
 * 🔹 Recupera tutti i post dal backend WordPress
 * @param {number} perPage - Post per pagina
 * @returns {Promise<Array>} Lista post normalizzata
 */
export async function getAllPosts(perPage = 100) {
  try {
    let allPosts = [];
    let page = 1;
    let totalPages = 1;

    const authors = await getAuthors();
    const authorMap = Object.fromEntries(authors.map(a => [a.id, a.name]));

    do {
      const url = `${WP_BASE_URL}/posts&per_page=${perPage}&page=${page}&_embed`;
      const response = await fetch(url);

      if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);

      const posts = await response.json();
      if (!Array.isArray(posts)) {
        console.error("❌ API non ha restituito un array:", posts);
        return [];
      }

      totalPages = parseInt(response.headers.get("X-WP-TotalPages") || "1", 10);

      // ✅ Normalizza tutti i post
      const normalized = posts.map(p => normalizePost(p, authorMap));

      allPosts = allPosts.concat(normalized);
      page++;
    } while (page <= totalPages);

    return allPosts;
  } catch (error) {
    console.error("❌ Errore recupero post:", error);
    return [];
  }
}

/**
 * 🔹 Recupera tutti gli autori
 * @returns {Promise<Array<{id: number, name: string}>>}
 */
export async function getAuthors() {
  try {
    const response = await fetch(`${WP_BASE_URL}/users`);
    if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
    const authors = await response.json();

    return authors.map(a => ({ id: a.id, name: a.name }));
  } catch (error) {
    console.error("❌ Errore recupero autori:", error);
    return [];
  }
}

/* =====================================================
   🧩 Funzioni di supporto per la normalizzazione
   ===================================================== */

/**
 * 🔧 Normalizza un singolo post WordPress
 */
function normalizePost(post, authorMap) {
  const title = decodeHTML(post.title?.rendered || "");
  const excerpt = cleanExcerpt(post.excerpt?.rendered || "");
  const content = post.content?.rendered || "";
  const sport = detectSport(title);
  const image = post._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null;
  const author = authorMap[post.author] || post._embedded?.author?.[0]?.name || "Staff";
  const date = formatDate(post.date);

  return {
    id: post.id,
    title,
    preview: excerpt,
    content,
    image,
    sport,
    author,
    date,
  };
}

/**
 * 🏷️ Rileva sport dal titolo
 */
function detectSport(title = "") {
  const t = title.toLowerCase();
  if (t.includes("calcio")) return "Calcio";
  if (t.includes("pallavolo")) return "Pallavolo";
  if (t.includes("basket")) return "Basket";
  if (t.includes("minivolley")) return "Minivolley";
  return "Altro";
}

/**
 * 🧹 Rimuove tag HTML e pulisce il testo estratto
 */
function cleanExcerpt(html) {
  const text = html.replace(/<[^>]*>/g, "").trim();
  return text.length > 200 ? text.slice(0, 197) + "..." : text;
}

/**
 * 🗓️ Formatta la data in formato gg/mm/aaaa
 */
function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * 🔠 Decodifica entità HTML (es. `&amp;` → `&`)
 */
function decodeHTML(html) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}
