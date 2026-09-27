import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { giornoDaSeriale, oraDaSeriale, istanteRoma } from "../server/calendari/orario.js";
import { leggiUispPallavolo } from "../server/calendari/formati/uisp-pallavolo.js";
import {
  normalizzaNome, eNostra, eInCasa, nostrePartite, differenze, campiEvento, chiaveUfficiale
} from "../server/calendari/partite.js";
import { idCartella, vociDaPaginaPubblica } from "../server/calendari/drive.js";
import { schemaFonteNuova, schemaFonteModifica, schemaGirone } from "../server/calendari/pannello.js";

/**
 * I calendari ufficiali.
 *
 * I tre file in test/esempi/calendari sono calendari UISP veri della
 * stagione 2026/27, ripuliti: c'è solo il foglio del calendario, senza
 * l'indirizzario e senza il foglio nascosto con telefoni ed email dei
 * referenti. Sono qui perché il primo tentativo di leggerli — uno script
 * scritto senza averli mai aperti — su 32 partite nostre ne trovava 6, e
 * tutte sbagliate. Un lettore si prova sui file che leggerà davvero.
 */

const esempio = (nome) => readFileSync(new URL(`./esempi/calendari/${nome}`, import.meta.url));
const NOSTRI = { nomiNostri: ["Pol. San Donato", "Polisportiva San Donato"], palestreCasa: ["Cartiera", "Via Fossano 8"] };

const aTorino = (d) => new Date(d).toLocaleString("it-IT", {
  timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
});

/* =====================================================
   Date e ore
   ===================================================== */

describe("date e ore dei fogli", () => {
  it("il numero di serie di Excel è un giorno di calendario", () => {
    expect(giornoDaSeriale(46298)).toEqual({ anno: 2026, mese: 10, giorno: 3 });
    expect(giornoDaSeriale(46298.625)).toEqual({ anno: 2026, mese: 10, giorno: 3 });
    expect(giornoDaSeriale(null)).toBeNull();
    expect(giornoDaSeriale("46298")).toBeNull();
  });

  it("la frazione di giorno è l'ora, arrotondata al minuto", () => {
    expect(oraDaSeriale(0.625)).toEqual({ ore: 15, minuti: 0 });
    // Così la salva Excel: non è esattamente 15:30
    expect(oraDaSeriale(0.6458333333)).toEqual({ ore: 15, minuti: 30 });
    expect(oraDaSeriale(46298.8125)).toEqual({ ore: 19, minuti: 30 });
  });

  it("l'ora del foglio è l'ora di Torino, con l'ora legale giusta", () => {
    // Ottobre: ora legale, due ore avanti rispetto a UTC
    expect(istanteRoma({ anno: 2026, mese: 10, giorno: 3 }, { ore: 15, minuti: 0 }).toISOString())
      .toBe("2026-10-03T13:00:00.000Z");
    // Novembre: ora solare, un'ora avanti
    expect(istanteRoma({ anno: 2026, mese: 11, giorno: 14 }, { ore: 15, minuti: 0 }).toISOString())
      .toBe("2026-11-14T14:00:00.000Z");
    // Il giorno del cambio d'ora: alle 15 è già ora solare
    expect(istanteRoma({ anno: 2026, mese: 10, giorno: 25 }, { ore: 15, minuti: 0 }).toISOString())
      .toBe("2026-10-25T14:00:00.000Z");
  });
});

/* =====================================================
   Il lettore UISP, sui file veri
   ===================================================== */

describe("lettore UISP pallavolo", () => {
  it("legge il girone A dell'Under 14 (foglio Google esportato)", () => {
    const { titolo, partite } = leggiUispPallavolo(esempio("uisp-u14fa.xlsx"));

    expect(titolo).toBe("XX Torneo Autunno/Cossalter - Under 14 FEMMINILE GIRONA A");
    expect(partite).toHaveLength(30);

    const prima = partite.find((p) => p.numero === "14102");
    expect(prima).toMatchObject({
      casa: "Pol. San Donato",
      ospite: "Vol-Ley Academy Volpiano",
      luogo: "Pal. Cartiera - Via Fossano,8 - TORINO",
      tuttoIlGiorno: false,
      risultato: null,
      parziali: null
    });
    // Le 15:00, non le 16:00: è l'errore che faceva leggere le date del 1899
    // con il fuso di allora
    expect(aTorino(prima.inizio)).toBe("03/10/2026, 15:00");

    const trasferta = partite.find((p) => p.numero === "14104");
    expect(trasferta.ospite).toBe("Pol. San Donato");
    expect(aTorino(trasferta.inizio)).toBe("10/10/2026, 15:30");
  });

  it("legge un .xlsx caricato così com'è e un foglio con le intestazioni a metà", () => {
    expect(leggiUispPallavolo(esempio("uisp-tafb.xlsx")).partite).toHaveLength(30);

    // "CALENDARI E RISULTATI", senza "N. Gara" in intestazione
    const u16 = leggiUispPallavolo(esempio("uisp-u16fa.xlsx"));
    expect(u16.partite).toHaveLength(12);
    expect(u16.partite.every((p) => /^\d+$/.test(p.numero))).toBe(true);
  });

  it("trova esattamente le nostre partite dei file veri", () => {
    const conta = (nome) => [...nostrePartite(leggiUispPallavolo(esempio(nome)).partite, NOSTRI).values()]
      .reduce((n, l) => n + l.length, 0);

    expect(conta("uisp-u14fa.xlsx")).toBe(10);
    expect(conta("uisp-tafb.xlsx")).toBe(10);
    expect(conta("uisp-u16fa.xlsx")).toBe(6);
  });

  /* Un girone costruito qui, per i casi che nei file veri a inizio
     stagione non ci sono ancora: le partite giocate. */
  function girone(righe, { nomeFoglio = "CALENDARIO E RISULTATI", intestazione = true } = {}) {
    const aoa = [
      ["", "", "", "Torneo di prova - Girone unico"],
      [],
      intestazione
        ? ["CAT", "N. Gara", "I° Giornata", "", "Squadre", "", "", "Palestra", "Note", "Risultato", "Risultato",
          "1° Set", "1° Set", "2° Set", "2° Set", "3° Set", "3° Set", "4° Set", "4° Set", "5° Set", "5° Set"]
        : [],
      ...righe
    ];
    const cartella = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(cartella, XLSX.utils.aoa_to_sheet(aoa), nomeFoglio);
    return XLSX.write(cartella, { type: "buffer", bookType: "xlsx" });
  }

  it("scrive risultato e parziali come il resto del sito", () => {
    const { partite } = leggiUispPallavolo(girone([
      ["X", 101, 46298, 0.625, "Pol. San Donato", "-", "Volley Rivoli", "Pal. Cartiera", "",
        3, 1, 25, 20, 18, 25, 25, 22, 25, 17],
      // Set vinti non scritti: si contano dai parziali
      ["X", 102, 46305, 0.75, "Volley Rivoli", "-", "Pol. San Donato", "Pal. Rivoli", "Anticipo",
        "", "", 20, 25, 25, 23, 22, 25, 19, 25],
      // Non giocata: 0 - 0 non è un risultato
      ["X", 103, 46312, 0, "Pol. San Donato", "-", "Volley Rivoli", "Pal. Cartiera", "", 0, 0]
    ]));

    expect(partite[0]).toMatchObject({ risultato: "3 - 1", parziali: "25-20, 18-25, 25-22, 25-17" });
    expect(partite[1]).toMatchObject({ risultato: "1 - 3", note: "Anticipo" });
    // Senza ora: una giornata intera, non una partita a mezzanotte
    expect(partite[2]).toMatchObject({ risultato: null, parziali: null, tuttoIlGiorno: true });
  });

  it("si ferma se il modello del foglio è cambiato, invece di leggere colonne sbagliate", () => {
    expect(() => leggiUispPallavolo(girone([["X", 101, 46298, 0.625, "A", "-", "B"]], { intestazione: false })))
      .toThrow(/modello UISP è cambiato/);
    expect(() => leggiUispPallavolo(girone([], { nomeFoglio: "Classifica" })))
      .toThrow(/CALENDARIO E RISULTATI/);
    expect(() => leggiUispPallavolo(Buffer.from("<html>accesso negato</html>")))
      .toThrow();
  });
});

/* =====================================================
   Quali sono le nostre
   ===================================================== */

describe("le nostre partite", () => {
  it("riconosce il nostro nome comunque sia scritto, ma solo a parola intera", () => {
    expect(normalizzaNome("Pol. San Donato")).toBe("pol san donato");
    expect(eNostra("POL.SAN DONATO", NOSTRI.nomiNostri)).toBe(true);
    expect(eNostra("Pol. San Donato Rossa", NOSTRI.nomiNostri)).toBe(true);
    expect(eNostra("Polisportiva  San Donato", NOSTRI.nomiNostri)).toBe(true);
    expect(eNostra("Pol. San Donatone", NOSTRI.nomiNostri)).toBe(false);
    expect(eNostra("Volley San Donato", NOSTRI.nomiNostri)).toBe(false);
  });

  it("in casa è solo la nostra palestra, non la squadra scritta per prima", () => {
    const aCasaNostra = { luogo: "Pal. Cartiera - Via Fossano,8 - TORINO" };
    const altrove = { luogo: "Palestra Matteotti - ALPIGNANO" };

    expect(eInCasa(aCasaNostra, "ospite", NOSTRI.palestreCasa)).toBe(true);
    expect(eInCasa(altrove, "casa", NOSTRI.palestreCasa)).toBe(false);
    // Senza palestre indicate resta l'ordine del foglio
    expect(eInCasa(altrove, "casa", [])).toBe(true);
  });

  it("un derby fra due nostre squadre va nel calendario di entrambe", () => {
    const gruppi = nostrePartite([{
      numero: "7", inizio: new Date("2026-10-03T13:00:00Z"), tuttoIlGiorno: false,
      casa: "Pol. San Donato Rossa", ospite: "Pol. San Donato Blu", luogo: "Pal. Cartiera"
    }], NOSTRI);

    expect([...gruppi.keys()]).toEqual(["Pol. San Donato Rossa", "Pol. San Donato Blu"]);
    expect(gruppi.get("Pol. San Donato Rossa")[0].avversario).toBe("Pol. San Donato Blu");
    expect(gruppi.get("Pol. San Donato Blu")[0]).toMatchObject({ avversario: "Pol. San Donato Rossa", inCasa: true });
  });
});

/* =====================================================
   Cosa è cambiato
   ===================================================== */

describe("confronto con il calendario del sito", () => {
  const ufficiale = {
    numero: "14102", inizio: "2026-10-03T13:00:00.000Z", tuttoIlGiorno: false,
    titolo: "Pol. San Donato - Volpiano", avversario: "Volpiano", inCasa: true,
    luogo: "Pal. Cartiera", note: null, risultato: null, parziali: null
  };
  const sulSito = campiEvento(ufficiale);

  it("niente da fare se nulla è cambiato", () => {
    expect(differenze(sulSito, ufficiale)).toEqual({ campi: [], genere: null });
  });

  it("una data diversa è uno spostamento, anche se è arrivato pure il risultato", () => {
    expect(differenze(sulSito, { ...ufficiale, inizio: "2026-10-04T16:00:00.000Z" }).genere).toBe("spostata");
    expect(differenze(sulSito, { ...ufficiale, inizio: "2026-10-04T16:00:00.000Z", risultato: "3 - 0" }).genere)
      .toBe("spostata");
  });

  it("il risultato arrivato è un risultato; la palestra cambiata è una modifica", () => {
    expect(differenze(sulSito, { ...ufficiale, risultato: "3 - 1", parziali: "25-20" }))
      .toEqual({ campi: ["risultato", "parziali"], genere: "risultato" });
    expect(differenze(sulSito, { ...ufficiale, luogo: "Pal. Rivoli" }))
      .toEqual({ campi: ["luogo"], genere: "modificata" });
  });

  it("la chiave distingue i gironi, perché i numeri di gara ricominciano ogni anno", () => {
    expect(chiaveUfficiale(12, "14102")).toBe("girone:12:14102");
    expect(chiaveUfficiale(40, "14102")).not.toBe(chiaveUfficiale(12, "14102"));
  });
});

/* =====================================================
   Drive e moduli del pannello
   ===================================================== */

describe("cartelle Drive", () => {
  it("accetta il collegamento in tutte le forme in cui lo si incolla", () => {
    const id = "1tcFC84gw3exaGoJ5AGydBMOp4KN6h1Hm";
    expect(idCartella(`https://drive.google.com/drive/folders/${id}?usp=sharing`)).toBe(id);
    expect(idCartella(`https://drive.google.com/drive/u/1/folders/${id}`)).toBe(id);
    expect(idCartella(`https://drive.google.com/embeddedfolderview?id=${id}#list`)).toBe(id);
    expect(idCartella(id)).toBe(id);
    expect(idCartella("https://example.com/calendario.pdf")).toBeNull();
  });

  it("legge l'elenco della pagina pubblica: fogli, sottocartelle e nomi con entità", () => {
    const pagina = `
      <div class="flip-entry" id="entry-AAAAAAAAAAAA1" tabindex="0"><a href="https://drive.google.com/file/d/AAAAAAAAAAAA1/view">
        <img src="https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.google-apps.spreadsheet" alt=""/>
        <div class="flip-entry-title">26-27 TAU14FA</div></a></div>
      <div class="flip-entry" id="entry-BBBBBBBBBBBB2" tabindex="0"><a href="https://drive.google.com/drive/folders/BBBBBBBBBBBB2">
        <div class="flip-entry-title">Archivio &amp; vecchi</div></a></div>`;

    expect(vociDaPaginaPubblica(pagina)).toEqual([
      { id: "AAAAAAAAAAAA1", nome: "26-27 TAU14FA", tipo: "application/vnd.google-apps.spreadsheet", modificatoIl: null },
      { id: "BBBBBBBBBBBB2", nome: "Archivio & vecchi", tipo: "application/vnd.google-apps.folder", modificatoIl: null }
    ]);
  });
});

describe("moduli dei calendari", () => {
  const base = {
    nome: "UISP Giovanili Torneo Autunno 2026",
    formato: "uisp_pallavolo",
    cartella: "https://drive.google.com/drive/folders/1tcFC84gw3exaGoJ5AGydBMOp4KN6h1Hm?usp=sharing",
    nomiNostri: ["Pol. San Donato", " Pol. San Donato "]
  };

  it("una fonte nuova: dal collegamento resta l'identificativo, i doppioni spariscono", () => {
    expect(schemaFonteNuova.parse(base)).toEqual({
      ...base,
      cartella: "1tcFC84gw3exaGoJ5AGydBMOp4KN6h1Hm",
      nomiNostri: ["Pol. San Donato"],
      palestreCasa: [],
      attiva: true
    });
  });

  it("rifiuta formati sconosciuti, collegamenti che non sono cartelle e fonti senza il nostro nome", () => {
    expect(schemaFonteNuova.safeParse({ ...base, formato: "figc_calcio" }).success).toBe(false);
    expect(schemaFonteNuova.safeParse({ ...base, cartella: "https://example.com" }).success).toBe(false);
    expect(schemaFonteNuova.safeParse({ ...base, nomiNostri: [] }).success).toBe(false);
  });

  it("in modifica un campo assente resta com'è, invece di tornare al valore iniziale", () => {
    expect(schemaFonteModifica.parse({ attiva: false })).toEqual({ attiva: false });
  });

  it("un girone si collega a una squadra o si mette da parte, ma qualcosa va detto", () => {
    expect(schemaGirone.parse({ squadraId: "4" })).toEqual({ squadraId: 4 });
    // null è scollegare, non "zero": il girone torna da collegare
    expect(schemaGirone.parse({ squadraId: null })).toEqual({ squadraId: null });
    expect(schemaGirone.safeParse({}).success).toBe(false);
  });
});
