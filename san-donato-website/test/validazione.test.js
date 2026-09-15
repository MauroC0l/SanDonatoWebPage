import { describe, it, expect } from "vitest";
import {
  schemaNotiziaNuova, schemaNotiziaModifica, schemaElencoNotizie,
  schemaAccesso, valida, SPORT, CATEGORIE, STATI, STATI_FILTRO
} from "../server/validazione.js";
import { cosaManca } from "../server/atleti.js";

/**
 * Le forme che le API accettano.
 *
 * Il caso che merita davvero un test è il penultimo blocco: uno schema di
 * modifica che si porta dietro i valori predefiniti di quello di creazione
 * spubblica una notizia a ogni correzione di refuso. È successo davvero, il
 * codice ne porta il commento, e un test è l'unico modo perché non
 * ricapiti al prossimo campo che qualcuno aggiunge.
 */

describe("creazione di una notizia", () => {
  it("accetta il minimo indispensabile e mette i valori di partenza", () => {
    const esito = valida(schemaNotiziaNuova, {
      titolo: "Vittoria in trasferta",
      contenuto: "<p>Bella partita.</p>"
    });

    expect(esito.sport).toBe("Altro");
    expect(esito.categoria).toBe("altro");
    expect(esito.stato).toBe("bozza");
  });

  it("rifiuta un titolo di due lettere", () => {
    expect(() => valida(schemaNotiziaNuova, { titolo: "ok", contenuto: "<p>x</p>" }))
      .toThrow();
  });

  it("rifiuta una notizia senza testo", () => {
    expect(() => valida(schemaNotiziaNuova, { titolo: "Un titolo lungo", contenuto: "" }))
      .toThrow();
  });

  it("rifiuta uno sport o una categoria inventati", () => {
    const base = { titolo: "Un titolo lungo", contenuto: "<p>x</p>" };

    expect(() => valida(schemaNotiziaNuova, { ...base, sport: "Curling" })).toThrow();
    expect(() => valida(schemaNotiziaNuova, { ...base, categoria: "gossip" })).toThrow();
  });
});

describe("modifica di una notizia", () => {
  it("NON applica nessun valore predefinito", () => {
    /*
     * Il punto di tutto questo file.
     *
     * Chi corregge un refuso manda solo il titolo. Se lo schema riempisse
     * i buchi con i propri valori di partenza, la richiesta arriverebbe
     * anche con stato "bozza" e sport "Altro": la notizia sparirebbe dal
     * sito e cambierebbe sezione, senza che nessuno l'abbia chiesto.
     */
    const esito = valida(schemaNotiziaModifica, { titolo: "Titolo corretto" });

    expect(Object.keys(esito)).toEqual(["titolo"]);
    expect(esito.stato).toBeUndefined();
    expect(esito.sport).toBeUndefined();
    expect(esito.categoria).toBeUndefined();
    expect(esito.pubblicataIl).toBeUndefined();
  });

  it("distingue «non l'ho toccato» da «l'ho messo a niente»", () => {
    // copertinaId a null significa "togli la copertina" ed è una richiesta
    // legittima; assente significa "lasciala com'è". Se lo schema
    // appiattisse i due casi, non si potrebbe più togliere un'immagine.
    const tolta = valida(schemaNotiziaModifica, { copertinaId: null });
    expect("copertinaId" in tolta).toBe(true);
    expect(tolta.copertinaId).toBeNull();

    const intoccata = valida(schemaNotiziaModifica, { titolo: "Titolo nuovo" });
    expect("copertinaId" in intoccata).toBe(false);
  });
});

describe("filtro dell'elenco", () => {
  it("accetta più stati separati da virgola", () => {
    // Il filtro "Bozze" del pannello ne chiede due insieme. Quando lo
    // schema ne accettava uno solo, la richiesta veniva scartata in
    // silenzio e l'elenco mostrava tutto.
    const esito = valida(schemaElencoNotizie, { stato: "bozza,in_revisione" });
    expect(esito.stato).toEqual(["bozza", "in_revisione"]);
  });

  it("conosce «programmata», che non è uno stato del database", () => {
    expect(STATI).not.toContain("programmata");
    expect(STATI_FILTRO).toContain("programmata");

    const esito = valida(schemaElencoNotizie, { stato: "programmata" });
    expect(esito.stato).toEqual(["programmata"]);
  });

  it("tiene la paginazione dentro limiti sensati", () => {
    expect(valida(schemaElencoNotizie, {}).pagina).toBe(1);
    expect(() => valida(schemaElencoNotizie, { pagina: 0 })).toThrow();
    expect(() => valida(schemaElencoNotizie, { perPagina: 5000 })).toThrow();
  });

  it("filtra per categoria solo con una categoria vera", () => {
    expect(valida(schemaElencoNotizie, { categoria: "eventi" }).categoria).toBe("eventi");
    expect(() => valida(schemaElencoNotizie, { categoria: "eventii" })).toThrow();
  });
});

describe("accesso", () => {
  it("normalizza l'email e lascia stare la password", () => {
    const esito = valida(schemaAccesso, {
      email: "  Mario.Rossi@Esempio.IT ",
      password: "  con spazi  "
    });

    expect(esito.email).toBe("mario.rossi@esempio.it");
    // La password NON si ripulisce: chi ha scelto di metterci uno spazio in
    // fondo ce l'ha anche nel proprio gestore di password, e togliendolo
    // non entrerebbe più.
    expect(esito.password).toBe("  con spazi  ");
  });

  it("rifiuta un indirizzo che non è un indirizzo", () => {
    expect(() => valida(schemaAccesso, { email: "mario", password: "x" })).toThrow();
  });
});

describe("gli elenchi condivisi con il front-end", () => {
  it("sport e categorie sono quelli che si aspetta il database", () => {
    // Se qui e nell'enum di Postgres gli elenchi divergono, l'errore arriva
    // dal driver come un messaggio incomprensibile in fase di scrittura.
    expect(SPORT).toEqual(["Calcio", "Pallavolo", "Minivolley", "Basket", "Altro"]);
    expect(CATEGORIE).toEqual(["societa", "eventi", "sport", "solidarieta", "altro"]);
  });
});

describe("cosa manca per completare l'iscrizione", () => {
  /* Due schermate leggono questo elenco — la pagina dell'atleta e la scheda
     che apre la segreteria — e devono leggerne uno solo: un atleta convinto
     di aver finito mentre la segreteria lo cerca al telefono è esattamente
     il guaio che questa funzione esiste per evitare. */

  const completa = {
    dataNascita: "1990-05-14",
    codiceFiscale: "RSSMRA90E14L219X",
    telefono: "333 1112223",
    certificatoScadenza: "2027-06-30",
    certificatoMediaId: 12
  };

  const nascitaDiUnMinore = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 10);
    return d.toISOString().slice(0, 10);
  };

  it("a un adulto con tutto in regola non manca niente", () => {
    expect(cosaManca(completa)).toEqual([]);
  });

  it("il certificato non basta senza la copia", () => {
    expect(cosaManca({ ...completa, certificatoMediaId: null }))
      .toContain("la copia del certificato medico");
  });

  it("a un minorenne serve un adulto da chiamare", () => {
    const minore = { ...completa, dataNascita: nascitaDiUnMinore() };

    expect(cosaManca(minore)).toEqual(["il contatto di un genitore"]);

    // Il nome da solo non serve: un nome senza numero non si chiama
    expect(cosaManca({ ...minore, tutoreNome: "Anna Rossi" }))
      .toEqual(["il contatto di un genitore"]);

    expect(cosaManca({ ...minore, tutoreNome: "Anna Rossi", tutoreTelefono: "333 1112223" }))
      .toEqual([]);
  });

  it("a un maggiorenne il contatto del genitore non si chiede", () => {
    expect(cosaManca(completa)).not.toContain("il contatto di un genitore");

    /* Senza data di nascita non si sa quanti anni ha: la data manca e lo si
       dice, ma non gli si chiede anche un tutore che forse non gli serve. */
    const senzaData = cosaManca({ ...completa, dataNascita: null });
    expect(senzaData).toContain("la data di nascita");
    expect(senzaData).not.toContain("il contatto di un genitore");
  });
});
