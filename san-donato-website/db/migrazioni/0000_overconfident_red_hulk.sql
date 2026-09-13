CREATE TYPE "public"."ruolo_utente" AS ENUM('admin', 'editor', 'coach', 'atleta');--> statement-breakpoint
CREATE TYPE "public"."sport_notizia" AS ENUM('Calcio', 'Pallavolo', 'Minivolley', 'Basket', 'Altro');--> statement-breakpoint
CREATE TYPE "public"."stato_notizia" AS ENUM('bozza', 'in_revisione', 'pubblicata', 'cestino');--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"chiave" text NOT NULL,
	"mime" text NOT NULL,
	"byte" integer,
	"larghezza" integer,
	"altezza" integer,
	"alt" text,
	"titolo" text,
	"caricato_da" integer,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"wp_id" integer,
	"url_originale_wp" text,
	CONSTRAINT "media_chiave_unique" UNIQUE("chiave"),
	CONSTRAINT "media_wp_id_unique" UNIQUE("wp_id")
);
--> statement-breakpoint
CREATE TABLE "notizie" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"titolo" text NOT NULL,
	"sommario" text,
	"contenuto" text NOT NULL,
	"copertina_id" integer,
	"sport" "sport_notizia" DEFAULT 'Altro' NOT NULL,
	"stato" "stato_notizia" DEFAULT 'bozza' NOT NULL,
	"autore_id" integer,
	"pubblicata_il" timestamp with time zone,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornata_il" timestamp with time zone DEFAULT now() NOT NULL,
	"wp_id" integer,
	CONSTRAINT "notizie_slug_unique" UNIQUE("slug"),
	CONSTRAINT "notizie_wp_id_unique" UNIQUE("wp_id")
);
--> statement-breakpoint
CREATE TABLE "sessioni" (
	"id" text PRIMARY KEY NOT NULL,
	"utente_id" integer NOT NULL,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_uso_il" timestamp with time zone DEFAULT now() NOT NULL,
	"scade_il" timestamp with time zone NOT NULL,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "utenti" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"ruolo" "ruolo_utente" DEFAULT 'atleta' NOT NULL,
	"nome" text,
	"cognome" text,
	"attivo" boolean DEFAULT true NOT NULL,
	"ultimo_accesso" timestamp with time zone,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "utenti_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_caricato_da_utenti_id_fk" FOREIGN KEY ("caricato_da") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notizie" ADD CONSTRAINT "notizie_copertina_id_media_id_fk" FOREIGN KEY ("copertina_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notizie" ADD CONSTRAINT "notizie_autore_id_utenti_id_fk" FOREIGN KEY ("autore_id") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessioni" ADD CONSTRAINT "sessioni_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notizie_elenco" ON "notizie" USING btree ("stato","pubblicata_il");--> statement-breakpoint
CREATE INDEX "idx_notizie_sport" ON "notizie" USING btree ("sport");--> statement-breakpoint
CREATE INDEX "idx_sessioni_utente" ON "sessioni" USING btree ("utente_id");--> statement-breakpoint
CREATE INDEX "idx_sessioni_scadenza" ON "sessioni" USING btree ("scade_il");--> statement-breakpoint
CREATE INDEX "idx_utenti_ruolo" ON "utenti" USING btree ("ruolo");