/**
 * Popola la tabella delle squadre.
 *
 * L'elenco arrivava da CALENDARS_CONFIG in src/api/calendarApi.js, dove
 * nomi, colori e variabili CSS erano scritti nel codice: aggiungere una
 * squadra voleva dire modificare un file e ridistribuire il sito. Da qui in
 * avanti è una riga in tabella.
 *
 * È ripetibile: la chiave è lo slug.
 *
 * Uso:
 *   node --env-file=.env scripts/semina-squadre.mjs
 */

import { getDb, chiudiDb } from "../db/client.js";
import { squadre } from "../db/schema.js";

/* Nomi, colori e variabili CSS trascritti dalla configurazione precedente,
   nello stesso ordine in cui comparivano. */
const ELENCO = [
  ["Eventi PSD", "eventi-psd", "#6c5ce7"],
  ["Segreteria PSD", "segreteria-psd", "#402ae0ff"],
  ["Calcio Seconda Categoria", "calcio-seconda-categoria", "#27ae60"],
  ["Calcio Allievi", "calcio-allievi", "#2ecc71"],
  ["Calcio Juniores", "calcio-juniores", "#16a085"],
  ["Calcio Open", "calcio-open", "#1abc9c"],
  ["Calcio Ragazzi", "calcio-ragazzi", "#e67e22"],
  ["Calcio U12", "calcio-u12", "#f39c12"],
  ["Volley Eccellenza B", "volley-eccellenza-b", "#d63031"],
  ["Volley Eccellenza C", "volley-eccellenza-c", "#e17055"],
  ["Volley Mista", "volley-mista", "#fd79a8"],
  ["Volley Mista Light", "volley-mista-light", "#e84393"],
  ["Volley U13", "volley-u13", "#a569bd"],
  ["Volley U14", "volley-u14", "#8e44ad"],
  ["Volley U15", "volley-u15", "#9b59b6"],
  ["Volley U16", "volley-u16", "#74b9ff"],
  ["Volley U17", "volley-u17", "#0984e3"],
  ["Volley U18", "volley-u18", "#2980b9"],
  ["Basket Open", "basket-open", "#c0392b"],
  ["Basket U19", "basket-u19", "#d35400"]
];

/**
 * Lo sport si ricava dal nome.
 *
 * "Volley" diventa "Pallavolo": nel resto del sito la sezione delle notizie
 * si chiama così, e avere due nomi per la stessa disciplina costringerebbe
 * a tradurre da qualche parte, prima o poi sbagliando.
 */
function sportDa(nome) {
  if (nome.startsWith("Calcio")) return "Calcio";
  if (nome.startsWith("Volley")) return "Pallavolo";
  if (nome.startsWith("Basket")) return "Basket";
  return "Societa";
}

async function main() {
  const db = getDb();
  for (const [nome, cssVar, colore] of ELENCO) {
    await db.insert(squadre).values({
      nome,
      slug: cssVar,
      sport: sportDa(nome),
      colore,
      cssVar,
      ordine: ELENCO.findIndex((v) => v[1] === cssVar)
    }).onConflictDoUpdate({
      target: squadre.slug,
      set: { nome, colore, cssVar, sport: sportDa(nome) }
    });
  }

  const salvate = await db.select({ sport: squadre.sport }).from(squadre);
  const perSport = salvate.reduce((acc, s) => ({ ...acc, [s.sport]: (acc[s.sport] || 0) + 1 }), {});

  console.log(`\n✅ ${salvate.length} voci in tabella:`, perSport);
}

main()
  .catch((e) => {
    console.error("\n❌", e.message);
    process.exitCode = 1;
  })
  .finally(() => chiudiDb());
