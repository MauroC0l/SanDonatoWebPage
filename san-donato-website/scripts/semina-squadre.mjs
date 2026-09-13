/**
 * Popola la tabella delle squadre.
 *
 * L'elenco arrivava da CALENDARS_CONFIG in src/api/calendarApi.js, dove
 * nomi, colori e variabili CSS erano scritti nel codice: aggiungere una
 * squadra voleva dire modificare un file e ridistribuire il sito. Da qui in
 * avanti è una riga in tabella.
 *
 * Gli identificativi dei calendari Google si leggono dalle variabili
 * d'ambiente, se presenti: servono solo all'importazione dello storico
 * (scripts/importa-eventi-google.mjs) e poi non vengono più usati.
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
  ["VITE_PSD_CALENDAR_ID", "Eventi PSD", "eventi-psd", "#6c5ce7"],
  ["VITE_PSD_SEGRETERIA_CALENDAR_ID", "Segreteria PSD", "segreteria-psd", "#402ae0ff"],
  ["VITE_CALCIO_SECONDA_CATEGORIA_CALENDAR_ID", "Calcio Seconda Categoria", "calcio-seconda-categoria", "#27ae60"],
  ["VITE_CALCIO_ALLIEVI_CALENDAR_ID", "Calcio Allievi", "calcio-allievi", "#2ecc71"],
  ["VITE_CALCIO_JUNIORES_CALENDAR_ID", "Calcio Juniores", "calcio-juniores", "#16a085"],
  ["VITE_CALCIO_OPEN_CALENDAR_ID", "Calcio Open", "calcio-open", "#1abc9c"],
  ["VITE_CALCIO_RAGAZZI_CALENDAR_ID", "Calcio Ragazzi", "calcio-ragazzi", "#e67e22"],
  ["VITE_CALCIO_U12_CALENDAR_ID", "Calcio U12", "calcio-u12", "#f39c12"],
  ["VITE_VOLLEY_ECCELLENZA_B_CALENDAR_ID", "Volley Eccellenza B", "volley-eccellenza-b", "#d63031"],
  ["VITE_VOLLEY_ECCELLENZA_C_CALENDAR_ID", "Volley Eccellenza C", "volley-eccellenza-c", "#e17055"],
  ["VITE_VOLLEY_MISTA_CALENDAR_ID", "Volley Mista", "volley-mista", "#fd79a8"],
  ["VITE_VOLLEY_MISTA_LIGHT_CALENDAR_ID", "Volley Mista Light", "volley-mista-light", "#e84393"],
  ["VITE_VOLLEY_U13_CALENDAR_ID", "Volley U13", "volley-u13", "#a569bd"],
  ["VITE_VOLLEY_U14_CALENDAR_ID", "Volley U14", "volley-u14", "#8e44ad"],
  ["VITE_VOLLEY_U15_CALENDAR_ID", "Volley U15", "volley-u15", "#9b59b6"],
  ["VITE_VOLLEY_U16_CALENDAR_ID", "Volley U16", "volley-u16", "#74b9ff"],
  ["VITE_VOLLEY_U17_CALENDAR_ID", "Volley U17", "volley-u17", "#0984e3"],
  ["VITE_VOLLEY_U18_CALENDAR_ID", "Volley U18", "volley-u18", "#2980b9"],
  ["VITE_BASKET_OPEN_CALENDAR_ID", "Basket Open", "basket-open", "#c0392b"],
  ["VITE_BASKET_U19_CALENDAR_ID", "Basket U19", "basket-u19", "#d35400"]
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
  let conCalendario = 0;

  for (const [variabile, nome, cssVar, colore] of ELENCO) {
    const calendarioGoogleId = process.env[variabile] || null;
    if (calendarioGoogleId) conCalendario++;

    await db.insert(squadre).values({
      nome,
      slug: cssVar,
      sport: sportDa(nome),
      colore,
      cssVar,
      ordine: ELENCO.findIndex((v) => v[2] === cssVar),
      calendarioGoogleId
    }).onConflictDoUpdate({
      target: squadre.slug,
      set: { nome, colore, cssVar, sport: sportDa(nome), calendarioGoogleId }
    });
  }

  const salvate = await db.select({ sport: squadre.sport }).from(squadre);
  const perSport = salvate.reduce((acc, s) => ({ ...acc, [s.sport]: (acc[s.sport] || 0) + 1 }), {});

  console.log(`\n✅ ${salvate.length} voci in tabella:`, perSport);

  if (conCalendario === 0) {
    console.log(
      "\n   Nessun identificativo di calendario Google trovato fra le variabili\n" +
      "   d'ambiente. Servono solo per importare lo storico degli eventi:\n" +
      "   vanno messi in .env con i nomi VITE_*_CALENDAR_ID."
    );
  } else {
    console.log(`   ${conCalendario} squadre con il calendario Google collegato.`);
  }
}

main()
  .catch((e) => {
    console.error("\n❌", e.message);
    process.exitCode = 1;
  })
  .finally(() => chiudiDb());
