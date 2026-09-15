/**
 * /api/admin/squadre/:id — modifica di una squadra.
 *
 *   PATCH  nome, sport, colore, ordine, attiva
 *
 * Non esiste il DELETE, ed è voluto: cancellare una squadra porterebbe via
 * con sé i suoi eventi (la chiave esterna è in cascata) e lascerebbe senza
 * squadra le richieste di iscrizione accolte. Una squadra che non esiste più
 * si DISATTIVA — sparisce dalle tendine e dai filtri, ma il campionato
 * dell'anno scorso resta consultabile.
 */

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../../db/client.js";
import { squadre, richiesteIscrizione } from "../../../../db/schema.js";
import { richiedeCapacita } from "../../../autenticazione.js";
import { annota } from "../../../registro.js";
import { creaSlug } from "../../../sanitizza.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../risposte.js";
import { leggiCorpo, parametri } from "../../../richiesta.js";
import { SPORT_SQUADRA, valida } from "../../../validazione.js";

/* Nessun valore predefinito: chi cambia il solo colore non deve riportare la
   squadra allo sport sbagliato. Stessa avvertenza degli altri schemi. */
const schemaModifica = z.object({
  nome: z.string().trim().min(2, "Il nome è troppo corto.").max(80).optional(),
  sport: z.enum(SPORT_SQUADRA).optional(),
  colore: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Il colore va scritto come #1a2b3c.").nullable()
  ).optional(),
  ordine: z.coerce.number().int().min(0).max(999).optional(),
  attiva: z.boolean().optional()
});

export default conGestioneErrori(
  richiedeCapacita("squadre.gestisci", async (req, res) => {
    if (req.method !== "PATCH" && req.method !== "PUT") {
      res.setHeader("Allow", "PATCH, PUT");
      return errore(res, 405, `Metodo ${req.method} non consentito.`);
    }

    const id = Number(parametri(req).id);
    if (!Number.isInteger(id) || id <= 0) throw new ErroreHttp(400, "Identificativo non valido.");

    const dati = valida(schemaModifica, await leggiCorpo(req));
    if (Object.keys(dati).length === 0) throw new ErroreHttp(400, "Non c'è niente da salvare.");

    const db = getDb();

    const [esistente] = await db
      .select({ id: squadre.id, nome: squadre.nome, sport: squadre.sport, attiva: squadre.attiva })
      .from(squadre)
      .where(eq(squadre.id, id))
      .limit(1);

    if (!esistente) return errore(res, 404, "Squadra non trovata.");

    const modifiche = { ...dati };

    /**
     * Cambiando nome cambia anche lo slug, e va controllato che sia libero.
     *
     * Lo slug è quello che finisce negli indirizzi del sito: rinominare una
     * squadra li cambia, e i vecchi collegamenti smettono di funzionare. È
     * un prezzo accettabile per un nome sbagliato, meno per un capriccio.
     */
    if (dati.nome !== undefined && dati.nome !== esistente.nome) {
      const slug = creaSlug(dati.nome);

      const [occupato] = await db
        .select({ id: squadre.id })
        .from(squadre)
        .where(eq(squadre.slug, slug))
        .limit(1);

      if (occupato && occupato.id !== id) {
        throw new ErroreHttp(409, "Esiste già una squadra con questo nome.");
      }
      modifiche.slug = slug;
    }

    /**
     * Cambiare lo sport di una squadra che ha già degli iscritti è quasi
     * sempre un errore di chi clicca: le richieste sono state accolte
     * verificando che lo sport combaciasse, e spostandolo si ritroverebbero
     * atleti di calcio dentro a una squadra di pallavolo.
     */
    if (dati.sport !== undefined && dati.sport !== esistente.sport) {
      const [{ quanti }] = await db
        .select({ quanti: sql`count(*)::int` })
        .from(richiesteIscrizione)
        .where(sql`${richiesteIscrizione.squadraId} = ${id} and ${richiesteIscrizione.stato} = 'approvata'`);

      if (quanti > 0) {
        throw new ErroreHttp(
          409,
          `"${esistente.nome}" ha ${quanti} iscritti accolti come ${esistente.sport}: `
          + "cambiarle sport li lascerebbe nello sport sbagliato. Creane una nuova e spostali."
        );
      }
    }

    const [aggiornata] = await db
      .update(squadre)
      .set(modifiche)
      .where(eq(squadre.id, id))
      .returning({
        id: squadre.id, nome: squadre.nome, slug: squadre.slug,
        sport: squadre.sport, colore: squadre.colore,
        ordine: squadre.ordine, attiva: squadre.attiva
      });

    const spenta = dati.attiva === false && esistente.attiva;
    const riaccesa = dati.attiva === true && !esistente.attiva;

    await annota(req.utente, {
      azione: spenta ? "squadre.disattiva" : riaccesa ? "squadre.riattiva" : "squadre.modifica",
      tipo: "squadra",
      id,
      descrizione: spenta
        ? `Ha disattivato "${esistente.nome}"`
        : riaccesa
          ? `Ha riattivato "${esistente.nome}"`
          : `Ha modificato "${esistente.nome}"`,
      dettaglio: { campi: Object.keys(modifiche) }
    });

    return json(res, { squadra: aggiornata });
  })
);
