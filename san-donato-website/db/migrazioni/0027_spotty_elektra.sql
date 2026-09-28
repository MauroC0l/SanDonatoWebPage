CREATE TABLE "etichette" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notizie_etichette" (
	"notizia_id" integer NOT NULL,
	"etichetta_id" integer NOT NULL,
	CONSTRAINT "notizie_etichette_notizia_id_etichetta_id_pk" PRIMARY KEY("notizia_id","etichetta_id")
);
--> statement-breakpoint
ALTER TABLE "notizie" ADD COLUMN "cestinata_il" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notizie_etichette" ADD CONSTRAINT "notizie_etichette_notizia_id_notizie_id_fk" FOREIGN KEY ("notizia_id") REFERENCES "public"."notizie"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notizie_etichette" ADD CONSTRAINT "notizie_etichette_etichetta_id_etichette_id_fk" FOREIGN KEY ("etichetta_id") REFERENCES "public"."etichette"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_etichetta_nome" ON "etichette" USING btree (lower("nome"));--> statement-breakpoint
CREATE INDEX "idx_etichetta_notizie" ON "notizie_etichette" USING btree ("etichetta_id");--> statement-breakpoint
-- ---------- Dati: dalle quattro categorie fisse alle etichette ----------
INSERT INTO "etichette" ("nome") VALUES ('Vita di società'), ('Feste ed eventi'), ('Sport e risultati'), ('Solidarietà e territorio');--> statement-breakpoint
INSERT INTO "notizie_etichette" ("notizia_id", "etichetta_id")
SELECT n."id", e."id"
FROM "notizie" n
JOIN "etichette" e ON e."nome" = CASE n."categoria"
  WHEN 'societa' THEN 'Vita di società'
  WHEN 'eventi' THEN 'Feste ed eventi'
  WHEN 'sport' THEN 'Sport e risultati'
  WHEN 'solidarieta' THEN 'Solidarietà e territorio'
END
WHERE n."categoria" <> 'altro';--> statement-breakpoint
-- Le notizie già nel cestino: la data non la sappiamo, vale l'ultima modifica
UPDATE "notizie" SET "cestinata_il" = "aggiornata_il" WHERE "stato" = 'cestino' AND "cestinata_il" IS NULL;
