CREATE TYPE "public"."sport_squadra" AS ENUM('Calcio', 'Pallavolo', 'Basket', 'Societa');--> statement-breakpoint
CREATE TYPE "public"."tipo_evento" AS ENUM('partita', 'allenamento', 'torneo', 'riunione', 'altro');--> statement-breakpoint
CREATE TABLE "associazioni_squadra" (
	"id" serial PRIMARY KEY NOT NULL,
	"utente_id" integer NOT NULL,
	"squadra_id" integer NOT NULL,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventi" (
	"id" serial PRIMARY KEY NOT NULL,
	"squadra_id" integer NOT NULL,
	"tipo" "tipo_evento" DEFAULT 'partita' NOT NULL,
	"titolo" text NOT NULL,
	"avversario" text,
	"inizio" timestamp with time zone NOT NULL,
	"fine" timestamp with time zone,
	"tutto_il_giorno" boolean DEFAULT false NOT NULL,
	"luogo" text,
	"descrizione" text,
	"risultato" text,
	"parziali" text,
	"marcatori" text[],
	"diretta" text,
	"creato_da" integer,
	"google_event_id" text,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eventi_google_event_id_unique" UNIQUE("google_event_id")
);
--> statement-breakpoint
CREATE TABLE "media_evento" (
	"id" serial PRIMARY KEY NOT NULL,
	"evento_id" integer NOT NULL,
	"media_id" integer NOT NULL,
	"ordine" integer DEFAULT 0 NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "squadre" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"slug" text NOT NULL,
	"sport" "sport_squadra" NOT NULL,
	"colore" text,
	"css_var" text,
	"ordine" integer DEFAULT 0 NOT NULL,
	"attiva" boolean DEFAULT true NOT NULL,
	"calendario_google_id" text,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "squadre_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "associazioni_squadra" ADD CONSTRAINT "associazioni_squadra_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "associazioni_squadra" ADD CONSTRAINT "associazioni_squadra_squadra_id_squadre_id_fk" FOREIGN KEY ("squadra_id") REFERENCES "public"."squadre"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventi" ADD CONSTRAINT "eventi_squadra_id_squadre_id_fk" FOREIGN KEY ("squadra_id") REFERENCES "public"."squadre"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventi" ADD CONSTRAINT "eventi_creato_da_utenti_id_fk" FOREIGN KEY ("creato_da") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_evento" ADD CONSTRAINT "media_evento_evento_id_eventi_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_evento" ADD CONSTRAINT "media_evento_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_associazione_unica" ON "associazioni_squadra" USING btree ("utente_id","squadra_id");--> statement-breakpoint
CREATE INDEX "idx_associazioni_squadra" ON "associazioni_squadra" USING btree ("squadra_id");--> statement-breakpoint
CREATE INDEX "idx_eventi_periodo" ON "eventi" USING btree ("inizio");--> statement-breakpoint
CREATE INDEX "idx_eventi_squadra" ON "eventi" USING btree ("squadra_id","inizio");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_media_evento_unico" ON "media_evento" USING btree ("evento_id","media_id");--> statement-breakpoint
CREATE INDEX "idx_media_evento" ON "media_evento" USING btree ("evento_id","ordine");--> statement-breakpoint
CREATE INDEX "idx_squadre_sport" ON "squadre" USING btree ("sport","ordine");