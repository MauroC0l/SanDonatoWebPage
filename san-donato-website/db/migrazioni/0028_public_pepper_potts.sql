ALTER TABLE "schede_atleta" DROP CONSTRAINT "schede_atleta_tipo_quota_id_tipi_quota_id_fk";
--> statement-breakpoint
DROP INDEX "idx_notizie_categoria";--> statement-breakpoint
ALTER TABLE "notizie" DROP COLUMN "categoria";--> statement-breakpoint
ALTER TABLE "schede_atleta" DROP COLUMN "quota_stagionale_centesimi";--> statement-breakpoint
ALTER TABLE "schede_atleta" DROP COLUMN "tipo_quota_id";--> statement-breakpoint
ALTER TABLE "squadre" DROP COLUMN "calendario_google_id";--> statement-breakpoint
DROP TYPE "public"."categoria_notizia";