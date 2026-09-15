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
import { elencaEventi, soloPartite, TIPI_PARTITA } from "../../../server/eventi.js";
import { puoGestireSquadra, squadreGestibili } from "../../../server/autorizzazioni.js";
import { richiedeAccesso } from "../../../server/autenticazione.js";
import { annota } from "../../../server/registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../server/risposte.js";
import { leggiCorpo, parametri } from "../../../server/richiesta.js";
import { schemaEventoNuovo, schemaElencoEventi, valida } from "../../../server/validazione.js";

async function elenco(req, res) {
  const { da, a, squadraId, limite } = valida(schemaElencoEventi, parametri(req));

  // "Programmati": quelli che sul sito non si vedono ancora
  const soloProgrammati = parametri(req).programmati === "1";

  const ammesse = await squadreGestibili(req.utente);

  // null = può gestirle tutte; un elenco vuoto = nessuna, e allora non deve
  // vedere niente invece di vedere tutto.
  if (Array.isArray(ammesse) && ammesse.length === 0) {
    return json(res, { eventi: [], squadreAmmesse: [] });
  }

  const risultato = await elencaEventi({
    da, a, squadraId, limite,
    squadreAmmesse: ammesse,
    soloProgrammati
  });

  res.setHeader("Cache-Control", "no-store");
  return json(res, { eventi: risultato, squadreAmmesse: ammesse });
}

async function crea(req, res) {
  const dati = valida(schemaEventoNuovo, await leggiCorpo(req));

  /*
   * Un allenatore mette a calendario solo partite, e senza programmarle.
   *
   * Il controllo sta qui e non solo nel modulo: i campi che a schermo non
   * ci sono si possono comunque mandare a mano. "Quando si vede sul sito"
   * poi non ha senso per una partita — una partita si sa che si gioca, e
   * tenerla nascosta fino al giorno prima non serve a nessuno.
   */
  if (soloPartite(req.utente)) {
    if (dati.tipo && !TIPI_PARTITA.includes(dati.tipo)) {
      throw new ErroreHttp(403, "Puoi mettere a calendario partite e tornei, non altri eventi.");
    }
    dati.visibileDal = null;
  }

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
    visibileDal: dati.visibileDal ?? null,
    luogo: dati.luogo ?? null,
    latitudine: dati.latitudine ?? null,
    longitudine: dati.longitudine ?? null,
    descrizione: dati.descrizione ?? null,
    risultato: dati.risultato ?? null,
    parziali: dati.parziali ?? null,
    marcatori: dati.marcatori ?? null,
    diretta: dati.diretta ?? null,
    creatoDa: req.utente.id
  }).returning({ id: eventi.id, titolo: eventi.titolo, inizio: eventi.inizio });

  await annota(req.utente, {
    azione: "eventi.crea",
    tipo: "evento",
    id: creato.id,
    descrizione: `Ha creato "${creato.titolo}" del ${creato.inizio.toLocaleDateString("it-IT")}`,
    dettaglio: { squadraId: dati.squadraId, tipo: dati.tipo }
  });

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
