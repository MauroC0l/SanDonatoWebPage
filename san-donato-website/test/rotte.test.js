import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ROTTE, trovaRotta } from "../server/rotte.js";

/**
 * L'elenco delle rotte e i file sul disco devono dire la stessa cosa.
 *
 * Su Vercel il codice viene impacchettato seguendo le importazioni scritte,
 * quindi l'elenco in server/rotte.js non si può costruire leggendo la
 * cartella: va tenuto a mano. Una cosa tenuta a mano è una cosa che un
 * giorno qualcuno dimentica — e il modo in cui lo scoprirebbe è un indirizzo
 * che in locale funziona e in produzione risponde "nessuna rotta".
 *
 * Questo test è quel promemoria: aggiungi un file e ti dice di aggiungerlo
 * anche all'elenco, prima che se ne accorga il sito pubblicato.
 */

const CARTELLA = fileURLToPath(new URL("../server/rotte/", import.meta.url));

function fileDelle(cartella) {
  const trovati = [];

  for (const voce of readdirSync(cartella)) {
    const percorso = join(cartella, voce);

    if (statSync(percorso).isDirectory()) trovati.push(...fileDelle(percorso));
    else if (voce.endsWith(".js")) trovati.push(percorso);
  }

  return trovati;
}

/** "admin/atleti/[id].js" -> "admin/atleti/[id]" (index sparisce). */
function percorsoDi(relativo) {
  const pezzi = relativo.replace(/\.js$/, "").split(sep).filter(Boolean);
  if (pezzi.at(-1) === "index") pezzi.pop();
  return pezzi.join("/");
}

describe("elenco delle rotte", () => {
  const sulDisco = fileDelle(CARTELLA)
    .map((f) => percorsoDi(relative(CARTELLA, f)))
    .sort();

  const nellElenco = ROTTE.map((r) => r.percorso).sort();

  it("ogni file in server/rotte/ compare nell'elenco", () => {
    const mancanti = sulDisco.filter((p) => !nellElenco.includes(p));

    expect(
      mancanti,
      `Aggiungi queste rotte a server/rotte.js: ${mancanti.join(", ")}`
    ).toEqual([]);
  });

  it("l'elenco non nomina file che non esistono più", () => {
    const fantasmi = nellElenco.filter((p) => !sulDisco.includes(p));

    expect(
      fantasmi,
      `Queste rotte non hanno più un file: ${fantasmi.join(", ")}`
    ).toEqual([]);
  });

  it("ogni rotta porta a una funzione", () => {
    for (const rotta of ROTTE) {
      expect(typeof rotta.handler, `${rotta.percorso} non esporta una funzione`).toBe("function");
    }
  });
});

describe("smistamento degli indirizzi", () => {
  const dove = (indirizzo) => {
    const esito = trovaRotta(indirizzo.split("/").filter(Boolean));
    return esito && { percorso: esito.rotta.percorso, parametri: esito.parametri };
  };

  it("i parametri dell'indirizzo arrivano con il loro nome", () => {
    expect(dove("admin/atleti/249")).toEqual({
      percorso: "admin/atleti/[id]",
      parametri: { id: "249" }
    });

    expect(dove("admin/atleti/249/certificato")).toEqual({
      percorso: "admin/atleti/[id]/certificato",
      parametri: { id: "249" }
    });
  });

  it("una rotta fissa vince su una con il parametro", () => {
    /* Il caso che fa danno: "ultime-per-sport" è un indirizzo vero, ma
       combacia anche con /notizie/[identificativo]. Se vincesse la seconda,
       la home del sito pubblico chiederebbe una notizia che non esiste. */
    expect(dove("notizie/ultime-per-sport").percorso).toBe("notizie/ultime-per-sport");
    expect(dove("notizie/una-qualunque").percorso).toBe("notizie/[identificativo]");

    // Stessa forma, altro caso: le cartelle della libreria e un file singolo
    expect(dove("admin/media/cartelle").percorso).toBe("admin/media/cartelle");
    expect(dove("admin/media/7").percorso).toBe("admin/media/[id]");
  });

  it("un indirizzo che non esiste non risponde", () => {
    expect(dove("non/esiste")).toBe(null);
    expect(dove("admin")).toBe(null);
  });

  it("un indirizzo codificato torna leggibile", () => {
    expect(dove("notizie/festa%20di%20natale").parametri).toEqual({
      identificativo: "festa di natale"
    });
  });
});
