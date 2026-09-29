import { describe, it, expect } from "vitest";
import { valoreDaEtichetta } from "../server/spese.js";

describe("categorie delle spese", () => {
  it("ricava dal nome un valore senza accenti né spazi", () => {
    expect(valoreDaEtichetta("Hosting e server")).toBe("hosting-e-server");
    expect(valoreDaEtichetta("Città & Sicurezza")).toBe("citta-sicurezza");
    expect(valoreDaEtichetta("  --Pagamenti--  ")).toBe("pagamenti");
  });

  it("con un nome fatto solo di simboli ripiega su un valore generico", () => {
    expect(valoreDaEtichetta("€€€")).toBe("categoria");
  });
});
