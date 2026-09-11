// ==============================
// 🔐 adminApi.js — Scrittura su WordPress dall'area riservata
// ==============================
//
// L'area admin non usa l'interfaccia di WordPress: parla direttamente con la
// sua REST API. L'autenticazione avviene con le "Application Password" native
// di WordPress (dal 5.6), cioè password dedicate e revocabili che si generano
// dal profilo utente e non espongono mai la password vera dell'account.

import { wpUrl, wpMediaUrl, wpRewriteMediaUrls } from "./wpConfig";
import { clearPostsCache, cleanExcerpt } from "./API.mjs";

const STORAGE_KEY = "psd_wp_credential";

/* =====================================================
   🔑 Gestione della credenziale
   ===================================================== */

// Copia in memoria: evita di rileggere lo storage a ogni richiesta e
// permette il funzionamento anche se lo storage è bloccato dal browser.
let memoryCredential = null;

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

// Le Application Password di WordPress non scadono da sole: se restassero
// nello storage per sempre, un accesso fatto una volta su un computer
// condiviso resterebbe valido a tempo indeterminato.
const REMEMBER_DAYS = 14;

function readStoredCredential() {
  try {
    const perSession = sessionStorage.getItem(STORAGE_KEY);
    if (perSession) return perSession;

    const persisted = localStorage.getItem(STORAGE_KEY);
    if (!persisted) return null;

    const { credential, expiresAt } = JSON.parse(persisted);
    if (!credential || !expiresAt || Date.now() > expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return credential;
  } catch {
    // Storage non disponibile o contenuto illeggibile
    return null;
  }
}

export function getCredential() {
  if (memoryCredential) return memoryCredential;
  memoryCredential = readStoredCredential();
  return memoryCredential;
}

function storeCredential(credential, remember) {
  memoryCredential = credential;
  try {
    // Di default la sessione muore con la scheda: la credenziale vale come
    // una password, e su un computer condiviso non deve sopravvivere.
    sessionStorage.setItem(STORAGE_KEY, credential);

    if (remember) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        credential,
        expiresAt: Date.now() + REMEMBER_DAYS * 24 * 60 * 60 * 1000
      }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Nessuno storage: resta valida solo la copia in memoria
  }
}

export function clearCredential() {
  memoryCredential = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // niente da fare
  }
}

function authHeaders(extra = {}) {
  const credential = getCredential();
  if (!credential) throw new AuthError("Sessione scaduta. Effettua di nuovo l'accesso.");
  return { Authorization: `Basic ${credential}`, ...extra };
}

export class AuthError extends Error {}

/* =====================================================
   🌐 Helper di richiesta
   ===================================================== */

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error("Impossibile contattare il server. Controlla la connessione.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new AuthError(
      "Credenziali non valide o permessi insufficienti. Effettua di nuovo l'accesso."
    );
  }

  if (!response.ok) {
    // WordPress restituisce { code, message } sugli errori
    let detail = "";
    try {
      const body = await response.json();
      detail = body?.message ? ` ${stripTags(body.message)}` : "";
    } catch {
      // corpo non leggibile
    }
    throw new Error(`Errore ${response.status}.${detail}`);
  }

  return response;
}

function stripTags(html = "") {
  return html.replace(/<[^>]+>/g, "").trim();
}

/* =====================================================
   👤 Autenticazione
   ===================================================== */

/**
 * Verifica la credenziale corrente interrogando WordPress.
 * Restituisce il profilo dell'utente, oppure lancia AuthError.
 */
export async function fetchCurrentUser() {
  const response = await request(wpUrl("/users/me", { context: "edit" }), {
    headers: authHeaders()
  });

  const user = await response.json();
  const capabilities = user.capabilities || {};

  return {
    id: user.id,
    name: user.name,
    username: user.slug,
    email: user.email,
    roles: user.roles || [],
    // I ruoli sono quelli di WordPress: non inventiamo un secondo sistema
    // di permessi che potrebbe divergere da quello vero.
    canPublish: !!capabilities.publish_posts,
    canDeleteOthers: !!capabilities.delete_others_posts,
    canEditOthers: !!capabilities.edit_others_posts,
    isAdmin: !!capabilities.manage_options
  };
}

/**
 * Accesso con nome utente e Application Password.
 * Non memorizza nulla se le credenziali non sono valide.
 */
export async function login(username, applicationPassword, remember = false) {
  // Le Application Password si copiano da WordPress con gli spazi:
  // WordPress li ignora, ma li togliamo per evitare falsi errori.
  const password = applicationPassword.replace(/\s+/g, "");
  const credential = toBase64(`${username.trim()}:${password}`);

  const previous = memoryCredential;
  memoryCredential = credential;

  try {
    const user = await fetchCurrentUser();
    storeCredential(credential, remember);
    return user;
  } catch (error) {
    memoryCredential = previous;
    throw error;
  }
}

export function logout() {
  clearCredential();
}

/* =====================================================
   📝 Post
   ===================================================== */

const EDIT_FIELDS = "id,date,modified,status,title,content,excerpt,featured_media,author,link";

/**
 * Elenco per l'area admin: comprende bozze e cestino, che l'API pubblica
 * non restituisce.
 */
export async function listPosts({ search = "", status = "publish,draft,pending", page = 1, perPage = 20 } = {}) {
  const response = await request(
    wpUrl("/posts", {
      context: "edit",
      status,
      search,
      page,
      per_page: perPage,
      orderby: "date",
      order: "desc",
      _embed: "true",
      _fields: `${EDIT_FIELDS},_links,_embedded`
    }),
    { headers: authHeaders() }
  );

  const raw = await response.json();

  return {
    posts: raw.map(toAdminPost),
    totalPages: parseInt(response.headers.get("X-WP-TotalPages") || "1", 10),
    total: parseInt(response.headers.get("X-WP-Total") || "0", 10)
  };
}

export async function getPost(id) {
  const response = await request(
    wpUrl(`/posts/${id}`, { context: "edit", _embed: "true" }),
    { headers: authHeaders() }
  );
  return toAdminPost(await response.json());
}

/**
 * In contesto "edit" WordPress restituisce sia .rendered sia .raw:
 * per l'editor serve .raw, cioè il contenuto come è stato salvato.
 */
function toAdminPost(post) {
  return {
    id: post.id,
    title: post.title?.raw ?? stripTags(post.title?.rendered || ""),
    content: wpRewriteMediaUrls(post.content?.raw ?? post.content?.rendered ?? ""),
    excerpt: post.excerpt?.raw ?? cleanExcerpt(post.excerpt?.rendered || "", 300),
    status: post.status,
    dateISO: post.date,
    modifiedISO: post.modified,
    featuredMediaId: post.featured_media || 0,
    image: wpMediaUrl(post._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null),
    authorId: post.author,
    authorName: post._embedded?.author?.[0]?.name || "",
    link: post.link || ""
  };
}

function buildPayload({ title, content, excerpt, status, featuredMediaId }) {
  const payload = { title, content, excerpt, status };
  // 0 è un valore valido: significa "nessuna immagine in evidenza"
  if (featuredMediaId !== undefined && featuredMediaId !== null) {
    payload.featured_media = featuredMediaId;
  }
  return payload;
}

export async function createPost(data) {
  const response = await request(wpUrl("/posts"), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(buildPayload(data))
  });

  clearPostsCache();
  return toAdminPost(await response.json());
}

export async function updatePost(id, data) {
  const response = await request(wpUrl(`/posts/${id}`), {
    method: "POST", // WordPress accetta POST anche per gli aggiornamenti
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(buildPayload(data))
  });

  clearPostsCache();
  return toAdminPost(await response.json());
}

/**
 * Sposta nel cestino di WordPress: recuperabile.
 * La cancellazione definitiva richiede force=true e resta volutamente fuori
 * dall'area admin, per non trasformare un click distratto in una perdita.
 */
export async function trashPost(id) {
  await request(wpUrl(`/posts/${id}`), {
    method: "DELETE",
    headers: authHeaders()
  });

  clearPostsCache();
}

/* =====================================================
   🖼 Immagini
   ===================================================== */

/**
 * Carica un file nella libreria media di WordPress.
 * Il nome file viene ripulito: WordPress rifiuta caratteri non ASCII.
 */
export async function uploadMedia(file, { title } = {}) {
  const safeName = buildSafeFileName(file.name || "immagine.jpg");

  const response = await request(wpUrl("/media"), {
    method: "POST",
    headers: authHeaders({
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Content-Type": file.type || "application/octet-stream"
    }),
    body: file
  });

  const media = await response.json();

  // Il titolo alternativo aiuta l'accessibilità e la ricerca interna
  if (title) {
    try {
      await request(wpUrl(`/media/${media.id}`), {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ title, alt_text: title })
      });
    } catch {
      // Non bloccante: l'immagine è comunque caricata
    }
  }

  return {
    id: media.id,
    url: wpMediaUrl(media.source_url),
    rawUrl: media.source_url
  };
}

function buildSafeFileName(name) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "jpg";

  const cleanBase = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // toglie gli accenti
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "immagine";

  const cleanExt = /^[a-z0-9]{2,5}$/.test(ext) ? ext : "jpg";
  return `${cleanBase}-${Date.now()}.${cleanExt}`;
}

