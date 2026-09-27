CREATE TYPE "public"."stato_iscrizione_stagione" AS ENUM('attiva', 'ritirata');--> statement-breakpoint
CREATE TABLE "iscrizioni_stagione" (
	"id" serial PRIMARY KEY NOT NULL,
	"utente_id" integer NOT NULL,
	"stagione_id" integer NOT NULL,
	"quota_centesimi" integer,
	"tipo_quota_id" integer,
	"stato" "stato_iscrizione_stagione" DEFAULT 'attiva' NOT NULL,
	"ritirato_il" date,
	"motivo_ritiro" text,
	"ritiro_registrato_da" integer,
	"squadre" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"aggiornata_da" integer,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornata_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stagioni" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"inizio" date NOT NULL,
	"fine" date NOT NULL,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stagioni_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
ALTER TABLE "legami_familiari" ADD COLUMN "stagione_id" integer;--> statement-breakpoint
ALTER TABLE "pagamenti" ADD COLUMN "stagione_id" integer;--> statement-breakpoint
ALTER TABLE "iscrizioni_stagione" ADD CONSTRAINT "iscrizioni_stagione_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iscrizioni_stagione" ADD CONSTRAINT "iscrizioni_stagione_stagione_id_stagioni_id_fk" FOREIGN KEY ("stagione_id") REFERENCES "public"."stagioni"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iscrizioni_stagione" ADD CONSTRAINT "iscrizioni_stagione_tipo_quota_id_tipi_quota_id_fk" FOREIGN KEY ("tipo_quota_id") REFERENCES "public"."tipi_quota"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iscrizioni_stagione" ADD CONSTRAINT "iscrizioni_stagione_ritiro_registrato_da_utenti_id_fk" FOREIGN KEY ("ritiro_registrato_da") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iscrizioni_stagione" ADD CONSTRAINT "iscrizioni_stagione_aggiornata_da_utenti_id_fk" FOREIGN KEY ("aggiornata_da") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_iscrizione_stagione_unica" ON "iscrizioni_stagione" USING btree ("utente_id","stagione_id");--> statement-breakpoint
CREATE INDEX "idx_iscrizioni_stagione" ON "iscrizioni_stagione" USING btree ("stagione_id","stato");--> statement-breakpoint
ALTER TABLE "legami_familiari" ADD CONSTRAINT "legami_familiari_stagione_id_stagioni_id_fk" FOREIGN KEY ("stagione_id") REFERENCES "public"."stagioni"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamenti" ADD CONSTRAINT "pagamenti_stagione_id_stagioni_id_fk" FOREIGN KEY ("stagione_id") REFERENCES "public"."stagioni"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pagamenti_stagione" ON "pagamenti" USING btree ("stagione_id","utente_id");--> statement-breakpoint
-- ---------- Dati: dalla quota "in corso" alla stagione 2026/27 ----------
-- La stagione in corso nasce qui (dal 1 luglio al 30 giugno, ora di Torino).
INSERT INTO "stagioni" ("nome", "inizio", "fine")
SELECT a || '/' || lpad(((a + 1) % 100)::text, 2, '0'), make_date(a, 7, 1), make_date(a + 1, 6, 30)
FROM (
  SELECT (extract(year FROM oggi)::int - CASE WHEN extract(month FROM oggi) < 7 THEN 1 ELSE 0 END) AS a
  FROM (SELECT (now() AT TIME ZONE 'Europe/Rome')::date AS oggi) o
) s
ON CONFLICT ("nome") DO NOTHING;--> statement-breakpoint
-- I versamenti già registrati vanno TUTTI alla stagione in corso e non in base
-- alla data: finora ogni versamento contava contro "la quota in corso", e
-- smistarli per data spezzerebbe i conti di chi ha pagato a giugno la quota di
-- settembre.
UPDATE "pagamenti" SET "stagione_id" = (
  SELECT "id" FROM "stagioni" WHERE (now() AT TIME ZONE 'Europe/Rome')::date BETWEEN "inizio" AND "fine"
) WHERE "stagione_id" IS NULL;--> statement-breakpoint
-- Le dichiarazioni dei fratelli fatte finora valgono per la stagione in corso.
UPDATE "legami_familiari" SET "stagione_id" = (
  SELECT "id" FROM "stagioni" WHERE (now() AT TIME ZONE 'Europe/Rome')::date BETWEEN "inizio" AND "fine"
) WHERE "stagione_id" IS NULL;--> statement-breakpoint
-- La stessa dichiarazione si rifà ogni stagione: il vincolo di unicità la
-- comprende. Si rifà DOPO aver dato la stagione alle righe che ci sono.
DROP INDEX "idx_legame_unico";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_legame_unico" ON "legami_familiari" USING btree ("utente_id","stagione_id","codice_fiscale_dichiarato");--> statement-breakpoint
-- Un'iscrizione alla stagione in corso per chi ha una quota, una squadra o un
-- versamento: quota e tariffa copiate dalla scheda, squadre di oggi.
INSERT INTO "iscrizioni_stagione" ("utente_id", "stagione_id", "quota_centesimi", "tipo_quota_id", "squadre")
SELECT u."id", cur."id", sa."quota_stagionale_centesimi", sa."tipo_quota_id",
  coalesce((
    SELECT jsonb_agg(jsonb_build_object('id', sq."id", 'nome', sq."nome", 'sport', sq."sport") ORDER BY sq."ordine")
    FROM "richieste_iscrizione" r JOIN "squadre" sq ON sq."id" = r."squadra_id"
    WHERE r."utente_id" = u."id" AND r."stato" = 'approvata'
  ), '[]'::jsonb)
FROM "utenti" u
CROSS JOIN (SELECT "id" FROM "stagioni" WHERE (now() AT TIME ZONE 'Europe/Rome')::date BETWEEN "inizio" AND "fine") cur
LEFT JOIN "schede_atleta" sa ON sa."utente_id" = u."id"
WHERE sa."quota_stagionale_centesimi" IS NOT NULL
   OR EXISTS (SELECT 1 FROM "richieste_iscrizione" r WHERE r."utente_id" = u."id" AND r."stato" = 'approvata')
   OR EXISTS (SELECT 1 FROM "pagamenti" p WHERE p."utente_id" = u."id")
ON CONFLICT ("utente_id", "stagione_id") DO NOTHING;
