ALTER TABLE "richieste_iscrizione" DROP CONSTRAINT "richieste_iscrizione_squadra_id_squadre_id_fk";
--> statement-breakpoint
ALTER TABLE "richieste_iscrizione" ALTER COLUMN "squadra_id" DROP NOT NULL;--> statement-breakpoint
-- In tre passi: una colonna NOT NULL non si può aggiungere a una tabella
-- che ha già righe senza dire cosa metterci dentro.
ALTER TABLE "richieste_iscrizione" ADD COLUMN "sport" "sport_squadra";--> statement-breakpoint
-- Le richieste già esistenti avevano una squadra: lo sport si ricava da lì.
UPDATE "richieste_iscrizione" r SET "sport" = s."sport" FROM "squadre" s WHERE s."id" = r."squadra_id";--> statement-breakpoint
ALTER TABLE "richieste_iscrizione" ALTER COLUMN "sport" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "richieste_iscrizione" ADD CONSTRAINT "richieste_iscrizione_squadra_id_squadre_id_fk" FOREIGN KEY ("squadra_id") REFERENCES "public"."squadre"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_richieste_sport" ON "richieste_iscrizione" USING btree ("sport","stato");