# Sito A.S.D. Polisportiva San Donato

Sito pubblico e area riservata della Polisportiva San Donato di Torino.

React + Vite per il front-end, una funzione serverless che smista tutte le
chiamate al back-end, Postgres per i dati. **WordPress non è più il motore del sito**:
resta in piedi solo come archivio dei file delle notizie vecchie, finché
non saranno trasferiti.

---

## Avvio in locale

Servono tre cose accese: il database, le API, il front-end.

```bash
docker compose up -d     # Postgres sulla 5432
npm install
cp .env.esempio .env     # e adattare DATABASE_URL se serve
npm run db:applica       # crea/aggiorna le tabelle

npm run dev:api          # API su http://localhost:3001
npm run dev              # sito su http://localhost:5173
```

Il sito parla con le API attraverso il proxy di Vite: per il browser stanno
sulla stessa origine, come in produzione. Senza questo il cookie di
sessione (`SameSite=Strict`) non partirebbe mai.

> **`npm run dev:api` va riavviato a ogni modifica dentro `server/`.** Il server di sviluppo carica i moduli una volta sola all'avvio:
> senza riavvio si continua a provare il codice di prima, e si finisce per
> cercare un difetto che è già stato corretto.

> Su Windows, se PowerShell blocca `npm` con "L'esecuzione di script è
> disabilitata": `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

### Dati finti per provare

```bash
node --env-file=.env scripts/semina-squadre.mjs
node --env-file=.env scripts/semina-dati-prova.mjs
```

Crea squadre, una sessantina di atleti con schede, certificati in vari
stati e versamenti. L'amministratore di prova è `admin@admin.it` con
password `admin`; gli altri account finti condividono `provapsd2026`.

> Sono credenziali da tavolo di lavoro. Un database con dentro questi
> account non va esposto su internet.

---

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | sito in locale |
| `npm run dev:api` | API in locale (replica l'instradamento di Vercel) |
| `npm run lint` | controllo del codice |
| `npm run build` | compilazione per la pubblicazione |
| `npm test` | suite di test |
| `npm run test:guarda` | test che si rieseguono a ogni salvataggio |
| `npm run db:genera` | crea una migrazione dalle differenze di `db/schema.js` |
| `npm run db:applica` | applica le migrazioni non ancora applicate |
| `npm run db:studio` | sfoglia il database dal browser |

---

## Test

```bash
npm test
```

Provano le regole, non l'aspetto: chi può fare cosa, quali forme accettano
le API, come si fanno i conti sui soldi e sulle scadenze dei certificati.
Sono le cose che si rompono in silenzio — un pulsante spostato lo si vede
aprendo la pagina, un permesso allentato no.

`test/api.test.js` fa richieste vere all'API locale e controlla il JSON che
torna: per esempio che un allenatore **non riceva** gli importi delle quote,
non che la schermata non li mostri. Se l'API non è accesa quei test si
saltano da soli, così `npm test` gira comunque.

Per eseguirli tutti: `docker compose up -d && npm run dev:api`, poi `npm test`.

---

## Ruoli e permessi

I permessi sono **capacità**, non controlli di ruolo sparsi negli endpoint:
stanno tutti in `server/autorizzazioni.js`, e un endpoint si protegge con
`richiedeCapacita("notizie.pubblica", ...)`.

| Ruolo | Indirizzo | Cosa fa |
|---|---|---|
| `admin` | `/admin` | tutto |
| `segreteria` | `/segreteria` | iscrizioni, quote, controllo dei certificati |
| `editor` | `/editor` | notizie e libreria dei file |
| `coach` | `/coach` | partite e atleti delle proprie squadre, libreria propria |
| `atleta` | `/area-riservata` | la propria iscrizione e le proprie quote |

Altre cinque regole che valgono la pena di essere sapute prima di leggere
il codice:

- **Partite ed eventi sono due sezioni, un calendario solo.** Un allenatore
  mette a calendario partite, tornei e allenamenti della propria squadra;
  assemblee, feste e chiusure della sede le decide chi amministra. Cambia il
  modulo, non il calendario del sito.
- **Il certificato medico lo controlla la segreteria.** Caricare un file e
  consegnare un certificato valido non sono la stessa cosa: finché qualcuno
  non l'ha guardato, quell'atleta non è a posto. Toccarlo lo riporta da
  controllare, e finché è valido l'atleta non lo può sostituire — si sblocca
  tre mesi prima della scadenza.
- **Le API sono trentacinque rotte e una funzione sola.** Su Vercel, senza
  un framework che le impacchetti, ogni file dentro `api/` diventerebbe una
  funzione a sé: il piano gratuito ne ammette dodici. Le rotte stanno in
  `server/rotte/` — un file per indirizzo, come prima — e in `api/` c'è solo
  `[[...percorso]].js`, che legge l'indirizzo e chiama la rotta giusta.
  L'elenco sta in `server/rotte.js` e va aggiornato a mano quando si
  aggiunge una rotta: non si può leggere la cartella a tempo di esecuzione,
  perché chi impacchetta il codice segue le importazioni scritte. C'è un
  test che fallisce se elenco e cartella divergono.
- **La libreria dei file ha due versioni.** Chi scrive le notizie la vede
  intera; chi mette a calendario le partite vede solo quello che ha caricato
  lui, e lo sa perché c'è scritto.
- **Per un minorenne serve un adulto da chiamare.** Nome e telefono di un
  genitore sono obbligatori quanto il codice fiscale, e l'età si ricava
  dalla data di nascita. I contatti sono due perché il genitore che
  risponde sempre non è quello che è in palestra; il secondo è facoltativo
  e compare solo a chi lo aggiunge. Li vede anche l'allenatore: è lui che è
  in campo quando serve.

Due regole che valgono sopra a tutte le altre, e che sono nei test:

- **Chi vede i dati di una persona non li può modificare.** L'anagrafica la
  scrive solo l'interessato. Nessun ruolo, amministratore compreso, ha una
  capacità per riscriverla. Unica eccezione concordata: la segreteria può
  registrare il certificato medico, perché arriva quasi sempre su carta.
- **L'allenatore non vede le quote.** Non gli vengono nascoste a schermo:
  non escono proprio dal server.
- **I versamenti nessuno li scrive a mano.** Né la segreteria né un
  amministratore: la tabella `pagamenti` si legge e basta, e a scriverla
  sarà la notifica del fornitore del pagamento online. Un importo battuto
  a mano non ha riscontro da nessuna parte, e una cassa che torna solo
  perché qualcuno ha scritto il numero giusto non è una cassa che torna.

---

## Struttura

```
api/          UNA funzione sola: [[...percorso]].js, che smista (vedi sotto)
server/
  rotte/      una rotta per file: il nome del file È l'indirizzo pubblico
  rotte.js    l'elenco che lega gli indirizzi alle rotte, tenuto a mano
  *.js        codice condiviso fra le rotte
db/           schema Drizzle, client, migrazioni
scripts/      lavori una tantum: importazioni, dati di prova, classificazioni
test/         la suite
src/
  api/        API.mjs (sito pubblico) · adminApi.js (area riservata)
  components/
    Admin/    area riservata dello staff
    Atleta/   area riservata dell'atleta
    AllPages/ barra in alto, menu, piè di pagina
    Home/ News/ Galleria/ ...   sito pubblico
  context/    sessione e finestre di dialogo
  css/        un foglio per componente
  hooks/      paginazione, vista scelta, altezza pubblicata
  utils/      soldi, certificati, percorsi delle aree
```

Il sito pubblico non scarica una riga del codice dell'area riservata: sta in
un blocco separato, caricato solo entrando nel pannello.

---

## Variabili d'ambiente

Stanno in `.env` (non versionato) e vanno replicate nel pannello dell'hosting.
Vedi `.env.esempio` per l'elenco completo e commentato.

| Variabile | A cosa serve |
|---|---|
| `DATABASE_URL` | Postgres |
| `R2_*`, `URL_PUBBLICO_FILE` | archivio dei file su Cloudflare R2 |
| `ARCHIVIO_LOCALE` | **solo in locale**: scrive i file in `public/caricamenti` |
| `VITE_GOOGLE_API_KEY`, `VITE_*_CALENDAR_ID` | calendari Google, in via di dismissione |
| `MAILERLITE_API_KEY` | newsletter — **solo lato server**, mai con prefisso `VITE_` |

> Tutto ciò che inizia con `VITE_` finisce **in chiaro** nel codice scaricato
> dai visitatori.

### Caricamento dei file

In produzione i file vanno su Cloudflare R2: il browser chiede un permesso
di scrittura a scadenza e carica direttamente là, senza farli passare dalle
nostre funzioni.

Finché le chiavi `R2_*` non ci sono, ogni caricamento risponde 503 con un
messaggio esplicito. In locale si accende `ARCHIVIO_LOCALE=1` e i file
finiscono in `public/caricamenti/`, servita da Vite: serve per poter
lavorare su copertine, certificati e immagini del profilo senza aspettare
le credenziali di Cloudflare. Su Vercel il disco è di sola lettura, quindi
in produzione va lasciato spento.

---

## Cosa resta da fare

Sta in [DA-FARE.md](DA-FARE.md): quello che aspetta una decisione della
società, quello che si farà quando servirà, e le idee già provate e
scartate — con il perché, perché non vengano riproposte fra sei mesi.

---

## Cosa resta di WordPress

Solo i file delle notizie importate: le loro immagini puntano ancora al
sottodominio `wp.polisportivasandonato.org`. Le righe in tabella `media`
hanno la chiave vuota e l'indirizzo originale, e `urlFile()` serve l'uno o
l'altro senza che il resto del codice debba saperlo.

**Non si scrive su quel WordPress.** È il sito che la società ha usato
davvero: nessuna prova, nessun articolo di test, nessun caricamento.
