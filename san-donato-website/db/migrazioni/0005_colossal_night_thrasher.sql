CREATE INDEX "idx_media_tag" ON "media" USING gin ("tag");--> statement-breakpoint
ALTER TABLE "utenti" DROP COLUMN "attivo";