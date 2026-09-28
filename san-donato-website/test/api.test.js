import { describe, it, expect, beforeAll } from "vitest";

/**
 * Prove contro l'API vera, con il database vero.
 *
 * Gli altri file provano funzioni singole. Qui si prova la cosa che
 * riguarda davvero il cliente: che, entrando con un certo account, dalla
 * rete arrivi soltanto quello che quell'account può vedere.
 *
 * È la differenza fra "il coach non vede le quote" e "il coach non le
 * riceve nemmeno". Nascondere una colonna nella schermata lascia il dato
 * nella risposta, e chiunque apra gli strumenti del browser se lo legge:
 * questi test guardano il JSON, non i pixel.
 *
 * SI SALTANO DA SOLI se l'API di sviluppo non è accesa, invece di fallire:
 * `npm test` deve poter girare anche senza Docker avviato — su una macchina
 * dove non c'è nulla in ascolto, un test rosso non segnalerebbe un difetto
 * del sito ma solo che manca un servizio.
 *
 * Per farli girare:  docker compose up -d  &&  npm run dev:api
 */

const BASE = process.env.API_PROVA || "http://localhost:3001/api";

const CONTI = {
  admin: { email: "admin@admin.it", password: "admin" },
  // Uno dei coach creati da scripts/semina-dati-prova.mjs, con squadre
  // assegnate: "coach@prova.local" è più vecchio e ha una password sua.
  coach: { email: "p012@prova.psd", password: "provapsd2026" },
  atleta: { email: "p051@prova.psd", password: "provapsd2026" },
  segreteria: { email: "p001@prova.psd", password: "provapsd2026" }
};

let apiAccesa = false;

/** Fa una richiesta tenendosi il cookie di sessione, come farebbe un browser. */
function sessione() {
  let cookie = "";

  return async function chiedi(percorso, opzioni = {}) {
    const risposta = await fetch(`${BASE}${percorso}`, {
      ...opzioni,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...opzioni.headers
      }
    });

    const arrivato = risposta.headers.getSetCookie?.() ?? [];
    if (arrivato.length) cookie = arrivato.map((c) => c.split(";")[0]).join("; ");

    const testo = await risposta.text();
    let corpo;
    try { corpo = testo ? JSON.parse(testo) : null; } catch { corpo = testo; }

    return { stato: risposta.status, corpo };
  };
}

async function entra(chi) {
  const chiedi = sessione();
  const esito = await chiedi("/accesso", {
    method: "POST",
    body: JSON.stringify(CONTI[chi])
  });

  if (esito.stato !== 200) {
    throw new Error(`Accesso fallito come ${chi}: ${esito.stato} ${JSON.stringify(esito.corpo)}`);
  }

  return { chiedi, utente: esito.corpo.utente };
}

beforeAll(async () => {
  try {
    const risposta = await fetch(`${BASE}/io`, { signal: AbortSignal.timeout(2000) });
    apiAccesa = risposta.ok;
  } catch {
    apiAccesa = false;
  }

  if (!apiAccesa) {
    console.warn(
      `\n  API non raggiungibile su ${BASE}: le prove di integrazione vengono saltate.`
      + "\n  Per eseguirle:  docker compose up -d  &&  npm run dev:api\n"
    );
  }
});

const seAccesa = (nome, prova) => it(nome, async (contesto) => {
  if (!apiAccesa) return contesto.skip();
  await prova();
});

describe("accesso", () => {
  seAccesa("credenziali sbagliate danno 401, non un errore di sessione", async () => {
    const chiedi = sessione();
    const esito = await chiedi("/accesso", {
      method: "POST",
      body: JSON.stringify({ email: CONTI.admin.email, password: "sbagliata" })
    });

    expect(esito.stato).toBe(401);
    // Il messaggio non deve distinguere "email inesistente" da "password
    // sbagliata": distinguerli direbbe a chiunque quali indirizzi esistono.
    expect(esito.corpo.errore).toMatch(/non corretti/i);
  });

  seAccesa("senza sessione /api/io risponde 200 con nessuno", async () => {
    // 200 e non 401: "non sei entrato" è una risposta legittima a questa
    // domanda, e il front-end la fa a ogni avvio.
    const chiedi = sessione();
    const esito = await chiedi("/io");

    expect(esito.stato).toBe(200);
    expect(esito.corpo.utente).toBeNull();
  });
});

describe("l'allenatore e le quote", () => {
  seAccesa("nell'elenco degli atleti non riceve nessun importo", async () => {
    const { chiedi } = await entra("coach");
    const esito = await chiedi("/admin/atleti");

    expect(esito.stato).toBe(200);
    expect(esito.corpo.atleti.length).toBeGreaterThan(0);

    for (const atleta of esito.corpo.atleti) {
      // Non "è nullo": proprio assente. Il taglio è sul server.
      expect("quotaStagionaleCentesimi" in atleta, atleta.nomeCompleto).toBe(false);
      expect("versatoCentesimi" in atleta, atleta.nomeCompleto).toBe(false);
    }
  });

  seAccesa("vede solo gli atleti delle proprie squadre", async () => {
    const { chiedi } = await entra("coach");
    const suoi = await chiedi("/admin/atleti");

    const { chiedi: chiediAdmin } = await entra("admin");
    const tutti = await chiediAdmin("/admin/atleti");

    expect(suoi.corpo.atleti.length).toBeLessThan(tutti.corpo.atleti.length);
  });

  seAccesa("la scheda di un atleta che non è suo non esiste", async () => {
    const { chiedi: chiediAdmin } = await entra("admin");
    const tutti = await chiediAdmin("/admin/atleti");

    const { chiedi } = await entra("coach");
    const suoi = await chiedi("/admin/atleti");
    const idSuoi = new Set(suoi.corpo.atleti.map((a) => a.utenteId));

    const estraneo = tutti.corpo.atleti.find((a) => !idSuoi.has(a.utenteId));
    expect(estraneo, "servono atleti fuori dalle squadre del coach").toBeTruthy();

    const esito = await chiedi(`/admin/atleti/${estraneo.utenteId}`);
    expect([403, 404]).toContain(esito.stato);
  });
});

describe("chi vede i dati non li modifica", () => {
  seAccesa("nemmeno l'amministratore riscrive l'anagrafica di un atleta", async () => {
    const { chiedi } = await entra("admin");
    const elenco = await chiedi("/admin/atleti");
    const qualcuno = elenco.corpo.atleti[0];

    const esito = await chiedi(`/admin/atleti/${qualcuno.utenteId}`, {
      method: "PATCH",
      body: JSON.stringify({ telefono: "3330000000", codiceFiscale: "RSSMRA80A01L219X" })
    });

    // O rifiuta la richiesta, o accetta ignorando i campi vietati: quello
    // che non deve succedere è che il dato cambi.
    if (esito.stato === 200) {
      const dopo = await chiedi(`/admin/atleti/${qualcuno.utenteId}`);
      expect(dopo.corpo.atleta.telefono).not.toBe("3330000000");
      expect(dopo.corpo.atleta.codiceFiscale).not.toBe("RSSMRA80A01L219X");
    } else {
      expect([400, 403]).toContain(esito.stato);
    }
  });
});

describe("l'atleta", () => {
  seAccesa("vede i propri conti ma non quelli degli altri", async () => {
    const { chiedi } = await entra("atleta");

    const mia = await chiedi("/iscrizione");
    expect(mia.stato).toBe(200);
    expect(mia.corpo.iscrizione).toHaveProperty("versatoCentesimi");

    // L'elenco degli atleti non è roba sua: non ha "atleti.leggi".
    const altrui = await chiedi("/admin/atleti");
    expect(altrui.stato).toBe(403);
  });

  seAccesa("è iscritto dal giorno del primo versamento", async () => {
    const { chiedi } = await entra("atleta");
    const mia = await chiedi("/iscrizione");

    const versamenti = mia.corpo.iscrizione.pagamenti;
    if (versamenti.length === 0) return; // niente versamenti, niente data

    expect(mia.corpo.iscrizione.iscrittoDal).toBe(versamenti[0].pagatoIl);
  });
});

describe("notizie pubbliche", () => {
  seAccesa("l'elenco pubblico non contiene bozze né cestinate", async () => {
    const chiedi = sessione();
    const esito = await chiedi("/notizie?perPagina=50");

    expect(esito.stato).toBe(200);
    for (const notizia of esito.corpo.notizie) {
      expect(notizia.stato).toBe("pubblicata");
      // Pubblicata ma con data nel futuro vorrebbe dire programmata, e
      // programmata vuol dire che sul sito non ci deve ancora essere.
      expect(new Date(notizia.pubblicataIl).getTime()).toBeLessThanOrEqual(Date.now());
    }
  });

  seAccesa("il filtro per etichetta vuole un identificativo", async () => {
    const chiedi = sessione();
    const ok = await chiedi("/notizie?etichetta=1");
    expect(ok.stato).toBe(200);
    // Ogni notizia porta le sue etichette, anche vuote
    for (const n of ok.corpo.notizie) expect(Array.isArray(n.etichette)).toBe(true);
    expect((await chiedi("/notizie?etichetta=gossip")).stato).toBe(400);
  });
});

describe("libreria dei file", () => {
  seAccesa("non contiene certificati medici né foto del profilo", async () => {
    const { chiedi } = await entra("admin");
    const esito = await chiedi("/admin/media?perPagina=60");

    expect(esito.stato).toBe(200);

    for (const file of esito.corpo.media) {
      /*
       * Sono file sanitari di minorenni e ritratti personali: si guardano
       * uno alla volta da dove appartengono, non in una galleria.
       *
       * Il controllo è sull'INDIRIZZO e non sulla cartella mostrata a
       * schermo: quella è un'etichetta che chiunque può rinominare, mentre
       * il pezzo di percorso dentro all'archivio lo decide il server nel
       * momento in cui il file viene caricato, e non cambia più.
       */
      expect(file.url ?? "", `${file.id} non doveva essere in libreria`)
        .not.toMatch(new RegExp("/(certificati|profili)/"));
    }
  });

  seAccesa("un atleta non la sfoglia affatto", async () => {
    // Ha "media.carica" per il proprio certificato: caricare un file e
    // sfogliare l'archivio della società sono due cose diverse.
    const { chiedi } = await entra("atleta");
    expect((await chiedi("/admin/media")).stato).toBe(403);
  });

  seAccesa("un allenatore vede solo i file che ha caricato lui", async () => {
    /*
     * L'allenatore ha una libreria sua per le foto e i video della propria
     * squadra. Il taglio è sul server: la sua risposta dichiara "soloMie" e
     * non porta l'elenco di chi altro carica, che non lo riguarda.
     */
    const { chiedi: daCoach } = await entra("coach");
    const sua = await daCoach("/admin/media");

    expect(sua.stato).toBe(200);
    expect(sua.corpo.soloMie).toBe(true);
    expect(sua.corpo.persone).toBeUndefined();

    const { chiedi: daAdmin } = await entra("admin");
    const tutta = await daAdmin("/admin/media");

    expect(tutta.corpo.soloMie).toBe(false);
    expect(tutta.corpo.totale).toBeGreaterThan(sua.corpo.totale);
  });

  seAccesa("un allenatore non tocca i file di un altro", async () => {
    const { chiedi: daAdmin } = await entra("admin");
    const tutta = await daAdmin("/admin/media");

    const { chiedi: daCoach } = await entra("coach");
    const sua = await daCoach("/admin/media");
    const suoi = new Set(sua.corpo.media.map((m) => m.id));

    const altrui = tutta.corpo.media.find((m) => !suoi.has(m.id));
    expect(altrui, "serve almeno un file non suo").toBeTruthy();

    const esito = await daCoach(`/admin/media/${altrui.id}`, {
      method: "PATCH",
      body: JSON.stringify({ titolo: "non dovrei" })
    });

    expect(esito.stato).toBe(403);
  });

  seAccesa("le etichette si ripuliscono da sole", async () => {
    const { chiedi } = await entra("admin");
    const elenco = await chiedi("/admin/media?perPagina=1");
    const file = elenco.corpo.media[0];

    const prima = file.tag;

    const dopo = await chiedi(`/admin/media/${file.id}`, {
      method: "PATCH",
      body: JSON.stringify({ tag: ["  Natale ", "NATALE", "feste", ""] })
    });

    // Minuscole, senza spazi ai bordi, senza doppioni e senza vuoti.
    expect(dopo.corpo.media.tag).toEqual(["natale", "feste"]);

    // Rimesso com'era: i test non devono lasciare in giro etichette finte.
    await chiedi(`/admin/media/${file.id}`, {
      method: "PATCH",
      body: JSON.stringify({ tag: prima })
    });
  });
});

describe("partite ed eventi", () => {
  seAccesa("un allenatore mette a calendario solo partite", async () => {
    /*
     * Assemblee, feste e chiusure della sede sono cose della società: le
     * decide chi la amministra. Il controllo è sul server perché i campi
     * che a schermo non ci sono si mandano comunque a mano.
     */
    const { chiedi } = await entra("coach");
    const elenco = await chiedi("/admin/eventi?da=2026-01-01T00:00:00Z&a=2026-12-31T00:00:00Z");
    const squadraId = elenco.corpo.squadreAmmesse?.[0];

    expect(squadraId, "il coach di prova deve avere una squadra").toBeTruthy();

    const rifiutato = await chiedi("/admin/eventi", {
      method: "POST",
      body: JSON.stringify({
        squadraId,
        tipo: "riunione",
        titolo: "[prova] Assemblea che non deve nascere",
        inizio: "2026-12-01T18:00:00.000Z"
      })
    });

    expect(rifiutato.stato).toBe(403);
  });

  seAccesa("a una partita dell'allenatore la programmazione viene ignorata", async () => {
    // "Quando si vede sul sito" non ha senso per una partita, e il server
    // la scarta invece di fidarsi del modulo.
    const { chiedi } = await entra("coach");
    const elenco = await chiedi("/admin/eventi?da=2026-01-01T00:00:00Z&a=2026-12-31T00:00:00Z");
    const squadraId = elenco.corpo.squadreAmmesse?.[0];

    const creato = await chiedi("/admin/eventi", {
      method: "POST",
      body: JSON.stringify({
        squadraId,
        tipo: "partita",
        titolo: "[prova] Partita del test",
        inizio: "2026-12-02T18:00:00.000Z",
        visibileDal: "2026-12-01T00:00:00.000Z"
      })
    });

    expect(creato.stato).toBe(201);

    const riletta = await chiedi(`/admin/eventi/${creato.corpo.evento.id}`);
    expect(riletta.corpo.evento.visibileDal).toBeNull();

    // I test non lasciano in giro partite inventate.
    await chiedi(`/admin/eventi/${creato.corpo.evento.id}`, { method: "DELETE" });
  });
});

describe("certificato medico", () => {
  seAccesa("la segreteria lo approva e l'atleta non lo può più cambiare", async () => {
    const { chiedi: daAdmin } = await entra("admin");
    const elenco = await daAdmin("/admin/atleti");

    /* Serve un certificato che scade fra parecchio: il blocco si apre da
       solo negli ultimi tre mesi, e su uno in scadenza non si vedrebbe. */
    const fraMesi = new Date(Date.now() + 300 * 86400000).toISOString().slice(0, 10);

    /*
     * Serve un certificato CON LA COPIA CARICATA, non solo con una data.
     *
     * Approvare quello che non si è potuto guardare è proprio la cosa che
     * il server rifiuta con un 409, quindi un atleta con la sola data farebbe
     * fallire questo test dicendo una cosa vera su un'altra regola.
     *
     * Un database appena seminato non ne ha nessuno — i file di prova li
     * attacca scripts/certificati-di-prova.mjs — e in quel caso questo test
     * non ha niente da provare e lo dice.
     */
    const atleta = elenco.corpo.atleti.find((a) => a.certificatoScadenza && a.certificatoCaricato);

    if (!atleta) {
      console.warn("    (saltato: nessun atleta ha la copia del certificato caricata)");
      return;
    }

    const primaScadenza = atleta.certificatoScadenza;

    await daAdmin(`/admin/atleti/${atleta.utenteId}`, {
      method: "PATCH",
      body: JSON.stringify({ certificatoScadenza: fraMesi })
    });

    // Scriverlo lo riporta "da validare": è il punto di tutto il giro.
    const dopoModifica = await daAdmin(`/admin/atleti/${atleta.utenteId}`);
    expect(dopoModifica.corpo.atleta.certificatoStato).toBe("da_validare");

    const approvato = await daAdmin(`/admin/atleti/${atleta.utenteId}/certificato`, {
      method: "POST",
      body: JSON.stringify({ approva: true })
    });

    expect(approvato.stato).toBe(200);
    expect(approvato.corpo.atleta.certificatoStato).toBe("valido");

    // Rimesso com'era: i test non cambiano i dati della società.
    await daAdmin(`/admin/atleti/${atleta.utenteId}`, {
      method: "PATCH",
      body: JSON.stringify({ certificatoScadenza: primaScadenza })
    });
  });

  seAccesa("respingerlo senza motivo non si può", async () => {
    // "Respinto" e basta costringe la famiglia a telefonare per sapere
    // cosa rifare: è la telefonata che il sito dovrebbe risparmiare.
    const { chiedi } = await entra("admin");
    const elenco = await chiedi("/admin/atleti");
    const atleta = elenco.corpo.atleti.find((a) => a.certificatoScadenza);

    const esito = await chiedi(`/admin/atleti/${atleta.utenteId}/certificato`, {
      method: "POST",
      body: JSON.stringify({ approva: false })
    });

    expect(esito.stato).toBe(400);
  });
});

describe("tariffe della stagione", () => {
  seAccesa("la quota si assegna scegliendo una tariffa", async () => {
    const { chiedi } = await entra("admin");

    const listino = await chiedi("/admin/quote");
    expect(listino.stato).toBe(200);

    const tariffa = listino.corpo.tariffe.find((t) => t.attiva);
    expect(tariffa, "servono tariffe: vedi la sezione Quote").toBeTruthy();

    const elenco = await chiedi("/admin/atleti");
    const atleta = elenco.corpo.atleti[0];
    const primaTariffa = atleta.tipoQuotaId ?? null;

    const esito = await chiedi(`/admin/atleti/${atleta.utenteId}`, {
      method: "PATCH",
      body: JSON.stringify({ tipoQuotaId: tariffa.id })
    });

    expect(esito.stato).toBe(200);
    // L'importo lo copia il server dalla tariffa: chi assegna non lo batte.
    expect(esito.corpo.atleta.quotaStagionaleCentesimi).toBe(tariffa.importoCentesimi);
    expect(esito.corpo.atleta.tipoQuota).toBe(tariffa.nome);

    // Rimesso com'era: i test non cambiano i conti della società.
    await chiedi(`/admin/atleti/${atleta.utenteId}`, {
      method: "PATCH",
      body: JSON.stringify({ tipoQuotaId: primaTariffa })
    });
  });

  seAccesa("una tariffa inventata viene rifiutata", async () => {
    const { chiedi } = await entra("admin");
    const elenco = await chiedi("/admin/atleti");

    const esito = await chiedi(`/admin/atleti/${elenco.corpo.atleti[0].utenteId}`, {
      method: "PATCH",
      body: JSON.stringify({ tipoQuotaId: 999999 })
    });

    expect(esito.stato).toBe(400);
  });

  seAccesa("la segreteria le applica ma non le decide", async () => {
    /*
     * Due mestieri diversi: quanto si paga è una delibera del consiglio,
     * dire chi paga quanto è amministrazione quotidiana.
     */
    const { chiedi } = await entra("segreteria");

    // Leggerle sì: le servono per sceglierle.
    expect((await chiedi("/admin/quote")).stato).toBe(200);

    const creata = await chiedi("/admin/quote", {
      method: "POST",
      body: JSON.stringify({ nome: "Tariffa di prova", importoCentesimi: 100 })
    });

    expect(creata.stato).toBe(403);
  });
});

describe("calendari ufficiali", () => {
  seAccesa("li gestisce solo l'amministratore", async () => {
    /* Decidono cosa entra nel calendario di tutte le squadre: né la
       segreteria né un allenatore, neanche in sola lettura. */
    for (const chi of ["segreteria", "coach", "atleta"]) {
      const { chiedi } = await entra(chi);
      expect((await chiedi("/admin/calendari")).stato, chi).toBe(403);
      expect((await chiedi("/admin/calendari/lettura", { method: "POST", body: "{}" })).stato, chi).toBe(403);
    }

    const { chiedi } = await entra("admin");
    const esito = await chiedi("/admin/calendari");
    expect(esito.stato).toBe(200);
    expect(esito.corpo.formati.map((f) => f.codice)).toContain("uisp_pallavolo");
  });

  seAccesa("una fonte con un collegamento che non è una cartella viene rifiutata", async () => {
    const { chiedi } = await entra("admin");
    const esito = await chiedi("/admin/calendari", {
      method: "POST",
      body: JSON.stringify({
        nome: "Prova", formato: "uisp_pallavolo",
        cartella: "https://example.com/calendario.pdf", nomiNostri: ["Pol. San Donato"]
      })
    });

    expect(esito.stato).toBe(400);
  });

  seAccesa("la lettura notturna non parte senza il segreto giusto", async () => {
    const chiedi = sessione();
    const senza = await chiedi("/cron/calendari");
    const sbagliato = await chiedi("/cron/calendari", { headers: { Authorization: "Bearer sbagliato" } });

    // 503 se il segreto non è configurato, 401 se è sbagliato: mai 200
    expect([401, 503]).toContain(senza.stato);
    expect([401, 503]).toContain(sbagliato.stato);
  });
});

describe("calendario da abbonare", () => {
  seAccesa("ogni squadra ha il suo file iCal, pubblico", async () => {
    const chiedi = sessione();
    const { corpo } = await chiedi("/squadre");
    const squadra = corpo.squadre[0];

    const risposta = await fetch(`${BASE}/calendario/${squadra.id}.ics`);
    expect(risposta.status).toBe(200);
    expect(risposta.headers.get("content-type")).toMatch(/^text\/calendar/);

    const testo = await risposta.text();
    expect(testo.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(testo).toContain(`X-WR-CALNAME:${squadra.nome}`);
  });

  seAccesa("una squadra che non esiste dà 404", async () => {
    expect((await fetch(`${BASE}/calendario/999999.ics`)).status).toBe(404);
    expect((await fetch(`${BASE}/calendario/non-un-numero`)).status).toBe(404);
  });
});

describe("l'allenatore mette a calendario", () => {
  seAccesa("partite e allenamenti delle sue squadre, ma non gli appuntamenti della società", async () => {
    /* Il modulo gli proponeva "Allenamento" e il server lo rifiutava con
       un 403: i due elenchi dei tipi non coincidevano. */
    const { chiedi } = await entra("coach");
    const { corpo } = await chiedi("/admin/eventi");
    const squadraId = corpo.squadreAmmesse[0];

    const nuovo = (tipo) => chiedi("/admin/eventi", {
      method: "POST",
      body: JSON.stringify({
        squadraId, tipo, titolo: `Prova ${tipo}`,
        inizio: new Date(Date.now() + 7 * 86_400_000).toISOString()
      })
    });

    const allenamento = await nuovo("allenamento");
    expect(allenamento.stato).toBe(201);
    expect((await nuovo("riunione")).stato).toBe(403);

    // In ordine: la prova non lascia allenamenti finti nel calendario
    await chiedi(`/admin/eventi/${allenamento.corpo.evento.id}`, { method: "DELETE" });
  });
});

describe("cancellare una squadra", () => {
  seAccesa("si cancella solo una squadra vuota", async () => {
    const { chiedi } = await entra("admin");

    // Vuota: nata adesso, senza partite né iscritti né calendari
    const creata = await chiedi("/admin/squadre", {
      method: "POST",
      body: JSON.stringify({ nome: `Prova cancellazione ${Date.now()}`, sport: "Calcio" })
    });
    expect(creata.stato).toBe(201);
    expect((await chiedi(`/admin/squadre/${creata.corpo.squadra.id}`, { method: "DELETE" })).stato).toBe(200);

    // Con qualcosa dentro: si rifiuta, e dice perché
    const { corpo } = await chiedi("/admin/squadre");
    const piena = corpo.squadre.find((s) => s.eventi > 0 || s.atleti > 0);
    const rifiuto = await chiedi(`/admin/squadre/${piena.id}`, { method: "DELETE" });
    expect(rifiuto.stato).toBe(409);
    expect(rifiuto.corpo.errore).toMatch(/Disattivala/);
  });

  seAccesa("la segreteria non cancella squadre", async () => {
    const { chiedi } = await entra("segreteria");
    expect((await chiedi("/admin/squadre/1", { method: "DELETE" })).stato).toBe(403);
  });
});

describe("allenatori", () => {
  seAccesa("la segreteria li vede tutti, con la quota della stagione", async () => {
    const { chiedi } = await entra("segreteria");
    const esito = await chiedi("/admin/allenatori");

    expect(esito.stato).toBe(200);
    expect(esito.corpo.stagione.nome).toMatch(/^\d{4}\/\d{2}$/);
    expect(esito.corpo.allenatori.length).toBeGreaterThan(0);
    // Aprire l'elenco assegna la quota a chi non l'aveva: nessuno resta senza
    expect(esito.corpo.allenatori.every((a) => a.quotaCentesimi != null)).toBe(true);
  });

  seAccesa("l'allenatore non vede l'elenco della cassa", async () => {
    const { chiedi } = await entra("coach");
    expect((await chiedi("/admin/allenatori")).stato).toBe(403);
  });
});

describe("ritiro durante la stagione", () => {
  seAccesa("segnato e annullato, il conto segue", async () => {
    const { chiedi } = await entra("admin");
    const elenco = await chiedi("/admin/atleti");
    const atleta = elenco.corpo.atleti.find((a) => !a.ritirato && a.quotaStagionaleCentesimi);
    expect(atleta, "serve un atleta con una quota").toBeTruthy();

    const ritirato = await chiedi(`/admin/atleti/${atleta.utenteId}/ritiro`, {
      method: "POST",
      body: JSON.stringify({ motivo: "Prova automatica" })
    });
    expect(ritirato.stato).toBe(200);
    expect(ritirato.corpo.atleta.ritirato).toBe(true);

    // La stagione è appena cominciata: il ritiro è prima di gennaio solo
    // fra luglio e dicembre, e allora la seconda metà non è dovuta.
    const mese = Number(ritirato.corpo.atleta.ritiratoIl.slice(5, 7));
    expect(ritirato.corpo.atleta.conto.secondaDovuta).toBe(mese < 7);

    const annullato = await chiedi(`/admin/atleti/${atleta.utenteId}/ritiro`, { method: "DELETE" });
    expect(annullato.stato).toBe(200);
    expect(annullato.corpo.atleta.ritirato).toBe(false);
  });

  seAccesa("una data futura viene rifiutata", async () => {
    const { chiedi } = await entra("admin");
    const elenco = await chiedi("/admin/atleti");
    const esito = await chiedi(`/admin/atleti/${elenco.corpo.atleti[0].utenteId}/ritiro`, {
      method: "POST",
      body: JSON.stringify({ data: "2099-01-01" })
    });
    expect(esito.stato).toBe(400);
  });
});

describe("stagioni e quote automatiche", () => {
  seAccesa("chi tiene i conti vede i numeri di ogni stagione, l'allenatore solo l'elenco", async () => {
    const segreteria = await entra("segreteria");
    const conti = await segreteria.chiedi("/admin/stagioni");
    expect(conti.stato).toBe(200);
    const inCorso = conti.corpo.stagioni.find((s) => s.inCorso);
    expect(inCorso).toBeTruthy();
    expect(inCorso.quote).toBeTruthy();

    const coach = await entra("coach");
    const elenco = await coach.chiedi("/admin/stagioni");
    expect(elenco.stato).toBe(200);
    expect(elenco.corpo.stagioni[0].quote).toBeUndefined();
  });

  seAccesa("una stagione passata si guarda con le squadre di allora", async () => {
    const { chiedi } = await entra("admin");
    const { corpo } = await chiedi("/admin/stagioni");
    const passata = corpo.stagioni.find((s) => s.passata);
    if (!passata) return; // nessuna stagione passata in questo database

    const atleti = await chiedi(`/admin/atleti?stagione=${passata.id}`);
    expect(atleti.stato).toBe(200);
    expect(atleti.corpo.stagione.id).toBe(passata.id);

    expect((await chiedi("/admin/atleti?stagione=999999")).stato).toBe(404);
  });

  seAccesa("le tariffe automatiche non si cancellano", async () => {
    const { chiedi } = await entra("admin");
    const { corpo } = await chiedi("/admin/quote");
    const automatica = corpo.tariffe.find((t) => t.automatica);
    expect(automatica, "la migrazione 0025 le crea sempre").toBeTruthy();

    const esito = await chiedi(`/admin/quote/${automatica.id}`, { method: "DELETE" });
    expect(esito.stato).toBe(409);
  });
});

describe("abbandono", () => {
  seAccesa("la segreteria lo segna e lo toglie, e il conto segue la regola di gennaio", async () => {
    const { chiedi } = await entra("segreteria");
    const elenco = await chiedi("/admin/atleti");
    const atleta = elenco.corpo.atleti.find((a) => !a.ritirato && !a.abbandonato && a.quotaStagionaleCentesimi);
    expect(atleta, "serve un atleta attivo con una quota").toBeTruthy();

    const segnato = await chiedi(`/admin/atleti/${atleta.utenteId}/abbandono`, { method: "POST" });
    expect(segnato.stato).toBe(200);
    expect(segnato.corpo.atleta.abbandonato).toBe(true);
    // Prima di gennaio: la seconda metà non è dovuta, la prima sì
    expect(segnato.corpo.atleta.conto.secondaDovuta).toBe(new Date().getMonth() < 6 ? true : false);
    expect(segnato.corpo.atleta.conto.dovuto).toBeGreaterThan(0);

    const tolto = await chiedi(`/admin/atleti/${atleta.utenteId}/abbandono`, { method: "DELETE" });
    expect(tolto.stato).toBe(200);
    expect(tolto.corpo.atleta.abbandonato).toBe(false);
  });

  seAccesa("l'allenatore non lo può segnare", async () => {
    const { chiedi } = await entra("coach");
    expect((await chiedi("/admin/atleti/1/abbandono", { method: "POST" })).stato).toBe(403);
  });

  seAccesa("il cron delle stagioni vuole il segreto", async () => {
    const senza = await fetch(`${BASE}/cron/stagioni`);
    expect(senza.status).toBe(401);
  });
});

describe("etichette e cestino delle notizie", () => {
  seAccesa("si crea, si rinomina e si cancella un'etichetta", async () => {
    const { chiedi } = await entra("admin");
    const nome = `Prova ${Date.now()}`;

    const creata = await chiedi("/admin/etichette", { method: "POST", body: JSON.stringify({ nome }) });
    expect(creata.stato).toBe(201);
    const id = creata.corpo.etichetta.id;

    // Lo stesso nome con altre maiuscole è la stessa etichetta
    const doppia = await chiedi("/admin/etichette", { method: "POST", body: JSON.stringify({ nome: nome.toUpperCase() }) });
    expect(doppia.stato).toBe(409);

    const rinominata = await chiedi(`/admin/etichette/${id}`, { method: "PATCH", body: JSON.stringify({ nome: `${nome} bis` }) });
    expect(rinominata.stato).toBe(200);

    expect((await chiedi(`/admin/etichette/${id}`, { method: "DELETE" })).stato).toBe(200);
  });

  seAccesa("una notizia va nel cestino, torna, e si cancella per sempre solo dal cestino", async () => {
    const { chiedi } = await entra("admin");
    const creata = await chiedi("/admin/notizie", {
      method: "POST",
      body: JSON.stringify({ titolo: "Notizia di prova del cestino", contenuto: "<p>Prova</p>" })
    });
    expect(creata.stato).toBe(201);
    const id = creata.corpo.notizia.id;

    // Fuori dal cestino non si cancella per sempre
    expect((await chiedi(`/admin/notizie/${id}?definitiva=1`, { method: "DELETE" })).stato).toBe(409);

    expect((await chiedi(`/admin/notizie/${id}`, { method: "DELETE" })).stato).toBe(200);
    const cestino = await chiedi("/admin/notizie?stato=cestino");
    expect(cestino.corpo.notizie.some((n) => n.id === id)).toBe(true);

    const ripristinata = await chiedi(`/admin/notizie/${id}`, { method: "PATCH", body: JSON.stringify({ stato: "bozza" }) });
    expect(ripristinata.corpo.notizia.stato).toBe("bozza");

    await chiedi(`/admin/notizie/${id}`, { method: "DELETE" });
    expect((await chiedi(`/admin/notizie/${id}?definitiva=1`, { method: "DELETE" })).stato).toBe(200);
    expect((await chiedi(`/admin/notizie/${id}`)).stato).toBe(404);
  });
});

describe("i dati dell'atleta si controllano sul server", () => {
  seAccesa("il telefono si ripulisce e ha al massimo dieci cifre", async () => {
    const { chiedi } = await entra("atleta");
    const prima = (await chiedi("/iscrizione")).corpo.iscrizione;

    const ok = await chiedi("/iscrizione", { method: "PATCH", body: JSON.stringify({ telefono: "+39 345 123-4567" }) });
    expect(ok.stato).toBe(200);
    expect((await chiedi("/iscrizione")).corpo.iscrizione.telefono).toBe("3451234567");

    const lungo = await chiedi("/iscrizione", { method: "PATCH", body: JSON.stringify({ telefono: "345123456789" }) });
    expect(lungo.stato).toBe(400);

    // Rimesso com'era
    await chiedi("/iscrizione", { method: "PATCH", body: JSON.stringify({ telefono: prima.telefono ?? "" }) });
  });

  seAccesa("un codice fiscale nuovo e sbagliato viene rifiutato", async () => {
    const { chiedi } = await entra("atleta");
    const esito = await chiedi("/iscrizione", { method: "PATCH", body: JSON.stringify({ codiceFiscale: "RSSMRA80A01L219A" }) });
    expect(esito.stato).toBe(400);
  });
});

describe("documenti del sito", () => {
  seAccesa("il sito legge solo i pubblicati, per sezione", async () => {
    const chiedi = sessione();
    const tutti = await chiedi("/documenti");
    expect(tutti.stato).toBe(200);
    expect(tutti.corpo.documenti.length).toBeGreaterThan(0);
    const privacy = await chiedi("/documenti?sezione=privacy");
    expect(privacy.corpo.documenti.every((d) => d.sezione === "privacy")).toBe(true);
    expect((await chiedi("/documenti?sezione=segreti")).stato).toBe(400);
  });

  seAccesa("l'amministratore aggiunge, nasconde, riordina e toglie", async () => {
    const { chiedi } = await entra("admin");
    const creato = await chiedi("/admin/documenti", {
      method: "POST",
      body: JSON.stringify({ sezione: "privacy", titolo: "Documento di prova", url: "/documenti/PSD_STATUTO.pdf" })
    });
    expect(creato.stato).toBe(201);
    const id = creato.corpo.documento.id;

    // Un indirizzo che non è un file del sito né un indirizzo web si rifiuta
    const cattivo = await chiedi(`/admin/documenti/${id}`, { method: "PATCH", body: JSON.stringify({ url: "javascript:alert(1)" }) });
    expect(cattivo.stato).toBe(400);

    await chiedi(`/admin/documenti/${id}`, { method: "PATCH", body: JSON.stringify({ pubblicato: false }) });
    const pubblici = await sessione()("/documenti?sezione=privacy");
    expect(pubblici.corpo.documenti.some((d) => d.id === id)).toBe(false);

    const elenco = await chiedi("/admin/documenti");
    const ids = elenco.corpo.documenti.filter((d) => d.sezione === "privacy").map((d) => d.id).reverse();
    expect((await chiedi("/admin/documenti/ordine", { method: "PUT", body: JSON.stringify({ sezione: "privacy", ids }) })).stato).toBe(200);

    expect((await chiedi(`/admin/documenti/${id}`, { method: "DELETE" })).stato).toBe(200);
    // Rimesso l'ordine di prima
    await chiedi("/admin/documenti/ordine", { method: "PUT", body: JSON.stringify({ sezione: "privacy", ids: ids.filter((x) => x !== id).reverse() }) });
  });

  seAccesa("la segreteria non gestisce i documenti", async () => {
    const { chiedi } = await entra("segreteria");
    expect((await chiedi("/admin/documenti")).stato).toBe(403);
  });
});

describe("regole del 28 settembre", () => {
  seAccesa("nessuno dello staff corregge l'anagrafica di un atleta", async () => {
    for (const ruolo of ["segreteria", "admin"]) {
      const staff = await entra(ruolo);
      const elenco = await staff.chiedi("/admin/atleti");
      const atleta = elenco.corpo.atleti.find((a) => a.haScheda);

      const esito = await staff.chiedi(`/admin/atleti/${atleta.utenteId}`, { method: "PATCH", body: JSON.stringify({ telefono: "+39 333 123 4567" }) });
      if (esito.stato === 200) {
        const dopo = (await staff.chiedi(`/admin/atleti/${atleta.utenteId}`)).corpo.atleta;
        expect(dopo.telefono).not.toBe("3331234567");
      } else {
        expect([400, 403]).toContain(esito.stato);
      }
    }

    const coach = await entra("coach");
    const suoi = await coach.chiedi("/admin/atleti");
    const suo = suoi.corpo.atleti[0];
    const no = await coach.chiedi(`/admin/atleti/${suo.utenteId}`, { method: "PATCH", body: JSON.stringify({ telefono: "3330000000" }) });
    expect(no.stato).toBe(403);
  });

  seAccesa("da Utenti l'amministratore non cambia nome o email di un atleta, la password sì", async () => {
    const admin = await entra("admin");
    const elenco = (await admin.chiedi("/admin/utenti")).corpo;
    const atleta = (elenco.utenti ?? elenco).find((u) => u.ruolo === "atleta" && u.email !== "p051@prova.psd");

    expect((await admin.chiedi("/admin/utenti", { method: "PATCH", body: JSON.stringify({ id: atleta.id, nome: "Cambiato" }) })).stato).toBe(403);
    expect((await admin.chiedi("/admin/utenti", { method: "PATCH", body: JSON.stringify({ id: atleta.id, email: "altra@prova.psd" }) })).stato).toBe(403);
    expect((await admin.chiedi("/admin/utenti", { method: "PATCH", body: JSON.stringify({ id: atleta.id, password: "provvisoria2026" }) })).stato).toBe(200);
  });

  seAccesa("solo l'amministratore cancella per sempre dal cestino", async () => {
    const admin = await entra("admin");
    const creata = await admin.chiedi("/admin/notizie", { method: "POST", body: JSON.stringify({ titolo: "Da cancellare per prova", contenuto: "<p>x</p>" }) });
    const id = creata.corpo.notizia.id;
    await admin.chiedi(`/admin/notizie/${id}`, { method: "DELETE" });

    const editor = sessione();
    await editor("/accesso", { method: "POST", body: JSON.stringify({ email: "p004@prova.psd", password: "provapsd2026" }) });
    expect((await editor(`/admin/notizie/${id}?definitiva=1`, { method: "DELETE" })).stato).toBe(403);
    expect((await editor("/admin/notizie", { method: "DELETE" })).stato).toBe(403);

    const segr = await entra("segreteria");
    expect((await segr.chiedi(`/admin/notizie/${id}?definitiva=1`, { method: "DELETE" })).stato).toBe(403);

    expect((await admin.chiedi(`/admin/notizie/${id}?definitiva=1`, { method: "DELETE" })).stato).toBe(200);
  });
});

describe("quota famiglia fra fratelli", () => {
  seAccesa("lo sconto va solo a chi lo chiede, e il fratello più grande vede l'avviso", async () => {
    const { carattereDiControllo } = await import("../server/codice-fiscale.js");
    const cf = (p) => p + carattereDiControllo(p);
    const segna = Date.now();
    const admin = await entra("admin");
    const segr = await entra("segreteria");
    const squadre = (await admin.chiedi("/admin/squadre")).corpo;
    const calcio = (squadre.squadre ?? squadre).find((q) => q.sport === "Calcio");

    async function iscrivi(nome, codice) {
      const s = sessione();
      const email = `${nome}.${segna}@prova.psd`;
      await s("/registrazione", { method: "POST", body: JSON.stringify({ email, password: "provapsd2026!", nome, cognome: "Prova", sport: "Calcio" }) });
      const r = (await admin.chiedi("/admin/iscrizioni")).corpo.richieste.find((x) => x.email === email);
      await admin.chiedi("/admin/iscrizioni", { method: "POST", body: JSON.stringify({ id: r.id, approvata: true, squadraId: calcio.id }) });
      const io = sessione();
      await io("/accesso", { method: "POST", body: JSON.stringify({ email, password: "provapsd2026!" }) });
      await io("/iscrizione", { method: "PATCH", body: JSON.stringify({ codiceFiscale: codice }) });
      return { io, id: (await io("/io")).corpo.utente.id };
    }
    const tipo = async (id) => (await segr.chiedi(`/admin/atleti/${id}`)).corpo.atleta.tipoQuota;

    const cfA = cf(`PRVGRN${String(segna).slice(-2)}A01L219`.slice(0, 15));
    const cfB = cf(`PRVPCL${String(segna).slice(-2)}B41L219`.slice(0, 15));
    const a = await iscrivi("grande", cfA);
    const b = await iscrivi("piccola", cfB);
    const primaA = await tipo(a.id);

    await b.io("/iscrizione/fratelli", { method: "POST", body: JSON.stringify({ codiceFiscale: cfA }) });
    const lB = (await segr.chiedi(`/admin/atleti/${b.id}`)).corpo.atleta.legami.find((l) => l.stato === "in_attesa");
    expect(lB.avviso).toBeNull();
    await segr.chiedi(`/admin/atleti/${b.id}/legami`, { method: "PATCH", body: JSON.stringify({ legameId: lB.id, conferma: true }) });
    expect(await tipo(b.id)).toBe("Famiglia");
    expect(await tipo(a.id)).toBe(primaA);

    await a.io("/iscrizione/fratelli", { method: "POST", body: JSON.stringify({ codiceFiscale: cfB }) });
    const lA = (await segr.chiedi(`/admin/atleti/${a.id}`)).corpo.atleta.legami.find((l) => l.stato === "in_attesa" && l.laSua);
    expect(lA.avviso).toMatch(/già stato usato/);
  });
});
