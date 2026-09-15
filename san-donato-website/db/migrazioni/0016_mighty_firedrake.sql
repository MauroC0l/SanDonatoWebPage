CREATE TABLE "tipi_quota" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"descrizione" text,
	"importo_centesimi" integer NOT NULL,
	"attiva" boolean DEFAULT true NOT NULL,
	"ordine" integer DEFAULT 0 NOT NULL,
	"creata_da" integer,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schede_atleta" ADD COLUMN "tipo_quota_id" integer;--> statement-breakpoint
ALTER TABLE "tipi_quota" ADD CONSTRAINT "tipi_quota_creata_da_utenti_id_fk" FOREIGN KEY ("creata_da") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schede_atleta" ADD CONSTRAINT "schede_atleta_tipo_quota_id_tipi_quota_id_fk" FOREIGN KEY ("tipo_quota_id") REFERENCES "public"."tipi_quota"("id") ON DELETE set null ON UPDATE no action;