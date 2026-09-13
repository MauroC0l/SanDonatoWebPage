/**
 * Connessione al database.
 *
 * Driver standard di Postgres (pg): funziona con un Postgres in locale,
 * con uno su una macchina nostra, e con qualunque servizio gestito.
 * Nessun legame con un fornitore: l'hosting si sceglie quando serve, e
 * cambiarlo vorrà dire cambiare DATABASE_URL, non il codice.
 *
 * Nota per quando decideremo l'hosting: se finiremo su funzioni serverless,
 * una connessione TCP per invocazione esaurisce le connessioni del database
 * molto prima del traffico. In quel caso si aggiunge un pooler (PgBouncer,
 * o il driver HTTP del fornitore) toccando SOLO questo file.
 */

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

let pool = null;
let istanza = null;

export function getDb() {
  if (istanza) return istanza;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL non impostata. Copia .env.esempio in .env e indica il tuo Postgres."
    );
  }

  pool = new pg.Pool({
    connectionString: url,
    // In locale il TLS non serve; sui servizi gestiti sì, e lo si attiva
    // mettendo ?sslmode=require nella stringa di connessione.
    max: 10
  });

  istanza = drizzle(pool, { schema });
  return istanza;
}

/** Chiude le connessioni: serve agli script, che altrimenti non terminano. */
export async function chiudiDb() {
  if (pool) {
    await pool.end();
    pool = null;
    istanza = null;
  }
}

export { schema };
