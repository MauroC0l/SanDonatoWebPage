ALTER TABLE "cartelle_media" ADD COLUMN "condivisa" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "cestinato_il" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "cestinato_da" integer;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_cestinato_da_utenti_id_fk" FOREIGN KEY ("cestinato_da") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_media_cestino" ON "media" USING btree ("cestinato_il");--> statement-breakpoint
-- La cartella comune esiste da subito e in ogni ambiente: crearla a mano
-- vorrebbe dire un sito dove c'è e uno dove non c'è. "on conflict" perché
-- il nome è unico e la migrazione deve poter essere rieseguita.
INSERT INTO "cartelle_media" ("nome", "condivisa") VALUES ('File condivisi', true)
  ON CONFLICT ("nome") DO UPDATE SET "condivisa" = true;
