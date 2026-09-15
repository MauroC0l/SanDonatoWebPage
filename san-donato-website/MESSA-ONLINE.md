# Mettere online la dimostrazione

Come pubblicare questo ramo a un indirizzo che si possa aprire da un
telefono, per farlo vedere alla società.

**Quello che si pubblica è una dimostrazione con dati inventati.** Non è il
sito della società: `polisportivasandonato.it` resta su WordPress e non viene
toccato. I dati veri — anagrafiche, certificati, pagamenti — non entrano qui
finché non ci sono i consensi raccolti e un backup, che stanno in
[DA-FARE.md](DA-FARE.md).

---

## 1. Il database

Il Postgres di sviluppo gira in Docker sul portatile: online serve un
servizio raggiungibile. Su [neon.tech](https://neon.tech) si crea un progetto
gratuito con Postgres 17 — la stessa versione di `docker-compose.yml`, così
non ci sono sorprese fra quello che funziona qui e quello che funziona lì.

Dal pannello si copia la stringa di connessione, che ha questa forma:

```
postgresql://utente:password@ep-qualcosa.eu-central-1.aws.neon.tech/psd?sslmode=require
```

Il driver stampa un avviso su `sslmode=require`: è solo un avviso, la
connessione funziona ed è cifrata.

## 2. Tabelle e dati finti

**Fatto il 15 settembre 2026.** Questa sezione resta per rifarlo — su un
altro database, o dopo aver buttato via questo.

Niente si crea a mano: le tabelle le fanno le migrazioni, che sono gli
stessi file SQL che girano in locale e stanno in `db/migrazioni/`. Non c'è
nessun file da caricare sul pannello di Neon, e infatti l'importazione che
Neon offre serve ad altro: copia da un database già esistente e
raggiungibile da internet, mentre il nostro sta in Docker sul portatile.

Serve solo un file con la stringa di connessione. Si crea a mano nella
cartella `san-donato-website`, si chiama `.env.demo`, e dentro ha una riga:

```
DATABASE_URL=postgresql://utente:password@ep-qualcosa.eu-central-1.aws.neon.tech/nome?sslmode=require
```

È ignorato da git — come ogni `.env*` — perché la password del database è
scritta lì dentro in chiaro.

Poi quattro comandi, in quest'ordine, perché ognuno ha bisogno del
precedente:

```bash
# 1. crea le tabelle
node --env-file=.env.demo node_modules/drizzle-kit/bin.cjs migrate

# 2. le venti squadre, vere: sono l'ossatura di tutto il resto
node --env-file=.env.demo scripts/semina-squadre.mjs

# 3. le cartelle della libreria
node --env-file=.env.demo scripts/cartelle-iniziali.mjs --applica

# 4. persone, richieste, schede, quote, certificati, partite
node --env-file=.env.demo scripts/semina-dati-prova.mjs --anche-remoto

# 5. notizie e immagini dal vecchio sito: LEGGE da WordPress, non scrive
node --env-file=.env.demo scripts/migra-da-wordpress.mjs --prova   # per guardare
node --env-file=.env.demo scripts/migra-da-wordpress.mjs           # per scrivere

# 6. i file importati finiscono in "Dal vecchio sito", le notizie
#    prendono una categoria in base a titolo e contenuto
node --env-file=.env.demo scripts/cartelle-iniziali.mjs --applica
node --env-file=.env.demo scripts/classifica-notizie.mjs --applica
```

`--anche-remoto` serve perché l'ultimo script per difetto rifiuta qualunque
database che non sia locale: crea un account `admin`/`admin`, e non deve
poterlo fare su un database vero per una variabile sbagliata. Prima di
scrivere stampa il nome dell'ospite, così un errore si vede.

Alla fine il database contiene 20 squadre, 146 account, 118 richieste in
tutti gli stati, una cinquantina di schede con certificati e quote, 5
tariffe e 262 fra partite e allenamenti — tutti inventati — più **97
notizie e 399 file** che invece sono quelli veri del vecchio sito.

Le persone sono finte, i contenuti pubblici no: è la combinazione giusta
per una dimostrazione, perché la società riconosce i propri articoli e
nessun dato personale vero gira su un sito di prova.

I file NON vengono copiati: le immagini restano su
`wp.polisportivasandonato.org` e il nostro database le indica. Finché quel
sito è in piedi si vedono; il giorno che lo si spegne vanno trasferite
sull'archivio (Cloudflare R2), ed è un passo già previsto.

## 3. Il deploy

Il ramo `backend-proprio` va spinto su GitHub: Vercel pubblica quello che
trova lì, non quello che c'è sul portatile. **`main` non si tocca** — è il
ramo del sito attuale.

Su Vercel: progetto nuovo dal repository. Le impostazioni che contano sono
tre, e sbagliarne una costa un pomeriggio:

| Impostazione | Valore | Perché |
|---|---|---|
| Root Directory | `san-donato-website` | il repository ha il sito dentro una cartella, non alla radice: lasciandolo vuoto Vercel non trova nemmeno il `package.json` |
| Production Branch | `backend-proprio` | `main` è il ramo del sito attuale e non va pubblicato qui |
| Framework Preset | Vite | comando `npm run build`, cartella d'uscita `dist`: li riconosce da solo |

Il `vercel.json` c'è già e manda `/api/*` alle funzioni e tutto il resto a
`index.html`; le funzioni sono i file dentro `api/`, una per indirizzo, e
Vercel le riconosce da sé.

Variabili d'ambiente da impostare sul progetto:

| Variabile | Valore | Perché |
|---|---|---|
| `DATABASE_URL` | la stringa di Neon | senza, il sito parte e ogni pagina che legge dati risponde 500 |
| `VITE_SITO_DIMOSTRATIVO` | `1` | accende la targhetta "versione di prova" e il `noindex` |

E due che **non** vanno messe:

- `ARCHIVIO_LOCALE` — scriverebbe i file dentro alla cartella del sito, che
  su Vercel è di sola lettura;
- le `R2_*` — non ci sono ancora. Senza, il caricamento di file è spento e
  lo dice (vedi sotto).

## 4. Controlli dopo il primo deploy

Nell'ordine, perché ognuno dipende dal precedente:

1. la home pubblica si apre e mostra le notizie, con le immagini;
2. `/login` con `admin@admin.it` / `admin` entra davvero — se entra e poi
   rimbalza fuori, il problema è il cookie di sessione, che in produzione è
   `Secure` e vuole `https`;
3. una pagina che legge il database, per esempio `/admin/atleti`;
4. in basso a sinistra c'è la targhetta arancione "Versione di prova";
5. nel sorgente della pagina c'è `<meta name="robots" content="noindex, nofollow">`.

## 5. Cosa NON funziona nella dimostrazione, e perché

Vanno sapute prima di mostrarle, per non scoprirle davanti al cliente.

- **Caricare file nuovi.** Manca il collegamento all'archivio (Cloudflare
  R2): il pulsante "Carica file" della libreria è spento e il messaggio lo
  spiega. Tutto il resto della libreria si mostra davvero — i 399 file del
  vecchio sito, le cartelle, le etichette, il cestino, il cassetto dei
  dettagli.
- **Pagare la quota.** La schermata c'è ed è completa, ma non muove un euro:
  manca la scelta del fornitore.
- **Le email.** Non ne esce nessuna: né avvisi né recupero della password.

## 6. Un percorso da seguire mostrandolo

Gli account sono tutti con password `provapsd2026`, tranne l'amministratore
(`admin@admin.it` / `admin`).

1. **Il sito pubblico** — home, notizie, calendario. È quello che vede una
   famiglia, ed è la parte che somiglia di più a quella di oggi.
2. **Un atleta** (`p034@prova.psd`) — la sua home dice se può giocare e cosa
   manca; poi Iscrizione, Contatti, Quota: ha 200 € di quota e 80 versati.
   Gli atleti sono gli account dal `p032` in su.
3. **La segreteria** (`p001@prova.psd`) — l'elenco atleti con i filtri
   "certificato scaduto" e "quota mancante", e la scheda di una persona: si
   legge tutto, si scrive solo la quota e il certificato.
4. **Un allenatore** (`p010@prova.psd`) — vede solo le proprie squadre, non
   vede nessuna quota, e la sua libreria contiene solo i suoi file più quelli
   condivisi.

   I ruoli seguono la numerazione: `p001`-`p003` segreteria, `p004`-`p009`
   redattori, `p010`-`p031` allenatori, dal `p032` gli atleti. Cambiano se
   si riempie di nuovo il database, perché il seminatore pesca a caso.
5. **L'amministratore** — le tariffe in Quote, gli utenti, il registro di chi
   ha fatto cosa.

Il filo da tenere è sempre lo stesso: **chi vede i dati di una persona non li
può modificare**, e ogni ruolo vede solo quello che gli serve.
