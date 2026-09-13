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
