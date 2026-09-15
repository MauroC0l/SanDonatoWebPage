import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { urlFile, urlPubblico, archivioLocale } from "../server/file.js";
import { chiaveValida, componiChiave, TIPI_AMMESSI } from "../server/archivio.js";

/**
 * Dove stanno i file e come si chiamano.
 *
 * Il caso che conta davvero è chiaveValida(): quella stringa arriva dal
 * browser e, con l'archivio su disco, diventa un percorso su cui si scrive.
 * Una chiave che riesce a risalire le cartelle è un modo per sovrascrivere
 * qualunque file del progetto, .env compreso.
 */

const ambiente = { ...process.env };

beforeEach(() => {
  delete process.env.URL_PUBBLICO_FILE;
  delete process.env.ARCHIVIO_LOCALE;
});

afterEach(() => {
  process.env = { ...ambiente };
});

describe("nome di un file nell'archivio", () => {
  it("è fatto di cartella, anno, mese e una parte casuale", () => {
    const chiave = componiChiave("image/jpeg", "profili");
    expect(chiave).toMatch(/^profili\/\d{4}\/\d{2}\/[0-9a-f]{16}\.jpg$/);
  });

  it("due file caricati nello stesso momento non si sovrascrivono", () => {
    // Il nome originale non c'entra: due "foto.jpg" caricate lo stesso
    // giorno finirebbero sulla stessa chiave, e la seconda cancellerebbe
    // la prima senza che nessuno se ne accorga.
    const uno = componiChiave("image/jpeg");
    const due = componiChiave("image/jpeg");
    expect(uno).not.toBe(due);
  });

  it("rifiuta un tipo di file che non ammettiamo", () => {
    expect(() => componiChiave("application/x-msdownload")).toThrow();
    expect(TIPI_AMMESSI).not.toContain("application/x-msdownload");
  });
});

describe("chiaveValida", () => {
  it("accetta le chiavi che generiamo noi", () => {
    for (const cartella of ["notizie", "eventi", "profili", "certificati"]) {
      expect(chiaveValida(componiChiave("image/png", cartella))).toBe(true);
    }
  });

  it("rifiuta qualunque tentativo di risalire le cartelle", () => {
    const cattive = [
      "../../.env",
      "profili/../../.env",
      "profili/2026/09/../../../../.env",
      "/etc/passwd",
      "C:/Windows/system32/x.png",
      "profili\\2026\\09\\aaaabbbbccccdddd.png"
    ];

    for (const chiave of cattive) {
      expect(chiaveValida(chiave), `accettata: ${chiave}`).toBe(false);
    }
  });

  it("rifiuta quello che non è nemmeno una stringa", () => {
    expect(chiaveValida(null)).toBe(false);
    expect(chiaveValida(undefined)).toBe(false);
    expect(chiaveValida(42)).toBe(false);
    expect(chiaveValida({})).toBe(false);
  });

  it("rifiuta una chiave dalla forma giusta ma con caratteri strani", () => {
    expect(chiaveValida("profili/2026/09/aaaabbbbccccddd?.png")).toBe(false);
    expect(chiaveValida("profili/2026/09/aaaabbbbccccdddd.png ")).toBe(false);
  });
});

describe("indirizzo pubblico di un file", () => {
  it("senza configurazione non inventa un indirizzo", () => {
    // Meglio niente immagine che un collegamento rotto: null lo fa capire
    // a chi disegna la pagina, una stringa a metà no.
    expect(urlPubblico("notizie/2026/09/aaaabbbbccccdddd.jpg")).toBeNull();
  });

  it("in modalità locale serve da /caricamenti", () => {
    process.env.ARCHIVIO_LOCALE = "1";
    expect(archivioLocale()).toBe(true);
    expect(urlPubblico("profili/2026/09/aaaabbbbccccdddd.jpg"))
      .toBe("/caricamenti/profili/2026/09/aaaabbbbccccdddd.jpg");
  });

  it("in produzione attacca la chiave al dominio dei file", () => {
    process.env.URL_PUBBLICO_FILE = "https://file.esempio.org/";
    // La barra in fondo al dominio non deve raddoppiarsi con quella della
    // chiave: un doppio slash in mezzo a un indirizzo su alcuni CDN è un 404.
    expect(urlPubblico("notizie/2026/09/aaaabbbbccccdddd.jpg"))
      .toBe("https://file.esempio.org/notizie/2026/09/aaaabbbbccccdddd.jpg");
  });
});

describe("urlFile durante il passaggio da WordPress", () => {
  it("un file già nostro si serve dall'archivio", () => {
    process.env.URL_PUBBLICO_FILE = "https://file.esempio.org";
    expect(urlFile("notizie/2026/09/aaaabbbbccccdddd.jpg", "https://vecchio.it/foto.jpg"))
      .toBe("https://file.esempio.org/notizie/2026/09/aaaabbbbccccdddd.jpg");
  });

  it("un file ancora su WordPress si serve da lì", () => {
    // Sono centinaia: finché non saranno trasferite, le notizie vecchie
    // devono continuare a mostrare le loro immagini.
    expect(urlFile(null, "https://vecchio.it/foto.jpg")).toBe("https://vecchio.it/foto.jpg");
  });

  it("senza né chiave né indirizzo vecchio non c'è immagine", () => {
    expect(urlFile(null, null)).toBeNull();
    expect(urlFile(undefined, undefined)).toBeNull();
  });
});
