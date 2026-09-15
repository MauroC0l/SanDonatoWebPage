CREATE TABLE "cartelle_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"creata_da" integer,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cartelle_media_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "cartella_id" integer;--> statement-breakpoint
ALTER TABLE "cartelle_media" ADD CONSTRAINT "cartelle_media_creata_da_utenti_id_fk" FOREIGN KEY ("creata_da") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_cartella_id_cartelle_media_id_fk" FOREIGN KEY ("cartella_id") REFERENCES "public"."cartelle_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_media_cartella" ON "media" USING btree ("cartella_id");