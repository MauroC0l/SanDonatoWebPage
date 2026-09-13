/**
 * Freno sui tentativi di accesso ripetuti.
 *
 * Si frena su due chiavi insieme: l'email tentata e l'indirizzo del
 * chiamante. Frenare solo sull'email permetterebbe di provare una password
 * comune su mille account diversi; frenare solo sull'indirizzo lascerebbe
 * campo libero a chi cambia rete.
 */

import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { tentativiAccesso } from "../db/schema.js";
import { ErroreHttp } from "./risposte.js";

const FINESTRA_MINUTI = 15;
const MASSIMO_TENTATIVI = 8;

const finestra = () => new Date(Date.now() - FINESTRA_MINUTI * 60 * 1000);

async function conteggio(chiave) {
  const [riga] = await getDb()
    .select({ quanti: sql`count(*)::int` })
    .from(tentativiAccesso)
    .where(and(eq(tentativiAccesso.chiave, chiave), gte(tentativiAccesso.quando, finestra())));

  return riga?.quanti ?? 0;
}

/** Blocca con un 429 se una delle chiavi ha superato la soglia. */
export async function verificaFreno(chiavi) {
  for (const chiave of chiavi) {
    if (await conteggio(chiave) >= MASSIMO_TENTATIVI) {
      throw new ErroreHttp(
        429,
        `Troppi tentativi di accesso. Riprova fra ${FINESTRA_MINUTI} minuti.`
      );
    }
  }
}

export async function registraFallimento(chiavi) {
  const db = getDb();
  await db.insert(tentativiAccesso).values(chiavi.map((chiave) => ({ chiave })));
}

/** Dopo un accesso riuscito il contatore riparte da zero. */
export async function azzeraFallimenti(chiavi) {
  const db = getDb();
  for (const chiave of chiavi) {
    await db.delete(tentativiAccesso).where(eq(tentativiAccesso.chiave, chiave));
  }
}
