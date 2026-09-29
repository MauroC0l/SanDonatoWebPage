/**
 * Le spese del sito: i servizi esterni, quanto costano e quanto si consuma.
 *
 * Due tipi di numeri, e la schermata li tiene distinti:
 *
 *   - quelli SCRITTI dall'amministratore: piano, importo, rinnovo. Nessun
 *     servizio ci manda la fattura, e un numero copiato dal pannello è più
 *     onesto di uno stimato qui;
 *   - quelli MISURATI dal sito a ogni apertura: quanto occupa il database e
 *     quanti byte ci sono nell'archivio dei file. Sono i due che crescono da
 *     soli e che, passata la soglia del piano gratuito, fanno arrivare una
 *     fattura che nessuno aspettava.
 */

import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { serviziEsterni, media } from "../db/schema.js";
import { ErroreHttp } from "./risposte.js";

export const CATEGORIE = [
  { valore: "sito", etichetta: "Sito" },
  { valore: "database", etichetta: "Database" },
  { valore: "file", etichetta: "Archivio dei file" },
  { valore: "email", etichetta: "Email e newsletter" },
  { valore: "dominio", etichetta: "Dominio" },
  { valore: "calendari", etichetta: "Calendari" },
  { valore: "codice", etichetta: "Codice" },
  { valore: "altro", etichetta: "Altro" }
];

export const PERIODICITA = [
  { valore: "gratis", etichetta: "Gratuito" },
  { valore: "mese", etichetta: "Al mese" },
  { valore: "anno", etichetta: "All'anno" },
  { valore: "una_tantum", etichetta: "Una tantum" }
];

export const MISURE = [
  { valore: "database", etichetta: "Spazio del database" },
  { valore: "archivio", etichetta: "Spazio dell'archivio dei file" }
];

// Oltre questa parte della soglia gratuita, la home lo segnala
const SOGLIA_AVVISO = 0.8;
// Un rinnovo entro questi giorni si segnala
const GIORNI_RINNOVO = 30;

/* =====================================================
   Lettura
   ===================================================== */

export async function elencaServizi() {
  return getDb()
    .select({
      id: serviziEsterni.id,
      nome: serviziEsterni.nome,
      categoria: serviziEsterni.categoria,
      serveA: serviziEsterni.serveA,
      account: serviziEsterni.account,
      piano: serviziEsterni.piano,
      importoCentesimi: serviziEsterni.importoCentesimi,
      periodicita: serviziEsterni.periodicita,
      rinnovoIl: serviziEsterni.rinnovoIl,
      limiti: serviziEsterni.limiti,
      urlPannello: serviziEsterni.urlPannello,
      note: serviziEsterni.note,
      misura: serviziEsterni.misura,
      sogliaByte: serviziEsterni.sogliaByte,
      ordine: serviziEsterni.ordine,
      attivo: serviziEsterni.attivo,
      aggiornatoIl: serviziEsterni.aggiornatoIl
    })
    .from(serviziEsterni)
    .orderBy(desc(serviziEsterni.attivo), asc(serviziEsterni.ordine), asc(serviziEsterni.id));
}

/**
 * Quello che il sito sa misurare da sé.
 *
 * Il database: pg_database_size, cioè lo spazio che Neon conta (tabelle,
 * indici e il loro disordine), non la somma delle righe.
 *
 * L'archivio: la somma dei byte dei file registrati con una chiave, cioè
 * già sull'archivio. Un file caricato e mai registrato non si vede — succede
 * se il browser si chiude a metà — ma è un'eccezione che pesa poco.
 */
export async function misuraConsumi() {
  const db = getDb();

  const risultato = await db.execute(sql`select pg_database_size(current_database())::bigint as byte`);
  const dbByte = (risultato.rows ?? risultato)[0]?.byte ?? null;

  const [archivio] = await db
    .select({
      byte: sql`coalesce(sum(${media.byte}), 0)::bigint`,
      file: sql`count(*)::int`,
      byteRiservati: sql`coalesce(sum(${media.byte}) filter (where ${media.chiave} like 'certificati/%'), 0)::bigint`,
      fileRiservati: sql`count(*) filter (where ${media.chiave} like 'certificati/%')::int`
    })
    .from(media)
    .where(isNotNull(media.chiave));

  // Quelli ancora sul vecchio WordPress: non pesano su R2 finché non si spostano
  const [{ ancoraSuWordpress }] = await db
    .select({ ancoraSuWordpress: sql`count(*)::int` })
    .from(media)
    .where(and(isNull(media.chiave), isNotNull(media.urlOriginaleWp)));

  return {
    database: { byte: dbByte == null ? null : Number(dbByte) },
    archivio: {
      byte: Number(archivio.byte),
      file: archivio.file,
      byteRiservati: Number(archivio.byteRiservati),
      fileRiservati: archivio.fileRiservati,
      ancoraSuWordpress
    }
  };
}

/* =====================================================
   Conti
   ===================================================== */

/** Quanto costa un servizio in un mese e in un anno, in centesimi. */
export function costoDi(servizio) {
  const importo = servizio.importoCentesimi ?? 0;
  if (servizio.periodicita === "mese") return { mese: importo, anno: importo * 12 };
  if (servizio.periodicita === "anno") return { mese: Math.round(importo / 12), anno: importo };
  return { mese: 0, anno: 0 };
}

function giorniA(data, oggi = new Date()) {
  const inizio = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
  return Math.round((new Date(`${data}T00:00:00`) - inizio) / 86400000);
}

/** Totali, prossimo rinnovo e cose da guardare, sui soli servizi attivi. */
export function riassumi(servizi, consumi) {
  const attivi = servizi.filter((s) => s.attivo);
  const totali = attivi.reduce((t, s) => {
    const c = costoDi(s);
    return { mese: t.mese + c.mese, anno: t.anno + c.anno };
  }, { mese: 0, anno: 0 });

  const rinnovi = attivi
    .filter((s) => s.rinnovoIl)
    .map((s) => ({ id: s.id, nome: s.nome, data: s.rinnovoIl, giorni: giorniA(s.rinnovoIl) }))
    .sort((a, b) => a.giorni - b.giorni);
  const prossimoRinnovo = rinnovi.find((r) => r.giorni >= 0) ?? null;

  const avvisi = [];

  for (const r of rinnovi) {
    if (r.giorni < 0) {
      avvisi.push({ tipo: "rinnovo_passato", servizioId: r.id, testo: `${r.nome}: la data di rinnovo è passata. Controlla che sia rinnovato e aggiorna la data.` });
    } else if (r.giorni <= GIORNI_RINNOVO) {
      avvisi.push({ tipo: "rinnovo", servizioId: r.id, testo: `${r.nome} si rinnova ${r.giorni === 0 ? "oggi" : r.giorni === 1 ? "domani" : `fra ${r.giorni} giorni`}.` });
    }
  }

  // I consumi misurati, ciascuno col servizio che lo paga
  const usi = attivi
    .filter((s) => s.misura && s.sogliaByte)
    .map((s) => {
      const byte = s.misura === "database" ? consumi.database.byte : consumi.archivio.byte;
      return { servizioId: s.id, nome: s.nome, misura: s.misura, byte, sogliaByte: s.sogliaByte, quota: byte == null ? null : byte / s.sogliaByte };
    });

  for (const u of usi) {
    if (u.quota != null && u.quota >= SOGLIA_AVVISO) {
      avvisi.push({
        tipo: "consumo",
        servizioId: u.servizioId,
        testo: `${u.nome}: occupato il ${Math.round(u.quota * 100)}% dello spazio del piano gratuito.`
      });
    }
  }

  const daCompilare = attivi.filter((s) => /da compilare/i.test(`${s.account ?? ""} ${s.piano ?? ""}`)).length;

  return { totali, prossimoRinnovo, usi, avvisi, daCompilare, attivi: attivi.length };
}

/** Quello che serve alla home: un riassunto, senza l'elenco. */
export async function riepilogoSpese() {
  const [servizi, consumi] = await Promise.all([elencaServizi(), misuraConsumi()]);
  return riassumi(servizi, consumi);
}

/* =====================================================
   Scrittura
   ===================================================== */

const testo = (max) => z.string().trim().max(max).transform((v) => v || null).nullable().optional();

const campi = {
  nome: z.string().trim().min(2, "Scrivi il nome del servizio.").max(120),
  categoria: z.enum(CATEGORIE.map((c) => c.valore)),
  serveA: testo(600),
  account: testo(200),
  piano: testo(120),
  importoCentesimi: z.number().int().min(0).max(100000000),
  periodicita: z.enum(PERIODICITA.map((p) => p.valore)),
  rinnovoIl: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida.").nullable().optional(),
  limiti: testo(1000),
  urlPannello: z.string().trim().max(500)
    .refine((v) => !v || /^https:\/\//.test(v), "L'indirizzo del pannello deve cominciare con https://")
    .transform((v) => v || null).nullable().optional(),
  note: testo(1000),
  misura: z.enum(MISURE.map((m) => m.valore)).nullable().optional(),
  sogliaByte: z.number().int().positive().nullable().optional(),
  attivo: z.boolean().optional()
};

export const schemaServizioNuovo = z.object({
  ...campi,
  categoria: campi.categoria.default("altro"),
  importoCentesimi: campi.importoCentesimi.default(0),
  periodicita: campi.periodicita.default("gratis")
});

export const schemaServizioModifica = z.object(campi).partial();

/* Un account è un nome, non una chiave: se qualcuno ci incolla una
   password o un token, meglio fermarlo prima che finisca in un database che
   leggono anche altri. */
function controllaSegreti(dati) {
  const sospetto = /(password|passw|pwd|secret|segreto|token)\s*[:=]/i;
  for (const campo of ["account", "note", "limiti"]) {
    if (dati[campo] && sospetto.test(dati[campo])) {
      throw new ErroreHttp(400, "Qui non vanno password né chiavi: scrivi solo con quale account si entra.");
    }
  }
}

export async function creaServizio(dati, autoreId) {
  controllaSegreti(dati);
  const db = getDb();
  const [{ ultimo }] = await db.select({ ultimo: sql`coalesce(max(${serviziEsterni.ordine}), 0)::int` }).from(serviziEsterni);
  const [creato] = await db.insert(serviziEsterni)
    .values({ ...dati, ordine: ultimo + 1, aggiornatoDa: autoreId })
    .returning();
  return creato;
}

export async function modificaServizio(id, dati, autoreId) {
  controllaSegreti(dati);
  const [aggiornato] = await getDb().update(serviziEsterni)
    .set({ ...dati, aggiornatoDa: autoreId, aggiornatoIl: new Date() })
    .where(eq(serviziEsterni.id, id))
    .returning();
  if (!aggiornato) throw new ErroreHttp(404, "Servizio non trovato.");
  return aggiornato;
}

export async function eliminaServizio(id) {
  const [tolto] = await getDb().delete(serviziEsterni).where(eq(serviziEsterni.id, id)).returning();
  if (!tolto) throw new ErroreHttp(404, "Servizio non trovato.");
  return tolto;
}
