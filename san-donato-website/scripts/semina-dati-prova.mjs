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
 * Uso:
 *   node --env-file=.env scripts/semina-dati-prova.mjs
 *   node --env-file=.env scripts/semina-dati-prova.mjs --pulisci
 */

import { eq, like, inArray } from "drizzle-orm";
import { getDb, chiudiDb } from "../db/client.js";
import {
  utenti, squadre, eventi, richiesteIscrizione, associazioniSquadra
} from "../db/schema.js";
import { creaHashPassword } from "../server/password.js";

/* Tutti gli account finti finiscono su questo dominio: è così che si
   riconoscono e si cancellano senza toccare quelli veri. */
const DOMINIO = "prova.psd";
const PASSWORD_COMUNE = "provapsd2026";

const soloPulisci = process.argv.includes("--pulisci");

/* =====================================================
   Sicurezza
   ===================================================== */

function verificaCheSiaLocale() {
  const url = process.env.DATABASE_URL ?? "";
  const locale = /@(localhost|127\.0\.0\.1)[:/]/.test(url);

  if (!locale) {
    throw new Error(
      "DATABASE_URL non punta a un database locale.\n" +
      "   Questo script crea un account admin/admin e centinaia di righe finte:\n" +
      "   non deve poter toccare un database vero."
    );
  }
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

  await db.insert(richiesteIscrizione).values(righe);

  const perStato = righe.reduce((acc, r) => ({ ...acc, [r.stato]: (acc[r.stato] || 0) + 1 }), {});
  console.log(`Create ${righe.length} richieste:`, perStato);
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

  const creati = await creaUtenti(db);
  await collegaAllenatori(db, creati, listaSquadre);
  await creaRichieste(db, creati, listaSquadre);
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
