import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ripulisciHtml, soloTesto, creaSlug } from "../server/sanitizza.js";

/**
 * La ripulitura dell'HTML delle notizie.
 *
 * Il contenuto arriva da un editor e finisce in pagina con
 * dangerouslySetInnerHTML: chi scrive è fidato, ma un copia-incolla da una
 * pagina altrui non lo è, e uno <script> che arriva così non sarebbe meno
 * pericoloso per essere arrivato per sbaglio.
 */

describe("ripulitura dell'HTML", () => {
  it("toglie gli script e li toglie davvero", () => {
    const pulito = ripulisciHtml('<p>Ciao</p><script>alert(1)</script>');

    expect(pulito).toContain("Ciao");
    expect(pulito).not.toContain("script");
    expect(pulito).not.toContain("alert");
  });

  it("toglie i gestori di evento appiccicati ai tag ammessi", () => {
    // Il tag resta perché è legittimo: sparisce l'attributo
    const pulito = ripulisciHtml('<p onclick="rubaTutto()">Testo</p>');

    expect(pulito).toContain("Testo");
    expect(pulito).not.toContain("onclick");
  });

  it("non lascia passare javascript: dentro a un collegamento", () => {
    const pulito = ripulisciHtml('<a href="javascript:alert(1)">clicca</a>');

    expect(pulito).not.toContain("javascript:");
    expect(pulito).toContain("clicca");
  });

  it("un link che apre una scheda nuova si porta dietro noopener", () => {
    /* Senza, la pagina di destinazione riceve un riferimento alla nostra e
       può cambiarle l'indirizzo sotto ai piedi. */
    const pulito = ripulisciHtml('<a href="https://esempio.it" target="_blank">vai</a>');

    expect(pulito).toContain("noopener");
  });

  it("lascia stare quello che serve a scrivere una notizia", () => {
    const pulito = ripulisciHtml(
      '<h2>Titolo</h2><p><strong>Grassetto</strong> e <em>corsivo</em></p><ul><li>uno</li></ul>'
    );

    expect(pulito).toContain("<h2>");
    expect(pulito).toContain("<strong>");
    expect(pulito).toContain("<li>");
  });
});

describe("testo e indirizzi leggibili", () => {
  it("il solo testo non incolla la fine di un paragrafo con l'inizio del successivo", () => {
    expect(soloTesto("<p>Prima.</p><p>Seconda.</p>")).toBe("Prima. Seconda.");
  });

  it("lo slug non porta accenti né spazi", () => {
    expect(creaSlug("Festa di San Donato — 23 e 24 maggio")).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("sanitize-html si deve poter caricare come CommonJS", () => {
  /*
   * Questo test esiste per un guasto vero, e serve a non ripeterlo.
   *
   * sanitize-html è un pacchetto CommonJS che al suo interno fa require()
   * di htmlparser2. Dalla versione 11 htmlparser2 è diventato solo ESM, e
   * require() di un modulo ESM non è permesso: Node 22 in locale lo tollera,
   * il confezionamento di Vercel no. Il risultato era che TUTTE le chiamate
   * all'API rispondevano 500 — non solo quelle delle notizie — perché la
   * funzione moriva mentre si caricava.
   *
   * In package.json c'è un "overrides" che tiene htmlparser2 a una versione
   * che offre ancora l'ingresso CommonJS. Se qualcuno lo toglierà, questo
   * test lo dirà qui invece che in produzione.
   */
  const require = createRequire(import.meta.url);

  it("htmlparser2 offre un ingresso CommonJS", () => {
    /* Il package.json non è fra le cose che htmlparser2 dichiara di
       esportare, quindi non lo si può chiedere per nome: si parte dal file
       che require() caricherebbe davvero e si risale finché non si trova. */
    const entrata = require.resolve("htmlparser2", {
      paths: [dirname(require.resolve("sanitize-html"))]
    });

    let cartella = dirname(entrata);
    while (!existsSync(join(cartella, "package.json"))) cartella = dirname(cartella);

    const suo = JSON.parse(readFileSync(join(cartella, "package.json"), "utf8"));
    const ingressoCjs = suo.type !== "module" || /commonjs/.test(suo.main ?? "");

    expect(
      ingressoCjs,
      `htmlparser2 ${suo.version} è solo ESM: su Vercel la funzione non parte. `
      + 'Tieni l\'"overrides" in package.json a una versione che abbia il build CommonJS.'
    ).toBe(true);
  });

  it("e si carica davvero con require, come fa Vercel", () => {
    const sanitize = require("sanitize-html");

    expect(typeof sanitize).toBe("function");
    expect(sanitize("<p>ciao</p><script>alert(1)</script>", { allowedTags: ["p"] }))
      .toBe("<p>ciao</p>");
  });
});
