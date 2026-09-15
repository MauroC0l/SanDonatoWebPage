/**
 * Assegna una categoria alle notizie che non ce l'hanno.
 *
 *   node --env-file=.env scripts/classifica-notizie.mjs            prova
 *   node --env-file=.env scripts/classifica-notizie.mjs --applica  scrive
 *   node --env-file=.env scripts/classifica-notizie.mjs --tutte    anche le già categorizzate
 *
 * PERCHÉ UNA VOLTA SOLA E NON A OGNI SALVATAGGIO: indovinare la categoria
 * dalle parole è utile per smaltire un archivio di 98 articoli ereditati da
 * WordPress, dove nessuno aveva un campo da compilare. Da domani la sceglie
 * chi scrive, dal menu nell'editor, e una macchina che gliela cambia sotto
 * sarebbe solo un dispetto.
 *
 * PERCHÉ NON INDOVINA TUTTO: quello che resta ambiguo finisce in "altro" di
 * proposito. Una categoria sbagliata è peggio di una categoria mancante —
 * la prima manda fuori strada chi cerca, la seconda si vede subito ed è già
 * in cima all'elenco da sistemare a mano.
 */

import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { notizie } from "../db/schema.js";

const APPLICA = process.argv.includes("--applica");
const TUTTE = process.argv.includes("--tutte");

/*
 * Le parole che fanno propendere per una categoria, con quanto pesano.
 *
 * A punteggio: la prima regola che combacia vincerebbe per caso — "NATALE
 * 2024 – Celebrazioni in Parrocchia" ha dentro sia una festa sia la
 * parrocchia, e quale delle due conti dipende da come si ordina l'elenco.
 * Sommando i punti la decisione si può almeno leggere e discutere.
 *
 * Le parole stanno senza accenti e in minuscolo: il titolo viene ripulito
 * allo stesso modo prima del confronto, così "SOCIETÀ" e "societa" sono la
 * stessa cosa.
 */
const REGOLE = {
  solidarieta: [
    ["5 x 1000", 6], ["5x1000", 6], ["5 1000", 6], ["cinque per mille", 6],
    ["razzismo", 5], ["solidariet", 5], ["beneficenza", 5],
    ["raccolta fondi", 4], ["valore sociale", 4], ["inclusione", 4],
    ["territorio", 2], ["volontari", 2]
  ],

  societa: [
    ["assemblea", 6], ["consiglio direttivo", 6], ["statuto", 6],
    ["documenti approvati", 5], ["bilancio", 5], ["elettiva", 5],
    ["vademecum", 5], ["tariffe", 5], ["convocazione", 4],
    ["iscrizion", 3], ["quote", 3], ["soci", 3],
    ["stagione", 2], ["start", 2], ["segreteria", 2]
  ],

  eventi: [
    ["lotteria", 6], ["sottoscrizione a premi", 6], ["christmas party", 6],
    ["festa", 5], ["party", 5], ["quiz night", 5], ["estrazione", 5],
    ["compleanno", 5], ["murales", 4], ["premiazione", 4],
    ["partita piu lunga", 5], ["terzo tempo", 4], ["torneo", 3],
    ["natale", 3], ["pasqua", 3], ["patronale", 3], ["cena", 3],
    ["auguri", 2], ["istantanee", 2]
  ],

  sport: [
    ["campionato", 5], ["campione", 5], ["playoff", 5], ["girone", 5],
    ["tim cup", 4], ["coppa", 4], ["finale", 4], ["semifinale", 4],
    ["under", 3], ["juniores", 3], ["prima squadra", 3], ["open", 2],
    ["partita", 2], ["vittoria", 3], ["sconfitta", 3], ["allenamento", 3],
    ["convocati", 3], ["classifica", 3], ["risultati", 3]
  ]
};

/* Sotto questo punteggio non si decide. Cinque è appena sopra il singolo
   aggancio debole in un sommario: con la soglia a tre finivano catalogate
   cose come "L'attività sportiva entra nella Costituzione", che di una
   categoria non ne ha nessuna. */
const SOGLIA = 5;

/** Minuscolo, senza accenti e senza punteggiatura: come lo confronta. */
export function ripulisci(testo) {
  return String(testo || "")
    .toLowerCase()
    // NFD spezza ogni lettera accentata in "lettera + segno", e la riga qui
    // sotto tiene solo lettere e cifre: il segno cade insieme alla
    // punteggiatura, e "società" diventa "societa". Fatto così invece che
    // con l'intervallo dei caratteri combinanti, che scritto nel sorgente
    // sarebbe una riga di caratteri invisibili.
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * La categoria di una notizia, e con quanta convinzione.
 *
 * Il titolo pesa il triplo del sommario: chi scrive mette lì la sostanza, e
 * un sommario lungo contiene parole di passaggio che non dicono di cosa
 * parla l'articolo.
 */
export function classifica({ titolo, sommario, sport }) {
  const nelTitolo = ripulisci(titolo);
  const nelSommario = ripulisci(sommario);

  const punti = {};

  for (const [categoria, parole] of Object.entries(REGOLE)) {
    let somma = 0;
    for (const [parola, peso] of parole) {
      if (nelTitolo.includes(parola)) somma += peso * 3;
      else if (nelSommario.includes(parola)) somma += peso;
    }
    punti[categoria] = somma;
  }

  /* Uno sport dichiarato è un voto per "sport", non una sentenza: metà
     degli articoli su una festa di Natale del settore calcio hanno lo sport
     compilato, e non parlano di partite. */
  if (sport && sport !== "Altro") punti.sport += 6;

  const ordinate = Object.entries(punti).sort((a, b) => b[1] - a[1]);
  const [vincente, punteggio] = ordinate[0];
  const secondo = ordinate[1][1];

  // Due categorie appaiate significano che il testo parla di entrambe: la
  // sceglie una persona, non questo script.
  if (punteggio < SOGLIA || punteggio === secondo) {
    return { categoria: "altro", punteggio, motivo: "incerto" };
  }

  return { categoria: vincente, punteggio, motivo: "parole" };
}

async function main() {
  const db = getDb();

  const righe = await db
    .select({
      id: notizie.id,
      titolo: notizie.titolo,
      sommario: notizie.sommario,
      sport: notizie.sport,
      categoria: notizie.categoria
    })
    .from(notizie)
    .where(TUTTE ? sql`true` : eq(notizie.categoria, "altro"))
    .orderBy(notizie.id);

  console.log(`Notizie da guardare: ${righe.length}${TUTTE ? " (tutte)" : " (solo quelle in \"altro\")"}\n`);

  const conteggio = {};
  const daScrivere = [];

  for (const riga of righe) {
    const esito = classifica(riga);
    conteggio[esito.categoria] = (conteggio[esito.categoria] ?? 0) + 1;

    if (esito.categoria !== riga.categoria) {
      daScrivere.push({ id: riga.id, categoria: esito.categoria });
      console.log(
        `${String(riga.id).padStart(4)}  ${esito.categoria.padEnd(12)} `
        + `(${String(esito.punteggio).padStart(3)})  ${riga.titolo.slice(0, 70)}`
      );
    }
  }

  console.log("\nRisultato:");
  for (const [categoria, quante] of Object.entries(conteggio).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${categoria.padEnd(12)} ${quante}`);
  }

  if (!APPLICA) {
    console.log(`\nNiente è stato scritto. Con --applica ne cambierebbe ${daScrivere.length}.`);
    return;
  }

  // Una per volta e non un CASE gigante: sono un centinaio di righe una
  // volta sola, e in cambio l'errore su una non porta giù le altre.
  for (const { id, categoria } of daScrivere) {
    await db.update(notizie).set({ categoria }).where(eq(notizie.id, id));
  }

  console.log(`\nScritte ${daScrivere.length} notizie.`);
}

/*
 * Parte solo se lanciato da riga di comando.
 *
 * I test importano questo file per provare classifica() sui titoli veri
 * dell'archivio: senza questa guardia, importarlo aprirebbe una
 * connessione al database e riscriverebbe le notizie.
 */
const lanciatoDaSolo = process.argv[1] && process.argv[1].endsWith("classifica-notizie.mjs");

if (lanciatoDaSolo) {
  main().then(() => process.exit(0), (e) => {
    console.error(e);
    process.exit(1);
  });
}
