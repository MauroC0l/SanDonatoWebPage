import { describe, it, expect } from "vitest";
import { creaHashPassword, verificaPassword } from "../server/password.js";

/**
 * Come sono tenute le password.
 *
 * In archivio non c'è nessuna password: c'è il risultato di scrypt, che è
 * una funzione a senso unico. Non esiste modo di "decifrarle" nemmeno per
 * noi — ed è il punto, non un limite: se il database finisse nelle mani
 * sbagliate, non ci sarebbe niente da leggere.
 *
 * Da qui discende anche che la password dimenticata non si può rispedire,
 * solo sostituire. Il sito infatti fa quello.
 */

describe("scrittura della password", () => {
  it("in archivio non finisce mai la password in chiaro", async () => {
    const memorizzato = await creaHashPassword("cavallo-batteria-graffetta");
    expect(memorizzato).not.toContain("cavallo");
    expect(memorizzato).not.toContain("batteria");
  });

  it("porta con sé i parametri con cui è stata calcolata", async () => {
    // scrypt$N$r$p$sale$impronta. I parametri viaggiano insieme perché il
    // giorno che li alzeremo, le password vecchie devono continuare a
    // verificarsi con quelli con cui sono nate.
    const memorizzato = await creaHashPassword("una password qualunque");
    const parti = memorizzato.split("$");

    expect(parti).toHaveLength(6);
    expect(parti[0]).toBe("scrypt");
    expect(Number(parti[1])).toBeGreaterThanOrEqual(65536);
  });

  it("due persone con la stessa password hanno impronte diverse", async () => {
    /*
     * Il sale, estratto a caso a ogni scrittura.
     *
     * Senza, due impronte uguali direbbero a chi legge il database che
     * quelle due persone hanno scelto la stessa password — e una tabella
     * precalcolata le scoprirebbe tutte in una volta.
     */
    const prima = await creaHashPassword("stessa password per tutti");
    const seconda = await creaHashPassword("stessa password per tutti");

    expect(prima).not.toBe(seconda);
    await expect(verificaPassword("stessa password per tutti", prima)).resolves.toBe(true);
    await expect(verificaPassword("stessa password per tutti", seconda)).resolves.toBe(true);
  });

  it("rifiuta una password troppo corta", async () => {
    await expect(creaHashPassword("corta")).rejects.toThrow();
  });
});

describe("verifica della password", () => {
  it("riconosce quella giusta e scarta quella sbagliata", async () => {
    const memorizzato = await creaHashPassword("la password vera");

    await expect(verificaPassword("la password vera", memorizzato)).resolves.toBe(true);
    await expect(verificaPassword("la password vera ", memorizzato)).resolves.toBe(false);
    await expect(verificaPassword("La password vera", memorizzato)).resolves.toBe(false);
    await expect(verificaPassword("", memorizzato)).resolves.toBe(false);
  });

  it("non si fa ingannare da un valore malformato in tabella", async () => {
    // Una riga rovinata da una migrazione non deve mai far entrare qualcuno:
    // la risposta giusta è "no", non un errore e nemmeno un "sì" distratto.
    for (const rotto of ["", "password", "scrypt$1$2", "bcrypt$x$y$z$w$v", null, undefined, 42]) {
      await expect(verificaPassword("qualunque cosa", rotto)).resolves.toBe(false);
    }
  });
});
