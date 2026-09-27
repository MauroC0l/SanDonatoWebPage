import { describe, it, expect } from "vitest";
import {
  carattereDiControllo, codiceFiscaleValido, normalizzaCodiceFiscale
} from "../server/codice-fiscale.js";

/**
 * Il codice fiscale.
 *
 * Finché serviva solo a comparire sui moduli federali bastava contare
 * sedici caratteri. Adesso con un codice fiscale si CERCA una persona — il
 * fratello o la sorella già iscritti — e una lettera sbagliata non trova
 * nessuno: chi ha dichiarato resta ad aspettare una tariffa ridotta che
 * non arriverà, senza sapere perché.
 *
 * Il carattere di controllo non dimostra che quel codice fiscale esista.
 * Intercetta le due cose che capitano davvero: una lettera per un'altra e
 * due caratteri invertiti.
 */

describe("il carattere di controllo", () => {
  it("torna su codici fiscali costruiti come si deve", () => {
    /* Due esempi calcolati per davvero, non inventati: sono la prova che
       le due tabelle sono state copiate giuste. Una tabella sbagliata
       darebbe la lettera giusta per caso una volta su ventisei. */
    expect(codiceFiscaleValido("MRTMTT91D08F205J")).toBe(true);
    expect(codiceFiscaleValido("RSSMRA85T10A562S")).toBe(true);
  });

  it("scarta un codice fiscale con l'ultima lettera sbagliata", () => {
    // Stesso codice di sopra con la Z al posto della S: la forma è
    // perfetta, ed è esattamente il caso che la sola lunghezza lasciava
    // passare.
    expect(codiceFiscaleValido("RSSMRA85T10A562Z")).toBe(false);
  });

  it("si accorge di due caratteri invertiti", () => {
    /* È il motivo per cui le posizioni pari e dispari hanno due tabelle
       diverse: con una sola, "10" e "01" darebbero la stessa somma e lo
       scambio passerebbe inosservato. */
    expect(carattereDiControllo("RSSMRA85T10A562"))
      .not.toBe(carattereDiControllo("RSSMRA85T01A562"));
  });

  it("accetta l'omocodia, cioè le cifre sostituite da lettere", () => {
    /* Quando due persone ottengono lo stesso codice, l'Agenzia ne cambia
       una sostituendo le cifre con lettere. Chi ha un omonimo esiste, e
       rifiutargli il proprio codice fiscale sarebbe un difetto raro e
       odioso — di quelli che capitano sempre alla stessa persona. */
    expect(codiceFiscaleValido("RSSMRA85T10A56NH")).toBe(true);
  });
});

describe("come viene scritto", () => {
  it("minuscole e spazi non fanno differenza", () => {
    // Su un telefono il maiuscolo automatico fa quello che vuole, e chi
    // copia dalla tessera sanitaria si porta dietro gli spazi.
    expect(codiceFiscaleValido(" rss mra 85t10 a562 s ")).toBe(true);
    expect(normalizzaCodiceFiscale(" rss mra85t10a562s ")).toBe("RSSMRA85T10A562S");
  });

  it("quello che non è un codice fiscale viene scartato", () => {
    for (const valore of [
      "",
      null,
      undefined,
      12345,
      "RSSMRA85T10A562",        // quindici caratteri
      "RSSMRA85T10A562SS",      // diciassette
      "12345678901234 5",       // tutto sbagliato
      "RSSMRA85Z10A562S"        // la Z non è un mese
    ]) {
      expect(codiceFiscaleValido(valore), `${valore} non deve passare`).toBe(false);
    }
  });
});
