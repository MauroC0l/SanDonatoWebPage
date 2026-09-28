import { describe, it, expect } from "vitest";
import { stagioneDi, contoStagione, oggiRoma } from "../server/stagioni.js";

describe("la stagione di una data", () => {
  it("luglio apre la stagione nuova", () => {
    expect(stagioneDi("2026-07-01").nome).toBe("2026/27");
    expect(stagioneDi("2026-06-30").nome).toBe("2025/26");
  });

  it("gennaio è ancora della stagione cominciata l'anno prima", () => {
    const s = stagioneDi("2027-01-15");
    expect(s).toEqual({
      nome: "2026/27", inizio: "2026-07-01", fine: "2027-06-30", inizioSecondaMeta: "2027-01-01",
      scadenzaPrimaMeta: "2026-10-31"
    });
  });

  it("il cambio di secolo non rompe il nome", () => {
    expect(stagioneDi("2099-09-01").nome).toBe("2099/00");
  });

  it("la mezzanotte è quella di Torino, non quella di Londra", () => {
    // 30 giugno alle 23:30 UTC = già 1 luglio a Torino
    expect(oggiRoma(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
  });
});

describe("il conto di una stagione", () => {
  const stagione = stagioneDi("2026-09-01");

  it("chi non si ritira deve tutta la quota", () => {
    const c = contoStagione({ quotaCentesimi: 25000, stato: "attiva" }, 10000, stagione);
    expect(c).toMatchObject({ primaMeta: 12500, secondaMeta: 12500, secondaDovuta: true, dovuto: 25000, residuo: 15000 });
  });

  it("chi smette prima di gennaio non deve la seconda metà", () => {
    const c = contoStagione({ quotaCentesimi: 25000, stato: "ritirata", ritiratoIl: "2026-12-31" }, 0, stagione);
    expect(c.secondaDovuta).toBe(false);
    expect(c.dovuto).toBe(12500);
  });

  it("chi smette dal 1° gennaio la deve", () => {
    const c = contoStagione({ quotaCentesimi: 25000, stato: "ritirata", ritiratoIl: "2027-01-01" }, 0, stagione);
    expect(c.dovuto).toBe(25000);
  });

  it("il centesimo dispari va alla prima metà", () => {
    const c = contoStagione({ quotaCentesimi: 12501, stato: "attiva" }, 0, stagione);
    expect([c.primaMeta, c.secondaMeta]).toEqual([6251, 6250]);
  });

  it("chi ha saldato e poi si ritira resta a credito", () => {
    const c = contoStagione({ quotaCentesimi: 20000, stato: "ritirata", ritiratoIl: "2026-10-10" }, 20000, stagione);
    expect(c.residuo).toBe(-10000);
  });

  it("chi ha abbandonato non deve niente, e quello che ha versato è credito", () => {
    const c = contoStagione({ quotaCentesimi: 25000, stato: "abbandonata" }, 3000, stagione);
    expect(c.dovuto).toBe(0);
    expect(c.residuo).toBe(-3000);
    expect(c.secondaDovuta).toBe(false);
  });

  it("senza quota non c'è niente da dovere, ma il versato si vede", () => {
    const c = contoStagione(null, 500, stagione);
    expect(c.dovuto).toBeNull();
    expect(c.versato).toBe(500);
  });
});
