CREATE TYPE "public"."stato_legame" AS ENUM('in_attesa', 'confermato', 'respinto');--> statement-breakpoint
CREATE TABLE "legami_familiari" (
	"id" serial PRIMARY KEY NOT NULL,
	"utente_id" integer NOT NULL,
	"codice_fiscale_dichiarato" text NOT NULL,
	"utente_collegato_id" integer,
	"stato" "stato_legame" DEFAULT 'in_attesa' NOT NULL,
	"motivo" text,
	"deciso_da" integer,
	"deciso_il" timestamp with time zone,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legami_familiari" ADD CONSTRAINT "legami_familiari_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legami_familiari" ADD CONSTRAINT "legami_familiari_utente_collegato_id_utenti_id_fk" FOREIGN KEY ("utente_collegato_id") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legami_familiari" ADD CONSTRAINT "legami_familiari_deciso_da_utenti_id_fk" FOREIGN KEY ("deciso_da") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_legame_unico" ON "legami_familiari" USING btree ("utente_id","codice_fiscale_dichiarato");--> statement-breakpoint
CREATE INDEX "idx_legame_stato" ON "legami_familiari" USING btree ("stato","creato_il");--> statement-breakpoint
CREATE INDEX "idx_legame_collegato" ON "legami_familiari" USING btree ("utente_collegato_id");