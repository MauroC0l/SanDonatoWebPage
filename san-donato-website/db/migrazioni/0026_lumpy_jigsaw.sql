ALTER TYPE "public"."stato_iscrizione_stagione" ADD VALUE 'abbandonata';--> statement-breakpoint
ALTER TABLE "iscrizioni_stagione" ADD COLUMN "abbandonata_il" date;--> statement-breakpoint
ALTER TABLE "iscrizioni_stagione" ADD COLUMN "abbandono_automatico" boolean DEFAULT false NOT NULL;