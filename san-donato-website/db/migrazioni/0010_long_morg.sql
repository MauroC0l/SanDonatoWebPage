CREATE TYPE "public"."categoria_notizia" AS ENUM('societa', 'eventi', 'sport', 'solidarieta', 'altro');--> statement-breakpoint
ALTER TABLE "notizie" ADD COLUMN "categoria" "categoria_notizia" DEFAULT 'altro' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_notizie_categoria" ON "notizie" USING btree ("categoria");