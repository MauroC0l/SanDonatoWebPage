/**
 * Forme accettate dalle API.
 *
 * La validazione sta ai confini: dentro, il resto del codice può dare per
 * buono ciò che riceve invece di controllare ogni campo a ogni passaggio.
 */

import { z } from "zod";
import { ErroreHttp } from "./risposte.js";

export const SPORT = ["Calcio", "Pallavolo", "Minivolley", "Basket", "Altro"];

/* Di cosa parla la notizia, che non è lo sport: la maggior parte
   dell'archivio racconta la vita della società, non una partita.
   Vedi la nota sull'enum in db/schema.js. */
export const CATEGORIE = ["societa", "eventi", "sport", "solidarieta", "altro"];
export const STATI = ["bozza", "in_revisione", "pubblicata", "cestino"];

/**
 * I valori che il FILTRO del pannello accetta, che sono uno in più.
 *
 * "programmata" non è uno stato del database e non deve finire in STATI, che
 * è l'elenco usato anche in scrittura: scriverla in tabella significherebbe
 * inventare un valore che l'enum di Postgres rifiuta. È solo un modo di
 * chiedere "le pubblicate che non sono ancora uscite", e vale in lettura.
 */
export const STATI_FILTRO = [...STATI, "programmata"];

export const schemaAccesso = z.object({
  email: z.string().trim().toLowerCase().email("Indirizzo email non valido.").max(255),
  password: z.string().min(1, "Inserisci la password.").max(200),
  ricordami: z.boolean().optional().default(false)
});

/* I campi di una notizia, senza valori predefiniti: quelli si applicano
   solo in creazione, mai in modifica. Vedi la nota qui sotto. */
const CAMPI = {
  titolo: z.string().trim().min(3, "Il titolo è troppo corto.").max(300),
  contenuto: z.string().min(1, "La notizia è vuota."),
  sommario: z.string().trim().max(500),
  sport: z.enum(SPORT),
  categoria: z.enum(CATEGORIE),
  stato: z.enum(STATI),
  slug: z.string().trim().max(90),
  copertinaId: z.number().int().positive().nullable(),

  /**
   * Quando la notizia compare sul sito.
   *
   * Nel futuro significa "programmata": lo stato resta "pubblicata" e le
   * interrogazioni pubbliche scartano le date non ancora arrivate. Vedi la
   * nota in server/notizie.js sul perché non esiste uno stato apposta.
   */
  pubblicataIl: z.coerce.date().nullable()
};

export const schemaNotiziaNuova = z.object({
  titolo: CAMPI.titolo,
  contenuto: CAMPI.contenuto,
  sommario: CAMPI.sommario.optional(),
  sport: CAMPI.sport.optional().default("Altro"),
  categoria: CAMPI.categoria.optional().default("altro"),
  stato: CAMPI.stato.optional().default("bozza"),
  slug: CAMPI.slug.optional(),
  copertinaId: CAMPI.copertinaId.optional(),
  pubblicataIl: CAMPI.pubblicataIl.optional()
});

/**
 * In modifica ogni campo è facoltativo e NESSUNO ha un valore predefinito.
 *
 * Non si può ricavare da schemaNotiziaNuova con .partial(): quel metodo rende
 * i campi facoltativi ma lascia i default, che così finirebbero applicati a
 * ogni modifica. Una richiesta che cambia solo il titolo si porterebbe dietro
 * sport "Altro" e stato "bozza", spubblicando la notizia senza che nessuno
 * l'abbia chiesto. Gli endpoint distinguono "assente" da "cambiato" guardando
 * se il campo è undefined, e con i default non lo sarebbe mai.
 */
export const schemaNotiziaModifica = z.object({
  titolo: CAMPI.titolo.optional(),
  contenuto: CAMPI.contenuto.optional(),
  sommario: CAMPI.sommario.optional(),
  sport: CAMPI.sport.optional(),
  categoria: CAMPI.categoria.optional(),
  stato: CAMPI.stato.optional(),
  slug: CAMPI.slug.optional(),
  copertinaId: CAMPI.copertinaId.optional(),
  pubblicataIl: CAMPI.pubblicataIl.optional()
});

export const schemaElencoNotizie = z.object({
  pagina: z.coerce.number().int().min(1).optional().default(1),
  perPagina: z.coerce.number().int().min(1).max(50).optional().default(12),
  sport: z.enum(SPORT).optional(),
  categoria: z.enum(CATEGORIE).optional(),

  /**
   * Uno stato solo oppure più stati separati da virgola.
   *
   * Il filtro "Bozze" del pannello ne chiede due insieme — bozza e
   * in_revisione — perché sono la stessa cosa per chi guarda: roba non
   * ancora online. Prima lo schema accettava un solo valore, il pannello ne
   * mandava due, e il caso "non è un valore dell'elenco" finiva scartato in
   * silenzio: il filtro spariva e l'elenco mostrava tutto.
   */
  stato: z.preprocess(
    (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v),
    z.array(z.enum(STATI_FILTRO)).min(1).max(STATI_FILTRO.length)
  ).optional(),

  cerca: z.string().trim().max(120).optional()
});

/** Applica uno schema e trasforma l'errore in un 400 con un messaggio leggibile. */
export function valida(schema, dati) {
  const esito = schema.safeParse(dati);
  if (esito.success) return esito.data;

  const primo = esito.error.issues[0];
  const campo = primo.path.join(".");
  throw new ErroreHttp(400, campo ? `${campo}: ${primo.message}` : primo.message);
}

/* =====================================================
   Eventi
   ===================================================== */

export const TIPI_EVENTO = ["partita", "allenamento", "torneo", "riunione", "evento", "altro"];
export const SPORT_SQUADRA = ["Calcio", "Pallavolo", "Basket", "Societa"];

const CAMPI_EVENTO = {
  squadraId: z.coerce.number().int().positive(),
  tipo: z.enum(TIPI_EVENTO),
  // Vuoto significa "quello della squadra": si valorizza solo per derogare
  sport: z.enum(SPORT_SQUADRA).nullable(),
  titolo: z.string().trim().min(2, "Il titolo è troppo corto.").max(200),
  avversario: z.string().trim().max(160).nullable(),
  inizio: z.coerce.date(),
  fine: z.coerce.date().nullable(),
  tuttoIlGiorno: z.boolean(),

  // Da quando compare sul sito. Vuoto significa subito: vedi la nota sulla
  // colonna in db/schema.js, il verso è opposto a quello delle notizie.
  visibileDal: z.coerce.date().nullable(),
  luogo: z.string().trim().max(240).nullable(),

  // Coordinate del punto scelto sulla mappa. Facoltative e sempre in coppia:
  // una latitudine senza longitudine non indica nulla.
  latitudine: z.coerce.number().min(-90).max(90).nullable(),
  longitudine: z.coerce.number().min(-180).max(180).nullable(),
  descrizione: z.string().trim().max(4000).nullable(),
  risultato: z.string().trim().max(60).nullable(),
  parziali: z.string().trim().max(160).nullable(),
  marcatori: z.array(z.string().trim().max(120)).max(40).nullable(),
  diretta: z.string().trim().url("Il collegamento alla diretta non è un indirizzo valido.").max(500).nullable()
};

export const schemaEventoNuovo = z.object({
  squadraId: CAMPI_EVENTO.squadraId,
  tipo: CAMPI_EVENTO.tipo.optional().default("partita"),
  sport: CAMPI_EVENTO.sport.optional(),
  titolo: CAMPI_EVENTO.titolo,
  avversario: CAMPI_EVENTO.avversario.optional(),
  inizio: CAMPI_EVENTO.inizio,
  fine: CAMPI_EVENTO.fine.optional(),
  tuttoIlGiorno: CAMPI_EVENTO.tuttoIlGiorno.optional().default(false),
  visibileDal: CAMPI_EVENTO.visibileDal.optional(),
  luogo: CAMPI_EVENTO.luogo.optional(),
  latitudine: CAMPI_EVENTO.latitudine.optional(),
  longitudine: CAMPI_EVENTO.longitudine.optional(),
  descrizione: CAMPI_EVENTO.descrizione.optional(),
  risultato: CAMPI_EVENTO.risultato.optional(),
  parziali: CAMPI_EVENTO.parziali.optional(),
  marcatori: CAMPI_EVENTO.marcatori.optional(),
  diretta: CAMPI_EVENTO.diretta.optional()
}).refine(
  (e) => !e.fine || e.fine >= e.inizio,
  { message: "La fine non può precedere l'inizio.", path: ["fine"] }
);

/* Stessa avvertenza dello schema delle notizie: niente .partial() su uno
   schema con valori predefiniti, o ogni modifica riporterebbe tipo
   "partita" e tuttoIlGiorno false anche a chi non li ha toccati. */
export const schemaEventoModifica = z.object({
  squadraId: CAMPI_EVENTO.squadraId.optional(),
  tipo: CAMPI_EVENTO.tipo.optional(),
  sport: CAMPI_EVENTO.sport.optional(),
  titolo: CAMPI_EVENTO.titolo.optional(),
  avversario: CAMPI_EVENTO.avversario.optional(),
  inizio: CAMPI_EVENTO.inizio.optional(),
  fine: CAMPI_EVENTO.fine.optional(),
  tuttoIlGiorno: CAMPI_EVENTO.tuttoIlGiorno.optional(),
  visibileDal: CAMPI_EVENTO.visibileDal.optional(),
  luogo: CAMPI_EVENTO.luogo.optional(),
  latitudine: CAMPI_EVENTO.latitudine.optional(),
  longitudine: CAMPI_EVENTO.longitudine.optional(),
  descrizione: CAMPI_EVENTO.descrizione.optional(),
  risultato: CAMPI_EVENTO.risultato.optional(),
  parziali: CAMPI_EVENTO.parziali.optional(),
  marcatori: CAMPI_EVENTO.marcatori.optional(),
  diretta: CAMPI_EVENTO.diretta.optional()
});

export const schemaElencoEventi = z.object({
  da: z.coerce.date().optional(),
  a: z.coerce.date().optional(),
  squadraId: z.coerce.number().int().positive().optional(),
  limite: z.coerce.number().int().min(1).max(1000).optional().default(500)
});

export const schemaAssociazione = z.object({
  utenteId: z.coerce.number().int().positive(),
  squadraId: z.coerce.number().int().positive()
});

/* =====================================================
   Registrazione, password, iscrizioni
   ===================================================== */

/**
 * Requisito minimo della password.
 *
 * Dieci caratteri e nient'altro: nessun obbligo di maiuscole, numeri e
 * simboli. Quelle regole spingono la gente verso "Password1!" e verso il
 * foglietto attaccato al monitor; la lunghezza conta molto di più.
 */
export const schemaPassword = z.string()
  .min(10, "La password deve avere almeno 10 caratteri.")
  .max(200, "La password è troppo lunga.");

/* Gli sport a cui ci si può iscrivere: "Societa" non è uno sport, è il
   calendario degli appuntamenti sociali. */
export const SPORT_ISCRIVIBILI = ["Calcio", "Pallavolo", "Basket"];

export const schemaRegistrazione = z.object({
  email: z.string().trim().toLowerCase().email("Indirizzo email non valido.").max(255),
  password: schemaPassword,
  nome: z.string().trim().min(1, "Indica il nome.").max(80),
  cognome: z.string().trim().min(1, "Indica il cognome.").max(80),
  // Lo sport, non la squadra: quale sia la squadra lo decide chi la compone
  sport: z.enum(SPORT_ISCRIVIBILI, { message: "Scegli lo sport." }),
  note: z.string().trim().max(500).optional()
});

export const schemaCambioPassword = z.object({
  attuale: z.string().min(1, "Inserisci la password attuale.").max(200),
  nuova: schemaPassword
}).refine((d) => d.attuale !== d.nuova, {
  message: "La nuova password deve essere diversa da quella attuale.",
  path: ["nuova"]
});

export const schemaDecisione = z.object({
  id: z.coerce.number().int().positive(),
  approvata: z.boolean(),
  // Obbligatoria quando si accoglie: accogliere SIGNIFICA assegnare una
  // squadra, non esiste un "sì" senza destinazione.
  squadraId: z.coerce.number().int().positive().optional(),
  motivo: z.string().trim().max(300).optional()
}).refine((d) => !d.approvata || d.squadraId, {
  message: "Scegli in quale squadra inserirlo.",
  path: ["squadraId"]
});
