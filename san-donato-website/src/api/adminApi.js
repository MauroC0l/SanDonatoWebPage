// ==============================
// Area riservata — dialogo con il nostro back-end.
//
// Prima questo file parlava con la REST API di WordPress usando le
// Application Password in Basic auth, memorizzate nel browser. Ora l'accesso
// avviene con email e password e la sessione vive in un cookie httpOnly:
// il JavaScript di pagina non può leggerla, quindi una falla XSS non
// consegna più le credenziali a nessuno.
//
// I nomi delle funzioni sono rimasti quelli di prima, così i componenti del
// pannello non sono stati riscritti. La traduzione fra il vocabolario di
// WordPress ("draft", "publish", "pending") e il nostro ("bozza",
// "pubblicata", "in_revisione") avviene qui dentro.
// ==============================

const BASE = "/api";

/* =====================================================
   Vocabolario
   ===================================================== */

const STATO_VERSO_NOI = {
  draft: "bozza",
  pending: "in_revisione",
  publish: "pubblicata",
  trash: "cestino"
};

const STATO_VERSO_PANNELLO = {
  bozza: "draft",
  in_revisione: "pending",
  pubblicata: "publish",
  cestino: "trash"
};

/* =====================================================
   Errori
   ===================================================== */

/** Sessione assente o scaduta: il pannello reagisce riportando al login. */
export class AuthError extends Error {}

async function chiedi(percorso, opzioni = {}) {
  const risposta = await fetch(`${BASE}${percorso}`, {
    // Il cookie di sessione viaggia da solo, ma solo se lo chiediamo
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(opzioni.body ? { "Content-Type": "application/json" } : {}),
      ...opzioni.headers
    },
    ...opzioni
  });

  if (risposta.status === 401) {
    throw new AuthError("Sessione scaduta. Effettua di nuovo l'accesso.");
  }

  const dati = await risposta.json().catch(() => ({}));

  if (!risposta.ok) {
    throw new Error(dati.errore || `Errore ${risposta.status}`);
  }
  return dati;
}

/* =====================================================
   Sessione
   ===================================================== */

/**
 * Chi è connesso adesso.
 *
 * Prima esisteva getCredential(), che leggeva la credenziale dal browser.
 * Ora la sessione è un cookie che il JavaScript non vede: l'unico modo di
 * sapere se c'è è chiederlo al server.
 */
export async function fetchCurrentUser() {
  const { utente } = await chiedi("/io");
  if (!utente) return null;

  return {
    id: utente.id,
    email: utente.email,
    username: utente.email,
    name: [utente.nome, utente.cognome].filter(Boolean).join(" ") || utente.email,
    role: utente.ruolo,
    capabilities: utente.capacita ?? [],
    canPublish: (utente.capacita ?? []).includes("notizie.pubblica")
  };
}

export async function login(email, password, remember = false) {
  const { utente } = await chiedi("/accesso", {
    method: "POST",
    body: JSON.stringify({ email: String(email).trim(), password, ricordami: !!remember })
  });

  return {
    id: utente.id,
    email: utente.email,
    username: utente.email,
    name: [utente.nome, utente.cognome].filter(Boolean).join(" ") || utente.email,
    role: utente.ruolo,
    capabilities: utente.capacita ?? [],
    canPublish: (utente.capacita ?? []).includes("notizie.pubblica")
  };
}

export async function logout() {
  try {
    await chiedi("/uscita", { method: "POST" });
  } catch {
    // Se la sessione era già caduta, l'uscita è comunque riuscita
  }
}

/* =====================================================
   Notizie
   ===================================================== */

function versoPannello(n) {
  return {
    id: n.id,
    slug: n.slug,
    title: n.titolo,
    excerpt: n.sommario ?? "",
    content: n.contenuto ?? "",
    sport: n.sport,
    status: STATO_VERSO_PANNELLO[n.stato] ?? n.stato,
    image: n.copertina || null,
    featuredMediaId: n.copertinaId ?? 0,
    author: n.autore,
    date: n.pubblicataIl,
    modified: n.aggiornataIl
  };
}

export async function listPosts({ search = "", status = "", page = 1, perPage = 20 } = {}) {
  const parametri = new URLSearchParams({ pagina: String(page), perPagina: String(perPage) });
  if (search) parametri.set("cerca", search);

  // Il pannello chiede più stati insieme ("publish,draft,pending") per dire
  // "tutte tranne il cestino": è già il comportamento predefinito del
  // back-end, quindi si traduce solo il caso di uno stato singolo.
  const stati = String(status).split(",").filter(Boolean);
  if (stati.length === 1) {
    parametri.set("stato", STATO_VERSO_NOI[stati[0]] ?? stati[0]);
  }

  const risultato = await chiedi(`/admin/notizie?${parametri}`);

  return {
    posts: risultato.notizie.map(versoPannello),
    total: risultato.totale,
    totalPages: risultato.pagine
  };
}

export async function getPost(id) {
  const { notizia } = await chiedi(`/admin/notizie/${id}`);
  return versoPannello(notizia);
}

function versoBackend(dati) {
  const corpo = {};

  if (dati.title !== undefined) corpo.titolo = dati.title;
  if (dati.content !== undefined) corpo.contenuto = dati.content;
  if (dati.excerpt !== undefined) corpo.sommario = dati.excerpt;
  if (dati.sport !== undefined) corpo.sport = dati.sport;
  if (dati.status !== undefined) corpo.stato = STATO_VERSO_NOI[dati.status] ?? dati.status;
  // Il pannello parla ancora di "featuredMediaId", parola di WordPress:
  // la traduzione sta qui, non nei componenti.
  if (dati.featuredMediaId !== undefined) corpo.copertinaId = dati.featuredMediaId || null;
  if (dati.copertinaId !== undefined) corpo.copertinaId = dati.copertinaId;

  return corpo;
}

export async function createPost(dati) {
  const { notizia, inviataInRevisione } = await chiedi("/admin/notizie", {
    method: "POST",
    body: JSON.stringify(versoBackend(dati))
  });

  return {
    id: notizia.id,
    slug: notizia.slug,
    status: STATO_VERSO_PANNELLO[notizia.stato] ?? notizia.stato,
    inviataInRevisione
  };
}

export async function updatePost(id, dati) {
  const { notizia, inviataInRevisione } = await chiedi(`/admin/notizie/${id}`, {
    method: "PATCH",
    body: JSON.stringify(versoBackend(dati))
  });

  return {
    id: notizia.id,
    slug: notizia.slug,
    status: STATO_VERSO_PANNELLO[notizia.stato] ?? notizia.stato,
    inviataInRevisione
  };
}

/** Sposta nel cestino. Non cancella: si recupera rimettendola in bozza. */
export async function trashPost(id) {
  const { notizia } = await chiedi(`/admin/notizie/${id}`, { method: "DELETE" });
  return { id: notizia.id, status: STATO_VERSO_PANNELLO[notizia.stato] };
}

/* =====================================================
   Media
   ===================================================== */

/** Larghezza e altezza di un'immagine, per salvarle insieme al file. */
async function misura(file) {
  if (!file.type?.startsWith("image/")) return {};

  try {
    const immagine = await createImageBitmap(file);
    const misure = { larghezza: immagine.width, altezza: immagine.height };
    immagine.close();
    return misure;
  } catch {
    // Le misure sono un di più: se il browser non ce la fa, si prosegue
    return {};
  }
}

/**
 * Caricamento di un'immagine di copertina, in due tempi.
 *
 * Il file non passa dal nostro server: si chiede un permesso di scrittura a
 * scadenza breve e lo si carica direttamente nell'archivio. Così un video di
 * una partita non sbatte contro il limite di corpo di una funzione
 * serverless, e i byte non attraversano il nostro codice.
 *
 * La registrazione avviene solo dopo che il caricamento è andato a buon
 * fine: in tabella non finiscono file che non esistono.
 */
export async function uploadMedia(file, { title } = {}) {
  const mime = file.type;
  const byte = file.size;

  const { chiave, urlDiCaricamento } = await chiedi("/admin/media", {
    method: "POST",
    body: JSON.stringify({ fase: "permesso", mime, byte })
  });

  const caricamento = await fetch(urlDiCaricamento, {
    method: "PUT",
    headers: { "Content-Type": mime },
    body: file
  });

  if (!caricamento.ok) {
    throw new Error(`Caricamento del file non riuscito (${caricamento.status}).`);
  }

  const misure = await misura(file);

  const { media } = await chiedi("/admin/media", {
    method: "POST",
    body: JSON.stringify({
      fase: "registra",
      chiave, mime, byte,
      titolo: title || null,
      ...misure
    })
  });

  return { id: media.id, url: media.url };
}
