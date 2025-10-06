// ==============================
// 📦 api.mjs — Funzioni per comunicare con WordPress
// ==============================

const WP_BASE_URL = "https://polisportivasandonato.org/index.php?rest_route=/wp/v2";

/**
 * 🔹 Recupera tutti i post dal backend WordPress
 * @param {number} perPage - Post per pagina
 * @param {number} page - Numero pagina
 * @returns {Promise<Array>} Lista post
 */
export async function getAllPosts(perPage = 100) {
  try {
    let allPosts = [];
    let page = 1;
    let totalPages = 1;

    const authors = await getAuthors();
    const authorMap = Object.fromEntries(authors.map(a => [a.id, a.name]));

    do {
      const url = `https://polisportivasandonato.org/index.php?rest_route=/wp/v2/posts&per_page=${perPage}&page=${page}&_embed`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Errore HTTP: ${response.status}`);
      }

      const posts = await response.json();

      if (!Array.isArray(posts)) {
        console.error("❌ API non ha restituito un array:", posts);
        return [];
      }

      totalPages = parseInt(response.headers.get("X-WP-TotalPages") || "1", 10);

      const transformedPosts = posts.map(post => ({
        id: post.id,
        preview: post.excerpt?.rendered || "",
        image: post._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null,
        title: post.title?.rendered || "",
        excerpt: post.excerpt?.rendered || "",
        content: post.content?.rendered || "",
        date: post.date || "",
        author: authorMap[post.author] || post._embedded?.author?.[0]?.name || "Staff",
        featured_media: post._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null
      }));

      allPosts = allPosts.concat(transformedPosts);
      page++;
    } while (page <= totalPages);

    return allPosts;

  } catch (error) {
    console.error("❌ Errore recupero post:", error);
    return [];
  }
}


/**
 * Recupera tutti gli autori registrati su WordPress
 * @returns {Promise<Array>} Lista autori { id, name }
 */
export async function getAuthors() {
  try {
    const url = `${WP_BASE_URL}/users`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
    const authors = await response.json();

    return authors.map(author => ({
      id: author.id,
      name: author.name
    }));
  } catch (error) {
    console.error("❌ Errore recupero autori:", error);
    return [];
  }
}
