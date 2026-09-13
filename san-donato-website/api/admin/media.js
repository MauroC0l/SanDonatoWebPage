/**
 * /api/admin/media — caricamento di un file in due tempi.
 *
 *   POST { fase: "permesso", mime, byte, titolo? }
 *        -> { chiave, urlDiCaricamento }
 *        Il browser carica il file su quell'indirizzo con una PUT.
 *
 *   POST { fase: "registra", chiave, mime, byte, larghezza?, altezza?, alt?, titolo? }
 *        -> { media: { id, url } }
 *
 * Il file non passa da qui: andrebbe oltre il limite di corpo di una
 * funzione serverless, e comunque non c'è motivo di farlo transitare.
 *
 * La registrazione è separata proprio perché il caricamento potrebbe non
 * arrivare in fondo: in tabella finiscono solo i file che esistono davvero.
 */

import { getDb } from "../../db/client.js";
import { media } from "../../db/schema.js";
import { richiedeCapacita } from "../../server/autenticazione.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../server/risposte.js";
import { leggiCorpo } from "../../server/richiesta.js";
import {
  componiChiave, permessoDiCaricamento, urlPubblico, TIPI_AMMESSI
} from "../../server/archivio.js";

// 25 MB per le immagini e i documenti. I video delle partite avranno una
// soglia propria quando arriverà la Fase 3.
const BYTE_MASSIMI = 25 * 1024 * 1024;

async function chiediPermesso(req, res, dati) {
  const mime = String(dati.mime || "");
  const byte = Number(dati.byte);

  if (!TIPI_AMMESSI.includes(mime)) {
    throw new ErroreHttp(415, `Tipo di file non ammesso: ${mime || "sconosciuto"}`);
  }
  if (!Number.isInteger(byte) || byte <= 0 || byte > BYTE_MASSIMI) {
    throw new ErroreHttp(413, `Il file supera i ${Math.round(BYTE_MASSIMI / 1024 / 1024)} MB.`);
  }

  const chiave = componiChiave(mime);
  const urlDiCaricamento = await permessoDiCaricamento(chiave, mime, byte);

  return json(res, { chiave, urlDiCaricamento });
}

async function registra(req, res, dati) {
  const chiave = String(dati.chiave || "");
  const mime = String(dati.mime || "");

  if (!chiave || !TIPI_AMMESSI.includes(mime)) {
    throw new ErroreHttp(400, "Dati del file incompleti.");
  }

  const [salvato] = await getDb().insert(media).values({
    chiave,
    mime,
    byte: Number.isInteger(dati.byte) ? dati.byte : null,
    larghezza: Number.isInteger(dati.larghezza) ? dati.larghezza : null,
    altezza: Number.isInteger(dati.altezza) ? dati.altezza : null,
    alt: dati.alt ? String(dati.alt).slice(0, 300) : null,
    titolo: dati.titolo ? String(dati.titolo).slice(0, 300) : null,
    caricatoDa: req.utente.id
  }).returning({ id: media.id, chiave: media.chiave });

  return json(res, {
    media: { id: salvato.id, url: urlPubblico(salvato.chiave) }
  }, 201);
}

export default conGestioneErrori(
  richiedeCapacita("media.carica", async (req, res) => {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return errore(res, 405, `Metodo ${req.method} non consentito.`);
    }

    const dati = await leggiCorpo(req);

    if (dati.fase === "permesso") return chiediPermesso(req, res, dati);
    if (dati.fase === "registra") return registra(req, res, dati);

    return errore(res, 400, 'Indica fase: "permesso" oppure "registra".');
  })
);
