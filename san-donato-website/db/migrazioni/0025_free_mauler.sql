CREATE TYPE "public"."tipo_tariffa_automatica" AS ENUM('prima_iscrizione', 'rinnovo', 'famiglia');--> statement-breakpoint
ALTER TABLE "tipi_quota" ADD COLUMN "automatica" "tipo_tariffa_automatica";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tariffa_automatica" ON "tipi_quota" USING btree ("automatica");--> statement-breakpoint
-- ---------- Dati: le tre tariffe automatiche ci sono sempre ----------
-- Se esistono già con il nome di sempre, si segnano quelle: chi le ha già
-- assegnate a mano non si ritrova due "Rinnovo".
UPDATE "tipi_quota" SET "automatica" = 'prima_iscrizione'
WHERE "id" = (SELECT "id" FROM "tipi_quota" WHERE lower("nome") LIKE 'prima iscrizione%' ORDER BY "id" LIMIT 1);--> statement-breakpoint
UPDATE "tipi_quota" SET "automatica" = 'rinnovo'
WHERE "id" = (SELECT "id" FROM "tipi_quota" WHERE lower("nome") LIKE 'rinnovo%' AND "automatica" IS NULL ORDER BY "id" LIMIT 1);--> statement-breakpoint
UPDATE "tipi_quota" SET "automatica" = 'famiglia'
WHERE "id" = (SELECT "id" FROM "tipi_quota" WHERE (lower("nome") LIKE 'fratell%' OR lower("nome") LIKE 'famiglia%') AND "automatica" IS NULL ORDER BY "id" LIMIT 1);--> statement-breakpoint
-- Quelle che mancano nascono SPENTE e a zero: un importo inventato qui
-- verrebbe assegnato da solo a tutti. Si accendono dopo aver deciso la cifra.
INSERT INTO "tipi_quota" ("nome", "descrizione", "importo_centesimi", "attiva", "ordine", "automatica")
SELECT v.nome, v.descrizione, 0, false, v.ordine, v.automatica::"tipo_tariffa_automatica"
FROM (VALUES
  ('Prima iscrizione', 'Chi la stagione scorsa non era iscritto', 1, 'prima_iscrizione'),
  ('Rinnovo', 'Chi era iscritto anche la stagione scorsa', 2, 'rinnovo'),
  ('Famiglia', 'Chi ha un fratello o una sorella iscritti, confermati dalla segreteria', 3, 'famiglia')
) AS v(nome, descrizione, ordine, automatica)
WHERE NOT EXISTS (SELECT 1 FROM "tipi_quota" t WHERE t."automatica"::text = v.automatica);
