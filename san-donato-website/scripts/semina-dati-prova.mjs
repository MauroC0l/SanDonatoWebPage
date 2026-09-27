/**
 * Riempie il database di dati finti, per vedere come regge l'interfaccia.
 *
 * Serve a stressare le schermate: nomi lunghissimi, accenti e apostrofi,
 * account mai usati e account fermi da anni, elenchi lunghi, richieste in
 * tutti gli stati, partite con dieci marcatori e parziali chilometrici.
 * Un pannello che funziona con tre righe può cadere a pezzi con duecento.
 *
 * RIFIUTA DI GIRARE SE IL DATABASE NON È IN LOCALE. Non è una cortesia: qui
 * dentro si crea un account "admin" con password "admin", e deve essere
 * impossibile che finisca su un database vero per una variabile d'ambiente
 * sbagliata.
 *
 * L'eccezione è il database della DIMOSTRAZIONE, che sta su un servizio
 * remoto ed è fatto apposta di dati inventati. Per quello serve scriverlo:
 * "--anche-remoto" non si digita per sbaglio, e il nome dell'ospite
 * finisce stampato a schermo prima di toccare qualunque cosa.
 *
 * Uso:
 *   node --env-file=.env scripts/semina-dati-prova.mjs
 *   node --env-file=.env scripts/semina-dati-prova.mjs --pulisci
 *   node --env-file=.env.demo scripts/semina-dati-prova.mjs --anche-remoto
 */

import { eq, like, inArray, sql } from "drizzle-orm";
import { getDb, chiudiDb } from "../db/client.js";
import {
  utenti, squadre, eventi, richiesteIscrizione, associazioniSquadra,
  schedeAtleta, pagamenti, tipiQuota, legamiFamiliari, iscrizioniStagione
} from "../db/schema.js";
import { stagioneCorrente, stagionePer, oggiRoma } from "../server/stagioni.js";
import { creaHashPassword } from "../server/password.js";
import { carattereDiControllo } from "../server/codice-fiscale.js";

/* Tutti gli account finti finiscono su questo dominio: è così che si
   riconoscono e si cancellano senza toccare quelli veri. */
const DOMINIO = "prova.psd";
const PASSWORD_COMUNE = "provapsd2026";

const soloPulisci = process.argv.includes("--pulisci");
const ancheRemoto = process.argv.includes("--anche-remoto");

/* =====================================================
   Sicurezza
   ===================================================== */

function verificaCheSiaLocale() {
  const url = process.env.DATABASE_URL ?? "";
  const locale = /@(localhost|127\.0\.0\.1)[:/]/.test(url);

  if (locale) return;

  if (!ancheRemoto) {
    throw new Error(
      "DATABASE_URL non punta a un database locale.\n" +
      "   Questo script crea un account admin/admin e centinaia di righe finte:\n" +
      "   non deve poter toccare un database vero.\n" +
      "   Se è il database della dimostrazione, aggiungi --anche-remoto."
    );
  }

  /* Il nome dell'ospite, stampato prima di scrivere qualunque cosa: se
     qualcuno lancia il comando con il file .env sbagliato, lo legge lì. */
  const ospite = url.replace(/^.*@/, "").replace(/[/?].*$/, "");
  console.log(`⚠  Database remoto: ${ospite}`);
  console.log("   Ci finiscono dati inventati e un account admin/admin.");
}

/* =====================================================
   Ingredienti
   ===================================================== */

const NOMI = [
  "Luca", "Giulia", "Marco", "Sara", "Andrea", "Chiara", "Matteo", "Elena",
  "Davide", "Francesca", "Simone", "Martina", "Alessandro", "Giorgia",
  "Federico", "Alice", "Lorenzo", "Sofia", "Riccardo", "Aurora", "Niccolò",
  "Beatrice", "Tommaso", "Ludovica", "Gabriele", "Emma", "Pietro", "Anna"
];

const COGNOMI = [
  "Rossi", "Bianchi", "Ferrari", "Esposito", "Romano", "Colombo", "Ricci",
  "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Mancini",
  "Costa", "Giordano", "Rizzo", "Lombardi", "Barbieri", "Moretti",
  "D'Amico", "Martinelli", "Fontana", "Caruso", "Mariani", "Rinaldi"
];

/* Casi che di solito rompono qualcosa: si mettono apposta. */
const CASI_LIMITE = [
  {
    nome: "Massimiliano Giovanni Battista",
    cognome: "Della Rovere Sforza Visconti di Modrone",
    perche: "nome e cognome lunghissimi: manda a capo le righe"
  },
  {
    nome: "Niccolò",
    cognome: "Dell'Acqua Sant'Antonio",
    perche: "apostrofi e accenti"
  },
  {
    nome: "",
    cognome: "",
    perche: "senza nome: deve comparire l'email al suo posto"
  },
  {
    nome: "Zoë",
    cognome: "Müller-Schäfer",
    perche: "caratteri non italiani"
  }
];

const LUOGHI = [
  "Campo Le Chiuse, Torino", "Palestra Via Pacchiotti", "PalaSanDonato",
  "Campo comunale di Rivoli", "Palazzetto di Collegno",
  "Centro sportivo Cenisia — campo 2 (ingresso da via Fiano, cancello laterale)"
];

const AVVERSARI = [
  "Rivoli", "Collegno", "Moncalieri", "Chieri", "Settimo", "Venaria",
  "Pianezza", "Grugliasco", "Nichelino", "Beinasco"
];

const scelta = (elenco) => elenco[Math.floor(Math.random() * elenco.length)];
const intero = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function giorniFa(giorni) {
  return new Date(Date.now() - giorni * 86400000);
}

/* =====================================================
   Pulizia
   ===================================================== */

async function pulisci(db) {
  const finti = await db
    .select({ id: utenti.id })
    .from(utenti)
    .where(like(utenti.email, `%@${DOMINIO}`));

  const ids = finti.map((u) => u.id);

  if (ids.length) {
    // Le richieste e le associazioni cadono da sole con la cascata sugli
    // utenti; gli eventi no, perché puntano alle squadre.
    await db.delete(associazioniSquadra).where(inArray(associazioniSquadra.utenteId, ids));
    await db.delete(richiesteIscrizione).where(inArray(richiesteIscrizione.utenteId, ids));
    await db.delete(utenti).where(inArray(utenti.id, ids));
  }

  // Gli eventi finti si riconoscono dal titolo
  await db.delete(eventi).where(like(eventi.titolo, "[prova]%"));

  console.log(`Ripuliti: ${ids.length} account finti e i loro eventi.`);
}

/* =====================================================
   Utenti
   ===================================================== */

async function creaUtenti(db) {
  const hashComune = await creaHashPassword(PASSWORD_COMUNE);
  const hashAdmin = await creaHashPassword("admin", { minimoCaratteri: 5 });

  const righe = [];

  // L'amministratore comodo, quello con cui si entra per provare
  righe.push({
    email: "admin@admin.it",
    passwordHash: hashAdmin,
    ruolo: "admin",
    nome: "Admin",
    cognome: "Di Prova",
    stato: "attivo",
    deveCambiarePassword: false,
    ultimoAccesso: new Date()
  });

  let n = 0;
  const prossima = () => `p${String(++n).padStart(3, "0")}@${DOMINIO}`;

  // --- Segreteria ---
  for (let i = 0; i < 3; i++) {
    righe.push({
      email: prossima(),
      passwordHash: hashComune,
      ruolo: "segreteria",
      nome: scelta(NOMI),
      cognome: scelta(COGNOMI),
      stato: "attivo",
      deveCambiarePassword: i === 0, // uno appena creato, non ancora entrato
      ultimoAccesso: i === 0 ? null : giorniFa(intero(1, 20))
    });
  }

  // --- Redattori ---
  for (let i = 0; i < 6; i++) {
    righe.push({
      email: prossima(),
      passwordHash: hashComune,
      ruolo: "editor",
      nome: scelta(NOMI),
      cognome: scelta(COGNOMI),
      stato: i === 5 ? "sospeso" : "attivo",
      deveCambiarePassword: false,
      ultimoAccesso: i < 3 ? giorniFa(intero(0, 10)) : giorniFa(intero(90, 400))
    });
  }

  // --- Allenatori ---
  for (let i = 0; i < 22; i++) {
    righe.push({
      email: prossima(),
      passwordHash: hashComune,
      ruolo: "coach",
      nome: scelta(NOMI),
      cognome: scelta(COGNOMI),
      stato: "attivo",
      deveCambiarePassword: i % 7 === 0,
      // Un terzo non è mai entrato: è il caso che si vuole notare
      ultimoAccesso: i % 3 === 0 ? null : giorniFa(intero(0, 200))
    });
  }

  // --- Atleti, in tutti gli stati ---
  const STATI = ["attivo", "attivo", "attivo", "in_attesa", "in_attesa", "sospeso"];

  for (let i = 0; i < 110; i++) {
    const stato = STATI[i % STATI.length];
    righe.push({
      email: prossima(),
      passwordHash: hashComune,
      ruolo: "atleta",
      nome: scelta(NOMI),
      cognome: scelta(COGNOMI),
      stato,
      deveCambiarePassword: false,
      ultimoAccesso: stato === "in_attesa"
        ? (i % 2 ? null : giorniFa(intero(0, 3)))
        : (i % 5 === 0 ? null : giorniFa(intero(0, 500)))
    });
  }

  // --- Casi limite ---
  for (const caso of CASI_LIMITE) {
    righe.push({
      email: caso.nome ? prossima() : `un.indirizzo.email.davvero.molto.lungo.per.vedere.che.succede@${DOMINIO}`,
      passwordHash: hashComune,
      ruolo: "atleta",
      nome: caso.nome || null,
      cognome: caso.cognome || null,
      stato: "in_attesa",
      deveCambiarePassword: false,
      ultimoAccesso: null
    });
  }

  const creati = await db.insert(utenti).values(righe).returning({
    id: utenti.id, ruolo: utenti.ruolo, stato: utenti.stato, email: utenti.email
  });

  console.log(`Creati ${creati.length} account.`);
  return creati;
}

/* =====================================================
   Associazioni e richieste
   ===================================================== */

async function collegaAllenatori(db, creati, listaSquadre) {
  const allenatori = creati.filter((u) => u.ruolo === "coach");
  const redattori = creati.filter((u) => u.ruolo === "editor");
  const sportive = listaSquadre.filter((s) => s.sport !== "Societa");

  const righe = [];

  // Ogni squadra ha almeno un allenatore; qualcuno ne ha due, e un paio di
  // allenatori ne seguono più d'una: sono i casi che l'elenco deve reggere.
  sportive.forEach((squadra, i) => {
    righe.push({ utenteId: allenatori[i % allenatori.length].id, squadraId: squadra.id });
    if (i % 4 === 0) {
      righe.push({ utenteId: allenatori[(i + 5) % allenatori.length].id, squadraId: squadra.id });
    }
  });

  // Due redattori associati a una squadra: possono gestirne gli eventi
  righe.push({ utenteId: redattori[0].id, squadraId: sportive[0].id });
  righe.push({ utenteId: redattori[1].id, squadraId: sportive[3].id });

  // Uno stesso accostamento può ripetersi: l'unicità è in tabella
  await db.insert(associazioniSquadra).values(righe).onConflictDoNothing();
  console.log(`Collegati allenatori e redattori alle squadre (${righe.length} accostamenti).`);
}

async function creaRichieste(db, creati, listaSquadre) {
  const atleti = creati.filter((u) => u.ruolo === "atleta");
  const decisori = creati.filter((u) => u.ruolo === "segreteria" || u.ruolo === "coach");
  const sportive = listaSquadre.filter((s) => s.sport !== "Societa");

  const SPORT = ["Calcio", "Pallavolo", "Basket"];
  const righe = [];

  for (const atleta of atleti) {
    const sport = scelta(SPORT);

    // Chi è "in_attesa" ha una richiesta ancora da decidere: è il caso più
    // importante, perché è quello che riempie la schermata delle richieste.
    if (atleta.stato === "in_attesa") {
      righe.push({
        utenteId: atleta.id,
        sport,
        squadraId: null,
        stato: "in_attesa",
        richiestaIl: giorniFa(intero(0, 45))
      });
      continue;
    }

    const suoSport = sportive.filter((s) => s.sport === sport);
    const squadra = suoSport.length ? scelta(suoSport) : sportive[0];
    const rifiutata = Math.random() < 0.15;

    righe.push({
      utenteId: atleta.id,
      sport: rifiutata ? sport : squadra.sport,
      squadraId: rifiutata ? null : squadra.id,
      stato: rifiutata ? "rifiutata" : "approvata",
      richiestaIl: giorniFa(intero(30, 300)),
      decisaDa: scelta(decisori).id,
      decisaIl: giorniFa(intero(1, 29)),
      motivoRifiuto: rifiutata
        ? scelta([
            "Non risulta fra i tesserati di questa stagione.",
            "Ha chiesto il calcio ma gioca a pallavolo: si registri di nuovo.",
            "Doppione: ha già un account con un'altra email. Contattare la segreteria per unirli, perché al momento risultano due persone distinte e le presenze finiscono divise fra i due."
          ])
        : null
    });
  }

  /*
   * Qualcuno che fa due sport.
   *
   * In Polisportiva succede — il ragazzo che gioca a calcio e d'inverno
   * fa pallavolo — e senza almeno un caso così nei dati di prova la
   * schermata che distingue le due squadre non la si vede mai, e quindi
   * non la si controlla mai.
   */
  const accolte = righe.filter((r) => r.stato === "approvata");

  for (const r of accolte.slice(0, 4)) {
    const altroSport = sportive.filter((s) => s.sport !== r.sport);
    if (altroSport.length === 0) continue;

    const seconda = scelta(altroSport);

    righe.push({
      utenteId: r.utenteId,
      sport: seconda.sport,
      squadraId: seconda.id,
      stato: "approvata",
      richiestaIl: giorniFa(intero(30, 300)),
      decisaDa: scelta(decisori).id,
      decisaIl: giorniFa(intero(1, 29)),
      motivoRifiuto: null
    });
  }

  await db.insert(richiesteIscrizione).values(righe);

  const perStato = righe.reduce((acc, r) => ({ ...acc, [r.stato]: (acc[r.stato] || 0) + 1 }), {});
  console.log(`Create ${righe.length} richieste:`, perStato);

  // Le accolte sono l'elenco di chi sta in squadra: è da lì che nascono le
  // schede, i certificati e le quote.
  return righe.filter((r) => r.stato === "approvata");
}

/* =====================================================
   Schede degli atleti, certificati e quote
   ===================================================== */

/** Dalla data al formato "2026-05-14" che vuole una colonna date. */
const soloData = (d) => d.toISOString().slice(0, 10);
const fraGiorni = (giorni) => soloData(new Date(Date.now() + giorni * 86400000));

/**
 * Le schede, con dentro i casi che la segreteria deve distinguere a colpo
 * d'occhio: certificati scaduti, in scadenza fra due settimane, mai
 * consegnati; quote saldate, a metà, non ancora decise.
 *
 * Le proporzioni sono volutamente sbilanciate verso i guai: una schermata in
 * cui va tutto bene non dice se i guai si vedrebbero.
 */
/* I mesi come li scrive un codice fiscale: A gennaio, B febbraio, e
   avanti saltando le lettere che si confondono leggendo. */
const MESI_CF = "ABCDEHLMPRST";
const CONSONANTI = "BCDFGHLMNPRSTVZ";

/**
 * Un codice fiscale finto ma FATTO BENE: forma giusta e carattere di
 * controllo che torna.
 *
 * Sedici caratteri a caso sarebbero bastati finché il codice fiscale
 * serviva solo a riempire una casella. Adesso con un codice fiscale si
 * cerca il fratello o la sorella già iscritti, e una prova in cui nessun
 * codice fiscale è valido è una prova in cui quella funzione non si può
 * nemmeno provare.
 *
 * "L219" è Torino. Le sei lettere iniziali sono consonanti a caso e non
 * ricavate da nome e cognome: qui servono dati verosimili, non persone
 * rintracciabili.
 */
function codiceFiscaleFinto(nascita) {
  const lettere = Array.from({ length: 6 }, () => scelta([...CONSONANTI])).join("");
  const anno = String(nascita.getFullYear()).slice(2);
  const mese = MESI_CF[nascita.getMonth()];
  const giorno = String(nascita.getDate()).padStart(2, "0");

  const primi15 = `${lettere}${anno}${mese}${giorno}L219`;
  return primi15 + carattereDiControllo(primi15);
}

async function creaSchede(db, richiesteApprovate) {
  const schede = [];
  const versamenti = [];
  const iscrizioni = [];

  /* La quota e i versamenti sono della stagione, non della persona: tutto
     quello che segue va sulla stagione in corso. */
  const stagione = await stagioneCorrente();

  /*
   * Una scheda per PERSONA, non per richiesta.
   *
   * Chi gioca a calcio e d'inverno fa pallavolo ha due richieste accolte
   * ma una sola anagrafica, e la tabella lo impone con un indice unico su
   * utente_id. Senza questa riga, i quattro atleti multi-sport che il
   * seminatore crea apposta facevano fallire l'inserimento di TUTTE le
   * schede insieme — e siccome le richieste doppie sono state aggiunte
   * dopo l'ultima semina, il guasto è rimasto invisibile finché non si è
   * riempito un database nuovo.
   */
  const perPersona = [...new Map(
    richiesteApprovate.map((r) => [r.utenteId, r])
  ).values()];

  for (const r of perPersona) {
    const sorte = Math.random();

    // Uno su sei non ha proprio la scheda: è l'atleta appena inserito, che
    // nessuno ha ancora registrato. Deve comparire lo stesso nell'elenco.
    if (sorte < 0.17) {
      iscrizioni.push({ utenteId: r.utenteId, stagioneId: stagione.id, quotaCentesimi: null });
      continue;
    }

    // Scadenza del certificato: un pezzo scaduto, un pezzo vicino
    const scadenza =
      sorte < 0.34 ? fraGiorni(-intero(1, 200)) :
      sorte < 0.5 ? fraGiorni(intero(0, 28)) :
      fraGiorni(intero(40, 330));

    const nascita = new Date();
    nascita.setFullYear(nascita.getFullYear() - intero(8, 42));
    nascita.setMonth(intero(0, 11), intero(1, 28));

    const minorenne = new Date().getFullYear() - nascita.getFullYear() < 18;
    const quota = scelta([15000, 20000, 25000, 30000, 35000, null]);

    // Un minore su tre ha anche il secondo contatto
    const secondoContatto = minorenne && intero(0, 2) === 0;

    schede.push({
      utenteId: r.utenteId,
      dataNascita: soloData(nascita),
      codiceFiscale: codiceFiscaleFinto(nascita),
      luogoNascita: scelta(["Torino", "Rivoli", "Collegno", "Moncalieri", "Chieri"]),
      telefono: `3${intero(20, 49)} ${intero(1000000, 9999999)}`,
      indirizzo: `Via ${scelta(COGNOMI)} ${intero(1, 140)}, Torino`,
      // Il tutore solo per i minori: è lì che serve davvero
      tutoreNome: minorenne ? `${scelta(NOMI)} ${scelta(COGNOMI)}` : null,
      tutoreParentela: minorenne ? scelta(["Madre", "Padre"]) : null,
      tutoreTelefono: minorenne ? `3${intero(20, 49)} ${intero(1000000, 9999999)}` : null,

      /* Il secondo contatto solo a una parte dei minori, non a tutti:
         serve a vedere la scheda in tutte e due le forme, con e senza.
         Una prova in cui ce l'hanno tutti nasconde proprio il caso che
         si voleva guardare.

         Le colonne ci sono sempre, anche quando sono nulle: le righe si
         inseriscono tutte insieme, e una riga con meno chiavi delle
         altre è il modo di ritrovarsi i dati nella colonna sbagliata. */
      tutore2Nome: secondoContatto ? `${scelta(NOMI)} ${scelta(COGNOMI)}` : null,
      tutore2Parentela: secondoContatto ? scelta(["Padre", "Nonna", "Nonno", "Zia"]) : null,
      tutore2Telefono: secondoContatto ? `3${intero(20, 49)} ${intero(1000000, 9999999)}` : null,
      tipoCertificato: scelta(["agonistico", "non_agonistico"]),
      certificatoScadenza: scadenza,

      // Il file resta scollegato in tutti i casi: senza un archivio dove
      // metterlo, fingere che ci sia renderebbe la schermata più ottimista
      // di com'è. "Scadenza registrata ma copia mai consegnata" è per ora
      // la situazione di tutti, ed è anche quella che va vista.
      certificatoMediaId: null,

      note: Math.random() < 0.15
        ? scelta([
            "Allergia alle arachidi, l'adrenalina è nello zaino.",
            "Lavora su turni: agli allenamenti del giovedì arriva tardi.",
            "Il fratello gioca negli Allievi, stessa email di contatto."
          ])
        : null
    });

    iscrizioni.push({ utenteId: r.utenteId, stagioneId: stagione.id, quotaCentesimi: quota });

    if (quota == null) continue;

    /* I versamenti: chi ha saldato in una volta, chi è fermo all'acconto,
       chi non ha ancora versato niente. */
    const quanto = Math.random();

    if (quanto < 0.25) continue;

    if (quanto < 0.55) {
      versamenti.push({
        utenteId: r.utenteId,
        importoCentesimi: Math.round(quota * 0.4),
        causale: "Acconto iscrizione",
        pagatoIl: soloData(giorniFa(intero(60, 200))),
        stagioneId: stagione.id,
        metodo: scelta(["bonifico", "contanti"])
      });
      continue;
    }

    if (Math.random() < 0.5) {
      versamenti.push({
        utenteId: r.utenteId,
        importoCentesimi: quota,
        causale: "Quota stagionale",
        pagatoIl: soloData(giorniFa(intero(30, 220))),
        stagioneId: stagione.id,
        metodo: scelta(["bonifico", "pos", "contanti"])
      });
    } else {
      const acconto = Math.round(quota / 2);
      versamenti.push(
        {
          utenteId: r.utenteId,
          importoCentesimi: acconto,
          causale: "Acconto iscrizione",
          pagatoIl: soloData(giorniFa(intero(150, 250))),
          stagioneId: stagione.id,
          metodo: "bonifico"
        },
        {
          utenteId: r.utenteId,
          importoCentesimi: quota - acconto,
          causale: "Saldo",
          pagatoIl: soloData(giorniFa(intero(20, 140))),
          stagioneId: stagione.id,
          metodo: scelta(["bonifico", "pos"])
        }
      );
    }
  }

  /* Due fratelli veri dentro ai dati di prova.

     Senza una coppia che abita allo stesso indirizzo, la tariffa agevolata
     per fratelli non si può nemmeno guardare: lo stesso tetto è una delle
     due cose che il sito confronta prima di far decidere la segreteria. */
  const famiglie = [];

  for (let i = 0; i + 1 < schede.length && famiglie.length < 2; i += 2) {
    const [uno, due] = [schede[i], schede[i + 1]];
    due.indirizzo = uno.indirizzo;
    famiglie.push([uno, due]);
  }

  if (schede.length) await db.insert(schedeAtleta).values(schede);
  if (versamenti.length) await db.insert(pagamenti).values(versamenti);

  /* Due ritirati, per vedere il segno negli elenchi e la seconda metà che
     non è più dovuta: la stagione è appena cominciata, quindi entrambi
     prima di gennaio. */
  for (const i of iscrizioni.filter((x) => x.quotaCentesimi != null).slice(-2)) {
    const giorno = giorniFa(intero(3, 20));
    const data = soloData(giorno) < stagione.inizio ? oggiRoma() : soloData(giorno);
    Object.assign(i, { stato: "ritirata", ritiratoIl: data, motivoRitiro: "Si è trasferito in un'altra città" });
  }

  /* Una stagione passata per qualcuno: senza, lo storico della scheda non
     si può nemmeno guardare. Saldata per intero, con la squadra di allora. */
  const [anno] = stagione.inizio.split("-").map(Number);
  const scorsa = await stagionePer(`${anno - 1}-09-01`);
  const veterani = iscrizioni.slice(0, 6);
  if (veterani.length) {
    await db.insert(iscrizioniStagione).values(veterani.map((v) => ({
      utenteId: v.utenteId,
      stagioneId: scorsa.id,
      quotaCentesimi: 20000,
      squadre: sql`'[{"id":0,"nome":"Squadra della stagione scorsa","sport":"calcio"}]'::jsonb`
    })));
    await db.insert(pagamenti).values(veterani.map((v) => ({
      utenteId: v.utenteId,
      stagioneId: scorsa.id,
      importoCentesimi: 20000,
      causale: "Quota stagionale",
      pagatoIl: `${anno - 1}-10-15`,
      metodo: "bonifico"
    })));
  }

  if (iscrizioni.length) {
    await db.insert(iscrizioniStagione).values(iscrizioni.map((i) => ({
      stato: "attiva", ritiratoIl: null, motivoRitiro: null, ...i
    })));

    // Le squadre di oggi, fotografate sulla stagione in corso
    await db.execute(sql`
      UPDATE iscrizioni_stagione i SET squadre = coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', sq.id, 'nome', sq.nome, 'sport', sq.sport) ORDER BY sq.ordine)
        FROM richieste_iscrizione r JOIN squadre sq ON sq.id = r.squadra_id
        WHERE r.utente_id = i.utente_id AND r.stato = 'approvata'
      ), '[]'::jsonb)
      WHERE i.stagione_id = ${stagione.id}`);
  }

  const parentele = famiglie.map(([uno, due]) => ({
    utenteId: uno.utenteId,
    stagioneId: stagione.id,
    codiceFiscaleDichiarato: due.codiceFiscale,
    utenteCollegatoId: due.utenteId
  }));

  /* Una dichiarazione che non trova nessuno: succede davvero — un codice
     fiscale battuto male, oppure un fratello che non si e ancora iscritto
     — e sono due cose diverse che solo una persona sa distinguere. */
  if (schede.length > 4) {
    parentele.push({
      utenteId: schede[4].utenteId,
      stagioneId: stagione.id,
      codiceFiscaleDichiarato: "BNCLRA05T41L219V",
      utenteCollegatoId: null
    });
  }

  if (parentele.length) {
    await db.insert(legamiFamiliari).values(parentele);
    console.log(`Dichiarate ${parentele.length} parentele, da controllare in segreteria.`);
  }

  const totale = versamenti.reduce((s, v) => s + v.importoCentesimi, 0);
  console.log(
    `Create ${schede.length} schede e ${versamenti.length} versamenti ` +
    `(${(totale / 100).toFixed(2)} € incassati).`
  );
}

/* =====================================================
   Eventi
   ===================================================== */

async function creaEventi(db, creati, listaSquadre) {
  const sportive = listaSquadre.filter((s) => s.sport !== "Societa");
  const societa = listaSquadre.filter((s) => s.sport === "Societa");
  const autore = creati[0];

  const righe = [];

  for (const squadra of sportive) {
    // Passate, con risultato
    for (let i = 0; i < 8; i++) {
      const inizio = giorniFa(intero(7, 200));
      inizio.setHours(intero(9, 20), scelta([0, 15, 30, 45]), 0, 0);

      const volley = squadra.sport === "Pallavolo";

      righe.push({
        squadraId: squadra.id,
        tipo: "partita",
        titolo: `[prova] ${squadra.nome} - ${scelta(AVVERSARI)}`,
        avversario: scelta(AVVERSARI),
        inizio,
        fine: new Date(inizio.getTime() + 2 * 3600000),
        tuttoIlGiorno: false,
        luogo: scelta(LUOGHI),
        risultato: volley ? `${intero(0, 3)} - ${intero(0, 3)}` : `${intero(0, 6)} - ${intero(0, 4)}`,
        parziali: volley
          ? "25-20, 23-25, 25-18, 19-25, 15-12"
          : null,
        // Una partita con molti marcatori: l'elenco deve andare a capo
        marcatori: Array.from({ length: intero(0, 9) }, () => scelta(COGNOMI)),
        diretta: Math.random() < 0.2 ? "https://www.youtube.com/watch?v=esempio" : null,
        creatoDa: autore.id
      });
    }

    // Future, senza risultato
    for (let i = 0; i < 6; i++) {
      const inizio = new Date(Date.now() + intero(1, 120) * 86400000);
      inizio.setHours(intero(9, 20), scelta([0, 30]), 0, 0);

      righe.push({
        squadraId: squadra.id,
        tipo: scelta(["partita", "partita", "allenamento", "torneo"]),
        titolo: `[prova] ${squadra.nome} - ${scelta(AVVERSARI)}`,
        avversario: scelta(AVVERSARI),
        inizio,
        fine: new Date(inizio.getTime() + 2 * 3600000),
        tuttoIlGiorno: false,
        luogo: scelta(LUOGHI),
        creatoDa: autore.id
      });
    }
  }

  // Appuntamenti di società, compreso uno con la deroga sullo sport
  for (const gruppo of societa) {
    for (let i = 0; i < 5; i++) {
      const inizio = new Date(Date.now() + intero(-60, 90) * 86400000);
      const tuttoIlGiorno = i % 2 === 0;
      if (!tuttoIlGiorno) inizio.setHours(intero(17, 21), 0, 0, 0);

      righe.push({
        squadraId: gruppo.id,
        tipo: scelta(["riunione", "evento", "altro"]),
        sport: i === 0 ? "Calcio" : null,
        titolo: i === 0
          ? "[prova] Cena della sezione calcio"
          : `[prova] ${scelta(["Assemblea soci", "Consiglio direttivo", "Festa di fine anno", "Open day"])}`,
        inizio,
        fine: null,
        tuttoIlGiorno,
        luogo: scelta(LUOGHI),
        descrizione: i === 1
          ? "Una descrizione volutamente lunga, per vedere come si comporta la scheda quando qualcuno incolla mezzo verbale dentro alle note dell'evento invece di allegare il documento, cosa che succede sempre."
          : null,
        creatoDa: autore.id
      });
    }
  }

  await db.insert(eventi).values(righe);
  console.log(`Creati ${righe.length} eventi.`);
}

/* =====================================================
   Le tariffe della stagione
   ===================================================== */

/**
 * Il listino che l'amministratore decide e la segreteria applica.
 *
 * Senza, la pagina "Quote" è vuota e sulla scheda di un atleta non c'è
 * niente da scegliere: si vede un pannello che sembra rotto invece di uno
 * che funziona. Gli importi sono verosimili ma inventati, come tutto il
 * resto qui dentro.
 */
async function creaTariffe(db) {
  const listino = [
    { nome: "Prima iscrizione", descrizione: "Chi si iscrive per la prima volta", importoCentesimi: 25000, ordine: 1 },
    { nome: "Rinnovo", descrizione: "Chi c'era anche l'anno scorso", importoCentesimi: 20000, ordine: 2 },
    { nome: "Fratello o sorella", descrizione: "Dal secondo figlio iscritto", importoCentesimi: 15000, ordine: 3 },
    { nome: "Minivolley", descrizione: "Corso propedeutico, un allenamento a settimana", importoCentesimi: 12000, ordine: 4 },
    { nome: "Solo tesseramento", descrizione: "Chi si allena altrove e gioca con noi", importoCentesimi: 5000, ordine: 5 },

    /* L'unica che si assegna da sola: la prende ogni allenatore la prima
       volta che apre la propria iscrizione. Il contrassegno "perAllenatori"
       e quello che la distingue, non il nome. */
    { nome: "Allenatori", descrizione: "Chi allena: quota fissa, uguale per tutti", importoCentesimi: 1000, ordine: 6, perAllenatori: true }
  ];

  /* Si rifanno a ogni giro come l'admin di prova: il seminatore deve
     poter girare due volte senza lasciare doppioni. */
  await db.delete(tipiQuota);
  await db.insert(tipiQuota).values(listino);

  console.log(`Create ${listino.length} tariffe.`);
}

/* =====================================================
   Esecuzione
   ===================================================== */

async function main() {
  verificaCheSiaLocale();

  const db = getDb();

  await pulisci(db);
  if (soloPulisci) return;

  // L'admin di prova si rifà a ogni giro
  await db.delete(utenti).where(eq(utenti.email, "admin@admin.it"));

  const listaSquadre = await db
    .select({ id: squadre.id, nome: squadre.nome, sport: squadre.sport })
    .from(squadre);

  if (listaSquadre.length === 0) {
    throw new Error("Non ci sono squadre. Lancia prima scripts/semina-squadre.mjs.");
  }

  await creaTariffe(db);

  const creati = await creaUtenti(db);
  await collegaAllenatori(db, creati, listaSquadre);
  const approvate = await creaRichieste(db, creati, listaSquadre);
  await creaSchede(db, approvate);
  await creaEventi(db, creati, listaSquadre);

  console.log("\n✅ Fatto.");
  console.log("   Accesso comodo:  admin@admin.it  /  admin");
  console.log(`   Tutti gli altri: qualsiasi indirizzo @${DOMINIO}  /  ${PASSWORD_COMUNE}`);
  console.log("\n   Per ripulire:    node --env-file=.env scripts/semina-dati-prova.mjs --pulisci");
}

main()
  .catch((e) => {
    console.error("\n❌", e.message);
    process.exitCode = 1;
  })
  .finally(() => chiudiDb());
