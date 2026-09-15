# Cose da fare

Quello che resta aperto, con il perché e da dove ripartire. Non è una lista
di desideri: ogni voce è qualcosa che è già stato incontrato lavorando, e
che è stato lasciato lì per una ragione scritta qui sotto.

---

## In attesa della società

Non sono lavori di programmazione: senza una decisione o una credenziale non
si può cominciare.

### Archivio dei file su Cloudflare R2

Servono `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY` e il dominio pubblico da cui i file si leggono.

Finché mancano, in produzione ogni caricamento risponde 503 con un messaggio
esplicito. In locale si lavora lo stesso con `ARCHIVIO_LOCALE=1`, che scrive
in `public/caricamenti/`.

### Hosting del database e del sito

Oggi il Postgres gira in Docker sul portatile di chi sviluppa. Serve un
servizio gestito e la relativa stringa di connessione; il codice non cambia.

### Pagamento online delle quote

La schermata c'è ed è completa — quanto si versa, in quante volte, con che
mezzo — ma non muove un euro: manca la scelta del fornitore (Stripe, Nexi,
SumUp).

Da quando la registrazione a mano è stata tolta, **nessuno può più scrivere
un versamento**: la tabella `pagamenti` si legge e basta. Chi paga in
contanti o con un bonifico oggi non risulta da nessuna parte, e questo
resta così finché il fornitore non c'è.

Quando arriverà, in ordine:

1. un endpoint apre una sessione di pagamento e restituisce l'indirizzo a cui
   mandare il browser, al posto di `procedi()` in
   `src/components/Atleta/SchermataPagamento.jsx`;
2. il versamento lo scrive **la notifica che il fornitore manda al server**,
   sulla tabella `pagamenti`. L'endpoint che scriveva a mano è stato tolto
   (`api/admin/atleti/[id]/pagamenti.js`, nella storia di git): quello che
   faceva — controllo dei permessi, importo in centesimi, riga nel registro
   — serve ancora, ma attivato da chi ha incassato e non da chi digita.

Il punto 2 non è un dettaglio: l'esito non si può registrare al ritorno
dell'utente sul sito. Chi chiude la pagina a metà avrebbe pagato senza che
risulti, e chi ricarica la pagina di ritorno risulterebbe due volte.

### Dati da uffwebsm

Il vecchio gestionale va spento e i suoi dati — anagrafiche, pagamenti,
certificati — devono passare di qui. Manca di sapere come estrarli:
esportazione, accesso al database, o copiatura a mano.

### Calendario ufficiale

I venti calendari Google vanno importati una volta sola e poi spenti. Lo
schema e lo script ci sono; il calendario del sito al momento gira sui dati
di prova.

---

## Da fare quando serve

### Consensi alla registrazione

Oggi chi si registra non accetta niente: né l'informativa, né il consenso
per il certificato medico, né quello per le foto. Registriamo minorenni e
teniamo il numero di telefono dei loro genitori, quindi non è una formalità
rimandabile a piacere.

**Prima di scrivere codice, guardare cosa c'è già.** Il sito pubblica
documenti che qualcuno ha già preparato, e il testo delle spunte deve dire
le stesse cose:

- `public/documenti/PSD_GDPR_2023_2024.pdf` — l'informativa della società.
  Porta gli anni 2023/2024 nel nome: va verificato se è ancora quella buona;
- `public/documenti/PSD_STATUTO.pdf` e `PSD_VADEMECUM_2025-2026.pdf`;
- `public/documenti/FIGC_Policy-per-la-tutela-dei-minori.pdf`,
  `Fascicolo-Policy-CSI_w.pdf`, `policy-uisp.pdf` — le policy federali sui
  minori, che riguardano proprio i dati che raccogliamo;
- `src/data/Privacy.json` — l'elenco che la pagina pubblica mostra.

Cosa chiedere, secondo la distinzione che conta (obbligatorio per
iscriversi / facoltativo e rifiutabile senza conseguenze):

1. **presa visione dell'informativa** — non è un consenso, è una spunta
   "ho letto" con il link al documento;
2. **chi accetta per un minorenne** — la dichiarazione di esercitare la
   responsabilità genitoriale: senza, non si sa chi ha acconsentito;
3. **dati sanitari** (il certificato medico è categoria particolare, art. 9
   GDPR) — consenso esplicito e separato;
4. **foto e video** in cui l'atleta è riconoscibile — spunte distinte per
   sito e per social, revocabili, e mai condizione per iscriversi;
5. **comunicazioni non organizzative** (newsletter, iniziative, 5x1000) —
   separate. Le convocazioni e le scadenze non sono marketing.

Come vanno fatti, che è la parte che si sbaglia:

- spunte **separate**, mai una sola "accetto tutto";
- **mai pre-spuntate**;
- il consenso **si registra**: una tabella `consensi` con utente, tipo,
  **versione del documento**, data di accettazione e data di revoca. Senza
  la versione, il giorno che l'informativa cambia non si sa più chi ha
  accettato cosa;
- una schermata dove ognuno **vede e revoca** i propri, perché un consenso
  che non si può ritirare non è un consenso.

Il testo dei documenti non lo scrive chi programma: lo dà chi segue la
privacy della società. Qui serve solo il posto dove firmarli e la memoria
di chi ha firmato cosa.

### Backup del database

Oggi non ce n'è nessuno. Il Postgres gira in Docker sul portatile di chi
sviluppa, e quando passerà su un servizio gestito il backup non arriverà da
solo: quasi tutti i piani economici tengono una copia di pochi giorni, e una
cancellazione fatta per sbaglio la si scopre dopo.

Cosa serve, in ordine di quanto protegge:

- **un dump periodico** (`pg_dump`) che finisca fuori dal server del
  database — su R2, quando ci saranno le credenziali, o dove gira il sito;
- **una copia che qualcuno tenga** anche a distanza di mesi: anagrafiche e
  pagamenti di una stagione servono l'anno dopo, e per gli obblighi fiscali
  servono per anni;
- **una prova di ripristino**, una volta sola, su un database vuoto. Un
  backup mai riletto non è un backup: è un file che si spera sia buono.

Non è un lavoro di programmazione — è una riga di cron e un posto dove
scrivere — ma è la cosa che, se manca, rende irrecuperabile qualunque altro
errore. È stata rimandata di proposito, non dimenticata.

### Spazio di archiviazione per persona

Oggi chi carica file non ha nessun tetto. Con gli allenatori che caricano
video delle partite dalla propria libreria, il conto di Cloudflare cresce
senza che nessuno se ne accorga finché non arriva la fattura.

Cosa servirebbe, in ordine di utilità:

- **contare**: quanti byte ha caricato ciascuno. `media.byte` c'è già e
  `media.caricato_da` pure, quindi è una somma raggruppata — il numero si può
  mostrare subito in fondo alla libreria di ciascuno, prima ancora di
  imporre qualunque limite;
- **avvisare**: una soglia oltre la quale la libreria dice "stai occupando
  tanto spazio", senza impedire niente;
- **limitare**: un tetto per ruolo (un allenatore non è un amministratore),
  controllato in `chiediPermesso` dentro `api/admin/media/index.js` — è già
  il punto in cui si decide se un caricamento può partire, e restituisce già
  un 413 quando il file è troppo grande;
- **fare spazio**: i file che nessuno usa più. `usoDiMedia()` in
  `server/media.js` sa già dire dove un file è usato, quindi l'elenco degli
  orfani è una query.

Prima di metterci mano conviene però guardare quanto spazio si occupa
davvero: con qualche centinaio di foto il problema potrebbe non esistere, e
un limite messo per prudenza è solo un ostacolo in più per chi lavora.

### Cambiare sport dopo una richiesta respinta

Segreteria e amministratori possono riaprire una richiesta respinta, ma
quella torna in coda **con lo stesso sport**. Chi aveva chiesto il calcio e
in realtà gioca a pallavolo non ha modo di correggersi da solo.

Servirebbe poter cambiare lo sport della propria richiesta finché è in
attesa. Il posto è la schermata che si vede aspettando la squadra
(`AttesaSquadraPage`), e l'endpoint non esiste ancora.

### Aggiornamento a React Router 7

`npm audit` segnala un redirect aperto nella versione 6 (backslash dentro a
`<Link>` e `useNavigate`). La correzione è il passaggio alla 7, che è un
cambio maggiore.

Le due novità di comportamento sono già accese con i flag `future` in
`src/main.jsx`, quindi il salto dovrebbe essere breve — ma va fatto apposta,
non di sfuggita.

---

## Fatto, con il conto da sapere

### Elenco completo dei comuni

`src/data/luoghi.js` contiene ora tutte le 107 province e tutti i 7.904
comuni, generati da `scripts/genera-luoghi.mjs` a partire dalle tabelle
ISTAT. Per aggiornarlo dopo una fusione di comuni si rilancia lo script e
si commette il risultato.

Costa 114 KB, che diventano una cinquantina compressi, e pesano solo sulla
schermata dell'iscrizione — l'unica che li carica. Se un giorno quel peso
desse fastidio, la via è chiedere i comuni al server invece di spedirli
tutti: la funzione `comuniDi()` in `src/utils/luoghi.js` è già il punto
unico da cui passano.

---

## Idee scartate, e perché

Perché non vengano riproposte fra sei mesi.

- **Preferenze dell'interfaccia sul server.** Provate e tolte: lista o
  griglia è una minuzia, e farne una colonna in tabella vuol dire una
  richiesta di rete a ogni clic. Stanno in `localStorage`.
- **Parziali obbligatori su tutte le partite.** Nel calcio quasi nessuno li
  scrive: pretenderli avrebbe lasciato ogni partita di calcio segnata come
  "da completare" per sempre, e un avviso che non si spegne mai è un avviso
  che si smette di leggere. Si chiedono solo a pallavolo e basket.
- **Versamenti scritti a mano dalla segreteria.** C'erano, e sono stati
  tolti: un importo battuto a mano non ha un riscontro da nessuna parte —
  né ricevuta né estratto conto — e la cassa tornava solo perché qualcuno
  aveva scritto il numero giusto. I versamenti li scriverà il fornitore del
  pagamento online, che è l'unico a sapere se i soldi sono arrivati.
- **Elenco di avvisi nella home del pannello.** C'era una riga per ogni cosa
  in sospeso sopra alle tessere che dicevano gli stessi numeri: due volte la
  stessa informazione, di cui una scritta in modo da sembrare urgente.
