// Configurazione di drizzle-kit: genera le migrazioni SQL a partire da
// db/schema.js e le applica al database.
//
// DATABASE_URL arriva da .env (ignorato da git). Gli script in package.json
// usano --env-file di Node, quindi non serve la libreria dotenv.

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.js",
  out: "./db/migrazioni",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL
  },
  // Le migrazioni sono file SQL nel repository: si leggono in revisione
  // e si applicano identiche in locale e in produzione.
  verbose: true,
  strict: true
});
