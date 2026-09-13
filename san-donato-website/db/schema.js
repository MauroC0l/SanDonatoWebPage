/**
 * Schema del database — Fase 1: utenti, sessioni, notizie, media.
 *
 * Le fasi successive (squadre, eventi, atleti, certificati) aggiungeranno
 * tabelle qui accanto. Le colonne sono in italiano come il resto del progetto.
 *
 * Nota sulle anagrafiche degli atleti: NON vivranno qui. Il sistema vero è
 * il gestionale uffwebsm, e avere due archivi delle stesse persone significa
 * ritrovarsi con dati che non coincidono. Quando arriveremo alla Fase 4, gli
 * atleti si leggeranno o importeranno da lì.
 */

import {
  pgTable, pgEnum, serial, integer, text, boolean, timestamp, index
} from "drizzle-orm/pg-core";

/* =====================================================
   Tipi enumerati
   ===================================================== */

export const ruoloUtente = pgEnum("ruolo_utente", [
  "admin",    // gestisce tutto: notizie, coach, atleti
  "editor",   // solo notizie, più gli eventi della squadra a cui è associato
  "coach",    // eventi e materiale delle proprie squadre
  "atleta"    // i propri dati, il proprio calendario
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

  // Disattivare invece di cancellare: le notizie scritte da questa persona
  // devono continuare ad avere un autore.
  attivo: boolean("attivo").notNull().default(true),

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

  caricatoDa: integer("caricato_da").references(() => utenti.id, { onDelete: "set null" }),
  creatoIl: timestamp("creato_il", { withTimezone: true }).notNull().defaultNow(),

  // Tracce dell'origine: rendono la migrazione ripetibile senza duplicare
  wpId: integer("wp_id").unique(),
  urlOriginaleWp: text("url_originale_wp")
});

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
  index("idx_notizie_sport").on(t.sport)
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
