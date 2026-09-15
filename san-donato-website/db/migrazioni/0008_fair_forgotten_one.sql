CREATE TABLE "registro_attivita" (
	"id" serial PRIMARY KEY NOT NULL,
	"utente_id" integer,
	"autore" text,
	"azione" text NOT NULL,
	"oggetto_tipo" text,
	"oggetto_id" integer,
	"descrizione" text,
	"dettaglio" jsonb,
	"quando" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eventi" ADD COLUMN "visibile_dal" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registro_attivita" ADD CONSTRAINT "registro_attivita_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_registro_quando" ON "registro_attivita" USING btree ("quando");--> statement-breakpoint
CREATE INDEX "idx_registro_utente" ON "registro_attivita" USING btree ("utente_id","quando");--> statement-breakpoint
CREATE INDEX "idx_registro_oggetto" ON "registro_attivita" USING btree ("oggetto_tipo","oggetto_id");