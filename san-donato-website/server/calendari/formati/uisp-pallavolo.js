/**
 * Lettore dei calendari della pallavolo UISP Torino.
 *
 * La UISP pubblica un foglio Excel per girone, sempre dallo stesso modello:
 *
 *   B  numero di gara     E  squadra di casa     J–K  set vinti (casa, ospite)
 *   C  giorno             G  squadra ospite      L–U  punti dei cinque set,
 *   D  ora                H  palestra                 a coppie
 *   I  note
 *
 * Le colonne sono FISSE e le si legge per posizione, non per nome: in
 * alcuni fogli le intestazioni di A e B mancano, in altri dicono "Numero
 * Gara" due volte. Quello che non manca mai sono "Palestra" in H e
 * "Risultato" in J, e servono da controllo: se non ci sono, il modello è
 * cambiato e il lettore si FERMA con un errore invece di leggere colonne
 * che non vogliono più dire la stessa cosa. Un calendario sbagliato in
 * silenzio è peggio di un calendario che non si aggiorna e lo dice.
 *
 * Si legge SOLO il foglio del calendario. Gli altri due — l'indirizzario e
 * quello nascosto "Da COMPILARE e NASCONDERE" — contengono nomi, telefoni
 * ed email dei referenti delle società: non ci servono e non devono
 * passare di qui.
 */

import * as XLSX from "xlsx";
import { giornoDaSeriale, oraDaSeriale, istanteRoma } from "../orario.js";

/* Il nome del foglio ha due grafie nei file della stessa stagione. */
const FOGLIO_CALENDARIO = /^\s*calendari[o]?\s+e\s+risultati\s*$/i;

/* Dove cercare l'intestazione: nelle prime righe, sopra alla prima giornata. */
const RIGHE_INTESTAZIONE = 15;

const COPPIE_SET = [["L", "M"], ["N", "O"], ["P", "Q"], ["R", "S"], ["T", "U"]];

/** Il valore di una cella, con gli errori di Excel (#DIV/0!, #REF!) trattati come vuoti. */
function cella(foglio, indirizzo) {
  const c = foglio[indirizzo];
  if (!c || c.t === "e" || c.t === "z") return null;
  return c.v ?? null;
}

function testo(foglio, indirizzo) {
  const v = cella(foglio, indirizzo);
  if (v === null) return "";
  return String(v).replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function numero(foglio, indirizzo) {
  const v = cella(foglio, indirizzo);
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\s*\d+(?:[.,]\d+)?\s*$/.test(v)) return Number(v.replace(",", "."));
  return null;
}

/** Il titolo del girone: la prima scritta nelle righe in alto. */
function titoloDi(foglio) {
  for (let riga = 1; riga <= 4; riga++) {
    for (const colonna of ["D", "E", "C", "B", "A"]) {
      const t = testo(foglio, `${colonna}${riga}`);
      if (t) return t;
    }
  }
  return null;
}

function haIntestazione(foglio) {
  for (let riga = 1; riga <= RIGHE_INTESTAZIONE; riga++) {
    if (/palestra/i.test(testo(foglio, `H${riga}`)) && /risultato/i.test(testo(foglio, `J${riga}`))) {
      return true;
    }
  }
  return false;
}

/**
 * Risultato e parziali nella forma che il sito usa già ovunque:
 * "3 - 1" e "25-20, 18-25, 25-22".
 *
 * Se i set vinti mancano ma i parziali ci sono, i set si contano dai
 * parziali: sono la stessa informazione, scritta due volte nel foglio.
 */
function esitoDi(foglio, riga) {
  const parziali = [];

  for (const [a, b] of COPPIE_SET) {
    const casa = numero(foglio, `${a}${riga}`);
    const ospite = numero(foglio, `${b}${riga}`);
    if (casa === null || ospite === null) continue;
    if (casa === 0 && ospite === 0) continue;
    parziali.push([casa, ospite]);
  }

  let setCasa = numero(foglio, `J${riga}`);
  let setOspite = numero(foglio, `K${riga}`);

  if ((setCasa === null || setOspite === null) && parziali.length) {
    setCasa = parziali.filter(([c, o]) => c > o).length;
    setOspite = parziali.filter(([c, o]) => o > c).length;
  }

  // 0 - 0 è la cella vuota di una partita non giocata, non un risultato
  const giocata = setCasa !== null && setOspite !== null && (setCasa > 0 || setOspite > 0);

  return {
    risultato: giocata ? `${setCasa} - ${setOspite}` : null,
    parziali: parziali.length ? parziali.map(([c, o]) => `${c}-${o}`).join(", ") : null
  };
}

/**
 * Tutte le partite di un file, di tutte le squadre.
 *
 * Quali siano le nostre non lo decide il lettore: lo decide chi lo chiama,
 * con i nomi scritti nella fonte. Così il lettore di un formato nuovo deve
 * saper leggere il suo foglio e basta.
 *
 * @returns {{ titolo: string|null, partite: Array<object> }}
 * @throws  se il file non è un calendario UISP riconoscibile
 */
export function leggiUispPallavolo(contenuto) {
  let cartella;
  try {
    cartella = XLSX.read(contenuto, { type: "buffer", cellDates: false, cellHTML: false, cellStyles: false });
  } catch {
    throw new Error("Il file non è un foglio Excel leggibile.");
  }

  const nome = cartella.SheetNames.find((n) => FOGLIO_CALENDARIO.test(n));
  if (!nome) {
    throw new Error(
      `Manca il foglio "CALENDARIO E RISULTATI" (ci sono: ${cartella.SheetNames.join(", ")}).`
    );
  }

  const foglio = cartella.Sheets[nome];
  if (!foglio["!ref"]) return { titolo: titoloDi(foglio), partite: [] };

  if (!haIntestazione(foglio)) {
    throw new Error(
      "Il foglio non ha più \"Palestra\" in colonna H e \"Risultato\" in colonna J: "
      + "il modello UISP è cambiato e il lettore va aggiornato prima di fidarsi."
    );
  }

  const ultima = XLSX.utils.decode_range(foglio["!ref"]).e.r + 1;
  const partite = [];

  for (let riga = 1; riga <= ultima; riga++) {
    const gara = numero(foglio, `B${riga}`);
    const giorno = giornoDaSeriale(numero(foglio, `C${riga}`));
    const casa = testo(foglio, `E${riga}`);
    const ospite = testo(foglio, `G${riga}`);

    // Le righe di intestazione di ogni giornata e quelle vuote non hanno
    // un numero di gara: è il modo più sicuro di riconoscerle.
    if (gara === null || !Number.isInteger(gara) || gara <= 0) continue;
    if (!giorno || !casa || !ospite) continue;

    const serialeOra = numero(foglio, `D${riga}`);
    // Un'ora a zero è una cella lasciata vuota, non una partita a mezzanotte
    const ora = serialeOra ? oraDaSeriale(serialeOra) : null;

    partite.push({
      numero: String(gara),
      inizio: istanteRoma(giorno, ora ?? {}),
      tuttoIlGiorno: !ora,
      casa,
      ospite,
      luogo: testo(foglio, `H${riga}`) || null,
      note: testo(foglio, `I${riga}`) || null,
      ...esitoDi(foglio, riga)
    });
  }

  return { titolo: titoloDi(foglio), partite };
}
