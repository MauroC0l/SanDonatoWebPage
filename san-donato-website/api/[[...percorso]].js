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
 * Il prezzo, scritto qui perché non si scopra dopo: il pacchetto è unico e
 * comprende il codice di tutte le rotte, quindi è più grosso di quanto
 * servirebbe a una chiamata sola. Con trentacinque rotte che condividono
 * quasi tutte le stesse dipendenze — database, sessioni, validazione — la
 * differenza è minima.
 *
 * COSA FA VERCEL PER NOI, E COSA RESTA A NOI
 *
 * Vercel riempie req.body e req.query, aggiunge res.status() e ci consegna
 * i pezzi dell'indirizzo in req.query.percorso, perché il nome del file è
 * [[...percorso]]. A noi resta di riconoscere quale rotta risponde e di
 * rimettere in req.query i parametri con i loro nomi: una scheda atleta
 * cerca req.query.id, non req.query.percorso[2].
 */

import { trovaRotta } from "../server/rotte.js";

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

  if (!url.pathname.startsWith("/api/") && url.pathname !== "/api") {
    res.status(404).setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ errore: "Fuori da /api" }));
    return;
  }

  const pezzi = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const esito = trovaRotta(pezzi);

  if (!esito) {
    res.status(404).setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ errore: `Nessuna rotta per ${url.pathname}` }));
    return;
  }

  /*
   * I parametri della query PIÙ quelli dell'indirizzo, con i nomi che gli
   * endpoint si aspettano. I secondi vincono sui primi: un "?id=7" scritto
   * a mano non deve poter scavalcare l'id che sta nell'indirizzo.
   *
   * Si riparte dall'URL invece di fidarsi di req.query, che in produzione
   * conterrebbe anche il "percorso" spezzettato da Vercel — roba di
   * smistamento, che agli endpoint non serve e li confonderebbe.
   */
  req.query = {
    ...Object.fromEntries(url.searchParams.entries()),
    ...esito.parametri
  };

  await esito.rotta.handler(req, res);
}
