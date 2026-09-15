/**
 * /api/iscrizione — la propria iscrizione, compilata dall'atleta.
 *
 *   GET    la propria scheda e cosa manca ancora
 *   PATCH  scrive i propri dati e il proprio certificato
 *
 * Perché non riusare /api/admin/atleti/:id: quello richiede "atleti.leggi",
 * che un atleta non ha e non deve avere — con quella capacità vedrebbe anche
 * le schede degli altri. Qui invece l'identità arriva dalla sessione e non
 * esiste un parametro con cui indicare qualcun altro.
 *
 * COSA NON SI PUÒ SCRIVERE DA QUI: la quota dovuta e i versamenti. Sono i
 * conti della società, li tiene la segreteria, e un modulo in cui uno dichiara
 * da sé quanto deve non sarebbe un'iscrizione ma un desiderio. Lo schema più
 * sotto elenca i campi ammessi uno per uno, invece di escludere quelli
 * vietati: così un campo aggiunto domani allo schema delle schede non diventa
 * scrivibile per sbaglio.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { squadre, richiesteIscrizione, schedeAtleta, media, pagamenti } from "../db/schema.js";
import { salvaScheda, cosaManca, minorenne } from "../server/atleti.js";
import { urlFile } from "../server/notizie.js";
import { richiedeAccesso } from "../server/autenticazione.js";
import { annota } from "../server/registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../server/risposte.js";
import { leggiCorpo } from "../server/richiesta.js";
import { valida } from "../server/validazione.js";

const vuotoENull = (max) => z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(max).nullable()
);

const dataONull = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  // Resta una stringa "2026-05-14": la colonna è un date senza ora, e
  // convertirla in Date la sposterebbe di un fuso.
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La data va scritta come 2026-05-14.").nullable()
);

const schemaMiei = z.object({
  dataNascita: dataONull.optional(),
  luogoNascita: vuotoENull(120).optional(),
  provinciaNascita: vuotoENull(60).optional(),
  codiceFiscale: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() || null : v),
    z.string().length(16, "Il codice fiscale ha 16 caratteri.").nullable()
  ).optional(),
  tagliaMaglietta: vuotoENull(20).optional(),

  telefono: vuotoENull(40).optional(),

  indirizzo: vuotoENull(200).optional(),
  civico: vuotoENull(20).optional(),
  citta: vuotoENull(120).optional(),
  provincia: vuotoENull(60).optional(),
  // Cinque cifre, niente di più: un CAP scritto male manda la posta altrove.
  cap: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().regex(/^[0-9]{5}$/, "Il CAP ha cinque cifre.").nullable()
  ).optional(),
  tutoreNome: vuotoENull(120).optional(),
  tutoreParentela: vuotoENull(40).optional(),
  tutoreTelefono: vuotoENull(40).optional(),
  tutoreEmail: vuotoENull(255).optional(),

  tutore2Nome: vuotoENull(120).optional(),
  tutore2Parentela: vuotoENull(40).optional(),
  tutore2Telefono: vuotoENull(40).optional(),
  tutore2Email: vuotoENull(255).optional(),
  tipoCertificato: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.enum(["agonistico", "non_agonistico"]).nullable()
  ).optional(),
  certificatoScadenza: dataONull.optional(),
  certificatoMediaId: z.number().int().positive().nullable().optional(),
  note: vuotoENull(2000).optional()
});

/**
 * Da quanti giorni prima della scadenza si può rifare il certificato.
 *
 * Tre mesi: è il tempo in cui uno prende appuntamento dal medico sportivo
 * senza correre. Prima di allora il certificato in corso vale, e non c'è
 * niente da sostituire.
 */
const GIORNI_RINNOVO = 90;

/**
 * Se l'atleta può toccare il proprio certificato, e perché no.
 *
 * Un certificato già controllato dalla segreteria e ancora buono per mesi
 * non si cambia: sostituirlo vorrebbe dire far rifare il controllo per
 * niente, e soprattutto è il modo in cui un foglio approvato viene
 * scambiato con uno che nessuno ha guardato. Si sblocca da solo quando la
 * scadenza si avvicina, che è quando serve davvero.
 */
function modificabile(scheda) {
  if (!scheda) return { si: true, motivo: null, dal: null };
  if (scheda.certificatoStato !== "valido") return { si: true, motivo: null, dal: null };
  if (!scheda.certificatoScadenza) return { si: true, motivo: null, dal: null };

  const scadenza = new Date(`${scheda.certificatoScadenza}T00:00:00`);
  const apertura = new Date(scadenza.getTime() - GIORNI_RINNOVO * 86400000);

  if (Date.now() >= apertura.getTime()) return { si: true, motivo: null, dal: null };

  return {
    si: false,
    motivo: "Il tuo certificato è stato controllato ed è ancora valido: "
      + "si potrà sostituire quando mancheranno tre mesi alla scadenza.",
    // Il giorno in cui si riapre, in forma "2026-05-14" come le altre date
    dal: apertura.toISOString().slice(0, 10)
  };
}

async function leggi(req, res) {
  const db = getDb();

  const [scheda] = await db
    .select({
      dataNascita: schedeAtleta.dataNascita,
      luogoNascita: schedeAtleta.luogoNascita,
      provinciaNascita: schedeAtleta.provinciaNascita,
      codiceFiscale: schedeAtleta.codiceFiscale,
      tagliaMaglietta: schedeAtleta.tagliaMaglietta,
      telefono: schedeAtleta.telefono,
      indirizzo: schedeAtleta.indirizzo,
      civico: schedeAtleta.civico,
      citta: schedeAtleta.citta,
      provincia: schedeAtleta.provincia,
      cap: schedeAtleta.cap,
      tutoreNome: schedeAtleta.tutoreNome,
      tutoreParentela: schedeAtleta.tutoreParentela,
      tutoreTelefono: schedeAtleta.tutoreTelefono,
      tutoreEmail: schedeAtleta.tutoreEmail,
      tutore2Nome: schedeAtleta.tutore2Nome,
      tutore2Parentela: schedeAtleta.tutore2Parentela,
      tutore2Telefono: schedeAtleta.tutore2Telefono,
      tutore2Email: schedeAtleta.tutore2Email,
      tipoCertificato: schedeAtleta.tipoCertificato,
      certificatoScadenza: schedeAtleta.certificatoScadenza,
      certificatoMediaId: schedeAtleta.certificatoMediaId,
      certificatoStato: schedeAtleta.certificatoStato,
      certificatoMotivo: schedeAtleta.certificatoMotivo,
      certificatoValidatoIl: schedeAtleta.certificatoValidatoIl,
      note: schedeAtleta.note,
      quota: schedeAtleta.quotaStagionaleCentesimi,
      aggiornataIl: schedeAtleta.aggiornataIl,
      certificatoChiave: media.chiave,
      certificatoUrlWp: media.urlOriginaleWp
    })
    .from(schedeAtleta)
    .leftJoin(media, eq(media.id, schedeAtleta.certificatoMediaId))
    .where(eq(schedeAtleta.utenteId, req.utente.id))
    .limit(1);

  // La squadra in cui si è stati messi, se la richiesta è stata accolta
  // Tutte, non solo l'ultima: chi gioca a calcio e a pallavolo ha due
  // squadre, e con una sola in risposta la seconda per il sito non esiste.
  const appartenenze = await db
    .select({
      squadraId: squadre.id,
      squadra: squadre.nome,
      sport: squadre.sport,
      colore: squadre.colore,
      stato: richiesteIscrizione.stato,
      dal: richiesteIscrizione.decisaIl
    })
    .from(richiesteIscrizione)
    .innerJoin(squadre, eq(squadre.id, richiesteIscrizione.squadraId))
    .where(and(
      eq(richiesteIscrizione.utenteId, req.utente.id),
      eq(richiesteIscrizione.stato, "approvata")
    ))
    .orderBy(desc(richiesteIscrizione.decisaIl));

  const [appartenenza] = appartenenze;

  /**
   * I propri versamenti.
   *
   * Li vede, non li scrive: sono i conti della società, e li registra la
   * segreteria. Ma sono i SUOI soldi, e sapere quanto ha versato e quanto
   * manca è esattamente il motivo per cui uno apre questa pagina.
   */
  const versamenti = await db
    .select({
      id: pagamenti.id,
      importoCentesimi: pagamenti.importoCentesimi,
      causale: pagamenti.causale,
      pagatoIl: pagamenti.pagatoIl,
      metodo: pagamenti.metodo
    })
    .from(pagamenti)
    .where(eq(pagamenti.utenteId, req.utente.id))
    .orderBy(asc(pagamenti.pagatoIl), asc(pagamenti.id));

  const versatoCentesimi = versamenti.reduce((s, v) => s + v.importoCentesimi, 0);

  res.setHeader("Cache-Control", "no-store");

  return json(res, {
    iscrizione: {
      ...(scheda ?? {}),
      esiste: !!scheda,
      certificatoUrl: scheda?.certificatoMediaId
        ? urlFile(scheda.certificatoChiave, scheda.certificatoUrlWp)
        : null,
      manca: cosaManca(scheda),
      // Lo sa il server perché è lui a decidere cosa manca: il modulo lo
      // usa per accendere gli asterischi sui campi del genitore.
      minorenne: minorenne(scheda?.dataNascita),
      certificatoModificabile: modificabile(scheda),
      appartenenza: appartenenza ?? null,
      appartenenze,

      quotaStagionaleCentesimi: scheda?.quota ?? null,
      versatoCentesimi,
      pagamenti: versamenti,

      /**
       * La data d'iscrizione è quella del PRIMO versamento.
       *
       * Non la data di registrazione dell'account né quella in cui è stata
       * accolta la richiesta: iscritti alla società lo si è da quando si è
       * pagato, ed è la data che compare sui tesseramenti. Finché nessuno ha
       * versato niente, l'iscrizione non ha una data — ed è giusto che sia
       * vuota invece di mostrarne una finta.
       */
      iscrittoDal: versamenti[0]?.pagatoIl ?? null
    }
  });
}

async function scrivi(req, res) {
  // Chi aspetta ancora una squadra non compila: la sua richiesta è sul
  // tavolo di qualcun altro, e i dati che quella persona sta leggendo non
  // devono cambiare sotto i suoi occhi.
  if (req.utente.stato === "in_attesa") {
    throw new ErroreHttp(
      403,
      "Finché la tua richiesta è in attesa non puoi compilare l'iscrizione. Appena ti assegnano una squadra si sblocca."
    );
  }

  const dati = valida(schemaMiei, await leggiCorpo(req));
  if (Object.keys(dati).length === 0) {
    throw new ErroreHttp(400, "Non c'è niente da salvare.");
  }

  /*
   * Il blocco sul certificato vale anche qui e non solo a schermo: i campi
   * disabilitati nel modulo sono una cortesia verso chi compila, non una
   * difesa — una richiesta si scrive a mano in dieci secondi.
   */
  const tocca = ["tipoCertificato", "certificatoScadenza", "certificatoMediaId"]
    .some((c) => dati[c] !== undefined);

  if (tocca) {
    const [attuale] = await getDb()
      .select({
        certificatoStato: schedeAtleta.certificatoStato,
        certificatoScadenza: schedeAtleta.certificatoScadenza
      })
      .from(schedeAtleta)
      .where(eq(schedeAtleta.utenteId, req.utente.id))
      .limit(1);

    const permesso = modificabile(attuale);
    if (!permesso.si) throw new ErroreHttp(409, permesso.motivo);
  }

  await salvaScheda(req.utente.id, dati, req.utente.id);

  await annota(req.utente, {
    azione: dati.certificatoMediaId !== undefined
      ? "iscrizione.certificato"
      : "iscrizione.compila",
    tipo: "atleta",
    id: req.utente.id,
    descrizione: dati.certificatoMediaId !== undefined
      ? "Ha caricato il proprio certificato medico"
      : "Ha compilato la propria iscrizione",
    dettaglio: { campi: Object.keys(dati) }
  });

  return leggi(req, res);
}

export default conGestioneErrori(
  richiedeAccesso(async (req, res) => {
    if (req.method === "GET") return leggi(req, res);
    if (req.method === "PATCH") return scrivi(req, res);

    res.setHeader("Allow", "GET, PATCH");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
