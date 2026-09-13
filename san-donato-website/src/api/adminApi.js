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
    stato: utente.stato,
    mustChangePassword: !!utente.deveCambiarePassword,
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
    stato: utente.stato,
    mustChangePassword: !!utente.deveCambiarePassword,
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

/* =====================================================
   Squadre ed eventi
   ===================================================== */

/** Le squadre, per i menu a tendina. */
export async function listSquadre() {
  const { squadre } = await chiedi("/squadre");
  return squadre;
}

/**
 * Gli eventi che questa persona può gestire.
 *
 * Il back-end restituisce anche `squadreAmmesse`: null se le gestisce
 * tutte, altrimenti l'elenco. Serve al pannello per proporre solo le
 * squadre giuste nel modulo di inserimento.
 */
export async function listEventi({ da, a, squadraId } = {}) {
  const parametri = new URLSearchParams();
  if (da) parametri.set("da", new Date(da).toISOString());
  if (a) parametri.set("a", new Date(a).toISOString());
  if (squadraId) parametri.set("squadraId", String(squadraId));

  const risposta = await chiedi(`/admin/eventi?${parametri}`);
  return { eventi: risposta.eventi, squadreAmmesse: risposta.squadreAmmesse };
}

export async function getEvento(id) {
  const { evento } = await chiedi(`/admin/eventi/${id}`);
  return evento;
}

export async function createEvento(dati) {
  const { evento } = await chiedi("/admin/eventi", {
    method: "POST",
    body: JSON.stringify(dati)
  });
  return evento;
}

export async function updateEvento(id, dati) {
  const { evento } = await chiedi(`/admin/eventi/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dati)
  });
  return evento;
}

/** Elimina davvero: un evento sbagliato nel calendario va tolto, non archiviato. */
export async function deleteEvento(id) {
  return chiedi(`/admin/eventi/${id}`, { method: "DELETE" });
}

/* ---------- Foto e video di un evento ---------- */

export async function listMediaEvento(eventoId) {
  const { media } = await chiedi(`/admin/eventi/${eventoId}/media`);
  return media;
}

export async function collegaMediaEvento(eventoId, mediaId) {
  const { media } = await chiedi(`/admin/eventi/${eventoId}/media`, {
    method: "POST",
    body: JSON.stringify({ mediaId })
  });
  return media;
}

export async function scollegaMediaEvento(eventoId, mediaId) {
  const { media } = await chiedi(`/admin/eventi/${eventoId}/media?mediaId=${mediaId}`, {
    method: "DELETE"
  });
  return media;
}

/* =====================================================
   Amministrazione: squadre e persone
   ===================================================== */

/** Le squadre con chi le gestisce. Solo per gli amministratori. */
export async function listSquadreConGestori() {
  const { squadre } = await chiedi("/admin/squadre");
  return squadre;
}

export async function associaSquadra(utenteId, squadraId) {
  return chiedi("/admin/squadre", {
    method: "POST",
    body: JSON.stringify({ utenteId, squadraId })
  });
}

export async function dissociaSquadra(utenteId, squadraId) {
  return chiedi(`/admin/squadre?utenteId=${utenteId}&squadraId=${squadraId}`, {
    method: "DELETE"
  });
}

export async function listUtenti() {
  const { utenti } = await chiedi("/admin/utenti");
  return utenti;
}

export async function createUtente(dati) {
  const { utente } = await chiedi("/admin/utenti", {
    method: "POST",
    body: JSON.stringify(dati)
  });
  return utente;
}

export async function updateUtente(dati) {
  const { utente } = await chiedi("/admin/utenti", {
    method: "PATCH",
    body: JSON.stringify(dati)
  });
  return utente;
}

/* =====================================================
   Registrazione e password
   ===================================================== */

/**
 * Registrazione di un atleta.
 *
 * Si sceglie lo SPORT, non la squadra. L'account resta in attesa finché
 * l'allenatore o la segreteria non lo assegnano a una squadra vera.
 */
export async function registrati(dati) {
  const { utente, sport } = await chiedi("/registrazione", {
    method: "POST",
    body: JSON.stringify(dati)
  });

  return {
    utente: {
      id: utente.id,
      email: utente.email,
      username: utente.email,
      name: [utente.nome, utente.cognome].filter(Boolean).join(" ") || utente.email,
      role: utente.ruolo,
      stato: utente.stato,
      capabilities: utente.capacita ?? [],
      canPublish: false,
      mustChangePassword: false
    },
    sport
  };
}

export async function cambiaPassword(attuale, nuova) {
  return chiedi("/cambia-password", {
    method: "POST",
    body: JSON.stringify({ attuale, nuova })
  });
}

/* =====================================================
   Richieste di appartenenza alle squadre
   ===================================================== */

export async function listIscrizioni({ tutte = false } = {}) {
  // Insieme alle richieste arrivano le squadre fra cui si può scegliere:
  // sono già filtrate su ciò che questa persona può decidere.
  return chiedi(`/admin/iscrizioni${tutte ? "?stato=tutte" : ""}`);
}

/** Accogliere significa assegnare una squadra: senza, il server rifiuta. */
export async function decidiIscrizione({ id, approvata, squadraId, motivo }) {
  return chiedi("/admin/iscrizioni", {
    method: "POST",
    body: JSON.stringify({ id, approvata, squadraId, motivo })
  });
}
