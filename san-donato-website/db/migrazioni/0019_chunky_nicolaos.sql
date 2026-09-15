ALTER TABLE "cartelle_media" ADD COLUMN "solo_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- L'unica cartella riservata che esiste oggi. Segnata qui e non nel codice:
-- il giorno che la si rinomina deve restare riservata lo stesso.
UPDATE "cartelle_media" SET "solo_admin" = true WHERE lower("nome") = 'dal vecchio sito';
