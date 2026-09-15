import { describe, it, expect } from "vitest";
import { euro, versoCampo, daCampo } from "../src/utils/soldi.js";
import {
  statoCertificato, quantoManca, inRegola, GIORNI_PREAVVISO
} from "../src/utils/certificato.js";
import { areaDi, percorsoProfilo, AREA_ATLETA } from "../src/utils/percorsi.js";
import { anni, minorenne } from "../src/utils/eta.js";
import { raggruppaPerAnno } from "../src/utils/versamenti.js";

/**
 * I conti e le date.
 *
 * Sono le funzioni con il rapporto più alto fra "quante schermate le usano"
 * e "quante righe sono". Un errore di un centesimo o di un giorno qui
 * compare identico in sei posti diversi, e in sei posti diversi sembra un
 * problema di quella schermata.
 */

describe("importi", () => {
  it("da centesimi a euro scritti come si scrivono in Italia", () => {
    // toContain e non toBe: fra il numero e il simbolo Intl mette uno
    // spazio unificatore, che non è lo spazio della barra spaziatrice e
    // rende il confronto esatto una trappola.
    expect(euro(12345)).toContain("123,45");
    expect(euro(0)).toContain("0,00");
    expect(euro(-500)).toContain("5,00");
  });

  it("niente importo si scrive con una lineetta, non con zero", () => {
    // "0,00 €" direbbe che la quota è zero; la lineetta dice che non è
    // ancora stata decisa. Sono due cose diverse per chi legge.
    expect(euro(null)).toBe("—");
    expect(euro(undefined)).toBe("—");
  });

  it("accetta sia la virgola sia il punto", () => {
    // In Italia si scrive 12,50, ma chi usa il tastierino numerico batte
    // 12.50 e non deve trovarsi un errore.
    expect(daCampo("12,50")).toBe(1250);
    expect(daCampo("12.50")).toBe(1250);
    expect(daCampo("  250 €  ")).toBe(25000);
  });

  it("distingue il campo vuoto dallo zero", () => {
    expect(daCampo("")).toBeNull();
    expect(daCampo("   ")).toBeNull();
    expect(daCampo("0")).toBe(0);
  });

  it("non si fa ingannare da quello che non è un numero", () => {
    expect(daCampo("boh")).toBeNull();
    expect(daCampo("12,,5")).toBeNull();
  });

  it("arrotonda al centesimo invece di tenere frazioni di centesimo", () => {
    expect(daCampo("12,345")).toBe(1235);
    expect(daCampo("12,344")).toBe(1234);
  });

  it("andata e ritorno non perde niente", () => {
    for (const centesimi of [0, 1, 999, 25000, 123456]) {
      expect(daCampo(versoCampo(centesimi))).toBe(centesimi);
    }
  });
});

describe("certificato medico", () => {
  const oggi = new Date(2026, 8, 14); // 14 settembre 2026

  /* Un certificato a posto davvero: file consegnato, segreteria che
     l'ha guardato, data che non è passata. */
  const aPosto = { fileCaricato: true, validazione: "valido" };

  it("senza niente è «mancante», non «scaduto»", () => {
    // Chi non ha mai consegnato e chi ce l'ha vecchio vanno trattati
    // diversamente: al primo si chiede il certificato, al secondo di rifarlo.
    expect(statoCertificato(null, oggi).chiave).toBe("mancante");
  });

  it("SENZA IL FILE non è valido, nemmeno con una data buona", () => {
    /*
     * È la regola che conta: una scadenza battuta a mano è una promessa,
     * non un certificato. Prima lo stato si calcolava sulla sola data, e
     * la stessa persona risultava "Valido" nella sua pagina e "file non
     * caricato" nell'elenco della segreteria.
     */
    const esito = statoCertificato("2027-06-30", oggi, { fileCaricato: false });

    expect(esito.chiave).toBe("senza_file");
    expect(inRegola(esito)).toBe(false);
  });

  it("consegnato ma non ancora guardato non è valido", () => {
    // Arriva la foto storta, la pagina sbagliata, il foglio dell'anno
    // prima: finché la segreteria non l'ha aperto, non vale.
    const esito = statoCertificato("2027-06-30", oggi, {
      fileCaricato: true,
      validazione: "da_validare"
    });

    expect(esito.chiave).toBe("da_controllare");
    expect(inRegola(esito)).toBe(false);
  });

  it("respinto non è valido", () => {
    const esito = statoCertificato("2027-06-30", oggi, {
      fileCaricato: true,
      validazione: "rifiutato"
    });

    expect(esito.chiave).toBe("respinto");
    expect(inRegola(esito)).toBe(false);
  });

  it("con tutte e tre le cose a posto è valido", () => {
    const esito = statoCertificato("2027-06-30", oggi, aPosto);

    expect(esito.chiave).toBe("valido");
    expect(inRegola(esito)).toBe(true);
  });

  it("scade oggi: ancora valido, non scaduto", () => {
    // Il certificato vale per tutto il giorno di scadenza. Contando con
    // l'ora, dal pomeriggio in poi sarebbe risultato scaduto.
    const esito = statoCertificato("2026-09-14", oggi, aPosto);

    expect(esito.chiave).toBe("in_scadenza");
    expect(esito.giorni).toBe(0);
    expect(inRegola(esito)).toBe(true);
  });

  it("ieri è scaduto", () => {
    const esito = statoCertificato("2026-09-13", oggi, aPosto);

    expect(esito.chiave).toBe("scaduto");
    expect(esito.giorni).toBe(-1);
    expect(inRegola(esito)).toBe(false);
  });

  it("scaduto batte anche l'approvazione della segreteria", () => {
    // Un foglio approvato ma vecchio non fa scendere in campo nessuno:
    // dirlo "valido" non sarebbe un errore di etichetta, sarebbe un rischio.
    expect(statoCertificato("2026-01-01", oggi, aPosto).chiave).toBe("scaduto");
  });

  it("il preavviso comincia esattamente a trenta giorni", () => {
    const ultimoInAllarme = statoCertificato("2026-10-14", oggi, aPosto); // +30
    const primoTranquillo = statoCertificato("2026-10-15", oggi, aPosto); // +31

    expect(ultimoInAllarme.giorni).toBe(GIORNI_PREAVVISO);
    expect(ultimoInAllarme.chiave).toBe("in_scadenza");
    expect(primoTranquillo.chiave).toBe("valido");
  });

  it("il cambio dell'ora legale non sposta il conto dei giorni", () => {
    /*
     * In Italia l'ora legale finisce l'ultima domenica di ottobre: fra il
     * 20 ottobre e il 20 novembre passano 31 giorni, ma 31 giorni e
     * un'ora di orologio. Con una divisione secca per 86400000 nel verso
     * opposto (marzo) si perderebbe un giorno. Da qui l'arrotondamento.
     */
    const ottobre = new Date(2026, 9, 20);
    expect(statoCertificato("2026-11-20", ottobre, aPosto).giorni).toBe(31);

    const marzo = new Date(2026, 2, 10);
    expect(statoCertificato("2026-04-10", marzo, aPosto).giorni).toBe(31);
  });

  it("racconta la scadenza con le parole di tutti i giorni", () => {
    expect(quantoManca(0)).toBe("scade oggi");
    expect(quantoManca(1)).toBe("scade domani");
    expect(quantoManca(12)).toBe("fra 12 giorni");
    expect(quantoManca(-1)).toBe("scaduto ieri");
    expect(quantoManca(-3)).toBe("scaduto da 3 giorni");
    expect(quantoManca(null)).toBe("");
  });
});

describe("indirizzi delle aree riservate", () => {
  it("ogni ruolo sta a casa sua", () => {
    expect(areaDi("admin")).toBe("/admin");
    expect(areaDi("segreteria")).toBe("/segreteria");
    expect(areaDi("editor")).toBe("/editor");
    expect(areaDi("coach")).toBe("/coach");
    expect(areaDi("atleta")).toBe(AREA_ATLETA);
  });

  it("l'atleta non ha una pagina «profilo» separata", () => {
    // La sua area è già la sua scheda: mandarlo su /area-riservata/profilo
    // lo porterebbe su una pagina che non esiste.
    expect(percorsoProfilo("atleta")).toBe(AREA_ATLETA);
    expect(percorsoProfilo("coach")).toBe("/coach/profilo");
  });
});

describe("età", () => {
  /* Le date si costruiscono a partire da oggi: scritte a mano
     scadrebbero, e il giorno che il test fallisse nessuno saprebbe se
     è rotto il codice o è solo passato un compleanno. */
  const oggi = new Date();

  /* In ora LOCALE, come la calcola anni(), e non con toISOString().

     Con toISOString() questo test passava di giorno e falliva di notte:
     in Italia, fra mezzanotte e le due, l'ora di Greenwich è ancora il
     giorno prima, e "il compleanno è domani" diventava "il compleanno è
     oggi". Il difetto era qui, non in anni(): il modo di sbagliare che
     il codice vero evita apposta. */
  const giorno = (d) => {
    const due = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
  };

  const anniFa = (n, giorniInPiu = 0) => {
    const d = new Date(oggi);
    d.setFullYear(d.getFullYear() - n);
    d.setDate(d.getDate() + giorniInPiu);
    return giorno(d);
  };

  it("gli anni compiuti, non quelli che si compiono", () => {
    expect(anni(anniFa(18))).toBe(18);

    // Compie diciotto anni domani: oggi ne ha diciassette
    expect(anni(anniFa(18, 1))).toBe(17);
  });

  it("senza data non si sa, e non sapendo non si pretende niente", () => {
    expect(anni(null)).toBe(null);
    expect(anni("")).toBe(null);
    expect(anni("non una data")).toBe(null);

    /* Questa è la parte che conta: un adulto che non ha ancora scritto
       la data di nascita non deve risultare minorenne, o gli si
       chiederebbe il contatto di un genitore. */
    expect(minorenne(null)).toBe(false);
  });

  it("minorenne fino al giorno prima del compleanno", () => {
    expect(minorenne(anniFa(18, 1))).toBe(true);
    expect(minorenne(anniFa(18))).toBe(false);
    expect(minorenne(anniFa(40))).toBe(false);
  });
});

describe("versamenti per anno", () => {
  const versamenti = [
    { id: 1, pagatoIl: "2025-09-10", importoCentesimi: 10000 },
    { id: 2, pagatoIl: "2025-12-01", importoCentesimi: 5000 },
    { id: 3, pagatoIl: "2026-01-15", importoCentesimi: 20000 }
  ];

  it("divide per anno, dal più recente, con il totale di ciascuno", () => {
    const gruppi = raggruppaPerAnno(versamenti);

    expect(gruppi.map((g) => g.anno)).toEqual(["2026", "2025"]);
    expect(gruppi[0].totale).toBe(20000);
    expect(gruppi[1].totale).toBe(15000);
  });

  it("dentro all'anno il più recente sta in cima", () => {
    const [, duemilaVenticinque] = raggruppaPerAnno(versamenti);

    // Arrivano dal più vecchio: qui devono uscire dal più nuovo
    expect(duemilaVenticinque.righe.map((v) => v.id)).toEqual([2, 1]);
  });

  it("un rimborso abbassa il totale dell'anno in cui è stato fatto", () => {
    const conRimborso = [...versamenti, { id: 4, pagatoIl: "2026-02-01", importoCentesimi: -5000 }];
    const [duemilaVentisei] = raggruppaPerAnno(conRimborso);

    expect(duemilaVentisei.totale).toBe(15000);
  });

  it("senza versamenti non ci sono anni", () => {
    expect(raggruppaPerAnno([])).toEqual([]);
    expect(raggruppaPerAnno(undefined)).toEqual([]);
  });
});
