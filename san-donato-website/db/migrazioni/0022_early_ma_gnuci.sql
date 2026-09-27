CREATE TABLE "fonti_calendario" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"formato" text NOT NULL,
	"cartella" text NOT NULL,
	"nomi_nostri" text[] NOT NULL,
	"palestre_casa" text[] DEFAULT '{}'::text[] NOT NULL,
	"attiva" boolean DEFAULT true NOT NULL,
	"in_lettura_dal" timestamp with time zone,
	"ultima_lettura" timestamp with time zone,
	"esito" text,
	"riepilogo" jsonb,
	"creata_da" integer,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gironi_ufficiali" (
	"id" serial PRIMARY KEY NOT NULL,
	"fonte_id" integer NOT NULL,
	"file_id" text NOT NULL,
	"nome_file" text,
	"titolo" text,
	"nome_nel_girone" text NOT NULL,
	"squadra_id" integer,
	"ignorato" boolean DEFAULT false NOT NULL,
	"partite" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ultima_lettura" timestamp with time zone,
	"sparito_il" timestamp with time zone,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eventi" ADD COLUMN "girone_id" integer;--> statement-breakpoint
ALTER TABLE "eventi" ADD COLUMN "chiave_ufficiale" text;--> statement-breakpoint
ALTER TABLE "eventi" ADD COLUMN "in_casa" boolean;--> statement-breakpoint
ALTER TABLE "eventi" ADD COLUMN "note_ufficiali" text;--> statement-breakpoint
ALTER TABLE "eventi" ADD COLUMN "sparita_il" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fonti_calendario" ADD CONSTRAINT "fonti_calendario_creata_da_utenti_id_fk" FOREIGN KEY ("creata_da") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gironi_ufficiali" ADD CONSTRAINT "gironi_ufficiali_fonte_id_fonti_calendario_id_fk" FOREIGN KEY ("fonte_id") REFERENCES "public"."fonti_calendario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gironi_ufficiali" ADD CONSTRAINT "gironi_ufficiali_squadra_id_squadre_id_fk" FOREIGN KEY ("squadra_id") REFERENCES "public"."squadre"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_girone_unico" ON "gironi_ufficiali" USING btree ("fonte_id","file_id","nome_nel_girone");--> statement-breakpoint
CREATE INDEX "idx_girone_squadra" ON "gironi_ufficiali" USING btree ("squadra_id");--> statement-breakpoint
ALTER TABLE "eventi" ADD CONSTRAINT "eventi_girone_id_gironi_ufficiali_id_fk" FOREIGN KEY ("girone_id") REFERENCES "public"."gironi_ufficiali"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_eventi_girone" ON "eventi" USING btree ("girone_id");--> statement-breakpoint
ALTER TABLE "eventi" ADD CONSTRAINT "eventi_chiave_ufficiale_unique" UNIQUE("chiave_ufficiale");