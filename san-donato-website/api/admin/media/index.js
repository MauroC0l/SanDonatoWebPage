/**
 * /api/admin/media — la libreria e il caricamento di un file.
 *
 *   GET    elenco sfogliabile, con filtri per cartella, tipo ed etichetta
 *
 * Il caricamento avviene in due tempi:
 *
 *   POST { fase: "permesso", mime, byte, cartella? }
 *        -> { chiave, urlDiCaricamento }
 *        Il browser carica il file su quell'indirizzo con una PUT.
 *
 *   POST { fase: "registra", chiave, mime, byte, larghezza?, altezza?, alt?, titolo?, tag?, cartellaId? }
 *        -> { media: { id, url } }
 *
 * Il file non passa da qui: andrebbe oltre il limite di corpo di una
 * funzione serverless, e comunque non c'è motivo di farlo transitare.
 *
 * La registrazione è separata proprio perché il caricamento potrebbe non
 * arrivare in fondo: in tabella finiscono solo i file che esistono davvero.
 */

import { getDb } from "../../../db/client.js";
import { media } from "../../../db/schema.js";
import { richiedeCapacita } from "../../../server/autenticazione.js";
import { puo, eAmministratore } from "../../../server/autorizzazioni.js";
import {
  elencaMedia, tagUsati, elencaCartelle, normalizzaTag, personeConFile,
  spurgaCestino, GIORNI_CESTINO
} from "../../../server/media.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../../server/risposte.js";
import { leggiCorpo, parametri } from "../../../server/richiesta.js";
import {
  componiChiave, permessoDiCaricamento, urlPubblico, TIPI_AMMESSI, eliminaFile,
  archivioConfigurato
} from "../../../server/archivio.js";

// 25 MB per le immagini e i documenti. I video delle partite avranno una
// soglia propria quando arriverà la Fase 3.
const BYTE_MASSIMI = 25 * 1024 * 1024;

/*
 * Dove finisce il file dentro l'archivio.
 *
 * Un elenco chiuso e non una stringa libera: la cartella arriva dal
 * browser e diventa un pezzo di percorso, e comunque servirà a ritrovare
 * le cose fra qualche migliaio di file. "notizie" resta il ripiego perché
 * è da lì che il caricamento è nato, e gli indirizzi già scritti nelle
 * notizie pubblicate non devono cambiare.
 */
const CARTELLE = ["notizie", "eventi", "profili", "certificati", "documenti"];

async function chiediPermesso(req, res, dati) {
  const mime = String(dati.mime || "");
  const byte = Number(dati.byte);

  if (!TIPI_AMMESSI.includes(mime)) {
    throw new ErroreHttp(415, `Tipo di file non ammesso: ${mime || "sconosciuto"}`);
  }
  if (!Number.isInteger(byte) || byte <= 0 || byte > BYTE_MASSIMI) {
    throw new ErroreHttp(413, `Il file supera i ${Math.round(BYTE_MASSIMI / 1024 / 1024)} MB.`);
  }

  const cartella = CARTELLE.includes(dati.cartella) ? dati.cartella : "notizie";
  const chiave = componiChiave(mime, cartella);
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
    // Etichette per ritrovare il file fra centinaia: ripulite e senza doppioni
    tag: normalizzaTag(dati.tag),
    titolo: dati.titolo ? String(dati.titolo).slice(0, 300) : null,

    /*
     * La cartella della libreria, quando chi carica ne sta guardando una.
     *
     * Diversa da dati.cartella qui sopra, che è il prefisso dentro al
     * bucket: quello dice dove il file è scritto, questa come lo si
     * ritrova. Un caricamento dall'editor di una notizia non ne ha
     * nessuna, e il file resta da ordinare.
     */
    cartellaId: Number.isInteger(dati.cartellaId) ? dati.cartellaId : null,

    caricatoDa: req.utente.id
  }).returning({ id: media.id, chiave: media.chiave });

  return json(res, {
    media: { id: salvato.id, url: urlPubblico(salvato.chiave) }
  }, 201);
}

/**
 * L'elenco della libreria, in due versioni.
 *
 * Chi scrive le notizie la vede tutta: è l'archivio della società, e
 * serve intero per riusare una foto invece di ricaricarla.
 *
 * Chi mette a calendario le partite vede SOLO quello che ha caricato lui:
 * gli serve un posto dove tenere foto e video della propria squadra, non
 * un accesso al materiale di tutti. Il taglio è qui e non a schermo —
 * l'indirizzo con i parametri se lo scrive chiunque.
 */
async function sfoglia(req, res) {
  const tutta = puo(req.utente, "notizie.scrivi");
  const propria = puo(req.utente, "eventi.gestisci_tutte")
    || puo(req.utente, "eventi.gestisci_proprie");

  if (!tutta && !propria) {
    throw new ErroreHttp(403, "Non hai i permessi per sfogliare la libreria.");
  }

  const p = parametri(req);

  /* Qui e non in un lavoro pianificato, che in questo impianto non
     esiste: un'interrogazione sola, con il suo indice, che nove volte su
     dieci non trova niente. Un errore non deve far fallire l'elenco —
     chi apre la libreria vuole vedere i file, non sapere del cestino. */
  try {
    await spurgaCestino({ eliminaFile });
  } catch (e) {
    console.error("Spurgo del cestino non riuscito:", e.message);
  }

  // Chi non vede la libreria intera vede la propria, punto.
  const suoi = tutta ? (p.persona || null) : req.utente.id;
  const cestino = p.cestino === "1" || p.cestino === "true";

  const risultato = await elencaMedia({
    pagina: Math.max(1, Number(p.pagina) || 1),
    perPagina: Math.min(60, Math.max(1, Number(p.perPagina) || 24)),
    cerca: p.cerca?.trim() || null,
    tag: p.tag?.trim().toLowerCase() || null,
    cartellaId: p.cartellaId || null,
    tipo: p.tipo || null,
    caricatoDa: suoi,
    cestino
  });

  /* Etichette, cartelle e persone viaggiano solo con la prima pagina:
     cambiando pagina non devono svuotarsi i filtri da cui si è appena
     passati. L'elenco delle persone è roba da libreria intera: a un
     allenatore direbbe chi altro carica, che non lo riguarda. */
  const extra = risultato.pagina === 1
    ? {
      etichette: await tagUsati(),
      ...(await elencaCartelle({
        /* I conti delle cartelle si fanno su quello che vede CHI GUARDA:
           un allenatore che legge "Notizie 312" e ci trova i suoi quattro
           file ha ricevuto un numero che non era suo. */
        caricatoDa: suoi,
        amministratore: eAmministratore(req.utente)
      })),
      ...(tutta ? { persone: await personeConFile() } : {}),
      soloMie: !tutta,
      giorniCestino: GIORNI_CESTINO,

      /* Se l'archivio dei file non è collegato, il pulsante "Carica"
         risponderebbe 503 al primo clic. Meglio dirlo prima e spegnerlo:
         un pulsante che fallisce sempre è peggio di un pulsante spento
         con scritto perché. */
      archivioPronto: archivioConfigurato()
    }
    : {};

  res.setHeader("Cache-Control", "no-store");
  return json(res, { ...risultato, ...extra });
}

export default conGestioneErrori(
  richiedeCapacita("media.carica", async (req, res) => {
    if (req.method === "GET") return sfoglia(req, res);

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return errore(res, 405, `Metodo ${req.method} non consentito.`);
    }

    const dati = await leggiCorpo(req);

    if (dati.fase === "permesso") return chiediPermesso(req, res, dati);
    if (dati.fase === "registra") return registra(req, res, dati);

    return errore(res, 400, 'Indica fase: "permesso" oppure "registra".');
  })
);
