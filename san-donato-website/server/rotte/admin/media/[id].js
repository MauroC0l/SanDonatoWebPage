/**
 * /api/admin/media/:id — come si ritrova un file.
 *
 *   GET     il file, se è fra quelli sfogliabili
 *   PATCH   titolo, testo alternativo, etichette, cartella
 *   POST    { azione: "ripristina" } lo ripesca dal cestino
 *   DELETE  lo butta nel cestino; con ?definitivo=1 lo cancella davvero
 *
 * Il file in sé non si tocca da qui: non esiste modo di sostituirne i byte.
 * Un'immagine cambiata sotto ai piedi comparirebbe diversa in tutti gli
 * articoli che la usano, e nessuno saprebbe spiegare perché.
 *
 * La cancellazione invece c'è, e rifiuta i file ancora usati: un'immagine
 * tolta mentre fa da copertina lascia un riquadro vuoto in home, e chi
 * l'ha cancellata non lo scopre mai. Il 409 dice dove sta il problema,
 * così si stacca prima la copertina e poi si cancella. Vale anche per il
 * cestino: un file cestinato dalla pagina sparisce lo stesso, e che sia
 * recuperabile non chiude il buco che lascia.
 */

import { z } from "zod";
import { richiedeCapacita } from "../../../autenticazione.js";
import { puo } from "../../../autorizzazioni.js";
import {
  trovaMedia, aggiornaMedia, usoDiMedia, eliminaMedia,
  cestinaMedia, ripristinaMedia, GIORNI_CESTINO
} from "../../../media.js";
import { eliminaFile } from "../../../archivio.js";
import { annota } from "../../../registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../risposte.js";
import { leggiCorpo, parametri } from "../../../richiesta.js";
import { valida } from "../../../validazione.js";

const schemaMedia = z.object({
  titolo: z.string().trim().max(300).optional(),
  alt: z.string().trim().max(300).optional(),
  // Le etichette arrivano già separate: spezzare una stringa con le virgole
  // qui vorrebbe dire decidere al posto di chi le scrive se "under 14, mista"
  // sono due etichette o una.
  tag: z.array(z.string().trim().max(40)).max(20).optional(),

  // null vuol dire "toglilo da ogni cartella": è una richiesta legittima
  // quanto spostarlo dentro a un'altra, e va distinta dal non averlo detto.
  cartellaId: z.number().int().positive().nullable().optional()
});

export default conGestioneErrori(
  richiedeCapacita("media.carica", async (req, res) => {
    const id = Number(req.query?.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ErroreHttp(400, "Identificativo del file non valido.");
    }

    /*
     * O si sfoglia la libreria intera, o si tocca solo la propria roba.
     *
     * Un allenatore ha una libreria sua per le foto della squadra: deve
     * poterle rinominare e cancellare, e non deve poter toccare quelle
     * degli altri. Il controllo sta qui perché l'indirizzo di un file
     * altrui si scrive cambiando un numero.
     */
    /* Anche i cestinati: da lì si ripesca e si butta via davvero, e per
       fare l'una o l'altra cosa bisogna prima poterli trovare. */
    const file = await trovaMedia(id, { ancheCestinati: true });
    if (!file) throw new ErroreHttp(404, "File non trovato.");

    const suo = file.caricatoDa === req.utente.id;
    const governa = puo(req.utente, "notizie.scrivi");

    /* Nella cartella condivisa si guarda anche quello che ha messo un
       altro — è il senso di quella cartella — ma toccarlo no: si
       rinomina e si cancella solo la propria roba. */
    if (!governa && !suo && !file.cartellaCondivisa) {
      throw new ErroreHttp(403, "Questo file non è tuo.");
    }

    if (req.method !== "GET" && !governa && !suo) {
      throw new ErroreHttp(403, "Questo file l'ha caricato un'altra persona.");
    }

    if (req.method === "GET") {

      res.setHeader("Cache-Control", "no-store");
      return json(res, { media: file, uso: await usoDiMedia(id) });
    }

    if (req.method === "POST") {
      const dati = await leggiCorpo(req);
      if (dati.azione !== "ripristina") {
        throw new ErroreHttp(400, 'L\'unica azione prevista è "ripristina".');
      }

      const tornato = await ripristinaMedia(id);

      await annota(req.utente, {
        azione: "media.ripristina",
        tipo: "media",
        id,
        descrizione: `Ha ripescato dal cestino il file ${tornato.titolo || id}`
      });

      return json(res, { media: await trovaMedia(id) });
    }

    if (req.method === "PATCH") {
      const dati = valida(schemaMedia, await leggiCorpo(req));
      if (Object.keys(dati).length === 0) {
        throw new ErroreHttp(400, "Non c'è niente da salvare.");
      }

      const aggiornato = await aggiornaMedia(id, dati);
      if (!aggiornato) throw new ErroreHttp(404, "File non trovato.");

      await annota(req.utente, {
        azione: "media.etichetta",
        tipo: "media",
        id,
        descrizione: `Ha aggiornato le informazioni del file ${aggiornato.titolo || id}`,
        dettaglio: { campi: Object.keys(dati) }
      });

      return json(res, { media: aggiornato });
    }

    if (req.method === "DELETE") {
      /* Due cancellazioni diverse dietro allo stesso verbo: dalla libreria
         si cestina, dal cestino si butta via. Un parametro e non due rotte
         perché la cosa che si fa è la stessa — togliere quel file — e a
         cambiare è solo quanto è definitiva. */
      const definitivo = parametri(req).definitivo === "1";

      const esito = definitivo
        ? await eliminaMedia(id, { eliminaFile })
        : await cestinaMedia(id, req.utente.id);

      if (esito.esito === "assente") throw new ErroreHttp(404, "File non trovato.");

      if (esito.esito === "in_uso") {
        const dove = [
          esito.uso.notizie && `${esito.uso.notizie} notizie`,
          esito.uso.eventi && `${esito.uso.eventi} eventi`,
          esito.uso.certificati && "una scheda atleta",
          esito.uso.profili && "un profilo"
        ].filter(Boolean).join(", ");

        throw new ErroreHttp(
          409,
          `Non si può cancellare: lo usano ancora ${dove}. Stacca prima il file da lì.`
        );
      }

      await annota(req.utente, {
        azione: definitivo ? "media.elimina" : "media.cestina",
        tipo: "media",
        id,
        descrizione: definitivo
          ? `Ha cancellato per sempre il file ${esito.file.titolo || id}`
          : `Ha messo nel cestino il file ${esito.file.titolo || id}`
      });

      return json(res, {
        eliminato: definitivo,
        cestinato: !definitivo,
        giorniCestino: GIORNI_CESTINO
      });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
