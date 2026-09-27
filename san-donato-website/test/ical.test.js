import { describe, it, expect } from "vitest";
import { calendarioIcs, piega, scappa } from "../server/ical.js";

/**
 * Il calendario da abbonare.
 *
 * Un errore qui non dà un messaggio: Google Calendar rifiuta il file in
 * silenzio, o peggio lo accetta e mette la partita all'ora sbagliata sui
 * telefoni di tutte le famiglie. Le regole del formato vanno provate una
 * per una.
 */

const squadra = { id: 14, nome: "Volley U14" };
const adesso = new Date("2026-09-27T10:00:00Z");

const partita = {
  id: 1,
  tipo: "partita",
  titolo: "Pol. San Donato - Vol-Ley Academy Volpiano",
  inizio: "2026-10-03T13:00:00.000Z",
  fine: null,
  tuttoIlGiorno: false,
  luogo: "Pal. Cartiera - Via Fossano,8 - TORINO",
  latitudine: null,
  longitudine: null,
  descrizione: "",
  risultato: null,
  parziali: null,
  marcatori: [],
  diretta: null,
  inCasa: true,
  noteUfficiali: null
};

const righe = (ics) => ics.replace(/\r\n /g, "").split("\r\n");

describe("calendario iCal di una squadra", () => {
  it("è un calendario valido, con righe chiuse da CRLF", () => {
    const ics = calendarioIcs(squadra, [partita], { adesso });

    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    // Nessun a capo "nudo": solo CRLF
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(righe(ics)).toContain("X-WR-CALNAME:Volley U14 · PSD");
  });

  it("una partita: ora in UTC, due ore di durata, identificativo stabile", () => {
    const r = righe(calendarioIcs(squadra, [partita], { adesso }));

    expect(r).toContain("UID:evento-1@polisportivasandonato.org");
    // Le 15:00 di Torino a ottobre sono le 13:00 UTC
    expect(r).toContain("DTSTART:20261003T130000Z");
    expect(r).toContain("DTEND:20261003T150000Z");
    // La virgola dell'indirizzo va scappata, o spezza il campo
    expect(r).toContain("LOCATION:Pal. Cartiera - Via Fossano\\,8 - TORINO");
    expect(r).toContain("DESCRIPTION:In casa");
  });

  it("il risultato si legge nel titolo, i parziali nella descrizione", () => {
    const r = righe(calendarioIcs(squadra, [{
      ...partita, risultato: "3 - 1", parziali: "25-20, 18-25", inCasa: false,
      marcatori: ["Rossi"], diretta: "https://example.com/live"
    }], { adesso }));

    expect(r).toContain("SUMMARY:Pol. San Donato - Vol-Ley Academy Volpiano (3 - 1)");
    expect(r).toContain(
      "DESCRIPTION:In trasferta\\nRisultato: 3 - 1 (25-20\\, 18-25)\\nMarcatori: Rossi\\nDiretta: https://example.com/live"
    );
    expect(r).toContain("URL:https://example.com/live");
  });

  it("un evento di un giorno intero: date senza ora, e la fine è il giorno dopo", () => {
    const r = righe(calendarioIcs(squadra, [{
      ...partita, id: 2, tipo: "evento", tuttoIlGiorno: true,
      // Mezzanotte di Torino, che in UTC è ancora il giorno prima
      inizio: "2026-10-02T22:00:00.000Z"
    }], { adesso }));

    expect(r).toContain("DTSTART;VALUE=DATE:20261003");
    expect(r).toContain("DTEND;VALUE=DATE:20261004");
  });

  it("scappa i caratteri speciali e piega le righe lunghe senza spezzare le lettere", () => {
    expect(scappa("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");

    const lunga = `SUMMARY:${"à".repeat(60)}`;
    const piegata = piega(lunga);
    for (const pezzo of piegata.split("\r\n")) {
      expect(Buffer.byteLength(pezzo)).toBeLessThanOrEqual(75);
    }
    // Rimettendo insieme i pezzi si riottiene la riga di partenza
    expect(piegata.replace(/\r\n /g, "")).toBe(lunga);
  });

  it("un calendario senza eventi è comunque un calendario", () => {
    const ics = calendarioIcs(squadra, [], { adesso });
    expect(ics).not.toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });
});
