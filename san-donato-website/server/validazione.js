/**
 * Forme accettate dalle API.
 *
 * La validazione sta ai confini: dentro, il resto del codice può dare per
 * buono ciò che riceve invece di controllare ogni campo a ogni passaggio.
 */

import { z } from "zod";
import { ErroreHttp } from "./risposte.js";

export const SPORT = ["Calcio", "Pallavolo", "Minivolley", "Basket", "Altro"];
export const STATI = ["bozza", "in_revisione", "pubblicata", "cestino"];

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
  stato: z.enum(STATI),
  slug: z.string().trim().max(90),
  copertinaId: z.number().int().positive().nullable()
};

export const schemaNotiziaNuova = z.object({
  titolo: CAMPI.titolo,
  contenuto: CAMPI.contenuto,
  sommario: CAMPI.sommario.optional(),
  sport: CAMPI.sport.optional().default("Altro"),
  stato: CAMPI.stato.optional().default("bozza"),
  slug: CAMPI.slug.optional(),
  copertinaId: CAMPI.copertinaId.optional()
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
  stato: CAMPI.stato.optional(),
  slug: CAMPI.slug.optional(),
  copertinaId: CAMPI.copertinaId.optional()
});

export const schemaElencoNotizie = z.object({
  pagina: z.coerce.number().int().min(1).optional().default(1),
  perPagina: z.coerce.number().int().min(1).max(50).optional().default(12),
  sport: z.enum(SPORT).optional(),
  stato: z.enum(STATI).optional(),
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

export const TIPI_EVENTO = ["partita", "allenamento", "torneo", "riunione", "altro"];

const CAMPI_EVENTO = {
  squadraId: z.coerce.number().int().positive(),
  tipo: z.enum(TIPI_EVENTO),
  titolo: z.string().trim().min(2, "Il titolo è troppo corto.").max(200),
  avversario: z.string().trim().max(160).nullable(),
  inizio: z.coerce.date(),
  fine: z.coerce.date().nullable(),
  tuttoIlGiorno: z.boolean(),
  luogo: z.string().trim().max(240).nullable(),
  descrizione: z.string().trim().max(4000).nullable(),
  risultato: z.string().trim().max(60).nullable(),
  parziali: z.string().trim().max(160).nullable(),
  marcatori: z.array(z.string().trim().max(120)).max(40).nullable(),
  diretta: z.string().trim().url("Il collegamento alla diretta non è un indirizzo valido.").max(500).nullable()
};

export const schemaEventoNuovo = z.object({
  squadraId: CAMPI_EVENTO.squadraId,
  tipo: CAMPI_EVENTO.tipo.optional().default("partita"),
  titolo: CAMPI_EVENTO.titolo,
  avversario: CAMPI_EVENTO.avversario.optional(),
  inizio: CAMPI_EVENTO.inizio,
  fine: CAMPI_EVENTO.fine.optional(),
  tuttoIlGiorno: CAMPI_EVENTO.tuttoIlGiorno.optional().default(false),
  luogo: CAMPI_EVENTO.luogo.optional(),
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
  titolo: CAMPI_EVENTO.titolo.optional(),
  avversario: CAMPI_EVENTO.avversario.optional(),
  inizio: CAMPI_EVENTO.inizio.optional(),
  fine: CAMPI_EVENTO.fine.optional(),
  tuttoIlGiorno: CAMPI_EVENTO.tuttoIlGiorno.optional(),
  luogo: CAMPI_EVENTO.luogo.optional(),
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
