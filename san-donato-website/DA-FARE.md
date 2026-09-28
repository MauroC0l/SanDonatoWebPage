# Cose da fare

Quello che resta aperto, con il perché e da dove ripartire. Non è una lista
di desideri: ogni voce è qualcosa che è già stato incontrato lavorando, e
che è stato lasciato lì per una ragione scritta qui sotto.

---

## Chiesto dalla società il 16 settembre 2026, e già fatto a metà

Le due richieste sono scritte, provate e pronte; quello che resta qui sotto
è la parte che **non si può chiudere da soli**, perché serve una risposta
della società o un pezzo di sito che ancora non c'è.

### Quota degli allenatori: chi la vede in segreteria?

Fatto: gli allenatori hanno la sezione **Iscrizione** come gli atleti, con i
loro dati e la loro quota, e la tariffa se la prendono da soli — è la riga di
`tipi_quota` contrassegnata "allenatori", una sola alla volta. Il certificato
medico a loro non si chiede.

Resta aperto:

- **la segreteria li vede — FATTO.** C'è la sezione **Allenatori**
  (`/admin/allenatori`, capacità `quote.gestisci`): tutti gli allenatori e
  solo loro, con le squadre che allenano, quella in cui giocano, la quota
  della stagione e il versato;
- **chi non entra mai nel sito — FATTO.** Aprire la sezione Allenatori
  assegna la tariffa degli allenatori a chi non ha ancora una quota per la
  stagione in corso. Una quota già scritta, anche zero, non si tocca;
- **chi altro paga?** Oggi la capacità `iscrizione.propria` ce l'hanno
  atleta e allenatore. Se anche dirigenti e segreteria versano qualcosa, è
  una riga in `server/autorizzazioni.js` — e un test che va aggiornato
  apposta, perché oggi dice il contrario;
- **un allenatore che gioca anche in prima squadra** oggi prende la quota da
  atleta se la segreteria gliel'ha messa, e quella degli allenatori solo se
  non ne ha nessuna. Non paga due volte. Se invece deve, serve una regola
  nuova: una quota per persona non basta più;
### Tariffa per fratelli: cosa succede quando il primo si ritira

Fatto: il giro completo — l'atleta dichiara il codice fiscale del fratello
dalla propria iscrizione, il sito cerca quella persona e confronta cognome e
indirizzo, la segreteria conferma o respinge dalla scheda. La conferma **non**
tocca la quota: la tariffa si sceglie a parte, come sempre.

Resta aperto:

- **se il primo iscritto si ritira a novembre — FATTO.** Ogni
  dichiarazione è di una stagione e si rifà la stagione dopo. Sulla scheda
  la segreteria legge "nella stagione X non risulta iscritto" quando il
  fratello trovato non ha un'iscrizione attiva a quella stagione. Nessun
  rifiuto automatico: decide lei;
- **il proprio codice fiscale è ancora controllato solo nella lunghezza**
  (`server/rotte/iscrizione.js`). Quello del fratello no: lì il carattere di
  controllo si verifica. La differenza è voluta — stringere anche l'altro
  significherebbe rifiutare il salvataggio a chi ha già scritto un codice
  fiscale storto mesi fa — ma finché resta, la ricerca del fratello può non
  trovare una persona che c'è;
- **nessuno avvisa chi ha dichiarato.** Conferma e rifiuto si vedono solo
  entrando nel sito, come tutto il resto: è la stessa mancanza delle email,
  più in basso in questa pagina;
- **la segreteria non ha un elenco** delle dichiarazioni da controllare: le
  vede aprendo la scheda di quella persona. Con due o tre all'anno va bene
  così; se diventassero trenta, servirebbe una voce nel cruscotto.

### Stagioni, e chi smette

Fatto (migrazione 0024): la tabella `stagioni`, dal 1° luglio al 30 giugno,
che si crea da sola la prima volta che serve; `iscrizioni_stagione` con
quota, tariffa, squadre di quell'anno e ritiro; `pagamenti` e
`legami_familiari` con la loro stagione. La quota è in due metà (il
centesimo dispari va alla prima) e chi si ritira prima del 1° gennaio non
deve la seconda. La scheda mostra le due metà, il ritiro (si segna e si
annulla) e le stagioni passate. Le regole stanno in `server/stagioni.js` e
si provano in `test/stagioni.test.js`.

La migrazione ha messo **tutti** i versamenti già registrati sulla stagione
in corso, non in base alla data: finora ogni versamento contava contro "la
quota in corso".

Fatto il 28 settembre 2026 (migrazione 0025):

- **quote automatiche.** Tre tariffe ci sono sempre, si rinominano e se ne
  cambia l'importo ma non si cancellano: *Prima iscrizione* (chi la stagione
  prima non c'era), *Rinnovo* (chi c'era) e *Famiglia* (fratello o sorella
  confermati dalla segreteria). Il sito le assegna da solo a chi gioca e non
  ha ancora una quota; una quota scelta a mano resta. Quelle create dalla
  migrazione nascono **spente e a zero**: vanno accese dopo averne deciso
  l'importo, altrimenti non si assegna niente;
- **quota famiglia**: l'atleta la chiede dalla pagina della quota scrivendo
  il codice fiscale; confermata dalla segreteria, la tariffa Famiglia si
  applica da sola (solo al posto di un'automatica o di una quota vuota);
- **selettore della stagione** in alto nel pannello: atleti, schede e
  allenatori di una stagione passata, in sola lettura;
- **pannello Stagioni**: iscritti, prime iscrizioni, rinnovi, ritirati, per
  sport, incassato e da incassare, stagione per stagione.

Resta aperto:

- **per quanti anni si tengono i dati di chi non torna**: lo deve dire chi
  segue la privacy della società. Non è ancora stato chiesto;
- **il rinnovo del 1° luglio — FATTO (deciso il 28 settembre 2026).** Tutti
  gli iscritti passano da soli alla stagione nuova con la quota Rinnovo, da
  saldare; chi aveva la quota famiglia o un'altra passa a Rinnovo e rifà la
  richiesta. Chi si era ritirato o aveva abbandonato arriva come
  "abbandonato" (server/manutenzione-stagioni.js, cron /api/cron/stagioni);
- **abbandono automatico — SPENTO finché non ci sono i pagamenti.** Chi non
  versa la prima metà passa ad "abbandonato"; se poi la versa, torna attivo
  da solo. La società non vuole indicare una scadenza agli atleti ("va
  saldata il prima possibile", 28/09/2026), ma per l'abbandono automatico
  una data serve: oggi nel codice è il 31 ottobre (`scadenzaPrimaMeta` in
  server/stagioni.js), non mostrata da nessuna parte. **Da decidere prima
  di accenderlo.**
  Si accende con `ABBANDONI_AUTOMATICI=1` su Vercel: oggi i versamenti non si
  registrano, e acceso segnerebbe come abbandonati tutti;
- **chi è "abbandonato" non deve la quota** e l'account resta aperto (può
  entrare e tornare): l'account aperto è confermato dalla società il
  28/09/2026, il "non deve la quota" è ancora da confermare;
- **"prima di gennaio" è la data del ritiro**, non quella dei versamenti:
  scelta fatta nel codice, da confermare con la società;
- **il pagamento online in due rate**: quando arriverà, deve scrivere
  `pagamenti.stagione_id` e sapere quale metà sta pagando;
- **certificato e taglia sono della persona**, non della stagione: una
  scheda sola, come prima. Se servono per stagione, va spostato;
- **le colonne della quota su `schede_atleta`** non si usano più: vanno
  tolte con una migrazione, dopo aver controllato che la 0024 abbia copiato
  tutto anche sul database vero.

---

## Segnalati dalla società il 28 settembre 2026

### Velocità dell'area riservata

Sulla demo ogni cambio di pagina costava 2-3 secondi: le funzioni di Vercel
giravano negli Stati Uniti (la regione predefinita) e il database Neon sta a
Francoforte, quindi ogni interrogazione attraversava l'oceano. Da qui
`"regions": ["fra1"]` in vercel.json, e le letture ricordate per un minuto
nel browser (src/api/adminApi.js). Resta la prima richiesta dopo un po' di
inattività: la funzione si riavvia e Neon si risveglia (qualche secondo, una
volta). Si toglie solo con piani a pagamento (Neon senza sospensione).

### Recupero della password via email

Non esiste: la pagina "Password dimenticata" dice che non è ancora attivo.
Servono un servizio da cui spedire le email (oggi le email partono solo da
MailerLite, per la newsletter), una tabella di gettoni a scadenza breve e
una risposta identica sia che l'indirizzo esista sia che no.

### Caricamento dei file (es. certificato medico)

Sulla demo e in produzione i caricamenti non funzionano: manca l'archivio
dei file (Cloudflare R2, vedi sotto) e ogni caricamento risponde 503. In
locale funziona con `ARCHIVIO_LOCALE=1`. Da verificare, una volta collegato
R2, anche il percorso completo del certificato: caricamento, anteprima,
controllo della segreteria.

### Telefono: il limite di 10 cifre è solo nel browser

I campi del telefono accettano solo cifre, al massimo 10. Il server però
controlla solo la lunghezza (40 caratteri): chi scrive a mano una richiesta
passa lo stesso. Da stringere anche lì, normalizzando i numeri già salvati
con gli spazi.

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

### Calendari ufficiali delle federazioni

Fatto per la **pallavolo UISP**: le partite si leggono ogni notte dalle
cartelle Drive della federazione e il calendario del sito le segue (vedi
"Calendari ufficiali" nel Readme). Resta:

- **`CRON_SECRET` su Vercel.** Senza, la lettura notturna non parte e il
  pannello lo dice. È una stringa casuale, da mettere nelle variabili del
  progetto;
- **le altre federazioni** (FIGC per il calcio, e le altre): ognuna vuole
  il suo lettore in `server/calendari/formati/`, scritto sui suoi file veri.
  Servono i collegamenti alle cartelle o alle pagine da cui si scaricano;
- **l'orario della lettura notturna** è in UTC, perché così vuole Vercel:
  alle 23, cioè mezzanotte d'inverno e l'una d'estate. Sul piano gratuito
  Vercel la fa partire in un momento qualsiasi di quell'ora;
- **il calendario Google "collettore"** che qualcuno riempie con i titoli
  "sport categoria - casa / ospite" non serve più: da dove arrivi non si
  è capito, e va avvisato chi lo aggiorna prima di spegnerlo;
- **i venti calendari Google di squadra sono vuoti** (verificato con la
  società il 27 settembre 2026) e **non servono più**: al loro posto ogni
  squadra ha un calendario da abbonare, `/api/calendario/:id.ics`, che
  Google e Apple rileggono da soli (deciso lo stesso giorno). Da togliere,
  con calma: `scripts/importa-eventi-google.mjs`, la colonna
  `squadre.calendario_google_id` e le variabili `VITE_*_CALENDAR_ID`;
- **Google Calendar rilegge quando vuole**: di solito ogni 8-24 ore, e non
  si può forzare. Una partita spostata il giorno stesso sul sito si vede
  subito, sul telefono di chi usa Google no. Apple rispetta le sei ore
  indicate nel file.

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
