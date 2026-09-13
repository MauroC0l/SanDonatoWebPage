/**
 * /api/admin/eventi
 *
 *   GET   gli eventi che questa persona può gestire
 *   POST  crea un evento
 *
 * Un coach vede e tocca solo le squadre a cui è associato. Il controllo non
 * è nel front-end: nascondere un pulsante non impedisce a nessuno di
 * chiamare l'indirizzo a mano.
 */

import { getDb } from "../../../db/client.js";
import { eventi } from "../../../db/schema.js";
import { elencaEventi } from "../../../server/eventi.js";
import { puoGestireSquadra, squadreGestibili } from "../../../server/autorizzazioni.js";
import { richiedeAccesso } from "../../../server/autenticazione.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../server/risposte.js";
import { leggiCorpo, parametri } from "../../../server/richiesta.js";
import { schemaEventoNuovo, schemaElencoEventi, valida } from "../../../server/validazione.js";

async function elenco(req, res) {
  const { da, a, squadraId, limite } = valida(schemaElencoEventi, parametri(req));

  const ammesse = await squadreGestibili(req.utente);

  // null = può gestirle tutte; un elenco vuoto = nessuna, e allora non deve
  // vedere niente invece di vedere tutto.
  if (Array.isArray(ammesse) && ammesse.length === 0) {
    return json(res, { eventi: [], squadreAmmesse: [] });
  }

  const risultato = await elencaEventi({
    da, a, squadraId, limite,
    squadreAmmesse: ammesse
  });

  res.setHeader("Cache-Control", "no-store");
  return json(res, { eventi: risultato, squadreAmmesse: ammesse });
}

async function crea(req, res) {
  const dati = valida(schemaEventoNuovo, await leggiCorpo(req));

  if (!await puoGestireSquadra(req.utente, dati.squadraId)) {
    throw new ErroreHttp(403, "Non gestisci questa squadra.");
  }

  const [creato] = await getDb().insert(eventi).values({
    squadraId: dati.squadraId,
    tipo: dati.tipo,
    // Vuoto = lo sport della squadra. Si valorizza solo per derogare.
    sport: dati.sport ?? null,
    titolo: dati.titolo,
    avversario: dati.avversario ?? null,
    inizio: dati.inizio,
    fine: dati.fine ?? null,
    tuttoIlGiorno: dati.tuttoIlGiorno,
    luogo: dati.luogo ?? null,
    descrizione: dati.descrizione ?? null,
    risultato: dati.risultato ?? null,
    parziali: dati.parziali ?? null,
    marcatori: dati.marcatori ?? null,
    diretta: dati.diretta ?? null,
    creatoDa: req.utente.id
  }).returning({ id: eventi.id, titolo: eventi.titolo, inizio: eventi.inizio });

  return json(res, { evento: creato }, 201);
}

export default conGestioneErrori(
  richiedeAccesso(async (req, res) => {
    if (req.method === "GET") return elenco(req, res);
    if (req.method === "POST") return crea(req, res);

    res.setHeader("Allow", "GET, POST");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
