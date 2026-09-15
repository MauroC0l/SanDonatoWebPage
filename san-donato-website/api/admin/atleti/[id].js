/**
 * /api/admin/atleti/:id — la scheda di un atleta.
 *
 *   GET    anagrafica, certificato, quota e versamenti
 *   PATCH  scrive SOLO la quota della stagione
 *
 * LA REGOLA: chi vede i dati di una persona non li modifica. Anagrafica,
 * recapiti, tutore e certificato medico sono dell'atleta, e li scrive lui
 * dalla propria area (/api/iscrizione). Nemmeno un amministratore li tocca
 * da qui: non è una svista, è la regola.
 *
 * Quello che resta allo staff è la quota della stagione, che non è un dato
 * personale ma un numero deciso dalla società — insieme ai versamenti, che
 * stanno nell'endpoint accanto. Se potesse deciderla l'atleta non sarebbe
 * una quota, sarebbe un'offerta.
 *
 * Lo schema elenca il solo campo ammesso invece di escludere quelli vietati:
 * un campo aggiunto domani alla tabella non diventa scrivibile per sbaglio.
 *
 * L'identificativo è quello dell'UTENTE, non della riga della scheda: la
 * scheda potrebbe non esistere ancora, e allora il primo salvataggio la crea.
 */

import { z } from "zod";
import { trovaAtleta, salvaScheda } from "../../../server/atleti.js";
import { puo, squadreConAtletiVisibili } from "../../../server/autorizzazioni.js";
import { richiedeCapacita } from "../../../server/autenticazione.js";
import { annota } from "../../../server/registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../server/risposte.js";
import { leggiCorpo, parametri } from "../../../server/richiesta.js";
import { valida } from "../../../server/validazione.js";
import { trovaTipoQuota } from "../../../server/quote.js";

/**
 * Quello che può scrivere chi tiene i conti: la quota, e basta.
 *
 * La quota si assegna SCEGLIENDO UNA TARIFFA, non battendo un importo:
 * le tariffe le decide l'amministratore una volta per tutte, e chi
 * assegna sceglie fra quelle. Sessanta importi scritti a mano ogni anno
 * vogliono dire qualche 200 al posto di 250 e gli sconti applicati a
 * memoria, senza poter più rispondere a "quanti hanno lo sconto fratello".
 *
 * null toglie la quota: è una richiesta legittima — un tesserato che passa
 * a dirigente non paga più.
 */
const schemaQuota = z.object({
  tipoQuotaId: z.coerce.number().int().positive().nullable().optional()
});

/**
 * L'eccezione alla regola: il certificato medico consegnato su carta.
 *
 * Chi porta il foglio in sede lo consegna a mano, e chiedergli di
 * fotografarlo e caricarlo da solo significherebbe che quel certificato non
 * entra mai nel sito. Perciò chi ha "certificato.registra" — segreteria e
 * amministratori — può caricare la copia e scrivere tipo e scadenza, che
 * sono gli unici dati leggibili sul foglio stesso.
 *
 * Resta un'eccezione stretta: anagrafica, recapiti e tutore no. E il campo
 * "note", dove l'atleta scrive di sé, nemmeno.
 */
const schemaCertificato = z.object({
  tipoCertificato: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.enum(["agonistico", "non_agonistico"]).nullable()
  ).optional(),
  certificatoScadenza: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    // Resta una stringa "2026-05-14": la colonna è un date senza ora, e
    // convertirla in Date la sposterebbe di un fuso.
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La data va scritta come 2026-05-14.").nullable()
  ).optional(),
  certificatoMediaId: z.number().int().positive().nullable().optional()
});

function idRichiesto(req) {
  const id = Number(parametri(req).id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroreHttp(400, "Identificativo non valido.");
  return id;
}

async function leggi(req, res) {
  const ammesse = await squadreConAtletiVisibili(req.utente);
  const atleta = await trovaAtleta(idRichiesto(req), {
    squadreAmmesse: ammesse,
    // Vedi la nota in server/atleti.js: al coach i conti non arrivano proprio
    conQuote: puo(req.utente, "quote.gestisci")
  });

  // 404 e non 403 quando l'atleta esiste ma è di un'altra squadra: dire
  // "non puoi vedere questo" confermerebbe comunque che esiste.
  if (!atleta) return errore(res, 404, "Atleta non trovato.");

  res.setHeader("Cache-Control", "no-store");
  return json(res, { atleta });
}

async function modifica(req, res) {
  const tieneIConti = puo(req.utente, "quote.gestisci");
  const registraCertificati = puo(req.utente, "certificato.registra");

  if (!tieneIConti && !registraCertificati) {
    throw new ErroreHttp(403, "Da qui non si modifica nulla: i dati li scrive l'atleta.");
  }

  const id = idRichiesto(req);

  // Esiste davvero, ed è qualcuno che questa persona può vedere?
  const ammesse = await squadreConAtletiVisibili(req.utente);
  const esistente = await trovaAtleta(id, { squadreAmmesse: ammesse });
  if (!esistente) return errore(res, 404, "Atleta non trovato.");

  const corpo = await leggiCorpo(req);

  /* Ogni permesso apre solo la sua porzione, e le due si sommano. I campi
     fuori da entrambe non vengono rifiutati con un errore: gli schemi li
     scartano, e se non resta niente lo si dice sotto. */
  const dati = {
    ...(tieneIConti ? valida(schemaQuota, corpo) : {}),
    ...(registraCertificati ? valida(schemaCertificato, corpo) : {})
  };

  /*
   * Dalla tariffa scelta all'importo scritto sulla scheda.
   *
   * L'importo si copia e non si ricava al volo: una tariffa ritoccata a
   * stagione in corso non deve cambiare gli accordi già presi con le
   * famiglie. Questa riga è il momento in cui la cifra viene fissata.
   */
  if (dati.tipoQuotaId !== undefined) {
    if (dati.tipoQuotaId === null) {
      dati.quotaStagionaleCentesimi = null;
    } else {
      const tariffa = await trovaTipoQuota(dati.tipoQuotaId);
      if (!tariffa) throw new ErroreHttp(400, "La tariffa scelta non esiste.");
      if (!tariffa.attiva) throw new ErroreHttp(400, `La tariffa "${tariffa.nome}" è spenta.`);

      dati.quotaStagionaleCentesimi = tariffa.importoCentesimi;
    }
  }

  if (Object.keys(dati).length === 0) {
    throw new ErroreHttp(
      400,
      tieneIConti
        ? "Da qui si cambiano solo la quota e il certificato. Il resto lo scrive l'atleta dalla sua area."
        : "Da qui si cambia solo il certificato."
    );
  }

  await salvaScheda(id, dati, req.utente.id);

  const tocca = Object.keys(dati);
  const soloQuota = tocca.every((c) => c === "quotaStagionaleCentesimi" || c === "tipoQuotaId");

  await annota(req.utente, {
    azione: soloQuota ? "atleti.quota" : "atleti.certificato",
    tipo: "atleta",
    id,
    descrizione: soloQuota
      ? `Ha impostato la quota di ${esistente.nomeCompleto}`
      : `Ha registrato il certificato di ${esistente.nomeCompleto}`,
    dettaglio: { campi: tocca }
  });

  const aggiornato = await trovaAtleta(id, {
    squadreAmmesse: ammesse,
    conQuote: tieneIConti
  });
  return json(res, { atleta: aggiornato });
}

export default conGestioneErrori(
  richiedeCapacita("atleti.leggi", async (req, res) => {
    if (req.method === "GET") return leggi(req, res);
    if (req.method === "PATCH" || req.method === "PUT") return modifica(req, res);

    res.setHeader("Allow", "GET, PATCH, PUT");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
