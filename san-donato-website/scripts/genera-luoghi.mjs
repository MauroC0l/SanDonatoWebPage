/**
 * Rigenera src/data/luoghi.js con tutti i comuni e le province d'Italia.
 *
 *   node scripts/genera-luoghi.mjs
 *
 * I dati arrivano da un elenco pubblico costruito sulle tabelle ISTAT
 * (github.com/matteocontrini/comuni-json). Si scaricano qui e non a ogni
 * avvio del sito per due motivi: non si dipende da un server di terzi per
 * far funzionare un modulo, e l'elenco cambia una volta ogni tanto — quando
 * un comune nasce da una fusione — non tutti i giorni.
 *
 * PERCHÉ UNO SCRIPT E NON UN FILE SCRITTO A MANO: sono quasi ottomila voci.
 * A mano non si scrivono, e soprattutto non si aggiornano: dopo la prossima
 * fusione di comuni si rilancia questo e si commette il risultato.
 *
 * Il file prodotto raggruppa i comuni per sigla di provincia, perché è così
 * che li usa il modulo: scelta la provincia, si propongono solo i suoi.
 */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const FONTE = "https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json";
const USCITA = fileURLToPath(new URL("../src/data/luoghi.js", import.meta.url));

/* Le taglie non c'entrano con l'ISTAT: stanno qui perché il file prodotto le
   deve contenere, e riscriverle a mano dopo ogni rigenerazione sarebbe il
   modo migliore per perderle. */
const TAGLIE = [
  "4 anni", "6 anni", "8 anni", "10 anni", "12 anni", "14 anni", "16 anni",
  "XS", "S", "M", "L", "XL", "XXL", "3XL"
];

const INTESTAZIONE = `/**
 * Comuni e province d'Italia.
 *
 * GENERATO DA scripts/genera-luoghi.mjs — non si modifica a mano.
 * Per aggiornarlo: node scripts/genera-luoghi.mjs
 *
 * I comuni sono raggruppati per sigla di provincia perché è così che li usa
 * il modulo dell'iscrizione: scelta la provincia si propongono solo i suoi,
 * che porta le voci da ottomila a qualche decina — una differenza che si
 * sente scrivendo, non nel tempo di calcolo.
 *
 * Fonte: elenco pubblico costruito sulle tabelle ISTAT.
 */
`;

async function main() {
  process.stdout.write("Scarico l'elenco… ");

  const risposta = await fetch(FONTE, { headers: { Accept: "application/json" } });
  if (!risposta.ok) throw new Error(`La fonte ha risposto ${risposta.status}.`);

  const comuni = await risposta.json();
  console.log(`${comuni.length} comuni.`);

  /* Province: sigla e nome, una volta sola ciascuna. La sigla è la chiave
     perché è corta, stabile e stampata sui documenti. */
  const province = new Map();
  const perProvincia = {};

  for (const c of comuni) {
    const sigla = c.sigla;
    const nome = c.provincia?.nome;
    if (!sigla || !nome) continue;

    if (!province.has(sigla)) province.set(sigla, nome);
    (perProvincia[sigla] ??= []).push(c.nome);
  }

  for (const elenco of Object.values(perProvincia)) {
    elenco.sort((a, b) => a.localeCompare(b, "it"));
  }

  const elencoProvince = [...province]
    .map(([sigla, nome]) => ({ sigla, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));

  console.log(`Province: ${elencoProvince.length}.`);

  const contenuto = [
    INTESTAZIONE,
    "/** Le province, in ordine alfabetico. */",
    `export const PROVINCE = ${JSON.stringify(elencoProvince)};`,
    "",
    "/** I comuni di ciascuna provincia, per sigla. */",
    `export const COMUNI_PER_PROVINCIA = ${JSON.stringify(perProvincia)};`,
    "",
    "/** Tutti i comuni insieme, per quando la provincia non è ancora stata scelta. */",
    "export const COMUNI = Object.values(COMUNI_PER_PROVINCIA)",
    "  .flat()",
    "  .sort((a, b) => a.localeCompare(b, \"it\"));",
    "",
    "/**",
    " * Le taglie proposte per la maglia da gara.",
    " *",
    " * I bambini si misurano in anni e gli adulti in lettere: un elenco solo",
    " * con dentro tutte e due, perché a chiedere \"quale delle due tabelle usi\"",
    " * si fa più confusione che a scorrere quattordici voci.",
    " */",
    `export const TAGLIE = ${JSON.stringify(TAGLIE)};`,
    ""
  ].join("\n");

  await writeFile(USCITA, contenuto);

  const kb = Math.round(Buffer.byteLength(contenuto) / 1024);
  console.log(`Scritto src/data/luoghi.js (${kb} KB).`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
