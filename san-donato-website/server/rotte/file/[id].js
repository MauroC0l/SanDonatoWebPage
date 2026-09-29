/**
 * GET /api/file/:id — apre un file dell'archivio riservato.
 *
 * Oggi sono i certificati medici. Nessuno di questi file ha un indirizzo
 * pubblico: il browser chiede qui, noi controlliamo chi è, e solo allora lo
 * mandiamo al file con un link firmato che vale due minuti. Un link copiato
 * dalla barra e mandato in una chat, dopo due minuti, non apre niente; e
 * questo indirizzo senza una sessione risponde 401.
 *
 * Chi può aprire un certificato: le stesse persone che possono aprire la
 * scheda dell'atleta a cui appartiene (vedi trovaAtleta), più chi l'ha
 * caricato. Cioè:
 *   - l'atleta stesso;
 *   - chi ha caricato il file (anche prima di collegarlo alla scheda);
 *   - segreteria e amministrazione, che vedono tutti gli atleti;
 *   - l'allenatore, solo se l'atleta sta in una delle sue squadre.
 *
 * Un file pubblico chiesto da qui non dà errore: si rimanda al suo
 * indirizzo, così chi costruisce un link non deve sapere dove sta il file.
 *
 * In locale (ARCHIVIO_LOCALE=1) il file si legge dal disco e si manda
 * direttamente, dato che non c'è niente da firmare.
 */

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db/client.js";
import { media, schedeAtleta, richiesteIscrizione } from "../../../db/schema.js";
import { richiedeAccesso } from "../../autenticazione.js";
import { puo, squadreConAtletiVisibili } from "../../autorizzazioni.js";
import { chiavePrivata, urlFile, archivioLocale } from "../../file.js";
import { linkDiLettura, leggiFileLocale } from "../../archivio.js";
import { errore, conGestioneErrori, soloMetodi, ErroreHttp } from "../../risposte.js";

const ESTENSIONE = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png",
  "image/webp": "webp", "image/avif": "avif", "image/gif": "gif"
};

/** Vero se questa persona può vedere i file riservati di un atleta. */
async function vedeAtleta(utente, atletaId) {
  if (utente.id === atletaId) return true;
  if (!puo(utente, "atleti.leggi")) return false;

  const ammesse = await squadreConAtletiVisibili(utente);
  if (ammesse === null) return true;
  if (ammesse.length === 0) return false;

  const [suo] = await getDb()
    .select({ id: richiesteIscrizione.id })
    .from(richiesteIscrizione)
    .where(and(
      eq(richiesteIscrizione.utenteId, atletaId),
      eq(richiesteIscrizione.stato, "approvata"),
      inArray(richiesteIscrizione.squadraId, ammesse)
    ))
    .limit(1);

  return Boolean(suo);
}

export default conGestioneErrori(richiedeAccesso(async (req, res) => {
  if (!soloMetodi(req, res, ["GET"])) return;

  const id = Number(req.query?.id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroreHttp(400, "File non valido.");

  const db = getDb();
  const [file] = await db
    .select({
      id: media.id,
      chiave: media.chiave,
      urlWp: media.urlOriginaleWp,
      mime: media.mime,
      titolo: media.titolo,
      caricatoDa: media.caricatoDa
    })
    .from(media)
    .where(eq(media.id, id))
    .limit(1);

  /* 404 anche quando il file c'è ma non è tuo: dire "esiste, ma non puoi"
     confermerebbe a chi prova i numeri uno dopo l'altro che lì c'è un
     certificato. */
  const nonTrovato = () => errore(res, 404, "File non trovato.");
  if (!file) return nonTrovato();

  if (!chiavePrivata(file.chiave)) {
    const url = urlFile(file.chiave, file.urlWp);
    if (!url) return nonTrovato();
    res.statusCode = 302;
    res.setHeader("Location", url);
    return res.end();
  }

  let permesso = file.caricatoDa === req.utente.id;

  if (!permesso) {
    // Di chi è: la scheda che lo indica come certificato
    const [scheda] = await db
      .select({ utenteId: schedeAtleta.utenteId })
      .from(schedeAtleta)
      .where(eq(schedeAtleta.certificatoMediaId, file.id))
      .limit(1);

    permesso = scheda
      ? await vedeAtleta(req.utente, scheda.utenteId)
      // Un certificato non più collegato (sostituito da uno nuovo): solo la segreteria
      : puo(req.utente, "certificato.registra");
  }

  if (!permesso) return nonTrovato();

  const nomeFile = `certificato-${file.id}.${ESTENSIONE[file.mime] ?? "bin"}`;
  res.setHeader("Cache-Control", "private, no-store");

  if (archivioLocale()) {
    const contenuto = await leggiFileLocale(file.chiave);
    if (!contenuto) return nonTrovato();
    res.setHeader("Content-Type", file.mime);
    res.setHeader("Content-Disposition", `inline; filename="${nomeFile}"`);
    res.statusCode = 200;
    return res.end(contenuto);
  }

  res.statusCode = 302;
  res.setHeader("Location", await linkDiLettura(file.chiave, { nomeFile }));
  return res.end();
}));
