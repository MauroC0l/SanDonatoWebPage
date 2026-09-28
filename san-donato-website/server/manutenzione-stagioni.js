/**
 * Quello che succede alle stagioni da solo, senza che nessuno prema niente.
 *
 * Deciso dalla società il 28 settembre 2026:
 *
 *   1. PASSAGGIO. Il 1° luglio tutti gli iscritti passano alla stagione
 *      nuova con la quota "Rinnovo", da saldare. Chi aveva un'altra quota
 *      (famiglia, una scelta a mano) passa anche lui a "Rinnovo": lo sconto
 *      famiglia si richiede di nuovo, come l'anno prima. Chi la stagione
 *      prima si era ritirato o aveva abbandonato non passa: nella stagione
 *      nuova risulta "abbandonata", e la segreteria può riattivarlo.
 *
 *   2. ABBANDONO. Chi entro la scadenza della prima metà non l'ha versata
 *      passa da solo ad "abbandonato". Se poi la versa, torna attivo da
 *      solo. Un abbandono segnato a mano dalla segreteria invece resta: lo
 *      toglie solo lei.
 *
 * Tutto è ripetibile: girare due volte non cambia niente la seconda. Gira
 * ogni notte (/api/cron/stagioni) e, per non dipendere dal cron, anche
 * quando qualcuno apre l'elenco degli atleti.
 */

import { sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { stagioneCorrente, stagioneDi, oggiRoma } from "./stagioni.js";

/* Il passaggio a una stagione si fa una volta: dopo, in questo processo, non
   serve più rifare il controllo a ogni richiesta. */
const giaPassate = new Set();

/**
 * Porta nella stagione in corso chi era iscritto in quella prima.
 *
 * Solo chi è ancora in una squadra (o allena): chi è stato tolto da tutte
 * le squadre non è più un iscritto. Le squadre copiate sono quelle di
 * oggi. Gli allenatori passano senza quota: la loro la assegna
 * assicuraQuotaAllenatore, con la tariffa degli allenatori.
 *
 * @returns quante iscrizioni ha creato
 */
export async function passaggioDiStagione() {
  const corrente = await stagioneCorrente();
  if (giaPassate.has(corrente.id)) return 0;

  const precedente = stagioneDi(`${Number(corrente.inizio.slice(0, 4)) - 1}-09-01`).nome;

  const { rows } = await getDb().execute(sql`
    WITH prima AS (
      SELECT i.utente_id, i.stato
      FROM iscrizioni_stagione i
      JOIN stagioni s ON s.id = i.stagione_id
      WHERE s.nome = ${precedente}
    ),
    rinnovo AS (
      SELECT id, importo_centesimi FROM tipi_quota
      WHERE automatica = 'rinnovo' AND attiva = true
      LIMIT 1
    )
    INSERT INTO iscrizioni_stagione
      (utente_id, stagione_id, quota_centesimi, tipo_quota_id, stato, abbandonata_il, abbandono_automatico, squadre)
    SELECT
      p.utente_id,
      ${corrente.id},
      CASE WHEN p.stato = 'attiva' AND u.ruolo <> 'coach' THEN (SELECT importo_centesimi FROM rinnovo) END,
      CASE WHEN p.stato = 'attiva' AND u.ruolo <> 'coach' THEN (SELECT id FROM rinnovo) END,
      CASE WHEN p.stato = 'attiva' THEN 'attiva' ELSE 'abbandonata' END::stato_iscrizione_stagione,
      CASE WHEN p.stato = 'attiva' THEN NULL ELSE ${corrente.inizio}::date END,
      p.stato <> 'attiva',
      coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', sq.id, 'nome', sq.nome, 'sport', sq.sport) ORDER BY sq.ordine)
        FROM richieste_iscrizione r JOIN squadre sq ON sq.id = r.squadra_id
        WHERE r.utente_id = p.utente_id AND r.stato = 'approvata'
      ), '[]'::jsonb)
    FROM prima p
    JOIN utenti u ON u.id = p.utente_id
    WHERE u.ruolo = 'coach'
       OR EXISTS (SELECT 1 FROM richieste_iscrizione r WHERE r.utente_id = p.utente_id AND r.stato = 'approvata')
    ON CONFLICT (utente_id, stagione_id) DO NOTHING
    RETURNING id
  `);

  giaPassate.add(corrente.id);
  return rows.length;
}

/**
 * Chi non ha versato la prima metà entro la scadenza passa ad
 * "abbandonato"; chi era stato messo così dal sito e poi l'ha versata
 * torna attivo. Gli allenatori no: la loro quota non si divide, e un
 * allenatore non "abbandona" per dieci euro.
 *
 * @returns { abbandonati, riattivati }
 */
export async function abbandoniAutomatici() {
  const corrente = await stagioneCorrente();
  const { scadenzaPrimaMeta } = stagioneDi(corrente.inizio);
  const db = getDb();

  /* Il versato di ciascuno in questa stagione, e la prima metà dovuta: la
     stessa regola di contoStagione (il centesimo dispari va alla prima). */
  const versato = sql`(
    SELECT coalesce(sum(p.importo_centesimi), 0) FROM pagamenti p
    WHERE p.utente_id = i.utente_id AND p.stagione_id = i.stagione_id
  )`;

  const riattivati = await db.execute(sql`
    UPDATE iscrizioni_stagione i
    SET stato = 'attiva', abbandonata_il = NULL, abbandono_automatico = false, aggiornata_il = now()
    WHERE i.stagione_id = ${corrente.id}
      AND i.stato = 'abbandonata' AND i.abbandono_automatico = true
      AND i.quota_centesimi IS NOT NULL
      AND ${versato} >= ceil(i.quota_centesimi / 2.0)
    RETURNING i.id
  `);

  /*
   * SPENTO finché non lo si accende con ABBANDONI_AUTOMATICI=1.
   *
   * Oggi i versamenti non si registrano: arriveranno con il pagamento
   * online. Acceso adesso, il giorno dopo la scadenza segnerebbe come
   * abbandonati TUTTI, perché per il sito nessuno ha versato niente. La
   * riattivazione qui sopra invece gira sempre: non fa danni.
   */
  if (process.env.ABBANDONI_AUTOMATICI !== "1") {
    return { abbandonati: 0, riattivati: riattivati.rows.length, spento: true };
  }

  // Prima della scadenza nessuno viene toccato
  if (oggiRoma() <= scadenzaPrimaMeta) {
    return { abbandonati: 0, riattivati: riattivati.rows.length };
  }

  const abbandonati = await db.execute(sql`
    UPDATE iscrizioni_stagione i
    SET stato = 'abbandonata', abbandonata_il = ${oggiRoma()}::date,
        abbandono_automatico = true, aggiornata_il = now()
    FROM utenti u
    WHERE u.id = i.utente_id AND u.ruolo <> 'coach'
      AND i.stagione_id = ${corrente.id}
      AND i.stato = 'attiva'
      AND i.quota_centesimi > 0
      AND ${versato} < ceil(i.quota_centesimi / 2.0)
    RETURNING i.id
  `);

  return { abbandonati: abbandonati.rows.length, riattivati: riattivati.rows.length };
}

/** Tutte e due, nell'ordine giusto: prima si passa, poi si controlla chi ha pagato. */
export async function manutenzioneStagioni() {
  const passati = await passaggioDiStagione();
  const { abbandonati, riattivati } = await abbandoniAutomatici();
  return { passati, abbandonati, riattivati };
}
