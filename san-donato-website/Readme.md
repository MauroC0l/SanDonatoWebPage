# Sito Polisportiva San Donato

Front-end React (Vite) del sito della A.S.D. Polisportiva San Donato.
I contenuti delle notizie arrivano da WordPress, usato solo come archivio:
la redazione avviene nell'area riservata di questo sito, non nel pannello
di WordPress.

---

## Avvio in locale

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build
```

> Su Windows, se PowerShell blocca `npm` con "L'esecuzione di script è
> disabilitata": `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

---

## Collegamento a WordPress

Le notizie vengono lette dalla REST API di WordPress. L'indirizzo è nella
variabile `VITE_WP_API_BASE`.

Il valore predefinito nel codice è già l'indirizzo definitivo:

```
https://wp.polisportivasandonato.org/wp/index.php
```

Non serve impostare la variabile: si usa solo per puntare altrove, ad esempio
verso un ambiente di prova.

### Verifica che WordPress risponda

Deve restituire testo JSON che inizia con `[{"id":`

```
https://wp.polisportivasandonato.org/wp/index.php?rest_route=/wp/v2/posts&per_page=1
```

Se risponde una pagina vuota, un errore di certificato o "Not Found", manca
uno dei tre interventi lato server: il record DNS `A` verso l'IP dell'hosting,
il sottodominio creato in cPanel sulla stessa cartella del sito, o il
certificato AutoSSL.

### Perché le immagini vengono riscritte

WordPress salva le URL dei file caricati sul dominio storico
(`polisportivasandonato.org/wp/wp-content/...`), che oggi porta al sito React.
`wpConfig.js` le riporta sul sottodominio, sia per la copertina degli articoli
sia per le immagini dentro al testo. Senza questo passaggio le foto
risulterebbero rotte pur essendo WordPress raggiungibile.

---

## Area riservata

Raggiungibile su **`/admin`**. Non è linkata dal sito pubblico: si arriva
digitando l'indirizzo o da un segnalibro.

| Percorso | Cosa fa |
|---|---|
| `/admin/accedi` | accesso |
| `/admin` | elenco notizie, ricerca, filtri, cestino |
| `/admin/nuova` | scrivi una nuova notizia |
| `/admin/modifica/:id` | modifica una notizia esistente |

Permette di scrivere, modificare, pubblicare, salvare bozze, caricare
l'immagine di copertina e cestinare. Le foto vengono ridotte a 1600px e
raddrizzate (orientamento EXIF) prima del caricamento.

### Come si accede

L'accesso usa le **Application Password** native di WordPress: password
dedicate e revocabili, che non espongono la password vera dell'account.

Per abilitare una persona:

1. entrare in WordPress → **Utenti** → aprire il profilo della persona
   (o crearne uno nuovo, ruolo *Autore* o *Editore*);
2. in fondo alla pagina, sezione **Password d'applicazione**, inserire un nome
   (es. "Pannello notizie") e confermare;
3. copiare il codice generato — compare **una sola volta**;
4. consegnare alla persona il proprio *nome utente* e quel codice.

Da quel momento usa solo `/admin`. Il codice si revoca dalla stessa pagina
senza toccare l'account.

### Ruoli

I permessi sono quelli di WordPress, non un secondo sistema parallelo:

- chi **non** può pubblicare vede il pulsante "Invia in revisione" al posto
  di "Pubblica", e le sue notizie restano in attesa;
- chi può pubblicare mette la notizia online direttamente.

### In quale sezione finisce una notizia

Lo sport è dedotto dal **titolo** (non esiste un campo dedicato in WordPress):
una notizia che contiene *calcio*, *volley*/*pallavolo*, *minivolley* o
*basket* finisce nella sezione corrispondente, altrimenti in "Altro".
L'editor lo mostra mentre si scrive, così l'operatore se ne accorge subito.

---

## Variabili d'ambiente

Stanno in `.env` (non versionato) e vanno replicate nel pannello dell'hosting.

| Variabile | A cosa serve |
|---|---|
| `VITE_WP_API_BASE` | indirizzo di WordPress (vedi sopra) |
| `VITE_GOOGLE_API_KEY` | calendari delle squadre |
| `VITE_*_CALENDAR_ID` | un identificativo per ogni squadra |
| `MAILERLITE_API_KEY` | newsletter — **solo lato server**, mai con prefisso `VITE_` |

> Tutto ciò che inizia con `VITE_` finisce **in chiaro** nel codice scaricato
> dai visitatori. La chiave Google va quindi ristretta dalla console Google
> Cloud al dominio della società e alla sola Calendar API.

---

## Struttura

```
src/
  api/         wpConfig (indirizzi) · API.mjs (lettura) · adminApi (scrittura)
  components/
    Admin/     area riservata: login, elenco, editor
    Home/ News/ ...   sito pubblico
  context/     auth.js (contesto + hook) · AuthProvider.jsx
  css/         un foglio di stile per componente
  data/        contenuti editoriali statici (orari, contatti, sponsor)
  utils/       prepareImage (ridimensionamento foto)
api/           funzioni serverless (newsletter)
```

Il sito pubblico non scarica una riga del codice dell'area riservata: sta in
un bundle separato, caricato solo entrando in `/admin`.
