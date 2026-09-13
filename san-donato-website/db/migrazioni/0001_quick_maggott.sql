CREATE TABLE "tentativi_accesso" (
	"id" serial PRIMARY KEY NOT NULL,
	"chiave" text NOT NULL,
	"quando" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_tentativi_chiave" ON "tentativi_accesso" USING btree ("chiave","quando");