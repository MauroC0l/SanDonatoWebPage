CREATE TYPE "public"."stato_richiesta" AS ENUM('in_attesa', 'approvata', 'rifiutata');--> statement-breakpoint
CREATE TYPE "public"."stato_utente" AS ENUM('in_attesa', 'attivo', 'sospeso');--> statement-breakpoint
ALTER TYPE "public"."ruolo_utente" ADD VALUE 'segreteria' BEFORE 'editor';--> statement-breakpoint
ALTER TYPE "public"."tipo_evento" ADD VALUE 'evento' BEFORE 'altro';--> statement-breakpoint
CREATE TABLE "richieste_iscrizione" (
	"id" serial PRIMARY KEY NOT NULL,
	"utente_id" integer NOT NULL,
	"squadra_id" integer NOT NULL,
	"stato" "stato_richiesta" DEFAULT 'in_attesa' NOT NULL,
	"note" text,
	"richiesta_il" timestamp with time zone DEFAULT now() NOT NULL,
	"decisa_da" integer,
	"decisa_il" timestamp with time zone,
	"motivo_rifiuto" text
);
--> statement-breakpoint
ALTER TABLE "eventi" ADD COLUMN "sport" "sport_squadra";--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "tag" text[];--> statement-breakpoint
ALTER TABLE "utenti" ADD COLUMN "stato" "stato_utente" DEFAULT 'in_attesa' NOT NULL;--> statement-breakpoint
-- Travaso: chi era attivo resta attivo, chi non lo era diventa sospeso.
-- Senza questo passaggio il valore predefinito 'in_attesa' chiuderebbe
-- fuori tutti, compreso chi amministra.
UPDATE "utenti" SET "stato" = CASE WHEN "attivo" THEN 'attivo'::"public"."stato_utente" ELSE 'sospeso'::"public"."stato_utente" END;--> statement-breakpoint
ALTER TABLE "utenti" ADD COLUMN "deve_cambiare_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "richieste_iscrizione" ADD CONSTRAINT "richieste_iscrizione_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "richieste_iscrizione" ADD CONSTRAINT "richieste_iscrizione_squadra_id_squadre_id_fk" FOREIGN KEY ("squadra_id") REFERENCES "public"."squadre"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "richieste_iscrizione" ADD CONSTRAINT "richieste_iscrizione_decisa_da_utenti_id_fk" FOREIGN KEY ("decisa_da") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_richieste_stato" ON "richieste_iscrizione" USING btree ("stato","richiesta_il");--> statement-breakpoint
CREATE INDEX "idx_richieste_squadra" ON "richieste_iscrizione" USING btree ("squadra_id","stato");--> statement-breakpoint
CREATE INDEX "idx_richieste_utente" ON "richieste_iscrizione" USING btree ("utente_id");