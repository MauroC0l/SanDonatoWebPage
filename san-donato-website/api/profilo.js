/**
 * /api/profilo — i propri dati.
 *
 *   GET    tutto quello che il sito sa di chi è connesso
 *   PATCH  modifica nome, cognome, email e immagine del profilo
 *
 * Distinto da /api/io, che resta minuscolo apposta: quello lo chiama il
 * front-end a ogni avvio solo per sapere se c'è una sessione, e caricarlo di
 * join lo renderebbe più lento per tutti. Questo lo chiede solo chi apre la
 * propria scheda.
 *
 * Non c'è nessuna capacità da controllare: l'unico dato che si tocca è il
 * proprio, e l'identità arriva dalla sessione, non dal corpo della richiesta.
 * Per questo non esiste un parametro "id": non deve essere possibile passare
 * quello di qualcun altro.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { utenti, squadre, associazioniSquadra, richiesteIscrizione, media } from "../db/schema.js";
import { urlFile } from "../server/file.js";
import { richiedeAccesso } from "../server/autenticazione.js";
import { annota } from "../server/registro.js";
import { capacitaDi } from "../server/autorizzazioni.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../server/risposte.js";
import { leggiCorpo } from "../server/richiesta.js";
import { valida } from "../server/validazione.js";

const schemaModifica = z.object({
  nome: z.string().trim().min(1, "Il nome non può restare vuoto.").max(80).optional(),
  cognome: z.string().trim().min(1, "Il cognome non può restare vuoto.").max(80).optional(),
  email: z.string().trim().toLowerCase().email("Indirizzo email non valido.").max(255).optional(),

  /**
   * L'immagine del profilo: l'identificativo di un file già caricato.
   *
   * null la toglie, ed è un caso legittimo — chi ha messo una foto deve
   * poterla levare senza chiedere il permesso a nessuno. Non si controlla
   * che il file sia un'immagine e non un PDF: lo fa già /api/admin/media,
   * che è l'unica strada per cui un identificativo può esistere.
   */
  immagineId: z.number().int().positive().nullable().optional()
});

async function leggi(req, res) {
  const db = getDb();

  const [riga] = await db
    .select({
      id: utenti.id,
      email: utenti.email,
      nome: utenti.nome,
      cognome: utenti.cognome,
      ruolo: utenti.ruolo,
      stato: utenti.stato,
      deveCambiarePassword: utenti.deveCambiarePassword,
      ultimoAccesso: utenti.ultimoAccesso,
      creatoIl: utenti.creatoIl,
      immagineId: utenti.immagineId,
      immagineChiave: media.chiave,
      immagineUrlWp: media.urlOriginaleWp
    })
    .from(utenti)
    .leftJoin(media, eq(media.id, utenti.immagineId))
    .where(eq(utenti.id, req.utente.id))
    .limit(1);

  if (!riga) throw new ErroreHttp(404, "Account non trovato.");

  const { immagineChiave, immagineUrlWp, ...resto } = riga;

  // Le squadre che questa persona GESTISCE (coach, editor, admin)
  const gestite = await db
    .select({ id: squadre.id, nome: squadre.nome, sport: squadre.sport, colore: squadre.colore })
    .from(associazioniSquadra)
    .innerJoin(squadre, eq(squadre.id, associazioniSquadra.squadraId))
    .where(eq(associazioniSquadra.utenteId, req.utente.id));

  // La squadra di cui FA PARTE, che è un'altra cosa: sta sulla richiesta di
  // iscrizione accolta. Si legge anche quando è ancora da decidere o è stata
  // respinta, perché è proprio lì che la persona va a cercare a che punto è.
  const [richiesta] = await db
    .select({
      sport: richiesteIscrizione.sport,
      stato: richiesteIscrizione.stato,
      richiestaIl: richiesteIscrizione.richiestaIl,
      decisaIl: richiesteIscrizione.decisaIl,
      motivoRifiuto: richiesteIscrizione.motivoRifiuto,
      squadraId: squadre.id,
      squadra: squadre.nome
    })
    .from(richiesteIscrizione)
    .leftJoin(squadre, eq(squadre.id, richiesteIscrizione.squadraId))
    .where(eq(richiesteIscrizione.utenteId, req.utente.id))
    // La più recente: chi è stato respinto una volta e poi accolto deve
    // vedere l'esito buono, non quello vecchio.
    .orderBy(desc(richiesteIscrizione.richiestaIl))
    .limit(1);

  /**
   * TUTTE le squadre di cui fa parte, non solo l'ultima.
   *
   * Chi gioca a calcio e a pallavolo ha due richieste accolte, e con una
   * sola in risposta la sua seconda squadra semplicemente non esiste per
   * il sito: nella pagina "Squadra" vedeva gli appuntamenti di una e non
   * sapeva dove fossero gli altri.
   *
   * "appartenenza" qui sopra resta: è la richiesta più recente comunque
   * sia andata, e serve a raccontare anche le attese e i rifiuti, che qui
   * dentro non compaiono perché una squadra non ce l'hanno.
   */
  const appartenenze = await db
    .select({
      squadraId: squadre.id,
      squadra: squadre.nome,
      sport: squadre.sport,
      colore: squadre.colore,
      dal: richiesteIscrizione.decisaIl
    })
    .from(richiesteIscrizione)
    .innerJoin(squadre, eq(squadre.id, richiesteIscrizione.squadraId))
    .where(and(
      eq(richiesteIscrizione.utenteId, req.utente.id),
      eq(richiesteIscrizione.stato, "approvata")
    ))
    .orderBy(asc(squadre.sport), asc(squadre.nome));

  res.setHeader("Cache-Control", "no-store");

  return json(res, {
    profilo: {
      // Fuori chiave e indirizzo WordPress: a chi disegna la pagina serve
      // un indirizzo e basta, e ogni campo in più è una cosa in più su cui
      // qualcuno finirà per appoggiarsi.
      ...resto,
      immagineUrl: urlFile(immagineChiave, immagineUrlWp),
      nomeCompleto: [resto.nome, resto.cognome].filter(Boolean).join(" ") || resto.email,
      capacita: capacitaDi(resto.ruolo),
      squadreGestite: gestite,
      appartenenza: richiesta ?? null,
      appartenenze
    }
  });
}

async function modifica(req, res) {
  // Chi aspetta ancora una squadra guarda e basta. Non è una questione di
  // sicurezza: è che finché la richiesta è aperta, chi deve decidere sta
  // leggendo quei dati, e cambiarli sotto i suoi occhi genera confusione.
  if (req.utente.stato === "in_attesa") {
    throw new ErroreHttp(
      403,
      "Finché la tua richiesta è in attesa non puoi modificare i dati. Appena ti assegnano una squadra si sblocca."
    );
  }

  const dati = valida(schemaModifica, await leggiCorpo(req));
  const db = getDb();

  const modifiche = { aggiornatoIl: new Date() };
  if (dati.nome !== undefined) modifiche.nome = dati.nome;
  if (dati.cognome !== undefined) modifiche.cognome = dati.cognome;
  if (dati.immagineId !== undefined) modifiche.immagineId = dati.immagineId;

  if (dati.email !== undefined && dati.email !== req.utente.email) {
    const [occupata] = await db
      .select({ id: utenti.id })
      .from(utenti)
      .where(eq(utenti.email, dati.email))
      .limit(1);

    if (occupata) throw new ErroreHttp(409, "Questo indirizzo è già usato da un altro account.");
    modifiche.email = dati.email;
  }

  await db
    .update(utenti)
    .set(modifiche)
    .where(eq(utenti.id, req.utente.id));

  await annota(req.utente, {
    azione: "profilo.modifica",
    tipo: "utente",
    id: req.utente.id,
    descrizione: "Ha modificato i propri dati",
    dettaglio: { campi: Object.keys(dati) }
  });

  // Si rilegge tutto invece di restituire le colonne appena scritte: a chi
  // ha cambiato l'immagine serve il suo indirizzo, che dal solo
  // identificativo non si ricava.
  return leggi(req, res);
}

export default conGestioneErrori(
  richiedeAccesso(async (req, res) => {
    if (req.method === "GET") return leggi(req, res);
    if (req.method === "PATCH") return modifica(req, res);

    res.setHeader("Allow", "GET, PATCH");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
