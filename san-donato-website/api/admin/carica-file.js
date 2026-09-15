/**
 * PUT /api/admin/carica-file?chiave=... — solo in modalità locale.
 *
 * Su R2 il browser carica direttamente sull'archivio, con un permesso a
 * scadenza: il file non passa mai da qui. In locale quell'archivio non
 * esiste, quindi questa rotta ne fa le veci e scrive in public/caricamenti.
 *
 * Perché una rotta separata e non un ramo dentro /api/admin/media: quella
 * riceve e restituisce JSON, questa riceve i byte grezzi del file. Mescolare
 * le due cose vorrebbe dire leggere il corpo in un modo o nell'altro a
 * seconda di un campo, ed è esattamente il genere di bivio che poi sbaglia.
 *
 * Se l'archivio locale è spento risponde 404 e non 403: in produzione questa
 * rotta non deve nemmeno sembrare esistere.
 */

import { richiedeCapacita } from "../../server/autenticazione.js";
import { errore, conGestioneErrori, ErroreHttp } from "../../server/risposte.js";
import {
  archivioLocale, chiaveValida, scriviFileLocale, TIPI_AMMESSI
} from "../../server/archivio.js";

const BYTE_MASSIMI = 25 * 1024 * 1024;

/** I byte del corpo, con il tetto applicato mentre arrivano. */
function leggiByte(req) {
  return new Promise((risolvi, rifiuta) => {
    const pezzi = [];
    let totale = 0;

    req.on("data", (pezzo) => {
      totale += pezzo.length;
      // Il taglio va fatto durante la ricezione e non dopo: aspettare la
      // fine per scoprire che il file era troppo grande vuol dire averlo
      // già tenuto tutto in memoria.
      if (totale > BYTE_MASSIMI) {
        rifiuta(new ErroreHttp(413, `Il file supera i ${Math.round(BYTE_MASSIMI / 1024 / 1024)} MB.`));
        req.destroy();
        return;
      }
      pezzi.push(pezzo);
    });

    req.on("end", () => risolvi(Buffer.concat(pezzi)));
    req.on("error", rifiuta);
  });
}

export default conGestioneErrori(
  richiedeCapacita("media.carica", async (req, res) => {
    if (!archivioLocale()) {
      return errore(res, 404, "Rotta non disponibile.");
    }

    if (req.method !== "PUT") {
      res.setHeader("Allow", "PUT");
      return errore(res, 405, `Metodo ${req.method} non consentito.`);
    }

    const chiave = String(req.query?.chiave || "");
    if (!chiaveValida(chiave)) throw new ErroreHttp(400, "Nome del file non valido.");

    const mime = String(req.headers["content-type"] || "").split(";")[0].trim();
    if (!TIPI_AMMESSI.includes(mime)) {
      throw new ErroreHttp(415, `Tipo di file non ammesso: ${mime || "sconosciuto"}`);
    }

    await scriviFileLocale(chiave, await leggiByte(req));

    res.statusCode = 204;
    res.end();
  })
);
