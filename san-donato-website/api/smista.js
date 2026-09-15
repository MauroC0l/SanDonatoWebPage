/**
 * L'unica funzione del sito: riceve tutto ciò che sta sotto /api e smista.
 *
 * PERCHÉ UNA SOLA
 *
 * Su Vercel, senza un framework che le impacchetti, ogni file dentro api/
 * diventa una funzione a sé: trentacinque file, trentacinque funzioni. Il
 * piano gratuito ne ammette dodici, e il deploy si rifiutava di partire.
 *
 * Le rotte vere vivono ora in server/rotte/, che per Vercel sono moduli
 * come tutti gli altri. Qui dentro c'è solo il centralino.
 *
 * Non è un ripiego per risparmiare: con trentacinque funzioni ognuna si
 * sveglia a freddo per conto suo, e chi apre il sito paga l'attesa la prima
 * volta che tocca ogni indirizzo diverso. Con una sola, la prima chiamata
 * scalda tutto il resto.
 *
 * PERCHÉ SI CHIAMA COSÌ E NON [[...percorso]].js
 *
 * Quel nome — la "catch-all facoltativa" — è una convenzione di Next.js, e
 * noi Next.js non lo usiamo: Vercel non lo riconosceva, non creava nessuna
 * funzione, e ogni chiamata all'API finiva nella regola che manda tutto a
 * index.html. Il sintomo era un 405 sul login: il browser mandava una POST
 * a un file statico.
 *
 * Adesso il nome è normale e a mandare qui le richieste è una riscrittura
 * scritta in vercel.json, che è documentata e non dipende da convenzioni di
 * un framework che non abbiamo.
 *
 * COSA FA VERCEL PER NOI, E COSA RESTA A NOI
 *
 * Vercel riempie req.body e req.query e aggiunge res.status(). A noi resta
 * di capire quale rotta risponde e di rimettere in req.query i parametri
 * con i loro nomi: una scheda atleta cerca req.query.id, non il terzo pezzo
 * di un indirizzo.
 */

import { trovaRotta } from "../server/rotte.js";

/**
 * I pezzi dell'indirizzo chiesto, già decodificati.
 *
 * Due strade perché ci si arriva in due modi:
 *
 *   - in produzione la riscrittura di vercel.json porta qui dentro il
 *     percorso originale come parametro "percorso", perché dopo una
 *     riscrittura req.url mostra la destinazione e non più la richiesta;
 *   - in locale il server di sviluppo chiama questa funzione con la
 *     richiesta così com'è, e il percorso sta ancora dentro req.url.
 */
export function pezziChiesti(req, url) {
  const riscritto = req.query?.percorso ?? url.searchParams.get("percorso");

  if (riscritto) {
    // Già decodificato una volta: da qui passa come valore di query
    const testo = Array.isArray(riscritto) ? riscritto.join("/") : String(riscritto);
    return testo.split("/").filter(Boolean);
  }

  // Dentro a un pathname le sequenze %XX ci sono ancora: vanno sciolte
  return url.pathname
    .replace(/^\/api\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((pezzo) => decodeURIComponent(pezzo));
}

export default async function smista(req, res) {
  /*
   * Lo stile Vercel: res.status(404).end(...).
   *
   * In produzione c'è già, ma questa funzione la usa anche il server di
   * sviluppo locale, che non lo aggiunge. Una riga, e i due ambienti si
   * comportano allo stesso modo.
   */
  if (typeof res.status !== "function") {
    res.status = (codice) => { res.statusCode = codice; return res; };
  }

  // L'host non conta: serve solo perché URL vuole un indirizzo completo.
  const url = new URL(req.url, "http://interno");
  const pezzi = pezziChiesti(req, url);
  const esito = trovaRotta(pezzi);

  if (!esito) {
    res.status(404).setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ errore: `Nessuna rotta per /api/${pezzi.join("/")}` }));
    return;
  }

  /*
   * I parametri della query PIÙ quelli dell'indirizzo, con i nomi che gli
   * endpoint si aspettano. I secondi vincono sui primi: un "?id=7" scritto
   * a mano non deve poter scavalcare l'id che sta nell'indirizzo.
   *
   * "percorso" si toglie: è roba di smistamento, ce l'ha messa la
   * riscrittura, e agli endpoint non serve — a uno che cerca un parametro
   * con quel nome direbbe una bugia.
   */
  const query = {
    ...(req.query ?? {}),
    ...Object.fromEntries(url.searchParams.entries()),
    ...esito.parametri
  };

  delete query.percorso;
  req.query = query;

  await esito.rotta.handler(req, res);
}
