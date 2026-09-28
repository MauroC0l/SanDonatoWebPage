/**
 * Il controllo delle chiamate del cron di Vercel.
 *
 * Vercel chiama le rotte /api/cron/* con l'intestazione
 * "Authorization: Bearer <CRON_SECRET>". Senza CRON_SECRET le rotte restano
 * CHIUSE, non aperte: un segreto che manca è una configurazione sbagliata,
 * e la reazione giusta è non fare niente e dirlo.
 */

import { timingSafeEqual } from "node:crypto";

export function cronAutorizzato(req) {
  const segreto = process.env.CRON_SECRET;
  if (!segreto) return false;

  const atteso = Buffer.from(`Bearer ${segreto}`);
  const ricevuto = Buffer.from(String(req.headers.authorization ?? ""));

  // Confronto a tempo costante: con un confronto normale, il tempo di
  // risposta direbbe quanti caratteri del segreto sono giusti.
  return atteso.length === ricevuto.length && timingSafeEqual(atteso, ricevuto);
}
