/**
 * Quello che l'amministratore vede e decide sui calendari ufficiali.
 *
 * Tre cose sole si decidono a mano, e stanno tutte qui:
 *
 *   - le FONTI: quale cartella leggere, in che formato, con quale nome la
 *     federazione scrive il nostro e quale palestra è la nostra;
 *   - i GIRONI: a quale squadra del sito corrisponde ciascuno, una volta
 *     per stagione;
 *   - le partite SPARITE: se toglierle davvero dal calendario.
 *
 * Tutto il resto lo fa la lettura notturna. Lo scopo è che a ogni cambio
 * di stagione, e a ogni federazione nuova, non serva toccare il codice.
 */

import { and, asc, count, desc, eq, isNotNull, like, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client.js";
import { eventi, fontiCalendario, gironiUfficiali, registroAttivita, squadre } from "../../db/schema.js";
import { ErroreHttp } from "../risposte.js";
import { CODICI_FORMATO, formatiPerPannello } from "./formati/index.js";
import { idCartella, indirizzoCartella } from "./drive.js";
import { applicaGirone } from "./sincronizza.js";

/* =====================================================
   Forme accettate
   ===================================================== */

const elencoNomi = (massimo, messaggio) => z.array(z.string().trim().min(2).max(80))
  .max(massimo)
  .transform((a) => [...new Set(a.filter(Boolean))])
  .refine((a) => !messaggio || a.length > 0, { message: messaggio });

/* Nessun valore predefinito nei campi: in modifica, un campo che manca
   deve restare com'è, non tornare al suo valore iniziale. */
const CAMPI_FONTE = {
  nome: z.string().trim().min(2, "Il nome è troppo corto.").max(120),
  formato: z.enum(CODICI_FORMATO, { message: "Formato sconosciuto." }),
  cartella: z.string().trim().transform((t, ctx) => {
    const id = idCartella(t);
    if (!id) {
      ctx.addIssue({ code: "custom", message: "Incolla il collegamento della cartella Google Drive." });
      return z.NEVER;
    }
    return id;
  }),
  nomiNostri: elencoNomi(10, "Scrivi almeno un nome con cui la federazione indica la nostra società."),
  palestreCasa: elencoNomi(10),
  attiva: z.boolean()
};

export const schemaFonteNuova = z.object({
  ...CAMPI_FONTE,
  palestreCasa: CAMPI_FONTE.palestreCasa.optional().default([]),
  attiva: CAMPI_FONTE.attiva.optional().default(true)
});

export const schemaFonteModifica = z.object(
  Object.fromEntries(Object.entries(CAMPI_FONTE).map(([k, v]) => [k, v.optional()]))
);

export const schemaGirone = z.object({
  // null = scollega: il girone torna "da collegare"
  squadraId: z.union([z.null(), z.coerce.number().int().positive()]).optional(),
  ignorato: z.boolean().optional()
}).refine((d) => d.squadraId !== undefined || d.ignorato !== undefined, {
  message: "Non c'è niente da salvare."
});

/* =====================================================
   Lettura per la dashboard
   ===================================================== */

async function fonti(db) {
  const righe = await db.select().from(fontiCalendario).orderBy(asc(fontiCalendario.id));

  const partitePerFonte = await db
    .select({ fonteId: gironiUfficiali.fonteId, quante: count(eventi.id) })
    .from(eventi)
    .innerJoin(gironiUfficiali, eq(gironiUfficiali.id, eventi.gironeId))
    .groupBy(gironiUfficiali.fonteId);
  const partite = new Map(partitePerFonte.map((r) => [r.fonteId, r.quante]));

  return righe.map((f) => ({
    id: f.id,
    nome: f.nome,
    formato: f.formato,
    cartella: f.cartella,
    indirizzo: indirizzoCartella(f.cartella),
    nomiNostri: f.nomiNostri,
    palestreCasa: f.palestreCasa,
    attiva: f.attiva,
    inLettura: Boolean(f.inLetturaDal),
    ultimaLettura: f.ultimaLettura,
    esito: f.esito,
    riepilogo: f.riepilogo,
    partite: partite.get(f.id) ?? 0
  }));
}

async function gironi(db) {
  const righe = await db
    .select({
      id: gironiUfficiali.id,
      fonteId: gironiUfficiali.fonteId,
      nomeFile: gironiUfficiali.nomeFile,
      titolo: gironiUfficiali.titolo,
      nomeNelGirone: gironiUfficiali.nomeNelGirone,
      squadraId: gironiUfficiali.squadraId,
      squadraNome: squadre.nome,
      ignorato: gironiUfficiali.ignorato,
      partite: gironiUfficiali.partite,
      ultimaLettura: gironiUfficiali.ultimaLettura,
      sparitoIl: gironiUfficiali.sparitoIl
    })
    .from(gironiUfficiali)
    .leftJoin(squadre, eq(squadre.id, gironiUfficiali.squadraId))
    .orderBy(asc(gironiUfficiali.fonteId), asc(gironiUfficiali.nomeFile), asc(gironiUfficiali.nomeNelGirone));

  /* Per scollegare serve sapere cosa si perde: le partite nel calendario,
     e quante di queste hanno qualcosa scritto a mano — marcatori, diretta,
     note, foto — che con loro se ne andrebbe. */
  const nelCalendario = await db
    .select({
      gironeId: eventi.gironeId,
      quante: count(eventi.id),
      conAggiunte: sql`count(*) filter (where
        coalesce(array_length(${eventi.marcatori}, 1), 0) > 0
        or ${eventi.diretta} is not null
        or coalesce(${eventi.descrizione}, '') <> ''
        or exists (select 1 from media_evento m where m.evento_id = ${eventi.id})
      )::int`
    })
    .from(eventi)
    .where(isNotNull(eventi.gironeId))
    .groupBy(eventi.gironeId);
  const perGirone = new Map(nelCalendario.map((r) => [r.gironeId, r]));

  const adesso = Date.now();

  // Le partite complete non servono al pannello: bastano quante sono e
  // quando si gioca la prossima, per riconoscere il girone giusto.
  return righe.map(({ partite, ...g }) => {
    const future = (partite ?? [])
      .map((p) => p.inizio)
      .filter((d) => new Date(d).getTime() >= adesso)
      .sort();

    return {
      ...g,
      partite: (partite ?? []).length,
      prossima: future[0] ?? null,
      nelCalendario: perGirone.get(g.id)?.quante ?? 0,
      conAggiunte: perGirone.get(g.id)?.conAggiunte ?? 0,
      avversari: [...new Set((partite ?? []).map((p) => p.avversario))].slice(0, 6)
    };
  });
}

async function sparite(db) {
  return db
    .select({
      id: eventi.id,
      titolo: eventi.titolo,
      inizio: eventi.inizio,
      sparitaIl: eventi.sparitaIl,
      squadra: squadre.nome
    })
    .from(eventi)
    .innerJoin(squadre, eq(squadre.id, eventi.squadraId))
    .where(and(isNotNull(eventi.gironeId), isNotNull(eventi.sparitaIl)))
    .orderBy(asc(eventi.inizio));
}

async function variazioni(db, quante = 40) {
  return db
    .select({
      id: registroAttivita.id,
      quando: registroAttivita.quando,
      azione: registroAttivita.azione,
      descrizione: registroAttivita.descrizione,
      oggettoTipo: registroAttivita.oggettoTipo,
      oggettoId: registroAttivita.oggettoId,
      autore: registroAttivita.autore
    })
    .from(registroAttivita)
    // La riga riassuntiva di ogni lettura non è una variazione: la si vede
    // già nell'esito della fonte, e ogni notte ne scriverebbe una uguale.
    .where(and(like(registroAttivita.azione, "calendari.%"), sql`${registroAttivita.azione} <> 'calendari.lettura'`))
    .orderBy(desc(registroAttivita.quando))
    .limit(quante);
}

/** Tutto quello che serve alla schermata, in una richiesta sola. */
export async function statoCalendari() {
  const db = getDb();

  const [elencoFonti, elencoGironi, elencoSparite, elencoVariazioni, elencoSquadre] = await Promise.all([
    fonti(db),
    gironi(db),
    sparite(db),
    variazioni(db),
    db.select({ id: squadre.id, nome: squadre.nome, sport: squadre.sport })
      .from(squadre)
      .where(eq(squadre.attiva, true))
      .orderBy(asc(squadre.ordine))
  ]);

  return {
    formati: formatiPerPannello(),
    fonti: elencoFonti,
    gironi: elencoGironi,
    sparite: elencoSparite,
    variazioni: elencoVariazioni,
    squadre: elencoSquadre,
    // Senza il segreto la lettura notturna non parte: Vercel chiama
    // l'indirizzo, e l'indirizzo lo rifiuta. Meglio dirlo in pagina.
    letturaNotturna: Boolean(process.env.CRON_SECRET)
  };
}

/* =====================================================
   Fonti
   ===================================================== */

export async function trovaFonte(id) {
  const [fonte] = await getDb().select().from(fontiCalendario).where(eq(fontiCalendario.id, Number(id))).limit(1);
  if (!fonte) throw new ErroreHttp(404, "Fonte non trovata.");
  return fonte;
}

export async function creaFonte(dati, autore) {
  const [creata] = await getDb().insert(fontiCalendario).values({
    ...dati,
    creataDa: autore?.id ?? null
  }).returning();
  return creata;
}

export async function modificaFonte(id, dati) {
  const [modificata] = await getDb()
    .update(fontiCalendario)
    .set(dati)
    .where(eq(fontiCalendario.id, Number(id)))
    .returning();
  if (!modificata) throw new ErroreHttp(404, "Fonte non trovata.");
  return modificata;
}

/**
 * Toglie una fonte, ma solo se non ha ancora portato partite nel calendario.
 *
 * Una fonte che ha già scritto partite si DISATTIVA: smette di essere
 * letta e le sue partite restano. Cancellarla le staccherebbe dai loro
 * gironi, e aggiungerla di nuovo per sbaglio le scriverebbe una seconda
 * volta, doppie.
 */
export async function eliminaFonte(id) {
  const db = getDb();

  const [{ quante }] = await db
    .select({ quante: count(eventi.id) })
    .from(eventi)
    .innerJoin(gironiUfficiali, eq(gironiUfficiali.id, eventi.gironeId))
    .where(eq(gironiUfficiali.fonteId, Number(id)));

  if (quante > 0) {
    throw new ErroreHttp(
      409,
      `Questa fonte ha già portato ${quante} partite nel calendario: non si cancella, si disattiva. `
      + "Smette di essere letta e le partite restano."
    );
  }

  const [tolta] = await db.delete(fontiCalendario).where(eq(fontiCalendario.id, Number(id))).returning();
  if (!tolta) throw new ErroreHttp(404, "Fonte non trovata.");
  return tolta;
}

/* =====================================================
   Gironi
   ===================================================== */

/**
 * Collega un girone a una squadra, o lo mette da parte.
 *
 * Collegato, le sue partite entrano SUBITO nel calendario, da quelle
 * lette l'ultima volta: chi collega vuole vederle, non aspettare la notte.
 *
 * Scollegato (squadraId null), il girone torna "da collegare" e le sue
 * partite escono dal calendario: un girone senza squadra non ha un
 * calendario in cui stare. Si perde quello che qualcuno ci aveva aggiunto
 * a mano — marcatori, diretta, foto — e il pannello lo dice prima di
 * chiedere conferma. Le partite ufficiali invece no: restano sul girone, e
 * collegandolo di nuovo tornano subito.
 *
 * Un girone collegato non si "ignora" direttamente: prima si scollega.
 * Per un collegamento sbagliato basta scegliere la squadra giusta, e le
 * partite si spostano con lui senza perdere niente.
 */
export async function aggiornaGirone(id, { squadraId, ignorato }) {
  const db = getDb();
  const [girone] = await db.select().from(gironiUfficiali).where(eq(gironiUfficiali.id, Number(id))).limit(1);
  if (!girone) throw new ErroreHttp(404, "Girone non trovato.");

  if (ignorato === true && girone.squadraId) {
    throw new ErroreHttp(
      409,
      "Questo girone è già collegato e le sue partite sono nel calendario. "
      + "Se la squadra è sbagliata, scegli quella giusta: le partite la seguono."
    );
  }

  if (squadraId === null) {
    if (!girone.squadraId) return { girone, prima: girone, conto: null };

    const tolte = await db.delete(eventi).where(eq(eventi.gironeId, girone.id)).returning({ id: eventi.id });
    const [scollegato] = await db.update(gironiUfficiali).set({ squadraId: null })
      .where(eq(gironiUfficiali.id, girone.id)).returning();

    return { girone: scollegato, prima: girone, conto: { tolte: tolte.length } };
  }

  const modifiche = {};

  if (squadraId !== undefined) {
    const [squadra] = await db.select({ id: squadre.id, attiva: squadre.attiva })
      .from(squadre).where(eq(squadre.id, squadraId)).limit(1);
    if (!squadra) throw new ErroreHttp(400, "Squadra non trovata.");
    if (!squadra.attiva) throw new ErroreHttp(400, "Questa squadra è disattivata: riattivala prima di collegarle un girone.");

    modifiche.squadraId = squadraId;
    modifiche.ignorato = false;
  }
  if (ignorato !== undefined && squadraId === undefined) modifiche.ignorato = ignorato;

  const [aggiornato] = await db.update(gironiUfficiali).set(modifiche)
    .where(eq(gironiUfficiali.id, girone.id)).returning();

  /* Le partite si scrivono da quelle conservate sul girone. Se il file non
     è più nella cartella non si dichiara sparito niente: "completo" vale
     solo per una lettura appena fatta del file intero. */
  const conto = aggiornato.squadraId && !aggiornato.ignorato
    ? await applicaGirone(aggiornato, aggiornato.partite ?? [], { completo: !aggiornato.sparitoIl })
    : null;

  return { girone: aggiornato, prima: girone, conto };
}

