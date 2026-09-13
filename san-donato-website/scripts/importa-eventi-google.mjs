/**
 * Importa lo storico degli eventi dai calendari Google.
 *
 * Va eseguito UNA volta al passaggio: da quel momento gli eventi si creano
 * nel pannello e Google non viene più letto. È comunque ripetibile — la
 * chiave è google_event_id — nel caso il passaggio avvenga in più riprese.
 *
 * Richiede in .env:
 *   VITE_GOOGLE_API_KEY          la chiave usata finora dal sito
 *   VITE_*_CALENDAR_ID           gli identificativi dei calendari
 *
 * Quegli identificativi finiscono in squadre.calendario_google_id tramite
 * scripts/semina-squadre.mjs, che va eseguito prima.
 *
 * Uso:
 *   node --env-file=.env scripts/importa-eventi-google.mjs --prova
 *   node --env-file=.env scripts/importa-eventi-google.mjs
 */

import { isNotNull } from "drizzle-orm";
import { getDb, chiudiDb } from "../db/client.js";
import { eventi, squadre } from "../db/schema.js";

const CHIAVE = process.env.VITE_GOOGLE_API_KEY;
const prova = process.argv.includes("--prova");

/* =====================================================
   Lettura della descrizione
   ===================================================== */

/**
 * Su Google i dati sportivi erano righe di testo dentro alla descrizione:
 *
 *   Partita: 3 - 1
 *   Marcatori: Rossi, Bianchi
 *   Parziali: 25-20, 25-18
 *   Diretta: https://...
 *
 * Qui si leggono per l'ultima volta e diventano colonne. Le righe che non
 * corrispondono a nessuna etichetta restano come descrizione.
 */
function leggiDescrizione(html = "") {
  const testo = String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

  let risultato = null, parziali = null, diretta = null;
  let marcatori = [];
  const righe = [];

  for (const grezza of testo.split("\n")) {
    const riga = grezza.trim();
    const minuscola = riga.toLowerCase();

    if (minuscola.startsWith("partita:") || minuscola.startsWith("risultato:")) {
      risultato = riga.slice(riga.indexOf(":") + 1).trim() || null;
    } else if (minuscola.startsWith("marcatori:")) {
      marcatori = riga.slice(10).split(",").map((m) => m.trim()).filter(Boolean);
    } else if (minuscola.startsWith("parziali:")) {
      parziali = riga.slice(9).trim() || null;
    } else if (minuscola.startsWith("diretta:") || minuscola.startsWith("streaming:")) {
      const link = riga.slice(riga.indexOf(":") + 1).trim();
      if (link) diretta = /^https?:\/\//i.test(link) ? link : `https://${link}`;
    } else if (riga) {
      righe.push(riga);
    }
  }

  return {
    descrizione: righe.join("\n").trim() || null,
    risultato,
    parziali,
    marcatori: marcatori.length ? marcatori : null,
    diretta
  };
}

/**
 * Il tipo si deduce dal titolo, e resta una deduzione: i titoli su Google
 * sono testo libero. Chi importa può correggere dal pannello.
 */
function deduciTipo(titolo = "") {
  const t = titolo.toLowerCase();
  if (t.includes("allenamento")) return "allenamento";
  if (t.includes("torneo")) return "torneo";
  if (t.includes("assemblea") || t.includes("riunione") || t.includes("consiglio")) return "riunione";
  if (t.includes("vs") || t.includes(" - ") || t.includes("partita")) return "partita";
  return "altro";
}

/* =====================================================
   Google
   ===================================================== */

async function scaricaCalendario(calendarioId) {
  const eventi = [];
  let pageToken = null;

  do {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarioId)}/events`
    );
    url.searchParams.set("key", CHIAVE);
    url.searchParams.set("singleEvents", "true");   // le ricorrenze diventano eventi singoli
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "2500");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const risposta = await fetch(url);
    if (!risposta.ok) {
      const dettaglio = await risposta.text();
      throw new Error(`Google ha risposto ${risposta.status}: ${dettaglio.slice(0, 200)}`);
    }

    const dati = await risposta.json();
    eventi.push(...(dati.items ?? []));
    pageToken = dati.nextPageToken ?? null;
  } while (pageToken);

  // Gli eventi cancellati restano nell'elenco con status "cancelled"
  return eventi.filter((e) => e.status !== "cancelled" && (e.start?.dateTime || e.start?.date));
}

function trasforma(elemento, squadraId) {
  const tuttoIlGiorno = !elemento.start.dateTime;
  const titolo = elemento.summary?.trim() || "Evento senza titolo";
  const dettagli = leggiDescrizione(elemento.description);

  return {
    squadraId,
    googleEventId: elemento.id,
    tipo: deduciTipo(titolo),
    titolo,
    inizio: new Date(elemento.start.dateTime || elemento.start.date),
    fine: elemento.end ? new Date(elemento.end.dateTime || elemento.end.date) : null,
    tuttoIlGiorno,
    luogo: elemento.location?.trim() || null,
    ...dettagli
  };
}

/* =====================================================
   Esecuzione
   ===================================================== */

async function main() {
  if (!CHIAVE) {
    throw new Error(
      "Manca VITE_GOOGLE_API_KEY in .env. È la stessa chiave che il sito usa " +
      "oggi per leggere i calendari."
    );
  }

  const db = getDb();
  const conCalendario = await db
    .select({ id: squadre.id, nome: squadre.nome, calendario: squadre.calendarioGoogleId })
    .from(squadre)
    .where(isNotNull(squadre.calendarioGoogleId));

  if (conCalendario.length === 0) {
    throw new Error(
      "Nessuna squadra ha un calendario Google collegato. Metti le variabili " +
      "VITE_*_CALENDAR_ID in .env e rilancia scripts/semina-squadre.mjs."
    );
  }

  console.log(`${conCalendario.length} calendari da leggere.\n`);

  let totale = 0;
  let conRisultato = 0;
  const perTipo = {};

  for (const squadra of conCalendario) {
    let elementi;
    try {
      elementi = await scaricaCalendario(squadra.calendario);
    } catch (e) {
      // Un calendario irraggiungibile non deve fermare gli altri diciannove
      console.warn(`  ⚠  ${squadra.nome}: ${e.message}`);
      continue;
    }

    const righe = elementi.map((e) => trasforma(e, squadra.id));
    totale += righe.length;

    for (const riga of righe) {
      perTipo[riga.tipo] = (perTipo[riga.tipo] || 0) + 1;
      if (riga.risultato) conRisultato++;
    }

    console.log(`  ${squadra.nome.padEnd(26)} ${String(righe.length).padStart(4)} eventi`);

    if (prova) continue;

    for (const riga of righe) {
      await db.insert(eventi).values(riga).onConflictDoUpdate({
        target: eventi.googleEventId,
        set: {
          titolo: riga.titolo,
          inizio: riga.inizio,
          fine: riga.fine,
          luogo: riga.luogo,
          descrizione: riga.descrizione,
          risultato: riga.risultato,
          parziali: riga.parziali,
          marcatori: riga.marcatori,
          diretta: riga.diretta,
          aggiornatoIl: new Date()
        }
      });
    }
  }

  console.log(`\nTotale: ${totale} eventi, di cui ${conRisultato} con un risultato.`);
  console.log("Ripartizione per tipo:", perTipo);

  if (prova) {
    console.log("\n--prova: non ho scritto nulla.");
    return;
  }

  const [conteggio] = await db.select({ quanti: eventi.id }).from(eventi).limit(1);
  console.log(`\n✅ Importazione completata.${conteggio ? "" : " (nessun evento salvato)"}`);
}

main()
  .catch((e) => {
    console.error("\n❌", e.message);
    process.exitCode = 1;
  })
  .finally(() => chiudiDb());
