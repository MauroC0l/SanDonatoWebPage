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
  trash: "cestino",
  // "future" non è uno stato in tabella: è una pubblicata la cui data di
  // uscita deve ancora arrivare. Vale solo per filtrare l'elenco.
  future: "programmata"
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

/**
 * @param eSessione  se un 401 significa "la tua sessione è caduta".
 *
 * Vale per tutte le chiamate tranne l'accesso: lì il 401 è la RISPOSTA alla
 * domanda ("email o password non corretti"), non la scadenza di qualcosa.
 * Tradurlo comunque in "Sessione scaduta" faceva comparire, a chi sbagliava
 * la password, un messaggio che parlava di una sessione che non aveva mai
 * aperto.
 */
async function chiedi(percorso, opzioni = {}, { eSessione = true } = {}) {
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

  if (risposta.status === 401 && eSessione) {
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
 * Da come risponde il server a come lo usa il front-end.
 *
 * Era ricopiata in tre punti — /io, accesso, registrazione — e ogni campo
 * nuovo andava aggiunto tre volte: l'immagine del profilo è arrivata
 * proprio mentre due delle tre copie erano già divergenti.
 */
function daUtenteApi(utente) {
  return {
    id: utente.id,
    email: utente.email,
    username: utente.email,
    name: [utente.nome, utente.cognome].filter(Boolean).join(" ") || utente.email,
    role: utente.ruolo,
    stato: utente.stato,
    immagineUrl: utente.immagineUrl ?? null,
    mustChangePassword: !!utente.deveCambiarePassword,
    capabilities: utente.capacita ?? [],
    canPublish: (utente.capacita ?? []).includes("notizie.pubblica")
  };
}

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

  return daUtenteApi(utente);
}

export async function login(email, password, remember = false) {
  const { utente } = await chiedi("/accesso", {
    method: "POST",
    body: JSON.stringify({ email: String(email).trim(), password, ricordami: !!remember })
  }, { eSessione: false });

  return daUtenteApi(utente);
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
  /**
   * "Programmata" non è uno stato del database: è una notizia pubblicata che
   * sul sito non c'è ancora. Il pannello però deve poterla distinguere a
   * colpo d'occhio da una già online, quindi la differenza si calcola qui,
   * una volta sola, invece che in ogni schermata.
   *
   * Scritta come negazione di "è online", e non come "ha una data futura",
   * per dire la stessa identica cosa che dice il filtro sul server: così una
   * notizia non può risultare online qui e programmata là. Il caso che le
   * separa è quello senza data, che non è online e quindi è da uscire.
   */
  const programmata = n.stato === "pubblicata"
    && !(n.pubblicataIl && new Date(n.pubblicataIl).getTime() <= Date.now());

  return {
    id: n.id,
    slug: n.slug,
    title: n.titolo,
    excerpt: n.sommario ?? "",
    content: n.contenuto ?? "",
    sport: n.sport,
    categoria: n.categoria ?? "altro",
    status: programmata ? "future" : (STATO_VERSO_PANNELLO[n.stato] ?? n.stato),
    image: n.copertina || null,
    featuredMediaId: n.copertinaId ?? 0,
    authorName: n.autore,
    // dateISO e non date: è il nome che usano gli elenchi del pannello
    dateISO: n.pubblicataIl,
    pubblicataIl: n.pubblicataIl,
    modified: n.aggiornataIl
  };
}

export async function listPosts({ search = "", status = "", categoria = "", page = 1, perPage = 20 } = {}) {
  const parametri = new URLSearchParams({ pagina: String(page), perPagina: String(perPage) });
  if (search) parametri.set("cerca", search);

  /**
   * Gli stati viaggiano tutti, anche quando sono più di uno.
   *
   * Prima veniva tradotto solo il caso singolo: chiedendo "Bozze", che sono
   * due stati insieme (draft e pending), non partiva alcun filtro e il
   * back-end rispondeva con l'elenco completo. Il filtro sembrava premuto e
   * non filtrava nulla.
   */
  const stati = String(status).split(",").filter(Boolean)
    .map((s) => STATO_VERSO_NOI[s] ?? s);

  if (stati.length) parametri.set("stato", stati.join(","));
  if (categoria) parametri.set("categoria", categoria);

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
  if (dati.categoria !== undefined) corpo.categoria = dati.categoria;
  if (dati.status !== undefined) corpo.stato = STATO_VERSO_NOI[dati.status] ?? dati.status;
  // Il pannello parla ancora di "featuredMediaId", parola di WordPress:
  // la traduzione sta qui, non nei componenti.
  if (dati.featuredMediaId !== undefined) corpo.copertinaId = dati.featuredMediaId || null;
  if (dati.copertinaId !== undefined) corpo.copertinaId = dati.copertinaId;

  // Data di uscita: nel futuro significa programmata. Si manda solo quando
  // chi scrive l'ha scelta, altrimenti il server mette "adesso".
  if (dati.pubblicataIl !== undefined) {
    corpo.pubblicataIl = dati.pubblicataIl ? new Date(dati.pubblicataIl).toISOString() : null;
  }

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
    pubblicataIl: notizia.pubblicataIl ?? null,
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
    pubblicataIl: notizia.pubblicataIl ?? null,
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
/*
 * "cartella" è il prefisso dentro all'archivio (notizie, eventi…),
 * "cartellaId" è la cartella della libreria in cui il file si ritrova.
 * Due cose diverse che si somigliano nel nome: la prima dice dove i byte
 * sono scritti, la seconda dove le persone li cercano.
 */
export async function uploadMedia(file, { title, cartella, cartellaId, tag } = {}) {
  const mime = file.type;
  const byte = file.size;

  const { chiave, urlDiCaricamento } = await chiedi("/admin/media", {
    method: "POST",
    body: JSON.stringify({ fase: "permesso", mime, byte, cartella })
  });

  /*
   * Niente credenziali sul caricamento vero e proprio.
   *
   * Verso R2 l'indirizzo è già firmato e mandare il cookie sarebbe uno
   * sbaglio; in locale l'indirizzo è una nostra rotta sulla stessa
   * origine, e il valore predefinito di fetch — "same-origin" — manda il
   * cookie proprio lì e solo lì. Un caso solo, senza distinguere.
   */
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
      cartellaId: Number.isInteger(cartellaId) ? cartellaId : null,
      tag: tag ?? null,
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
export async function listEventi({ da, a, squadraId, programmati } = {}) {
  const parametri = new URLSearchParams();
  // Il filtro "Programmati" del pannello: quelli non ancora visibili sul sito
  if (programmati) parametri.set("programmati", "1");
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

/** Affida una squadra a un allenatore o a un redattore. */
export async function associaSquadra(utenteId, squadraId) {
  // PUT e non POST: su questo indirizzo POST ora crea una squadra nuova.
  return chiedi("/admin/squadre", {
    method: "PUT",
    body: JSON.stringify({ utenteId, squadraId })
  });
}

export async function creaSquadra(dati) {
  const { squadra } = await chiedi("/admin/squadre", {
    method: "POST",
    body: JSON.stringify(dati)
  });
  return squadra;
}

export async function aggiornaSquadra(id, dati) {
  const { squadra } = await chiedi(`/admin/squadre/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dati)
  });
  return squadra;
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

  return { utente: daUtenteApi(utente), sport };
}

export async function cambiaPassword(attuale, nuova) {
  return chiedi("/cambia-password", {
    method: "POST",
    body: JSON.stringify({ attuale, nuova })
  });
}

/* =====================================================
   Cruscotto: cosa aspetta chi e appena entrato
   ===================================================== */

export async function getCruscotto() {
  const { cruscotto } = await chiedi("/cruscotto");
  return cruscotto;
}

/* =====================================================
   Registro delle attività
   ===================================================== */

export async function listAttivita({ pagina = 1, perPagina = 40, utenteId, tipo, cerca, da, a } = {}) {
  const parametri = new URLSearchParams({
    pagina: String(pagina),
    perPagina: String(perPagina)
  });
  if (utenteId) parametri.set("utenteId", String(utenteId));
  if (tipo) parametri.set("tipo", tipo);
  if (cerca) parametri.set("cerca", cerca);
  if (da) parametri.set("da", new Date(da).toISOString());
  if (a) parametri.set("a", new Date(a).toISOString());

  return chiedi(`/admin/registro?${parametri}`);
}

/* =====================================================
   Atleti: schede, certificati e quote
   ===================================================== */

/**
 * Gli atleti che chi è connesso può vedere.
 *
 * Insieme all'elenco arriva `squadreAmmesse`: null se le vede tutte,
 * altrimenti quali. Serve al pannello per proporre nel filtro solo le
 * squadre che daranno un risultato.
 */
export async function listAtleti({ squadraId } = {}) {
  const parametri = new URLSearchParams();
  if (squadraId) parametri.set("squadraId", String(squadraId));

  const risposta = await chiedi(`/admin/atleti?${parametri}`);
  return {
    atleti: risposta.atleti,
    squadreAmmesse: risposta.squadreAmmesse,
    // false per un allenatore: quote e versamenti non gli arrivano affatto
    conQuote: risposta.conQuote !== false
  };
}

export async function getAtleta(utenteId) {
  const { atleta } = await chiedi(`/admin/atleti/${utenteId}`);
  return atleta;
}

/** Salva la scheda. Se non esisteva, la crea. */
export async function salvaSchedaAtleta(utenteId, dati) {
  const { atleta } = await chiedi(`/admin/atleti/${utenteId}`, {
    method: "PATCH",
    body: JSON.stringify(dati)
  });
  return atleta;
}

/* =====================================================
   Il proprio profilo
   ===================================================== */

/** Tutto quello che il sito sa di chi è connesso, squadre comprese. */
export async function getProfilo() {
  const { profilo } = await chiedi("/profilo");
  return profilo;
}

export async function aggiornaProfilo(dati) {
  const { profilo } = await chiedi("/profilo", {
    method: "PATCH",
    body: JSON.stringify(dati)
  });
  return profilo;
}

/* =====================================================
   La propria iscrizione (area dell'atleta)
   ===================================================== */

/** La propria scheda, con l'elenco di cosa manca ancora. */
export async function getIscrizione() {
  const { iscrizione } = await chiedi("/iscrizione");
  return iscrizione;
}

export async function salvaIscrizione(dati) {
  const { iscrizione } = await chiedi("/iscrizione", {
    method: "PATCH",
    body: JSON.stringify(dati)
  });
  return iscrizione;
}

/**
 * Gli eventi di una squadra, dall'API pubblica.
 *
 * Un atleta non può passare da /api/admin/eventi, che vuole il permesso di
 * gestirli: quello che vede lui è lo stesso calendario che sta sul sito,
 * ristretto alla sua squadra.
 */
export async function eventiDiSquadra(squadraId, { da, a } = {}) {
  const parametri = new URLSearchParams({ squadraId: String(squadraId) });
  if (da) parametri.set("da", new Date(da).toISOString());
  if (a) parametri.set("a", new Date(a).toISOString());

  const { eventi } = await chiedi(`/eventi?${parametri}`);
  return eventi;
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

/* =====================================================
   Libreria dei file
   ===================================================== */

/**
 * I file già caricati, per ritrovarne uno invece di ricaricarlo.
 *
 * Non comprende certificati medici e foto del profilo: il taglio è sul
 * server, in server/media.js, dove c'è scritto anche perché.
 */
export async function listMedia({ pagina = 1, perPagina = 24, cerca, tag, cartellaId, tipo, persona, cestino } = {}) {
  const parametri = new URLSearchParams({
    pagina: String(pagina),
    perPagina: String(perPagina)
  });

  if (cerca) parametri.set("cerca", cerca);
  if (tag) parametri.set("tag", tag);
  if (cartellaId) parametri.set("cartellaId", String(cartellaId));
  if (tipo) parametri.set("tipo", tipo);
  // Solo per chi vede la libreria intera: al resto il server la impone.
  if (persona) parametri.set("persona", String(persona));
  if (cestino) parametri.set("cestino", "1");

  return chiedi(`/admin/media?${parametri}`);
}

/** Un file solo, con il conto di dove è usato. */
export async function getMedia(id) {
  return chiedi(`/admin/media/${id}`);
}

/** Cambia titolo, testo alternativo ed etichette. Il file non si tocca. */
export async function aggiornaMedia(id, dati) {
  const { media } = await chiedi(`/admin/media/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dati)
  });
  return media;
}

/**
 * Mette un file nel cestino, da dove si può ripescare per dieci giorni.
 *
 * Il server rifiuta con 409 se il file è ancora usato da qualche parte: il
 * messaggio dice dove, così si stacca prima da lì. Vale anche per il
 * cestino — un file cestinato sparisce dalle pagine lo stesso.
 */
export async function eliminaMedia(id) {
  return chiedi(`/admin/media/${id}`, { method: "DELETE" });
}

/** Lo butta via davvero: riga in tabella e byte nell'archivio. */
export async function eliminaMediaPerSempre(id) {
  return chiedi(`/admin/media/${id}?definitivo=1`, { method: "DELETE" });
}

/** Lo ripesca dal cestino: torna nella cartella in cui stava. */
export async function ripristinaMedia(id) {
  const { media } = await chiedi(`/admin/media/${id}`, {
    method: "POST",
    body: JSON.stringify({ azione: "ripristina" })
  });
  return media;
}

/* ---------- Cartelle della libreria ---------- */

export async function listCartelleMedia() {
  return chiedi("/admin/media/cartelle");
}

export async function creaCartellaMedia(nome) {
  const { cartella } = await chiedi("/admin/media/cartelle", {
    method: "POST",
    body: JSON.stringify({ nome })
  });
  return cartella;
}

export async function rinominaCartellaMedia(id, nome) {
  const { cartella } = await chiedi(`/admin/media/cartelle/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ nome })
  });
  return cartella;
}

/**
 * Cancella una cartella.
 *
 * Di suo i file restano e perdono solo la cartella. Con "conFile" finiscono
 * nel cestino, dove restano dieci giorni: cancellare una cartella piena per
 * sbaglio non deve essere un gesto irreparabile.
 */
export async function eliminaCartellaMedia(id, { conFile = false } = {}) {
  const coda = conFile ? "?conFile=1" : "";
  return chiedi(`/admin/media/cartelle/${id}${coda}`, { method: "DELETE" });
}

/**
 * Rimette in coda una richiesta di iscrizione respinta.
 *
 * Serve perché un rifiuto altrimenti è definitivo: quella persona non può
 * registrarsi di nuovo — l'email risulta già presa — e resta con un account
 * che non porta da nessuna parte.
 */
export async function riapriRichiesta(id) {
  return chiedi("/admin/iscrizioni", {
    method: "PATCH",
    body: JSON.stringify({ id })
  });
}

/**
 * Approva o respinge il certificato medico di un atleta.
 *
 * Lo fa chi ha "certificato.registra": segreteria e amministratori. Per
 * respingere serve un motivo — "respinto" e basta costringe la famiglia a
 * telefonare per sapere cosa rifare.
 */
export async function validaCertificato(utenteId, { approva, motivo } = {}) {
  const { atleta } = await chiedi(`/admin/atleti/${utenteId}/certificato`, {
    method: "POST",
    body: JSON.stringify({ approva, motivo })
  });
  return atleta;
}

/* =====================================================
   Tariffe della stagione
   ===================================================== */

/**
 * Le tariffe: prima iscrizione, rinnovo, sconto fratello.
 *
 * Le legge chi assegna le quote — gli servono per sceglierle — ma le decide
 * solo chi amministra: quanto si paga è una delibera, dire chi paga quanto è
 * amministrazione.
 */
export async function listTariffe() {
  const { tariffe } = await chiedi("/admin/quote");
  return tariffe;
}

export async function creaTariffa(dati) {
  const { tariffa } = await chiedi("/admin/quote", {
    method: "POST",
    body: JSON.stringify(dati)
  });
  return tariffa;
}

export async function aggiornaTariffa(id, dati) {
  const { tariffa } = await chiedi(`/admin/quote/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dati)
  });
  return tariffa;
}

/** Rifiuta con 409 se qualche atleta ce l'ha: in quel caso si spegne. */
export async function eliminaTariffa(id) {
  return chiedi(`/admin/quote/${id}`, { method: "DELETE" });
}
