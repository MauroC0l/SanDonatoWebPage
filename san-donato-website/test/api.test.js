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
    let corpo = null;
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

  seAccesa("il filtro per categoria rifiuta una categoria inventata", async () => {
    const chiedi = sessione();
    expect((await chiedi("/notizie?categoria=eventi")).stato).toBe(200);
    expect((await chiedi("/notizie?categoria=gossip")).stato).toBe(400);
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
