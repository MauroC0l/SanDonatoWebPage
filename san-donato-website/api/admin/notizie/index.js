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

import { getDb } from "../../../db/client.js";
import { notizie } from "../../../db/schema.js";
import { elencaNotizie, slugLibero } from "../../../server/notizie.js";
import { ripulisciHtml, soloTesto, creaSlug } from "../../../server/sanitizza.js";
import { puo } from "../../../server/autorizzazioni.js";
import { richiedeCapacita } from "../../../server/autenticazione.js";
import { json, errore, conGestioneErrori } from "../../../server/risposte.js";
import { leggiCorpo, parametri } from "../../../server/richiesta.js";
import { schemaElencoNotizie, schemaNotiziaNuova, valida } from "../../../server/validazione.js";

async function elenco(req, res) {
  const { pagina, perPagina, sport, stato, cerca } = valida(schemaElencoNotizie, parametri(req));

  const risultato = await elencaNotizie({
    pagina, perPagina, sport, stato, cerca,
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

  const [creata] = await getDb().insert(notizie).values({
    slug,
    titolo: dati.titolo,
    sommario: dati.sommario || soloTesto(contenuto, 200),
    contenuto,
    sport: dati.sport,
    stato: statoFinale,
    copertinaId: dati.copertinaId ?? null,
    autoreId: req.utente.id,
    pubblicataIl: statoFinale === "pubblicata" ? new Date() : null
  }).returning({ id: notizie.id, slug: notizie.slug, stato: notizie.stato });

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
