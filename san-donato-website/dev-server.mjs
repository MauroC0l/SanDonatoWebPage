/**
 * Server di sviluppo per le API — solo in locale, mai in produzione.
 *
 * In produzione le richieste sotto /api arrivano alla funzione unica che sta
 * in api/[[...percorso]].js, che le smista. In locale `vite dev` serve solo
 * il front-end, quindi senza questo server le API non esisterebbero e si
 * potrebbe provare il sito soltanto dopo un deploy: un giro lentissimo.
 *
 * Qui dentro c'è il minimo indispensabile: un server HTTP che passa tutto
 * allo STESSO smistatore usato in produzione. Prima questo file si
 * ricostruiva le rotte per conto suo leggendo la cartella — due meccanismi
 * per la stessa cosa, e quindi due modi di divergere senza accorgersene.
 *
 * Avvio:  npm run dev:api    (oppure npm run dev, che avvia entrambi)
 */

import { createServer } from "node:http";
import smista from "./api/[[...percorso]].js";
import { ROTTE } from "./server/rotte.js";

const PORTA = Number(process.env.PORTA_API || 3001);

console.log(`API di sviluppo: ${ROTTE.length} rotte`);
for (const r of ROTTE) {
  const indirizzo = "/api/" + r.segmenti
    .map((s) => (s.tipo === "parametro" ? `:${s.nome}` : s.valore))
    .join("/");
  console.log(`  ${indirizzo}`);
}

createServer(async (req, res) => {
  try {
    await smista(req, res);
  } catch (e) {
    /*
     * In produzione un errore non catturato lo raccoglie Vercel; qui no, e
     * senza questa rete il server morirebbe alla prima svista lasciando il
     * browser in attesa per sempre.
     */
    console.error("Errore:", e);

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ errore: "Errore interno" }));
    }
  }
}).listen(PORTA, () => {
  console.log(`\nIn ascolto su http://localhost:${PORTA}`);
});
