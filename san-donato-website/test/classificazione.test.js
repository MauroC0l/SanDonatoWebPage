import { describe, it, expect } from "vitest";
import { classifica, ripulisci } from "../scripts/classifica-notizie.mjs";

/**
 * La categoria indovinata dalle parole del titolo.
 *
 * I casi qui sotto sono titoli veri dell'archivio della Polisportiva, non
 * esempi inventati: è l'unico modo perché il test dica qualcosa di utile.
 * Se un domani si aggiusta una regola, questi dicono subito se si è rotto
 * qualcosa che prima funzionava.
 */

const categoriaDi = (titolo, extra = {}) => classifica({ titolo, ...extra }).categoria;

describe("ripulitura del testo", () => {
  it("toglie accenti, maiuscole e punteggiatura", () => {
    expect(ripulisci("SOCIETÀ")).toBe("societa");
    expect(ripulisci("PSD – 5 x 1000 – scelta di valore")).toBe("psd 5 x 1000 scelta di valore");
  });

  it("regge il segno di moltiplicazione al posto della x", () => {
    // "5×1000" con il segno × si scriveva così in tre titoli, e con la
    // sola regola "5 x 1000" finivano tutti in "societa".
    expect(ripulisci("5×1000 alla PSD")).toBe("5 1000 alla psd");
  });

  it("non si rompe su niente", () => {
    expect(ripulisci(null)).toBe("");
    expect(ripulisci(undefined)).toBe("");
    expect(ripulisci("")).toBe("");
  });
});

describe("titoli veri dell'archivio", () => {
  it("riconosce la vita di società", () => {
    expect(categoriaDi("ASSEMBLEA SOCI 2026 – i documenti approvati")).toBe("societa");
    expect(categoriaDi("VADEMECUM E TARIFFE STAGIONE 2025-2026")).toBe("societa");
    expect(categoriaDi("Assemblea Elettiva 24 novembre 2023")).toBe("societa");
  });

  it("riconosce le feste", () => {
    expect(categoriaDi("FESTA DI NATALE 2025 – DICIOTTESIMO PARTY")).toBe("eventi");
    expect(categoriaDi("ESTRAZIONE LOTTERIA DI NATALE 2025")).toBe("eventi");
    expect(categoriaDi("8 DICEMBRE – Festa patronale a San Donato")).toBe("eventi");
  });

  it("riconosce lo sport", () => {
    expect(categoriaDi("Junior TIM CUP – LA PSD 2010 si laurea campione piemontese")).toBe("sport");
    expect(categoriaDi("VOLLEY UNDER 15 – 3° POSTO AI NAZIONALI UISP")).toBe("sport");
  });

  it("riconosce la solidarietà, anche quando parla pure di sport", () => {
    // "La Psd contro il razzismo – Junior tim cup" nomina la coppa, ma non
    // parla della partita: è la ragione per cui i punteggi sono pesati e
    // non si prende la prima regola che combacia.
    expect(categoriaDi("La Psd contro il razzismo – Junior tim cup")).toBe("solidarieta");
    expect(categoriaDi("PSD – 5 x 1000 – scelta di valore")).toBe("solidarieta");
    expect(categoriaDi("5×1000 alla PSD")).toBe("solidarieta");
  });
});

describe("quando non è chiaro, non decide", () => {
  it("un titolo senza appigli resta in «altro»", () => {
    expect(categoriaDi("L'attività sportiva entra nella Costituzione Italiana")).toBe("altro");
    expect(categoriaDi("asdads")).toBe("altro");
    expect(categoriaDi("")).toBe("altro");
  });

  it("una sola parola debole nel sommario non basta", () => {
    // Il titolo pesa il triplo apposta: una parola di passaggio in fondo a
    // un sommario lungo non dice di cosa parla l'articolo.
    const esito = classifica({
      titolo: "Un pomeriggio in Polisportiva",
      sommario: "Tante persone, e in fondo anche una cena."
    });
    expect(esito.categoria).toBe("altro");
  });
});

describe("lo sport dichiarato", () => {
  it("spinge verso «sport» ma non decide da solo", () => {
    // Metà degli articoli sulla festa di Natale del settore calcio hanno lo
    // sport compilato: se bastasse quello, finirebbero tutti fra le partite.
    expect(categoriaDi("Un titolo qualunque", { sport: "Calcio" })).toBe("sport");
    expect(categoriaDi("FESTA DI NATALE 2025 – DICIOTTESIMO PARTY", { sport: "Calcio" }))
      .toBe("eventi");
  });

  it("«Altro» non conta come sport dichiarato", () => {
    expect(categoriaDi("Un titolo qualunque", { sport: "Altro" })).toBe("altro");
  });
});

describe("la risposta ha sempre la stessa forma", () => {
  it("categoria, punteggio e motivo", () => {
    const esito = classifica({ titolo: "ASSEMBLEA SOCI 2026" });
    expect(esito).toHaveProperty("categoria");
    expect(esito).toHaveProperty("punteggio");
    expect(esito).toHaveProperty("motivo");
    expect(typeof esito.punteggio).toBe("number");
  });
});
