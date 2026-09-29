CREATE TABLE "categorie_servizi" (
	"valore" text PRIMARY KEY NOT NULL,
	"etichetta" text NOT NULL,
	"ordine" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
-- ---------- Dati: le categorie che prima erano scritte nel codice ----------
INSERT INTO "categorie_servizi" ("valore", "etichetta", "ordine") VALUES
('sito', 'Sito', 1),
('database', 'Database', 2),
('file', 'Archivio dei file', 3),
('email', 'Email e newsletter', 4),
('dominio', 'Dominio', 5),
('calendari', 'Calendari', 6),
('codice', 'Codice', 7),
('altro', 'Altro', 8)
ON CONFLICT ("valore") DO NOTHING;
