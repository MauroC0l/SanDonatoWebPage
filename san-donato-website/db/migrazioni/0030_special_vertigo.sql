CREATE TABLE "servizi_esterni" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"categoria" text DEFAULT 'altro' NOT NULL,
	"serve_a" text,
	"account" text,
	"piano" text,
	"importo_centesimi" integer DEFAULT 0 NOT NULL,
	"periodicita" text DEFAULT 'gratis' NOT NULL,
	"rinnovo_il" date,
	"limiti" text,
	"url_pannello" text,
	"note" text,
	"misura" text,
	"soglia_byte" bigint,
	"ordine" integer DEFAULT 0 NOT NULL,
	"attivo" boolean DEFAULT true NOT NULL,
	"aggiornato_da" integer,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "servizi_esterni" ADD CONSTRAINT "servizi_esterni_aggiornato_da_utenti_id_fk" FOREIGN KEY ("aggiornato_da") REFERENCES "public"."utenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- ---------- Dati: i servizi su cui il sito si regge oggi ----------
-- Gli account e gli importi che non si conoscono sono "da compilare": li
-- scrive l'amministratore dalla scheda Spese sito, guardando i pannelli.
INSERT INTO "servizi_esterni" ("nome", "categoria", "serve_a", "account", "piano", "importo_centesimi", "periodicita", "limiti", "url_pannello", "note", "misura", "soglia_byte", "ordine") VALUES
('Vercel', 'sito', 'Pubblica il sito e fa girare il server (le API), più i due lavori notturni: lettura dei calendari ufficiali e passaggio di stagione.', 'Da compilare (di solito si entra con GitHub)', 'Hobby (gratuito)', 0, 'gratis', 'Il piano Hobby è gratuito ma pensato per uso personale e non commerciale, con un tetto di traffico mensile e al massimo due lavori pianificati al giorno (sono già usati tutti e due). Per il sito ufficiale della società va valutato il piano Pro, che si paga per ogni membro del team.', 'https://vercel.com/dashboard', NULL, NULL, NULL, 1),
('Neon', 'database', 'Il database Postgres: account, atleti, quote, pagamenti, notizie, calendari. Server a Francoforte (UE).', 'Da compilare', 'Free', 0, 'gratis', 'Il piano gratuito ha 0,5 GB di spazio e un tempo di calcolo mensile limitato; oltre serve un piano a pagamento. Conserva una storia breve per il ripristino: una copia di sicurezza vera va fatta a parte.', 'https://console.neon.tech', NULL, 'database', 536870912, 2),
('Cloudflare R2', 'file', 'L''archivio dei file: immagini e documenti nel bucket pubblico, certificati medici nel bucket riservato (senza indirizzo pubblico). Giurisdizione UE.', 'Da compilare', 'Free tier', 0, 'gratis', 'Gratis fino a 10 GB al mese, 1 milione di scritture e 10 milioni di letture al mese; oltre circa 0,015 $ per GB al mese. Il traffico in uscita non si paga. Per attivarlo serve una carta registrata.', 'https://dash.cloudflare.com', NULL, 'archivio', 10737418240, 3),
('GitHub', 'codice', 'Il codice del sito: Vercel pubblica quello che trova qui. Ramo main per il sito attuale, backend-proprio per la dimostrazione.', 'MauroC0l', 'Free', 0, 'gratis', NULL, 'https://github.com/MauroC0l/SanDonatoWebPage', NULL, NULL, NULL, 4),
('MailerLite', 'email', 'La newsletter: il modulo "Resta aggiornato" in fondo alle pagine iscrive qui.', 'Da compilare', 'Free', 0, 'gratis', 'Il piano gratuito ha un numero massimo di iscritti e di invii al mese: i limiti attuali sono nel pannello.', 'https://dashboard.mailerlite.com', NULL, NULL, NULL, 5),
('Google Drive', 'calendari', 'Le cartelle pubbliche delle federazioni da cui si leggono ogni notte i calendari ufficiali.', 'Nessuno (cartelle pubbliche); chiave API di Google Cloud facoltativa', 'Gratuito', 0, 'gratis', NULL, 'https://console.cloud.google.com', NULL, NULL, NULL, 6),
('Dominio polisportivasandonato', 'dominio', 'Gli indirizzi del sito (.it e .org) e le caselle email della società.', 'Da compilare', 'Da compilare', 0, 'anno', NULL, NULL, 'Da compilare: presso chi è registrato, quanto costa l''anno e quando si rinnova. Se il dominio scade, sito ed email smettono di funzionare.', NULL, NULL, 7),
('WordPress (sito attuale)', 'sito', 'Il vecchio sito su wp.polisportivasandonato.org: da lì vengono le notizie importate, e molte immagini si leggono ancora da lì.', 'Da compilare', 'Da compilare', 0, 'gratis', NULL, 'https://wp.polisportivasandonato.org/wp-admin', 'Da spegnere solo dopo aver copiato i file su R2 (scripts/trasferisci-file-wordpress.mjs): spegnendolo prima, le immagini delle notizie spariscono.', NULL, NULL, 8);
