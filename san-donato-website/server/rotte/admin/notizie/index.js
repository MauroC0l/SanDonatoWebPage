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

import { getDb } from "../../../../db/client.js";
import { notizie } from "../../../../db/schema.js";
import { elencaNotizie, slugLibero } from "../../../notizie.js";
import { ripulisciHtml, soloTesto, creaSlug } from "../../../sanitizza.js";
import { puo } from "../../../autorizzazioni.js";
import { richiedeCapacita } from "../../../autenticazione.js";
import { annota } from "../../../registro.js";
import { json, errore, conGestioneErrori } from "../../../risposte.js";
import { leggiCorpo, parametri } from "../../../richiesta.js";
import { schemaElencoNotizie, schemaNotiziaNuova, valida } from "../../../validazione.js";

async function elenco(req, res) {
  const { pagina, perPagina, sport, categoria, stato, cerca } = valida(schemaElencoNotizie, parametri(req));

  const risultato = await elencaNotizie({
    pagina, perPagina, sport, categoria, stato, cerca,
    soloPubblicate: false
  });

  // Mai in cache: il pannello deve mostrare ciò che c'è adesso
  res.setHeader("Cache-Control", "no-store");
  return json(res, risultato);
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
    categoria: dati.categoria,
    stato: statoFinale,
    copertinaId: dati.copertinaId ?? null,
    autoreId: req.utente.id,
    pubblicataIl: statoFinale === "pubblicata" ? quando : null
  }).returning({
    id: notizie.id, slug: notizie.slug,
    stato: notizie.stato, pubblicataIl: notizie.pubblicataIl
  });

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

export default conGestioneErrori(async (req, res) => {
  if (req.method === "GET") {
    return richiedeCapacita("notizie.leggi_bozze", elenco)(req, res);
  }
  if (req.method === "POST") {
    return richiedeCapacita("notizie.scrivi", crea)(req, res);
  }

  res.setHeader("Allow", "GET, POST");
  return errore(res, 405, `Metodo ${req.method} non consentito.`);
});
