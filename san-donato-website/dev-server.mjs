/**
 * Server di sviluppo per le API — solo in locale, mai in produzione.
 *
 * In produzione ogni file dentro api/ diventa una funzione su Vercel.
 * In locale `vite dev` serve solo il front-end, quindi senza questo server
 * le API non esisterebbero e si potrebbe provare il sito solo dopo un
 * deploy: un giro lentissimo.
 *
 * Riproduce le tre cose che Vercel fa per noi:
 *   1. associa i file di api/ agli indirizzi, con i segmenti [dinamici]
 *   2. mette i parametri in req.query
 *   3. aggiunge res.status() allo stile di Node
 *
 * Avvio:  npm run dev:api    (oppure npm run dev, che avvia entrambi)
 */

import { createServer } from "node:http";
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const PORTA = Number(process.env.PORTA_API || 3001);

// fileURLToPath e non .pathname: quest'ultimo lascia i caratteri codificati,
// e un percorso che contiene uno spazio arriverebbe con %20 dentro.
const CARTELLA_API = fileURLToPath(new URL("./api/", import.meta.url));

/* =====================================================
   Scoperta delle rotte
   ===================================================== */

async function elencaFile(cartella) {
  const voci = await readdir(cartella, { withFileTypes: true });
  const file = [];

  for (const voce of voci) {
    const percorso = join(cartella, voce.name);
    if (voce.isDirectory()) file.push(...await elencaFile(percorso));
    else if (voce.name.endsWith(".js")) file.push(percorso);
  }
  return file;
}

/** "notizie/[identificativo].js" -> { segmenti, dinamica } */
function componiRotta(percorsoRelativo) {
  const senzaEstensione = percorsoRelativo.replace(/\.js$/, "");
  const pezzi = senzaEstensione.split(sep).filter(Boolean);

  // index.js rappresenta la cartella che lo contiene
  if (pezzi.at(-1) === "index") pezzi.pop();

  const segmenti = pezzi.map((p) => {
    const dinamico = p.match(/^\[(.+)\]$/);
    return dinamico ? { tipo: "parametro", nome: dinamico[1] } : { tipo: "fisso", valore: p };
  });

  return { segmenti, dinamica: segmenti.some((s) => s.tipo === "parametro") };
}

async function caricaRotte() {
  const file = await elencaFile(CARTELLA_API);
  const rotte = [];

  for (const percorso of file) {
    const { segmenti, dinamica } = componiRotta(relative(CARTELLA_API, percorso));
    const modulo = await import(pathToFileURL(percorso).href);

    if (typeof modulo.default !== "function") {
      console.warn(`  saltato (nessun handler): ${relative(CARTELLA_API, percorso)}`);
      continue;
    }
    rotte.push({ segmenti, dinamica, handler: modulo.default, percorso });
  }

  // Le rotte fisse vincono su quelle dinamiche: /api/notizie/ultime-per-sport
  // non deve finire dentro /api/notizie/[identificativo]
  return rotte.sort((a, b) => Number(a.dinamica) - Number(b.dinamica));
}

function abbina(rotte, pezziUrl) {
  for (const rotta of rotte) {
    if (rotta.segmenti.length !== pezziUrl.length) continue;

    const parametri = {};
    let combacia = true;

    for (let i = 0; i < rotta.segmenti.length; i++) {
      const atteso = rotta.segmenti[i];
      if (atteso.tipo === "parametro") parametri[atteso.nome] = decodeURIComponent(pezziUrl[i]);
      else if (atteso.valore !== pezziUrl[i]) { combacia = false; break; }
    }

    if (combacia) return { rotta, parametri };
  }
  return null;
}

/* =====================================================
   Avvio
   ===================================================== */

const rotte = await caricaRotte();

console.log(`API di sviluppo: ${rotte.length} rotte`);
for (const r of rotte) {
  const indirizzo = "/api/" + r.segmenti
    .map((s) => (s.tipo === "parametro" ? `:${s.nome}` : s.valore))
    .join("/");
  console.log(`  ${indirizzo}`);
}

createServer(async (req, res) => {
  // Stile Vercel: res.status(404).end(...)
  res.status = (codice) => { res.statusCode = codice; return res; };

  const url = new URL(req.url, `http://localhost:${PORTA}`);

  if (!url.pathname.startsWith("/api/")) {
    res.status(404).end(JSON.stringify({ errore: "Fuori da /api" }));
    return;
  }

  const pezzi = url.pathname.slice(5).split("/").filter(Boolean);
  const esito = abbina(rotte, pezzi);

  if (!esito) {
    res.status(404).setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ errore: `Nessuna rotta per ${url.pathname}` }));
    return;
  }

  req.query = { ...Object.fromEntries(url.searchParams.entries()), ...esito.parametri };

  try {
    await esito.rotta.handler(req, res);
  } catch (e) {
    console.error("Errore:", e);
    if (!res.headersSent) {
      res.status(500).setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ errore: "Errore interno" }));
    }
  }
}).listen(PORTA, () => {
  console.log(`\nIn ascolto su http://localhost:${PORTA}`);
});
