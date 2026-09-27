/**
 * Fratelli e sorelle: chi lo dichiara, cosa trova il sistema, chi decide.
 *
 * Il giro è di tre passi e sono di tre persone diverse, apposta:
 *
 *   1. DICHIARA l'interessato, dalla propria iscrizione, scrivendo il
 *      codice fiscale del fratello o della sorella già iscritti;
 *   2. VERIFICA il sistema: cerca quel codice fiscale fra le schede e, se
 *      trova qualcuno, mette accanto alla dichiarazione le due cose che in
 *      segreteria si guarderebbero comunque a occhio — stesso cognome,
 *      stesso indirizzo;
 *   3. DECIDE la segreteria, e solo dopo assegna la tariffa agevolata con
 *      lo stesso comando di sempre.
 *
 * PERCHÉ NON ASSEGNA IL SISTEMA. Perché il codice fiscale non dimostra la
 * parentela: contiene cognome, nome, data e comune di nascita, e della
 * famiglia non dice niente. Due fratelli con cognomi diversi esistono, due
 * cugini che abitano insieme anche. E soprattutto perché la quota la decide
 * la società: un campo del modulo che abbassa da solo l'importo dovuto
 * sarebbe l'atleta che si scrive la propria quota.
 *
 * PERCHÉ A CHI DICHIARA NON SI DICE SE QUEL CODICE FISCALE ESISTE. Perché
 * rispondere "trovato" vuol dire che chiunque, scrivendo il codice fiscale
 * di una persona qualsiasi, può scoprire se quella persona fa sport qui.
 * Non è un dato suo. La risposta è sempre la stessa: la segreteria
 * controllerà.
 */

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { legamiFamiliari, schedeAtleta, utenti } from "../db/schema.js";
import { codiceFiscaleValido, normalizzaCodiceFiscale } from "./codice-fiscale.js";
import { ErroreHttp } from "./risposte.js";

/**
 * Quello che torna a chi ha dichiarato.
 *
 * Il codice fiscale che ha scritto lui, lo stato e l'eventuale motivo del
 * rifiuto. Niente nomi: vedi la nota in cima.
 */
function versoChiDichiara(riga) {
  return {
    id: riga.id,
    codiceFiscale: riga.codiceFiscaleDichiarato,
    stato: riga.stato,
    motivo: riga.motivo,
    creatoIl: riga.creatoIl
  };
}

/** Le dichiarazioni di una persona, come le vede lei. */
export async function legamiDichiaratiDa(utenteId) {
  const righe = await getDb()
    .select({
      id: legamiFamiliari.id,
      codiceFiscaleDichiarato: legamiFamiliari.codiceFiscaleDichiarato,
      stato: legamiFamiliari.stato,
      motivo: legamiFamiliari.motivo,
      creatoIl: legamiFamiliari.creatoIl
    })
    .from(legamiFamiliari)
    .where(eq(legamiFamiliari.utenteId, Number(utenteId)))
    .orderBy(desc(legamiFamiliari.creatoIl));

  return righe.map(versoChiDichiara);
}

/**
 * Registra una dichiarazione e cerca chi è.
 *
 * Il controllo del carattere di controllo non è pignoleria: una lettera
 * sbagliata non trova nessuno, e chi ha dichiarato resterebbe ad aspettare
 * uno sconto che non arriva senza sapere perché.
 */
export async function dichiaraLegame(utente, codiceFiscaleGrezzo) {
  const cf = normalizzaCodiceFiscale(codiceFiscaleGrezzo);

  if (!codiceFiscaleValido(cf)) {
    throw new ErroreHttp(
      400,
      "Questo codice fiscale non torna. Ricontrollalo: basta una lettera "
      + "diversa perché non corrisponda a nessuno."
    );
  }

  const db = getDb();

  /* Il proprio, no: non è un controllo teorico, è l'errore che fa chi non
     ha capito cosa chiede il modulo — e un fratello di sé stessi
     resterebbe in segreteria come una richiesta da capire. */
  const [mia] = await db
    .select({ codiceFiscale: schedeAtleta.codiceFiscale })
    .from(schedeAtleta)
    .where(eq(schedeAtleta.utenteId, utente.id))
    .limit(1);

  if (mia?.codiceFiscale && normalizzaCodiceFiscale(mia.codiceFiscale) === cf) {
    throw new ErroreHttp(
      400,
      "Questo è il tuo codice fiscale: qui va quello di tuo fratello o di tua sorella."
    );
  }

  /* Chi è, se c'è. Non esce da qui: serve alla segreteria, non a chi scrive.

     Il confronto normalizza anche il lato del database e non solo quello
     scritto adesso: i codici fiscali già registrati sono passati da un
     controllo che guardava solo la lunghezza, e fra quelli ce ne sono con
     gli spazi della tessera sanitaria o scritti in minuscolo. Cercare
     l'uguaglianza esatta non li troverebbe. */
  const [trovato] = await db
    .select({ utenteId: schedeAtleta.utenteId })
    .from(schedeAtleta)
    .where(eq(sql`upper(replace(${schedeAtleta.codiceFiscale}, ' ', ''))`, cf))
    .limit(1);

  const [creato] = await db
    .insert(legamiFamiliari)
    .values({
      utenteId: utente.id,
      codiceFiscaleDichiarato: cf,
      utenteCollegatoId: trovato?.utenteId ?? null
    })
    /* Dichiarato due volte lo stesso codice fiscale non è un errore da
       mostrare: è il pulsante premuto due volte. La riga che c'è già resta
       com'è — compresa una decisione già presa, che un secondo invio non
       deve riaprire. */
    .onConflictDoNothing()
    .returning({
      id: legamiFamiliari.id,
      codiceFiscaleDichiarato: legamiFamiliari.codiceFiscaleDichiarato,
      stato: legamiFamiliari.stato,
      motivo: legamiFamiliari.motivo,
      creatoIl: legamiFamiliari.creatoIl
    });

  return creato ? versoChiDichiara(creato) : null;
}

/**
 * Ritira una dichiarazione, finché nessuno l'ha ancora guardata.
 *
 * Dopo la decisione non si tocca più: una dichiarazione confermata è la
 * ragione per cui quella persona paga meno, e farla sparire lascerebbe una
 * tariffa agevolata senza più un perché.
 */
export async function ritiraLegame(id, utenteId) {
  const [tolto] = await getDb()
    .delete(legamiFamiliari)
    .where(and(
      eq(legamiFamiliari.id, Number(id)),
      eq(legamiFamiliari.utenteId, Number(utenteId)),
      eq(legamiFamiliari.stato, "in_attesa")
    ))
    .returning({ id: legamiFamiliari.id });

  if (!tolto) {
    throw new ErroreHttp(
      404,
      "Questa dichiarazione non c'è più, oppure la segreteria l'ha già guardata."
    );
  }

  return tolto;
}

/**
 * I legami che riguardano una persona, come li vede chi tiene le quote.
 *
 * Tutti e due i versi: quelli che ha dichiarato lei e quelli in cui è stata
 * nominata da qualcun altro. Aprendo la scheda di un ragazzo, "sua sorella
 * ha dichiarato lui" è esattamente l'informazione che serve per decidere
 * chi dei due ha diritto alla tariffa agevolata.
 *
 * Qui i nomi ci sono: chi ha "quote.gestisci" vede già l'anagrafica di
 * tutti, e senza il nome non avrebbe nulla su cui decidere.
 */
export async function legamiPerSegreteria(utenteId) {
  const db = getDb();
  const id = Number(utenteId);

  const chiDichiara = {
    nome: utenti.nome,
    cognome: utenti.cognome,
    email: utenti.email
  };

  const righe = await db
    .select({
      id: legamiFamiliari.id,
      utenteId: legamiFamiliari.utenteId,
      codiceFiscaleDichiarato: legamiFamiliari.codiceFiscaleDichiarato,
      utenteCollegatoId: legamiFamiliari.utenteCollegatoId,
      stato: legamiFamiliari.stato,
      motivo: legamiFamiliari.motivo,
      decisoIl: legamiFamiliari.decisoIl,
      creatoIl: legamiFamiliari.creatoIl,
      ...chiDichiara
    })
    .from(legamiFamiliari)
    .innerJoin(utenti, eq(utenti.id, legamiFamiliari.utenteId))
    .where(or(
      eq(legamiFamiliari.utenteId, id),
      eq(legamiFamiliari.utenteCollegatoId, id)
    ))
    .orderBy(desc(legamiFamiliari.creatoIl));

  if (righe.length === 0) return [];

  /* Le due persone dei legami trovati, per dire chi sono e per il
     confronto che segue. Una interrogazione sola invece di una per riga. */
  const idsCoinvolti = [...new Set(
    righe.flatMap((r) => [r.utenteId, r.utenteCollegatoId]).filter(Boolean)
  )];

  const schede = new Map(
    (await db
      .select({
        utenteId: schedeAtleta.utenteId,
        nome: utenti.nome,
        cognome: utenti.cognome,
        indirizzo: schedeAtleta.indirizzo,
        civico: schedeAtleta.civico,
        cap: schedeAtleta.cap,
        citta: schedeAtleta.citta
      })
      .from(schedeAtleta)
      .innerJoin(utenti, eq(utenti.id, schedeAtleta.utenteId))
      .where(inArray(schedeAtleta.utenteId, idsCoinvolti)))
      .map((s) => [s.utenteId, s])
  );

  return righe.map((r) => {
    const uno = schede.get(r.utenteId);
    const altro = r.utenteCollegatoId ? schede.get(r.utenteCollegatoId) : null;

    return {
      id: r.id,
      stato: r.stato,
      motivo: r.motivo,
      creatoIl: r.creatoIl,
      decisoIl: r.decisoIl,
      codiceFiscale: r.codiceFiscaleDichiarato,

      // Chi ha scritto la dichiarazione, e se è la persona di questa scheda
      dichiarataDa: [r.nome, r.cognome].filter(Boolean).join(" ") || r.email,
      dichiarataDaId: r.utenteId,
      laSua: r.utenteId === id,

      /* Chi il sistema ha trovato con quel codice fiscale. Null vuol dire
         che nessuno degli iscritti ce l'ha: o è un errore di battitura, o
         quel fratello non si è ancora iscritto. Sono due cose diverse e le
         distingue solo una persona. */
      trovato: altro
        ? {
          utenteId: r.utenteCollegatoId,
          nomeCompleto: [altro.nome, altro.cognome].filter(Boolean).join(" "),
          stessoCognome: confronta(uno?.cognome, altro.cognome),
          stessoIndirizzo: confrontaIndirizzo(uno, altro)
        }
        : null
    };
  });
}

function confronta(a, b) {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Stesso indirizzo, con la tolleranza di chi scrive a mano.
 *
 * "Via Roma 12" e "via roma, 12" sono lo stesso posto, e una spunta che
 * dicesse di no perché una virgola sarebbe peggio che inutile: chi legge
 * imparerebbe a non fidarsene.
 */
function confrontaIndirizzo(a, b) {
  if (!a || !b) return false;

  const chiave = (s) => [s.indirizzo, s.civico, s.cap, s.citta]
    .map((p) => (p ?? "").toString().toLowerCase().replace(/[^a-z0-9]/g, ""))
    .join("|");

  const chiaveA = chiave(a);
  // Un indirizzo vuoto da tutte e due le parti non è "lo stesso indirizzo".
  if (chiaveA === "|||") return false;

  return chiaveA === chiave(b);
}

/**
 * La segreteria decide: è un fratello o no.
 *
 * Decidere NON assegna nessuna tariffa. Sono due gesti separati perché
 * sono due domande separate — "sono fratelli?" e "quanto paga?" — e la
 * seconda resta di chi tiene i conti, con lo stesso comando di sempre.
 */
export async function decidiLegame(id, { stato, motivo = null }, decisore) {
  const [deciso] = await getDb()
    .update(legamiFamiliari)
    .set({
      stato,
      motivo: stato === "respinto" ? motivo : null,
      decisoDa: decisore.id,
      decisoIl: new Date()
    })
    .where(eq(legamiFamiliari.id, Number(id)))
    .returning({
      id: legamiFamiliari.id,
      utenteId: legamiFamiliari.utenteId,
      stato: legamiFamiliari.stato
    });

  if (!deciso) throw new ErroreHttp(404, "Questa dichiarazione non esiste più.");
  return deciso;
}
