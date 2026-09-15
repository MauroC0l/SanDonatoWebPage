CREATE TYPE "public"."metodo_pagamento" AS ENUM('contanti', 'bonifico', 'pos', 'altro');--> statement-breakpoint
CREATE TYPE "public"."tipo_certificato" AS ENUM('agonistico', 'non_agonistico');--> statement-breakpoint
CREATE TABLE "pagamenti" (
	"id" serial PRIMARY KEY NOT NULL,
	"utente_id" integer NOT NULL,
	"importo_centesimi" integer NOT NULL,
	"causale" text,
	"pagato_il" date NOT NULL,
	"metodo" "metodo_pagamento" DEFAULT 'bonifico' NOT NULL,
	"registrato_da" integer,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schede_atleta" (
	"id" serial PRIMARY KEY NOT NULL,
	"utente_id" integer NOT NULL,
	"data_nascita" date,
	"luogo_nascita" text,
	"codice_fiscale" text,
	"telefono" text,
	"indirizzo" text,
	"tutore_nome" text,
	"tutore_telefono" text,
	"tipo_certificato" "tipo_certificato",
	"certificato_scadenza" date,
	"certificato_media_id" integer,
	"quota_stagionale_centesimi" integer,
	"note" text,
	"aggiornata_da" integer,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornata_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eventi" ADD COLUMN "latitudine" double precision;--> statement-breakpoint
ALTER TABLE "eventi" ADD COLUMN "longitudine" double precision;--> statement-breakpoint
ALTER TABLE "pagamenti" ADD CONSTRAINT "pagamenti_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamenti" ADD CONSTRAINT "pagamenti_registrato_da_utenti_id_fk" FOREIGN KEY ("registrato_da") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schede_atleta" ADD CONSTRAINT "schede_atleta_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schede_atleta" ADD CONSTRAINT "schede_atleta_certificato_media_id_media_id_fk" FOREIGN KEY ("certificato_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schede_atleta" ADD CONSTRAINT "schede_atleta_aggiornata_da_utenti_id_fk" FOREIGN KEY ("aggiornata_da") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pagamenti_utente" ON "pagamenti" USING btree ("utente_id","pagato_il");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scheda_atleta_unica" ON "schede_atleta" USING btree ("utente_id");--> statement-breakpoint
CREATE INDEX "idx_scheda_certificato" ON "schede_atleta" USING btree ("certificato_scadenza");