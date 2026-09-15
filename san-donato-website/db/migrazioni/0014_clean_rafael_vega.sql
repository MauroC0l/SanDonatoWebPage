CREATE TYPE "public"."stato_certificato" AS ENUM('da_validare', 'valido', 'rifiutato');--> statement-breakpoint
ALTER TABLE "schede_atleta" ADD COLUMN "certificato_stato" "stato_certificato" DEFAULT 'da_validare' NOT NULL;--> statement-breakpoint
ALTER TABLE "schede_atleta" ADD COLUMN "certificato_validato_da" integer;--> statement-breakpoint
ALTER TABLE "schede_atleta" ADD COLUMN "certificato_validato_il" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schede_atleta" ADD COLUMN "certificato_motivo" text;--> statement-breakpoint
ALTER TABLE "schede_atleta" ADD CONSTRAINT "schede_atleta_certificato_validato_da_utenti_id_fk" FOREIGN KEY ("certificato_validato_da") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;