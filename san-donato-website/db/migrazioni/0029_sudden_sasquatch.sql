CREATE TYPE "public"."sezione_documento" AS ENUM('menu', 'privacy', 'tutela_minori', 'safeguarding', 'contributi', 'cinque_per_mille');--> statement-breakpoint
CREATE TABLE "documenti" (
	"id" serial PRIMARY KEY NOT NULL,
	"sezione" "sezione_documento" NOT NULL,
	"titolo" text NOT NULL,
	"descrizione" text,
	"url" text NOT NULL,
	"media_id" integer,
	"anno" text,
	"importo" text,
	"percepito_il" date,
	"ordine" integer DEFAULT 0 NOT NULL,
	"pubblicato" boolean DEFAULT true NOT NULL,
	"aggiornato_da" integer,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documenti" ADD CONSTRAINT "documenti_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documenti" ADD CONSTRAINT "documenti_aggiornato_da_utenti_id_fk" FOREIGN KEY ("aggiornato_da") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_documenti_sezione" ON "documenti" USING btree ("sezione","ordine");--> statement-breakpoint
-- ---------- Dati: i documenti che il sito mostrava già ----------
-- Copiati dai file di dati delle pagine (src/data/*.json), nell'ordine in
-- cui comparivano. Da qui in poi li gestisce l'amministratore.
INSERT INTO "documenti" ("sezione", "titolo", "descrizione", "url", "anno", "importo", "percepito_il", "ordine") VALUES
('menu', 'Vademecum 2025-2026', 'Tutto quello che serve sapere per la stagione: iscrizioni, quote, regole.', '/documenti/PSD_VADEMECUM_2025-2026.pdf', NULL, NULL, NULL, 1),
('menu', 'Statuto', 'Lo statuto dell''Associazione Sportiva Dilettantistica.', '/documenti/PSD_STATUTO.pdf', NULL, NULL, NULL, 2),
('privacy', 'INFORMATIVA IN MATERIA DI PROTEZIONE DEI DATI PERSONALI (GDPR) 2023/2024', 'Scarica il documento completo sul trattamento dei dati per gli iscritti.', '/documenti/PSD_GDPR_2023_2024.pdf', NULL, NULL, NULL, 1),
('tutela_minori', 'FIGC Policy minori', 'Documento che definisce le procedure per prevenire comportamenti scorretti e garantire la sicurezza in un torneo FIGC.', '/documenti/FIGC_Policy-per-la-tutela-dei-minori.pdf', NULL, NULL, NULL, 1),
('tutela_minori', 'Uisp Policy minori', 'Documento che definisce le procedure per prevenire comportamenti scorretti e garantire la sicurezza in un torneo UISP', '/documenti/policy-uisp.pdf', NULL, NULL, NULL, 2),
('tutela_minori', 'Csi Policy minori', 'Documento che definisce le procedure per prevenire comportamenti scorretti e garantire la sicurezza in un torneo CSI.', '/documenti/Fascicolo-Policy-CSI_w.pdf', NULL, NULL, NULL, 3),
('safeguarding', 'Modello Organizzativo e di Controllo', 'Documento che definisce le misure per prevenire abusi, violenze e discriminazioni, garantendo un ambiente sicuro per tutti i tesserati e le tesserate.', '/documenti/modello-organizzativo-safeguarding.pdf', NULL, NULL, NULL, 1),
('safeguarding', 'Codice di Condotta', 'Insieme di regole e comportamenti attesi da tutti i collaboratori, volontari e dirigenti per tutelare i minori e prevenire ogni forma di molestia.', '/documenti/codice-condotta-safeguarding.pdf', NULL, NULL, NULL, 2),
('safeguarding', 'Verbale di Nomina e Approvazione', 'Verbale dell''Assemblea dei soci che ratifica la nomina della Responsabile Safeguarding e l''approvazione delle policy a tutela dei tesserati.', '/documenti/verbale-nomina-safeguarding.pdf', NULL, NULL, NULL, 3),
('contributi', 'Rendiconto Ufficiale Completo', 'Scarica il documento ufficiale firmato contenente il riepilogo formale di tutti i contributi elencati in questa pagina.', '/documenti/PSD_Aiuti_Stato.pdf', NULL, NULL, NULL, 1),
('cinque_per_mille', 'Rendiconto 5x1000 2025', NULL, '/documenti/rendiconti/PSD_rendiconto_5x1000_2025.pdf', '2025', '€ 2.973,00', '2025-12-03'::date, 1),
('cinque_per_mille', 'Rendiconto 5x1000 2024', NULL, '/documenti/rendiconti/PSD_rendiconto_5x1000_2024.pdf', '2024', '€ 2.973,00', '2025-12-03'::date, 2),
('cinque_per_mille', 'Rendiconto 5x1000 2023', NULL, '/documenti/rendiconti/PSD_rendiconto_5x1000_2023.pdf', '2023', '€ 3.218,00', '2024-09-06'::date, 3),
('cinque_per_mille', 'Rendiconto 5x1000 2022', NULL, '/documenti/rendiconti/PSD_rendiconto_5x1000_2022.pdf', '2022', '€ 2.729,00', '2023-12-08'::date, 4),
('cinque_per_mille', 'Rendiconto 5x1000 2021', NULL, '/documenti/rendiconti/PSD_rendiconto_5x1000_2021.pdf', '2021', '€ 2.746,00', '2022-09-09'::date, 5),
('cinque_per_mille', 'Rendiconto 5x1000 2020', NULL, '/documenti/rendiconti/PSD_rendiconto_5x1000_2020.pdf', '2020', '€ 2.696,00', '2022-05-12'::date, 6),
('cinque_per_mille', 'Rendiconto 5x1000 2019', NULL, '/documenti/rendiconti/PSD_rendiconto_5x1000_2019.pdf', '2019', '€ 2.431,00', '2021-02-05'::date, 7),
('cinque_per_mille', 'Rendiconto 5x1000 2018', NULL, '/documenti/rendiconti/PSD_rendiconto_5x1000_2018.pdf', '2018', '€ 2.472,00', '2020-10-15'::date, 8),
('cinque_per_mille', 'Rendiconto 5x1000 2017', NULL, '/documenti/rendiconti/PSD_rendiconto_5x1000_2017.pdf', '2017', '€ 2.815,00', '2019-12-24'::date, 9),
('cinque_per_mille', 'Rendiconto 5x1000 2016', NULL, '/documenti/rendiconti/PSD_rendiconto_5x1000_2016.pdf', '2016', '€ 2.374,00', '2018-12-17'::date, 10),
('cinque_per_mille', 'Rendiconto 5x1000 2015', NULL, '/documenti/rendiconti/PSD_rendiconto_5x1000_2015.pdf', '2015', '€ 2.285,00', '2017-12-12'::date, 11),
('cinque_per_mille', 'Rendiconto 5x1000 2014', NULL, '/documenti/rendiconti/PSD_rendiconto_5x1000_2014.pdf', '2014', '€ 1.875,00', '2017-12-12'::date, 12),
('cinque_per_mille', 'Rendiconto 5x1000 2013', NULL, '/documenti/rendiconti/PSD_rendiconto_5x1000_2013.pdf', '2013', '€ 1.441,00', '2016-08-01'::date, 13),
('cinque_per_mille', 'Rendiconto 5x1000 2012', NULL, '/documenti/rendiconti/PSD_rendiconto_5x1000_2012.pdf', '2012', '€ 1.528,00', '2016-08-01'::date, 14),
('cinque_per_mille', 'Rendiconto 5x1000 2011', NULL, '/documenti/rendiconti/PSD_rendiconto_5x1000_2011.pdf', '2011', '€ 0,00', '2015-02-05'::date, 15),
('cinque_per_mille', 'Rendiconto 5x1000 2010', NULL, '/documenti/rendiconti/PSD_rendiconto_5x1000_2010.pdf', '2010', '€ 1.758,00', '2014-12-12'::date, 16);
