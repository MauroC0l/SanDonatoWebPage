/**
 * /api/admin/notizie
 *
 *   GET   elenco completo, bozze e cestino inclusi
 *   POST  crea una notizia
 *
 * Tutto ciò che sta sotto /api/admin richiede una sessione e una capacità:
 * il controllo è nel decoratore, non dentro al corpo della funzione, così
 * dimenticarselo è difficile.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../../../../db/client.js";
import { notizie } from "../../../../db/schema.js";
import { impostaEtichette } from "../../../etichette.js";
import { elencaNotizie, slugLibero, pulisciCestinoNotizie, GIORNI_CESTINO } from "../../../notizie.js";
import { ripulisciHtml, soloTesto, creaSlug } from "../../../sanitizza.js";
import { puo } from "../../../autorizzazioni.js";
import { richiedeCapacita } from "../../../autenticazione.js";
import { annota } from "../../../registro.js";
import { json, errore, conGestioneErrori } from "../../../risposte.js";
import { leggiCorpo, parametri } from "../../../richiesta.js";
import { schemaElencoNotizie, schemaNotiziaNuova, valida } from "../../../validazione.js";

async function elenco(req, res) {
  const { pagina, perPagina, sport, etichetta, stato, cerca } = valida(schemaElencoNotizie, parametri(req));

  // Aprendo il cestino, prima si tolgono quelle scadute
  if (String(stato ?? "").split(",").includes("cestino")) await pulisciCestinoNotizie();

  const risultato = await elencaNotizie({
    pagina, perPagina, sport, etichetta, stato, cerca,
    soloPubblicate: false
  });

  // Mai in cache: il pannello deve mostrare ciò che c'è adesso
  res.setHeader("Cache-Control", "no-store");
  // Il pannello lo usa per dire fra quanti giorni ognuna sparisce
  return json(res, { ...risultato, giorniCestino: GIORNI_CESTINO });
}

async function crea(req, res) {
  const dati = valida(schemaNotiziaNuova, await leggiCorpo(req));

  // Pubblicare è un permesso a parte: chi non ce l'ha manda in revisione,
  // e non se lo sente dire come errore — la notizia viene comunque salvata.
  const vuolePubblicare = dati.stato === "pubblicata";
  const statoFinale = vuolePubblicare && !puo(req.utente, "notizie.pubblica")
    ? "in_revisione"
    : dati.stato;

  const contenuto = ripulisciHtml(dati.contenuto);
  const slug = await slugLibero(creaSlug(dati.slug || dati.titolo));

  // Con una data indicata si pubblica allora, altrimenti adesso. Una data nel
  // futuro è la programmazione: la notizia esiste, è "pubblicata", e compare
  // sul sito quando arriva il momento.
  const quando = dati.pubblicataIl ?? new Date();

  const [creata] = await getDb().insert(notizie).values({
    slug,
    titolo: dati.titolo,
    sommario: dati.sommario || soloTesto(contenuto, 200),
    contenuto,
    sport: dati.sport,
    stato: statoFinale,
    copertinaId: dati.copertinaId ?? null,
    autoreId: req.utente.id,
    pubblicataIl: statoFinale === "pubblicata" ? quando : null
  }).returning({
    id: notizie.id, slug: notizie.slug,
    stato: notizie.stato, pubblicataIl: notizie.pubblicataIl
  });

  if (dati.etichette) await impostaEtichette(creata.id, dati.etichette);

  await annota(req.utente, {
    azione: `notizie.${statoFinale === "pubblicata" ? "pubblica" : "crea"}`,
    tipo: "notizia",
    id: creata.id,
    descrizione: `Ha creato "${dati.titolo}" (${statoFinale})`,
    dettaglio: { sport: dati.sport, stato: statoFinale }
  });

  return json(res, {
    notizia: creata,
    // Il front-end lo usa per spiegare perché non è stata pubblicata
    inviataInRevisione: vuolePubblicare && statoFinale === "in_revisione"
  }, 201);
}

/**
 * Svuota il cestino: cancella per sempre tutte le notizie cestinate.
 *
 * Le copertine restano nella libreria dei file: possono servire ad altre
 * notizie, e i file hanno il loro cestino.
 */
async function svuotaCestino(req, res) {
  const tolte = await getDb()
    .delete(notizie)
    .where(eq(notizie.stato, "cestino"))
    .returning({ id: notizie.id, titolo: notizie.titolo });

  await annota(req.utente, {
    azione: "notizie.svuota_cestino",
    tipo: "notizia",
    id: null,
    descrizione: `Ha svuotato il cestino delle notizie (${tolte.length})`,
    dettaglio: { titoli: tolte.map((n) => n.titolo).slice(0, 50) }
  });

  return json(res, { eliminate: tolte.length });
}

export default conGestioneErrori(async (req, res) => {
  if (req.method === "GET") {
    return richiedeCapacita("notizie.leggi_bozze", elenco)(req, res);
  }
  if (req.method === "POST") {
    return richiedeCapacita("notizie.scrivi", crea)(req, res);
  }
  // DELETE sull'elenco intero vuol dire una cosa sola: svuotare il cestino
  if (req.method === "DELETE") {
    return richiedeCapacita("notizie.cestina", svuotaCestino)(req, res);
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return errore(res, 405, `Metodo ${req.method} non consentito.`);
});
