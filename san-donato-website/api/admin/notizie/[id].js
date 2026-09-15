/**
 * /api/admin/notizie/:id
 *
 *   GET     una notizia, in qualunque stato, per la modifica
 *   PATCH   modifica solo i campi indicati
 *   DELETE  sposta nel cestino
 *
 * La cancellazione è reversibile: DELETE porta la notizia nello stato
 * "cestino", non la elimina. Per riportarla indietro basta un PATCH con
 * un altro stato. Eliminare davvero un articolo scritto anni fa, per un
 * clic sbagliato, non deve essere possibile da qui.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../../../db/client.js";
import { notizie } from "../../../db/schema.js";
import { trovaNotizia, slugLibero } from "../../../server/notizie.js";
import { ripulisciHtml, soloTesto, creaSlug } from "../../../server/sanitizza.js";
import { puo } from "../../../server/autorizzazioni.js";
import { richiedeCapacita } from "../../../server/autenticazione.js";
import { annota } from "../../../server/registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../server/risposte.js";
import { leggiCorpo, parametri } from "../../../server/richiesta.js";
import { schemaNotiziaModifica, valida } from "../../../server/validazione.js";

function idRichiesto(req) {
  const id = Number(parametri(req).id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroreHttp(400, "Identificativo non valido.");
  return id;
}

async function leggi(req, res) {
  const notizia = await trovaNotizia(idRichiesto(req), { soloPubblicate: false });
  if (!notizia) return errore(res, 404, "Notizia non trovata.");

  res.setHeader("Cache-Control", "no-store");
  return json(res, { notizia });
}

async function modifica(req, res) {
  const id = idRichiesto(req);
  const dati = valida(schemaNotiziaModifica, await leggiCorpo(req));

  const db = getDb();
  const [esistente] = await db
    .select({
      id: notizie.id, titolo: notizie.titolo,
      stato: notizie.stato, pubblicataIl: notizie.pubblicataIl
    })
    .from(notizie)
    .where(eq(notizie.id, id))
    .limit(1);

  if (!esistente) return errore(res, 404, "Notizia non trovata.");

  const modifiche = { aggiornataIl: new Date() };

  if (dati.titolo !== undefined) modifiche.titolo = dati.titolo;
  if (dati.sport !== undefined) modifiche.sport = dati.sport;
  if (dati.categoria !== undefined) modifiche.categoria = dati.categoria;
  if (dati.copertinaId !== undefined) modifiche.copertinaId = dati.copertinaId;

  if (dati.contenuto !== undefined) {
    modifiche.contenuto = ripulisciHtml(dati.contenuto);
    // Il sommario ricalcolato solo se non ne arriva uno esplicito
    if (dati.sommario === undefined) modifiche.sommario = soloTesto(modifiche.contenuto, 200);
  }
  if (dati.sommario !== undefined) modifiche.sommario = dati.sommario;

  if (dati.slug !== undefined) {
    modifiche.slug = await slugLibero(creaSlug(dati.slug), id);
  }

  let inviataInRevisione = false;

  if (dati.stato !== undefined && dati.stato !== esistente.stato) {
    const vuolePubblicare = dati.stato === "pubblicata";

    if (vuolePubblicare && !puo(req.utente, "notizie.pubblica")) {
      modifiche.stato = "in_revisione";
      inviataInRevisione = true;
    } else {
      modifiche.stato = dati.stato;
    }

    // La data di pubblicazione si scrive una volta sola: ripubblicare una
    // notizia vecchia non deve farla risalire in cima all'elenco.
    if (modifiche.stato === "pubblicata" && !esistente.pubblicataIl) {
      modifiche.pubblicataIl = new Date();
    }
  }

  /**
   * Una data indicata esplicitamente vince su tutto il resto: è il modo di
   * spostare avanti l'uscita di una notizia (programmarla) o di correggere
   * la data di una importata da WordPress.
   *
   * Sta dopo il blocco qui sopra apposta: quello mette "adesso" alla prima
   * pubblicazione, questo lo scavalca quando chi scrive ha scelto un momento.
   */
  if (dati.pubblicataIl !== undefined) {
    modifiche.pubblicataIl = dati.pubblicataIl;
  }

  const [aggiornata] = await db
    .update(notizie)
    .set(modifiche)
    .where(eq(notizie.id, id))
    .returning({
      id: notizie.id, slug: notizie.slug,
      stato: notizie.stato, pubblicataIl: notizie.pubblicataIl
    });

  const cambioStato = modifiche.stato && modifiche.stato !== esistente.stato;

  await annota(req.utente, {
    azione: cambioStato ? `notizie.${modifiche.stato}` : "notizie.modifica",
    tipo: "notizia",
    id,
    descrizione: cambioStato
      ? `Ha portato "${esistente.titolo}" da ${esistente.stato} a ${modifiche.stato}`
      : `Ha modificato "${modifiche.titolo ?? esistente.titolo}"`,
    // I nomi dei campi toccati, non il loro contenuto: il registro dice chi
    // ha messo le mani dove, non conserva una copia di ogni versione.
    dettaglio: { campi: Object.keys(modifiche).filter((c) => c !== "aggiornataIl") }
  });

  return json(res, { notizia: aggiornata, inviataInRevisione });
}

async function cestina(req, res) {
  const id = idRichiesto(req);

  const [cestinata] = await getDb()
    .update(notizie)
    .set({ stato: "cestino", aggiornataIl: new Date() })
    .where(eq(notizie.id, id))
    .returning({ id: notizie.id, titolo: notizie.titolo, stato: notizie.stato });

  if (!cestinata) return errore(res, 404, "Notizia non trovata.");

  await annota(req.utente, {
    azione: "notizie.cestina",
    tipo: "notizia",
    id,
    descrizione: `Ha cestinato "${cestinata.titolo}"`
  });

  return json(res, { notizia: cestinata });
}

export default conGestioneErrori(async (req, res) => {
  if (req.method === "GET") {
    return richiedeCapacita("notizie.leggi_bozze", leggi)(req, res);
  }
  if (req.method === "PATCH" || req.method === "PUT") {
    return richiedeCapacita("notizie.scrivi", modifica)(req, res);
  }
  if (req.method === "DELETE") {
    return richiedeCapacita("notizie.cestina", cestina)(req, res);
  }

  res.setHeader("Allow", "GET, PATCH, PUT, DELETE");
  return errore(res, 405, `Metodo ${req.method} non consentito.`);
});
