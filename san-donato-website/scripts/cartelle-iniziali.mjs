/**
 * Crea le prime cartelle della libreria e ci mette dentro quello che c'è già.
 *
 *   node --env-file=.env scripts/cartelle-iniziali.mjs            prova
 *   node --env-file=.env scripts/cartelle-iniziali.mjs --applica  scrive
 *
 * Una libreria che si apre su quattrocento file tutti insieme e nessuna
 * cartella non invoglia nessuno a metterci ordine: si comincia da tre
 * cartelle già piene, e da lì si riorganizza.
 *
 * La divisione è quella che si può dedurre da sola, cioè da dove il file è
 * stato scritto nel bucket: copertine di notizie, foto di eventi, e tutto
 * quello che arriva dal vecchio sito. Da lì in poi decidono le persone.
 *
 * SI PUÒ RIESEGUIRE: tocca solo i file che non hanno ancora una cartella,
 * quindi non disfa il lavoro di chi ha già spostato qualcosa a mano.
 */

import { and, ilike, isNull, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { media, cartelleMedia } from "../db/schema.js";

const APPLICA = process.argv.includes("--applica");

/* Nome della cartella e come si riconoscono i file che ci vanno.
   "dalVecchioSito" sono quelli senza chiave: sono ancora su WordPress. */
const INIZIALI = [
  { nome: "Notizie", dove: () => ilike(media.chiave, "notizie/%") },
  { nome: "Eventi", dove: () => ilike(media.chiave, "eventi/%") },
  { nome: "Dal vecchio sito", dove: () => isNull(media.chiave) }
];

async function trovaOCrea(db, nome) {
  const [esistente] = await db
    .select({ id: cartelleMedia.id })
    .from(cartelleMedia)
    .where(sql`lower(${cartelleMedia.nome}) = lower(${nome})`)
    .limit(1);

  if (esistente) return { id: esistente.id, nuova: false };

  if (!APPLICA) return { id: null, nuova: true };

  const [creata] = await db
    .insert(cartelleMedia)
    .values({ nome })
    .returning({ id: cartelleMedia.id });

  return { id: creata.id, nuova: true };
}

async function main() {
  const db = getDb();

  for (const { nome, dove } of INIZIALI) {
    const { id, nuova } = await trovaOCrea(db, nome);

    // Solo i file ancora da ordinare: chi ne ha già spostato uno a mano ha
    // deciso, e questo script non è nessuno per correggerlo.
    const condizione = and(dove(), isNull(media.cartellaId));

    const [{ quanti }] = await db
      .select({ quanti: sql`count(*)::int` })
      .from(media)
      .where(condizione);

    console.log(
      `${nome.padEnd(18)} ${nuova ? "(nuova)" : "(c'era già)"}  ${quanti} file da sistemare`
    );

    if (APPLICA && id) {
      await db.update(media).set({ cartellaId: id }).where(condizione);
    }
  }

  const [{ senza }] = await db
    .select({ senza: sql`count(*)::int` })
    .from(media)
    .where(isNull(media.cartellaId));

  console.log(`\nSenza cartella dopo: ${APPLICA ? senza : "(prova, niente scritto)"}`);

  if (!APPLICA) console.log("Rilancia con --applica per scrivere.");
}

main().then(() => process.exit(0), (e) => {
  console.error(e);
  process.exit(1);
});
