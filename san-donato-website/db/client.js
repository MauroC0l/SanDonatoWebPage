/**
 * Connessione al database.
 *
 * Il driver di Neon parla in HTTP invece che con una connessione TCP
 * persistente. È la scelta giusta in ambiente serverless, dove ogni
 * richiesta può svegliare un processo diverso: con un driver classico si
 * esauriscono le connessioni del database molto prima di esaurire il traffico.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

let istanza = null;

export function getDb() {
  if (istanza) return istanza;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL non impostata. In locale va in .env, su Vercel fra le variabili d'ambiente del progetto."
    );
  }

  istanza = drizzle(neon(url), { schema });
  return istanza;
}

export { schema };
