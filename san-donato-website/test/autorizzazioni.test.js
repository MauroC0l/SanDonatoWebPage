import { describe, it, expect } from "vitest";
import { capacitaDi, puo, squadreConAtletiVisibili } from "../server/autorizzazioni.js";

/**
 * I permessi.
 *
 * Sono la prima cosa da provare con dei test veri: un difetto qui non fa
 * cadere niente e non si vede aprendo il sito — semplicemente qualcuno
 * legge o scrive quello che non deve, e ce ne si accorge dopo.
 *
 * La regola che sta sotto a metà di questi casi è una sola, ed è del
 * cliente: CHI VEDE I DATI DI UNA PERSONA NON PUÒ MODIFICARLI. La scheda
 * anagrafica la compila l'atleta, e nessun ruolo dello staff — nemmeno
 * l'amministratore — la può riscrivere.
 */

const utente = (ruolo) => ({ id: 1, ruolo, email: "tizio@prova.it" });

describe("capacità per ruolo", () => {
  it("l'amministratore governa tutto quello che c'è da governare", () => {
    const sue = capacitaDi("admin");

    for (const capacita of [
      "notizie.pubblica", "eventi.gestisci_tutte", "squadre.gestisci",
      "utenti.gestisci", "atleti.leggi", "quote.gestisci", "registro.leggi"
    ]) {
      expect(sue, `all'admin manca ${capacita}`).toContain(capacita);
    }
  });

  it("nessun ruolo può scrivere l'anagrafica di un altro", () => {
    // Non esiste proprio una capacità del genere: il permesso mancante è
    // più solido di un controllo che qualcuno può dimenticarsi di fare.
    for (const ruolo of ["admin", "segreteria", "editor", "coach", "atleta"]) {
      expect(capacitaDi(ruolo)).not.toContain("atleti.scrivi");
      expect(capacitaDi(ruolo)).not.toContain("anagrafica.scrivi");
    }
  });

  it("un ruolo che non esiste non ha nessuna capacità", () => {
    // Conta più di quanto sembri: se capacitaDi() rispondesse con le
    // capacità dell'admin davanti a un valore sconosciuto, basterebbe una
    // riga sbagliata in tabella per aprire il pannello a chiunque.
    expect(capacitaDi("presidente")).toEqual([]);
    expect(capacitaDi(undefined)).toEqual([]);
    expect(capacitaDi(null)).toEqual([]);
  });
});

describe("l'allenatore e le quote", () => {
  it("non può vedere i conti dei suoi atleti", () => {
    // Richiesta esplicita della società: al coach serve sapere se il
    // ragazzo può scendere in campo, non quanto ha pagato la famiglia.
    expect(puo(utente("coach"), "quote.gestisci")).toBe(false);
  });

  it("le schede degli atleti però le legge, perché gli servono", () => {
    expect(puo(utente("coach"), "atleti.leggi")).toBe(true);
  });

  it("vede solo le proprie squadre, non tutte", async () => {
    /*
     * null significa "nessun limite, le vede tutte".
     *
     * Chi tiene i conti — amministratore e segreteria — esce subito con
     * null senza toccare il database, ed è quello che si prova qui. Per
     * il coach la funzione va invece a leggere le sue associazioni: quel
     * caso vuole un database vero e sta nelle prove fatte a mano contro
     * l'API, non in un test che dovrebbe girare senza niente acceso.
     */
    await expect(squadreConAtletiVisibili(utente("admin"))).resolves.toBeNull();
    await expect(squadreConAtletiVisibili(utente("segreteria"))).resolves.toBeNull();

    // Un ruolo che non legge gli atleti non ne vede di nessuna squadra,
    // e anche questo si decide prima di qualunque interrogazione.
    await expect(squadreConAtletiVisibili(utente("atleta"))).resolves.toEqual([]);
  });
});

describe("la segreteria", () => {
  it("tiene i conti e registra il certificato medico", () => {
    // L'eccezione concordata: il certificato arriva spesso su carta, e
    // qualcuno lo deve pur registrare.
    expect(puo(utente("segreteria"), "quote.gestisci")).toBe(true);
    expect(puo(utente("segreteria"), "certificato.registra")).toBe(true);
  });

  it("non amministra gli account né le squadre", () => {
    expect(puo(utente("segreteria"), "utenti.gestisci")).toBe(false);
    expect(puo(utente("segreteria"), "squadre.gestisci")).toBe(false);
  });
});

describe("l'atleta", () => {
  it("carica i propri file e nient'altro", () => {
    expect(puo(utente("atleta"), "media.carica")).toBe(true);

    for (const capacita of [
      "atleti.leggi", "quote.gestisci", "utenti.gestisci",
      "notizie.scrivi", "registro.leggi", "iscritti.leggi"
    ]) {
      expect(puo(utente("atleta"), capacita), `l'atleta non deve avere ${capacita}`).toBe(false);
    }
  });
});

describe("puo()", () => {
  it("dice di no quando non c'è nessuno", () => {
    expect(puo(null, "notizie.scrivi")).toBe(false);
    expect(puo(undefined, "notizie.scrivi")).toBe(false);
  });
});
