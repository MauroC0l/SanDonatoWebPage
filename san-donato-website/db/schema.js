/**
 * Schema del database.
 *
 * Le colonne sono in italiano come il resto del progetto.
 *
 * ANAGRAFICHE DEGLI ATLETI — la regola è cambiata. Fino a poco fa qui c'era
 * scritto che non sarebbero mai vissute in questo database, perché il sistema
 * vero era il gestionale uffwebsm e due archivi delle stesse persone
 * divergono. Ora uffwebsm va smantellato: questo database è l'unica fonte, e
 * anagrafica, quote versate e certificati medici stanno nelle tabelle in
 * fondo al file. Dove altri commenti dicono ancora il contrario, è il
 * commento a essere vecchio.
 */

import {
  pgTable, pgEnum, serial, integer, text, boolean, timestamp, date,
  doublePrecision, jsonb, index, uniqueIndex
} from "drizzle-orm/pg-core";

/* =====================================================
   Tipi enumerati
   ===================================================== */

export const ruoloUtente = pgEnum("ruolo_utente", [
  "admin",      // gestisce tutto: notizie, eventi, persone
  "segreteria", // vede gli iscritti e i loro dati, approva le iscrizioni
  "editor",     // notizie, più gli eventi della squadra a cui è associato
  "coach",      // eventi e materiale delle proprie squadre
  "atleta"      // i propri dati, il proprio calendario
]);

/**
 * Stato di un account.
 *
 * Sostituisce il booleano "attivo", che non sapeva distinguere fra chi si è
 * appena registrato e aspetta il via libera, e chi è stato sospeso: due
 * situazioni che richiedono schermate diverse e decisioni diverse.
 */
export const statoUtente = pgEnum("stato_utente", [
  "in_attesa",  // registrato da solo, in attesa di approvazione
  "attivo",
  "sospeso"     // non entra più, ma ciò che ha scritto resta al suo posto
]);

export const statoNotizia = pgEnum("stato_notizia", [
  "bozza",
  "in_revisione", // scritta da chi non ha il permesso di pubblicare
  "pubblicata",
  "cestino"       // cancellazione reversibile, come su WordPress
]);

/* Su WordPress lo sport era dedotto dal titolo con detectSport(), perché non
   esisteva un campo. Qui è una colonna vera: una notizia sul volley il cui
   titolo non contiene "volley" non finisce più in "Altro" per sbaglio. */
export const sportNotizia = pgEnum("sport_notizia", [
  "Calcio", "Pallavolo", "Minivolley", "Basket", "Altro"
]);

/*
 * Di cosa parla una notizia, che è un'altra domanda rispetto a quale
 * sport riguarda.
 *
 * Su 98 articoli portati da WordPress, 79 avevano sport "Altro": non
 * erano mal catalogati, semplicemente non parlavano di uno sport.
 * Assemblee, feste di Natale, tariffe della stagione, 5x1000: la vita di
 * una polisportiva è fatta soprattutto di questo, e infilarla tutta in
 * "Altro" vuol dire non avere nessuna categoria.
 *
 * Una colonna a parte e non altri valori dentro allo sport: una partita
 * di calcio con la raccolta fondi è entrambe le cose, e un elenco solo
 * costringerebbe a scegliere quale delle due buttare via.
 */
export const categoriaNotizia = pgEnum("categoria_notizia", [
  "societa",      // assemblee, consiglio, documenti, tariffe, iscrizioni
  "eventi",       // feste, tornei, lotterie, ricorrenze
  "sport",        // partite, campionati, risultati, squadre
  "solidarieta",  // 5x1000, iniziative sul territorio, parrocchia
  "altro"
]);

/* =====================================================
   Utenti e sessioni
   ===================================================== */

export const utenti = pgTable("utenti", {
  id: serial("id").primaryKey(),

  // Sempre in minuscolo: l'unicità dev'essere insensibile alle maiuscole,
  // e normalizzare in scrittura è più semplice di un indice funzionale.
  email: text("email").notNull().unique(),

  // scrypt: salt + parametri + hash in un'unica stringa. Nessuna dipendenza
  // esterna, è nel modulo crypto di Node.
  passwordHash: text("password_hash").notNull(),

  ruolo: ruoloUtente("ruolo").notNull().default("atleta"),
  nome: text("nome"),
  cognome: text("cognome"),

  /**
   * La foto del profilo, se c'è.
   *
   * Un riferimento all'archivio dei file e non un indirizzo scritto a mano:
   * il giorno che i file cambiano dominio non si riscrivono centocinquanta
   * righe. Facoltativa e destinata a restare tale per la maggior parte degli
   * account — dove manca si mostrano le iniziali, che non sono un ripiego
   * ma un modo di riconoscere qualcuno altrettanto rapido.
   *
   * set null e non cascade: cancellando un file dall'archivio si perde la
   * foto, non l'account.
   */
  immagineId: integer("immagine_id").references(() => media.id, { onDelete: "set null" }),

  // Sospendere invece di cancellare: le notizie scritte da questa persona
  // devono continuare ad avere un autore.
  stato: statoUtente("stato").notNull().default("in_attesa"),

  /**
   * Gli account creati dall'amministratore nascono con una password
   * provvisoria, che lui stesso conosce perché deve consegnarla. Finché non
   * viene cambiata, chi amministra può entrare come quella persona: al primo
   * accesso il cambio è obbligatorio.
   */
  deveCambiarePassword: boolean("deve_cambiare_password").notNull().default(false),

  // Richiesto esplicitamente: monitorare gli accessi al sito.
  ultimoAccesso: timestamp("ultimo_accesso", { withTimezone: true }),

  creatoIl: timestamp("creato_il", { withTimezone: true }).notNull().defaultNow(),
  aggiornatoIl: timestamp("aggiornato_il", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("idx_utenti_ruolo").on(t.ruolo)
]);

export const sessioni = pgTable("sessioni", {
  // Qui finisce l'HASH del token di sessione, mai il token. Se il database
  // trapela, le sessioni attive non sono utilizzabili da chi lo legge.
  id: text("id").primaryKey(),

  utenteId: integer("utente_id").notNull()
    .references(() => utenti.id, { onDelete: "cascade" }),

  creataIl: timestamp("creata_il", { withTimezone: true }).notNull().defaultNow(),
  ultimoUsoIl: timestamp("ultimo_uso_il", { withTimezone: true }).notNull().defaultNow(),
  scadeIl: timestamp("scade_il", { withTimezone: true }).notNull(),

  // Per far riconoscere a una persona le proprie sessioni aperte
  userAgent: text("user_agent")
}, (t) => [
  index("idx_sessioni_utente").on(t.utenteId),
  index("idx_sessioni_scadenza").on(t.scadeIl)
]);

/* =====================================================
   Media
   ===================================================== */

/**
 * Le cartelle della libreria.
 *
 * Sono un'etichetta sola per file, in una tabella a parte invece che una
 * stringa dentro a media: così rinominare "Feste" in "Eventi sociali" è
 * una riga aggiornata, non quattrocento.
 *
 * NON hanno niente a che vedere con la cartella dentro al bucket, che sta
 * dentro alla chiave e non cambia mai. Sono due cose diverse di proposito:
 * la chiave è dove il file è scritto e rinominarla vorrebbe dire spostare
 * i byte e rompere ogni indirizzo già pubblicato; la cartella è come lo si
 * ritrova, e la gente la riorganizza quando le pare.
 */
export const cartelleMedia = pgTable("cartelle_media", {
  id: serial("id").primaryKey(),

  nome: text("nome").notNull().unique(),

  /**
   * Una cartella che vedono tutti, e in cui tutti possono mettere.
   *
   * Serve perché la regola normale è l'opposto: un allenatore vede solo
   * quello che ha caricato lui. Senza un posto comune, la foto della
   * premiazione che serve a chi scrive la notizia va mandata per
   * WhatsApp, e il sito che dovrebbe essere l'archivio della società non
   * la vede passare.
   *
   * Una colonna e non un nome riservato: "File condivisi" si può
   * rinominare senza che smetta di essere condivisa, e domani se ne
   * potranno segnare altre.
   */
  condivisa: boolean("condivisa").notNull().default(false),

  /**
   * Cartella che vede solo chi amministra.
   *
   * Ne esiste una sola e si chiama "Dal vecchio sito": sono le centinaia
   * di immagini ereditate da WordPress, che servono a chi fa ordine
   * nell'archivio e a nessun altro. Fra le quattro cartelle della
   * libreria di un allenatore era la più grossa, e non conteneva niente
   * che lo riguardasse.
   *
   * I file dentro restano cercabili da chi la libreria la vede intera:
   * una foto di tre anni fa può servire a una notizia. È la cartella a
   * sparire dall'elenco, non il suo contenuto.
   */
  soloAdmin: boolean("solo_admin").notNull().default(false),

  creataDa: integer("creata_da").references(() => utenti.id, { onDelete: "set null" }),
  creataIl: timestamp("creata_il", { withTimezone: true }).notNull().defaultNow()
});

export const media = pgTable("media", {
  id: serial("id").primaryKey(),

  // Percorso dell'oggetto dentro il bucket R2. L'URL pubblico si compone
  // a partire da questa: se un giorno cambia il dominio dei file, si cambia
  // in un punto solo invece che in 96 articoli.
  //
  // Facoltativa durante la transizione: un file ancora su WordPress ha
  // chiave vuota e si serve da urlOriginaleWp. Quando passera' su R2 la
  // chiave si riempie e l'indirizzo cambia da solo.
  chiave: text("chiave").unique(),

  mime: text("mime").notNull(),
  byte: integer("byte"),
  larghezza: integer("larghezza"),
  altezza: integer("altezza"),

  // Testo alternativo: serve a chi usa un lettore di schermo, e oggi manca
  alt: text("alt"),
  titolo: text("titolo"),

  /**
   * Etichette libere, per ritrovare un file fra centinaia.
   *
   * Un elenco di testi invece di una tabella a parte: con qualche centinaio
   * di file non serve un vocabolario controllato, e una colonna sola evita
   * due join per mostrare tre parole. Se un giorno le etichette andranno
   * rinominate o unite, si passera' a una tabella dedicata.
   */
  tag: text("tag").array(),

  /**
   * In quale cartella della libreria sta questo file.
   *
   * "set null" e non "cascade": cancellando una cartella i file NON si
   * cancellano, restano senza cartella. Una cartella è un modo di
   * ordinare, e riordinare non deve poter distruggere niente.
   */
  cartellaId: integer("cartella_id").references(() => cartelleMedia.id, { onDelete: "set null" }),

  caricatoDa: integer("caricato_da").references(() => utenti.id, { onDelete: "set null" }),
  creatoIl: timestamp("creato_il", { withTimezone: true }).notNull().defaultNow(),

  /**
   * Quando è finito nel cestino. Vuota: è un file normale.
   *
   * Cancellare sul serio al primo clic è il modo di perdere per sempre
   * l'unica copia della foto di una premiazione, e nessuno se ne accorge
   * il giorno stesso. Qui il file esce dalla libreria e basta: per dieci
   * giorni si può ripescare, dopo di che viene tolto davvero — riga e
   * byte nell'archivio.
   *
   * Dieci giorni e non "finché non si svuota": un cestino che nessuno
   * svuota è un archivio che cresce e che nessuno guarda, e intanto i
   * byte si pagano.
   */
  cestinatoIl: timestamp("cestinato_il", { withTimezone: true }),
  cestinatoDa: integer("cestinato_da").references(() => utenti.id, { onDelete: "set null" }),

  // Tracce dell'origine: rendono la migrazione ripetibile senza duplicare
  wpId: integer("wp_id").unique(),
  urlOriginaleWp: text("url_originale_wp")
}, (t) => [
  // GIN e non btree: su un elenco l'indice deve poter rispondere a
  // "quali file hanno questa etichetta", non a "ordinali tutti".
  index("idx_media_tag").using("gin", t.tag),
  index("idx_media_cartella").on(t.cartellaId),

  // Lo spurgo cerca "i cestinati da più di dieci giorni", e lo fa a ogni
  // apertura della libreria: senza indice sarebbe una scansione a vuoto.
  index("idx_media_cestino").on(t.cestinatoIl)
]);

/* =====================================================
   Notizie
   ===================================================== */

export const notizie = pgTable("notizie", {
  id: serial("id").primaryKey(),

  slug: text("slug").notNull().unique(),
  titolo: text("titolo").notNull(),

  // Riassunto per gli elenchi. Se vuoto, si ricava dal contenuto.
  sommario: text("sommario"),

  // HTML prodotto dall'editor, ripulito lato server prima di essere salvato:
  // chi scrive è fidato solo fino a un certo punto, e l'HTML finisce
  // in pagina con dangerouslySetInnerHTML.
  contenuto: text("contenuto").notNull(),

  copertinaId: integer("copertina_id").references(() => media.id, { onDelete: "set null" }),

  sport: sportNotizia("sport").notNull().default("Altro"),
  categoria: categoriaNotizia("categoria").notNull().default("altro"),
  stato: statoNotizia("stato").notNull().default("bozza"),

  autoreId: integer("autore_id").references(() => utenti.id, { onDelete: "set null" }),

  // Distinta da creataIl: una notizia si può scrivere oggi e pubblicare domani
  pubblicataIl: timestamp("pubblicata_il", { withTimezone: true }),

  creataIl: timestamp("creata_il", { withTimezone: true }).notNull().defaultNow(),
  aggiornataIl: timestamp("aggiornata_il", { withTimezone: true }).notNull().defaultNow(),

  // Idempotenza della migrazione: rieseguirla non crea 96 doppioni
  wpId: integer("wp_id").unique()
}, (t) => [
  // L'elenco pubblico chiede sempre "le pubblicate, dalla più recente"
  index("idx_notizie_elenco").on(t.stato, t.pubblicataIl),
  index("idx_notizie_sport").on(t.sport),
  index("idx_notizie_categoria").on(t.categoria)
]);

/* =====================================================
   Freno ai tentativi di accesso
   ===================================================== */

/**
 * Un tentativo di accesso fallito per riga.
 *
 * Senza questo, un'API di accesso è una porta su cui si può bussare
 * all'infinito: scrypt rallenta chi prova a indovinare, ma non lo ferma.
 * La tabella sta nel database e non in memoria perché in ambiente
 * serverless ogni richiesta può toccare un processo diverso, e un
 * contatore in memoria non conterebbe quasi nulla.
 */
export const tentativiAccesso = pgTable("tentativi_accesso", {
  id: serial("id").primaryKey(),

  // Email tentata oppure indirizzo del chiamante: si frena su entrambi,
  // così né un account singolo né una sorgente singola possono insistere.
  chiave: text("chiave").notNull(),

  quando: timestamp("quando", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("idx_tentativi_chiave").on(t.chiave, t.quando)
]);

/* =====================================================
   FASE 3 — Squadre ed eventi
   ===================================================== */

export const sportSquadra = pgEnum("sport_squadra", [
  "Calcio", "Pallavolo", "Basket", "Societa"
]);

export const tipoEvento = pgEnum("tipo_evento", [
  "partita", "allenamento", "torneo", "riunione", "evento", "altro"
]);

/**
 * Le squadre, più i due calendari di società ("Eventi PSD", "Segreteria PSD")
 * che squadre non sono: hanno sport "Societa".
 *
 * calendarioGoogleId conserva l'origine, come wp_id per le notizie: serve
 * all'importazione dello storico e a non reimportare due volte lo stesso
 * evento. Dopo il passaggio non viene più letto.
 */
export const squadre = pgTable("squadre", {
  id: serial("id").primaryKey(),

  nome: text("nome").notNull(),
  slug: text("slug").notNull().unique(),
  sport: sportSquadra("sport").notNull(),

  // Colore e variabile CSS erano già nel codice del calendario: portarli in
  // tabella permette di aggiungere una squadra senza toccare il codice.
  colore: text("colore"),
  cssVar: text("css_var"),

  ordine: integer("ordine").notNull().default(0),

  // Una squadra che non esiste più si disattiva: i suoi eventi passati
  // devono restare consultabili.
  attiva: boolean("attiva").notNull().default(true),

  calendarioGoogleId: text("calendario_google_id"),

  creataIl: timestamp("creata_il", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("idx_squadre_sport").on(t.sport, t.ordine)
]);

/**
 * Chi può gestire quale squadra.
 *
 * Vale sia per i coach sia per gli editor: la richiesta diceva che un editor
 * "eventualmente, se associato a una squadra" può gestirne gli eventi. Una
 * tabella sola invece di due identiche.
 */
export const associazioniSquadra = pgTable("associazioni_squadra", {
  id: serial("id").primaryKey(),

  utenteId: integer("utente_id").notNull()
    .references(() => utenti.id, { onDelete: "cascade" }),

  squadraId: integer("squadra_id").notNull()
    .references(() => squadre.id, { onDelete: "cascade" }),

  creataIl: timestamp("creata_il", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  uniqueIndex("idx_associazione_unica").on(t.utenteId, t.squadraId),
  index("idx_associazioni_squadra").on(t.squadraId)
]);

/**
 * Gli eventi delle squadre.
 *
 * Risultato, parziali, marcatori e link alla diretta erano scritti dentro
 * al testo della descrizione dell'evento Google, in righe tipo
 * "Partita: 3 - 1" o "Marcatori: Rossi, Bianchi", e ri-estratti da un
 * parser a ogni caricamento della pagina. Qui sono colonne: chi inserisce
 * compila dei campi, e nessuno deve più ricordare la formula esatta.
 */
export const eventi = pgTable("eventi", {
  id: serial("id").primaryKey(),

  squadraId: integer("squadra_id").notNull()
    .references(() => squadre.id, { onDelete: "cascade" }),

  tipo: tipoEvento("tipo").notNull().default("partita"),

  /**
   * Sport dell'evento, di norma VUOTO.
   *
   * Lo sport si ricava dalla squadra, ed è così che lo restituisce l'API:
   * duplicarlo qui vorrebbe dire tenere allineati due posti. Questa colonna
   * serve solo a scavalcare la derivazione nei casi in cui non basta — per
   * esempio un evento del calendario di società (sport "Societa") che
   * riguarda in realtà il calcio.
   */
  sport: sportSquadra("sport"),
  titolo: text("titolo").notNull(),
  avversario: text("avversario"),

  inizio: timestamp("inizio", { withTimezone: true }).notNull(),
  fine: timestamp("fine", { withTimezone: true }),

  /**
   * Da quando l'evento compare sul calendario del sito.
   *
   * VUOTO significa "subito", ed è il caso normale: le 263 righe già in
   * archivio non hanno questa colonna e devono restare visibili. Una data nel
   * futuro è la programmazione — il calendario del mese si prepara con calma
   * e si mostra quando è pronto.
   *
   * Il verso è opposto a quello delle notizie, dove la data vuota significa
   * "non ancora uscita": lì la colonna esisteva già ed è la data di
   * pubblicazione, qui è una limitazione che si aggiunge a un archivio
   * pubblico. Fare altrimenti avrebbe nascosto di colpo tutto il calendario.
   */
  visibileDal: timestamp("visibile_dal", { withTimezone: true }),

  // Un evento "tutto il giorno" non ha un'ora da mostrare
  tuttoIlGiorno: boolean("tutto_il_giorno").notNull().default(false),

  luogo: text("luogo"),

  /**
   * Il punto esatto sulla mappa, scelto da chi inserisce l'evento.
   *
   * Il solo nome del luogo non basta a portarci qualcuno: "Palestra Le
   * Chiuse" cercato su una mappa può dare tre risultati in tre quartieri
   * diversi, e una trasferta si sbaglia una volta sola. Con le coordinate il
   * collegamento sul sito apre il punto giusto e basta.
   *
   * Restano facoltative: un allenamento nel campo di sempre non ha bisogno
   * che qualcuno apra la mappa per inserirlo.
   */
  latitudine: doublePrecision("latitudine"),
  longitudine: doublePrecision("longitudine"),

  descrizione: text("descrizione"),

  risultato: text("risultato"),
  parziali: text("parziali"),
  marcatori: text("marcatori").array(),
  diretta: text("diretta"),

  creatoDa: integer("creato_da").references(() => utenti.id, { onDelete: "set null" }),

  googleEventId: text("google_event_id").unique(),

  creatoIl: timestamp("creato_il", { withTimezone: true }).notNull().defaultNow(),
  aggiornatoIl: timestamp("aggiornato_il", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  // L'interrogazione più frequente: "gli eventi fra due date"
  index("idx_eventi_periodo").on(t.inizio),
  index("idx_eventi_squadra").on(t.squadraId, t.inizio)
]);

/** Foto e video di una partita, caricati dal coach. */
export const mediaEvento = pgTable("media_evento", {
  id: serial("id").primaryKey(),

  eventoId: integer("evento_id").notNull()
    .references(() => eventi.id, { onDelete: "cascade" }),

  mediaId: integer("media_id").notNull()
    .references(() => media.id, { onDelete: "cascade" }),

  ordine: integer("ordine").notNull().default(0),
  creatoIl: timestamp("creato_il", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  uniqueIndex("idx_media_evento_unico").on(t.eventoId, t.mediaId),
  index("idx_media_evento").on(t.eventoId, t.ordine)
]);

/* =====================================================
   Richieste di iscrizione a una squadra
   ===================================================== */

export const statoRichiesta = pgEnum("stato_richiesta", [
  "in_attesa", "approvata", "rifiutata"
]);

/**
 * Un atleta che si registra sceglie lo SPORT, non la squadra: quale sia la
 * sua squadra non lo sa lui, lo decide chi la compone.
 *
 * Finché la richiesta non viene accolta assegnandogli una squadra, il suo
 * account resta in stato "in_attesa".
 *
 * Per questo "sport" è obbligatorio e "squadra_id" no: il primo è la
 * domanda, il secondo è la risposta, e arriva dopo.
 *
 * ATTENZIONE, per non confondersi più avanti: questa NON è l'iscrizione
 * ufficiale alla società, né il tesseramento. Questa tabella dice soltanto
 * "questa persona fa parte di questa squadra", cioè vede il calendario e i
 * propri dati. Tesseramento, quote e certificato stanno nella scheda
 * dell'atleta, più in basso.
 *
 * (Fino a poco fa qui c'era scritto che quelle cose vivevano su uffwebsm.
 * Non più: quel gestionale viene spento, vedi la nota in cima al file.)
 *
 * Tabella separata da associazioni_squadra perché dicono cose diverse:
 * là "gestisce la squadra", qui "ne fa parte".
 */
export const richiesteIscrizione = pgTable("richieste_iscrizione", {
  id: serial("id").primaryKey(),

  utenteId: integer("utente_id").notNull()
    .references(() => utenti.id, { onDelete: "cascade" }),

  // Lo sport chiesto in fase di registrazione
  sport: sportSquadra("sport").notNull(),

  // La squadra assegnata da chi decide. Vuota finché non si decide.
  squadraId: integer("squadra_id")
    .references(() => squadre.id, { onDelete: "set null" }),

  stato: statoRichiesta("stato").notNull().default("in_attesa"),

  // Quello che la persona ha scritto di sé al momento della richiesta:
  // serve a chi decide per riconoscerla ("sono il papà di Luca Rossi").
  note: text("note"),

  richiestaIl: timestamp("richiesta_il", { withTimezone: true }).notNull().defaultNow(),

  // Chi ha deciso e quando: una domanda respinta senza sapere da chi
  // diventa impossibile da discutere.
  decisaDa: integer("decisa_da").references(() => utenti.id, { onDelete: "set null" }),
  decisaIl: timestamp("decisa_il", { withTimezone: true }),
  motivoRifiuto: text("motivo_rifiuto")
}, (t) => [
  index("idx_richieste_stato").on(t.stato, t.richiestaIl),
  // Un allenatore cerca le richieste del proprio sport, non della propria
  // squadra: quando arrivano, una squadra non ce l'hanno ancora.
  index("idx_richieste_sport").on(t.sport, t.stato),
  index("idx_richieste_squadra").on(t.squadraId, t.stato),
  index("idx_richieste_utente").on(t.utenteId)
]);

/* =====================================================
   FASE 4 — Schede degli atleti, certificati e quote

   Queste tabelle esistono perché uffwebsm viene spento: da qui in avanti
   anagrafica, certificati e pagamenti degli atleti stanno solo qui. Finché
   il vecchio gestionale era il sistema vero, duplicarli sarebbe stato un
   errore; adesso non c'è nulla da duplicare.
   ===================================================== */

export const tipoCertificato = pgEnum("tipo_certificato", [
  "agonistico",
  "non_agonistico"
]);

/**
 * A che punto è il certificato medico nel giro di controllo.
 *
 * Caricare un file e consegnare un certificato valido non sono la stessa
 * cosa: capita la foto storta, la pagina sbagliata, il foglio scaduto o il
 * certificato di un altro sport. Qualcuno lo deve guardare, e finché non
 * l'ha guardato quel ragazzo non è a posto — anche se sul sito risulta
 * "caricato".
 *
 * Chi controlla è la segreteria, che ha "certificato.registra". Un rifiuto
 * porta un motivo, perché "rifiutato" e basta obbliga a telefonare.
 */
export const statoCertificato = pgEnum("stato_certificato", [
  "da_validare",
  "valido",
  "rifiutato"
]);

/**
 * Le tariffe della stagione, decise una volta e riusate per tutti.
 *
 * Prima la quota si batteva a mano su ogni scheda: sessanta importi
 * scritti uno per uno, con gli inevitabili 200 invece di 250 e i 25 euro
 * di sconto fratello applicati a memoria. E quando il consiglio cambia le
 * tariffe, non c'è modo di sapere chi aveva quale.
 *
 * Le crea e le cambia l'amministratore; la segreteria le APPLICA e basta.
 * Cambiare una tariffa NON ritocca le quote già assegnate: quelle sono
 * accordi presi con le famiglie, e riscriverli tutti insieme perché il
 * listino è cambiato a gennaio sarebbe un guaio, non una comodità.
 */
export const tipiQuota = pgTable("tipi_quota", {
  id: serial("id").primaryKey(),

  nome: text("nome").notNull(),
  descrizione: text("descrizione"),

  // In CENTESIMI, come ogni altro importo del sito: vedi la nota sulla
  // colonna delle quote più sotto.
  importoCentesimi: integer("importo_centesimi").notNull(),

  /* Si disattiva invece di cancellare: una tariffa tolta resta su decine
     di schede dell'anno scorso, e farla sparire renderebbe illeggibili i
     conti passati. Spenta, non si propone più a chi assegna. */
  attiva: boolean("attiva").notNull().default(true),

  // L'ordine in cui si vedono: le tariffe hanno una gerarchia che
  // l'alfabeto non conosce — prima iscrizione, rinnovo, fratello.
  ordine: integer("ordine").notNull().default(0),

  creataDa: integer("creata_da").references(() => utenti.id, { onDelete: "set null" }),
  creataIl: timestamp("creata_il", { withTimezone: true }).notNull().defaultNow()
});

export const metodoPagamento = pgEnum("metodo_pagamento", [
  "contanti", "bonifico", "pos", "altro"
]);

/**
 * La scheda di un atleta: una riga per persona, o nessuna.
 *
 * Tabella separata da "utenti" e non colonne in più là dentro: di 157
 * account solo una parte sono atleti, e allargare "utenti" significherebbe
 * portarsi dietro dodici colonne vuote su ogni amministratore, ogni
 * redattore e ogni allenatore. Qui la riga esiste solo per chi ha davvero
 * una scheda, e chi legge "utenti" non se la trova fra i piedi.
 *
 * Una riga per persona, garantita dall'indice unico su utente_id: una
 * seconda scheda della stessa persona sarebbe la solita doppia verità.
 */
export const schedeAtleta = pgTable("schede_atleta", {
  id: serial("id").primaryKey(),

  utenteId: integer("utente_id").notNull()
    .references(() => utenti.id, { onDelete: "cascade" }),

  /* ---------- Anagrafica ---------- */

  // date e non timestamp: una data di nascita non ha un'ora, e con il fuso
  // orario di mezzo il 1° gennaio diventa il 31 dicembre per metà del mondo.
  dataNascita: date("data_nascita"),
  luogoNascita: text("luogo_nascita"),
  provinciaNascita: text("provincia_nascita"),
  codiceFiscale: text("codice_fiscale"),

  /**
   * La taglia della maglia da gara.
   *
   * Sembra un dettaglio e invece è la domanda che la segreteria fa a
   * sessanta famiglie ogni settembre, una per una, al telefono. Sta qui
   * perché la sa l'atleta e serve a chi ordina il materiale.
   *
   * Testo e non un elenco chiuso in Postgres: le taglie dei bambini si
   * dicono in anni, quelle degli adulti in lettere, e i fornitori cambiano
   * nomenclatura. L'elenco proposto sta nella validazione, dove si
   * aggiorna senza una migrazione.
   */
  tagliaMaglietta: text("taglia_maglietta"),

  /* ---------- Recapiti ---------- */

  telefono: text("telefono"),

  /* ---------- Residenza ----------

     Spezzata in cinque colonne invece di una riga sola di testo: la
     segreteria stampa i moduli federali, che chiedono via, numero, comune,
     provincia e CAP in caselle separate. Con "Via Le Chiuse 20/A, 10144
     Torino" dentro a un campo unico, quel lavoro lo fa a mano ogni volta.

     "indirizzo" resta il nome della via: era già così, e rinominarla
     vorrebbe dire una migrazione di dati per un guadagno nullo. */

  indirizzo: text("indirizzo"),
  civico: text("civico"),
  citta: text("citta"),
  provincia: text("provincia"),
  cap: text("cap"),

  /* ---------- Chi chiamare se succede qualcosa ----------

     Due contatti e non uno solo. Il primo è obbligatorio per i minori; il
     secondo esiste perché il genitore che risponde sempre non è quello che
     è in palestra: separati, divorziati, turni di lavoro, nonni che
     accompagnano. Con un numero solo, la telefonata che conta è quella che
     squilla a vuoto.

     Due terne di colonne e non una tabella a parte: sono due, non n. Il
     giorno che ne servisse un terzo si farà una tabella, ma oggi
     costerebbe due innesti in ogni lettura di una scheda per niente. */

  tutoreNome: text("tutore_nome"),
  // "madre", "padre", "nonna", "tutore": chi chiama deve sapere con chi parla
  tutoreParentela: text("tutore_parentela"),
  tutoreTelefono: text("tutore_telefono"),
  tutoreEmail: text("tutore_email"),

  tutore2Nome: text("tutore2_nome"),
  tutore2Parentela: text("tutore2_parentela"),
  tutore2Telefono: text("tutore2_telefono"),
  tutore2Email: text("tutore2_email"),

  /* ---------- Certificato medico ---------- */

  tipoCertificato: tipoCertificato("tipo_certificato"),
  certificatoScadenza: date("certificato_scadenza"),

  // Il file vero e proprio. Resta vuoto finché non c'è un archivio dove
  // metterlo: la scadenza però si registra lo stesso, ed è quella che serve
  // per sapere chi può scendere in campo.
  certificatoMediaId: integer("certificato_media_id")
    .references(() => media.id, { onDelete: "set null" }),

  /**
   * Il controllo della segreteria.
   *
   * Parte da "da_validare" e ci torna ogni volta che l'atleta cambia
   * qualcosa del certificato: file nuovo, scadenza diversa, tipo diverso.
   * Altrimenti basterebbe far validare un foglio buono e poi sostituirlo.
   */
  certificatoStato: statoCertificato("certificato_stato").notNull().default("da_validare"),

  certificatoValidatoDa: integer("certificato_validato_da")
    .references(() => utenti.id, { onDelete: "set null" }),
  certificatoValidatoIl: timestamp("certificato_validato_il", { withTimezone: true }),
  certificatoMotivo: text("certificato_motivo"),

  /* ---------- Quota della stagione ---------- */

  /**
   * Quanto deve per la stagione in corso, in CENTESIMI.
   *
   * Interi e non decimali: 0.1 + 0.2 in virgola mobile non fa 0.3, e su una
   * somma di quote l'errore si vede. Il resto del codice divide per cento
   * solo al momento di scriverlo a schermo.
   */
  quotaStagionaleCentesimi: integer("quota_stagionale_centesimi"),

  /**
   * Quale tariffa le è stata applicata.
   *
   * L'importo resta scritto anche qui e non si ricava dalla tariffa: una
   * tariffa cambiata a stagione in corso non deve riscrivere gli accordi
   * già presi con le famiglie. Questo campo dice PERCHÉ quella cifra —
   * "sconto fratello" — che su un conto è la metà della risposta.
   */
  tipoQuotaId: integer("tipo_quota_id")
    .references(() => tipiQuota.id, { onDelete: "set null" }),

  note: text("note"),

  aggiornataDa: integer("aggiornata_da").references(() => utenti.id, { onDelete: "set null" }),
  creataIl: timestamp("creata_il", { withTimezone: true }).notNull().defaultNow(),
  aggiornataIl: timestamp("aggiornata_il", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  uniqueIndex("idx_scheda_atleta_unica").on(t.utenteId),
  // "Chi ha il certificato in scadenza il mese prossimo" è la domanda che la
  // segreteria fa più spesso, e va risposta senza leggere tutte le schede.
  index("idx_scheda_certificato").on(t.certificatoScadenza)
]);

/**
 * I versamenti, uno per riga.
 *
 * Non una colonna "ha pagato" sulla scheda: una quota si paga quasi sempre
 * in due o tre volte, e con un solo campo la segreteria non saprebbe più
 * dire quanto manca né quando è arrivato cosa. Il totale versato è una
 * somma, che è esattamente ciò che un database sa fare.
 */
export const pagamenti = pgTable("pagamenti", {
  id: serial("id").primaryKey(),

  utenteId: integer("utente_id").notNull()
    .references(() => utenti.id, { onDelete: "cascade" }),

  // In centesimi, come la quota. Può essere negativo: un rimborso è un
  // versamento al contrario, e registrarlo così evita di cancellare righe
  // che sono già passate per la cassa.
  importoCentesimi: integer("importo_centesimi").notNull(),

  causale: text("causale"),
  pagatoIl: date("pagato_il").notNull(),
  metodo: metodoPagamento("metodo").notNull().default("bonifico"),

  registratoDa: integer("registrato_da").references(() => utenti.id, { onDelete: "set null" }),
  creatoIl: timestamp("creato_il", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("idx_pagamenti_utente").on(t.utenteId, t.pagatoIl)
]);

/* =====================================================
   Registro delle attività — chi ha fatto cosa
   ===================================================== */

/**
 * Una riga per ogni operazione che cambia qualcosa.
 *
 * Serve per rispondere a domande che prima non avevano risposta: chi ha
 * cestinato quell'articolo, chi ha cambiato la quota, chi ha respinto quella
 * richiesta e quando. Con dieci persone che toccano lo stesso sito, "non sono
 * stato io" è una conversazione che si chiude solo con un registro.
 *
 * È un archivio in SOLA SCRITTURA: nessun endpoint lo modifica o lo cancella.
 * Un registro che si può correggere non è un registro.
 */
export const registroAttivita = pgTable("registro_attivita", {
  id: serial("id").primaryKey(),

  utenteId: integer("utente_id").references(() => utenti.id, { onDelete: "set null" }),

  /**
   * Il nome di chi ha agito, copiato qui al momento del fatto.
   *
   * Ridondante rispetto al collegamento, e apposta: un account cancellato
   * azzera utente_id, e un registro che a quel punto dicesse "qualcuno ha
   * cestinato l'articolo" non servirebbe a niente. Anche un cambio di nome
   * non deve riscrivere il passato.
   */
  autore: text("autore"),

  // Cosa è successo, in forma di codice: "notizie.cestina", "atleti.pagamento"
  azione: text("azione").notNull(),

  // Su cosa: "notizia", "evento", "utente", "richiesta", "atleta"…
  oggettoTipo: text("oggetto_tipo"),
  oggettoId: integer("oggetto_id"),

  // La stessa cosa in italiano, già pronta da leggere: comporla al momento
  // del fatto è l'unico momento in cui si sa com'era il titolo di allora.
  descrizione: text("descrizione"),

  // Spazio libero per i particolari (valore prima/dopo, motivo, importo)
  dettaglio: jsonb("dettaglio"),

  quando: timestamp("quando", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  // L'elenco si guarda quasi sempre dal più recente
  index("idx_registro_quando").on(t.quando),
  index("idx_registro_utente").on(t.utenteId, t.quando),
  // "Tutto quello che è successo a questa notizia"
  index("idx_registro_oggetto").on(t.oggettoTipo, t.oggettoId)
]);
