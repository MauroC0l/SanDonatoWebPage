/**
 * Quello che la pagina Chi siamo ricava da ChiSiamo.json.
 *
 * Il JSON racconta la storia in frasi (il sottotitolo, la riga del
 * progetto educativo, i numeri separati da "•"). La pagina li mostra
 * anche come tappe, contatori e barre: invece di ricopiare date e numeri
 * qui, dove qualcuno si dimenticherebbe di aggiornarli, si leggono dalle
 * stesse frasi. Se una frase cambia forma, la tappa o il numero che non si
 * riesce più a leggere sparisce, e resta comunque il testo originale.
 */

const SENZA_TAG = /<[^>]+>/g;

/* "150 Volley • 134 Calcio • 16 Basket" → [{ quanti: 150, nome: "Volley" }, …] */
export function leggiNumeri(testo = "") {
  return testo
    .split("•")
    .map((pezzo) => pezzo.trim().match(/^(\d+)\s+(.+)$/))
    .filter(Boolean)
    .map(([, quanti, nome]) => ({ quanti: Number(quanti), nome }));
}

/* "CSI • UISP • FIGC • US Acli" → ["CSI", "UISP", "FIGC", "US Acli"] */
export function leggiElenco(testo = "") {
  return testo.split("•").map((s) => s.trim()).filter(Boolean);
}

/* Il numero in grassetto del sottotitolo: "<strong>350 tesseramenti</strong>" */
export function leggiTesseramenti(sottotitolo = "") {
  const m = sottotitolo.match(/<strong>\s*(\d+)\s*([^<]*)<\/strong>/);
  return m ? { quanti: Number(m[1]), nome: m[2].trim() } : null;
}

/* L'anno del distintivo: "Dal 2008 Insieme" → 2008 */
export function leggiAnno(testo = "") {
  const m = testo.match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

const maiuscola = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Le tappe della storia, nell'ordine in cui sono successe:
 * la nascita (dal sottotitolo), il progetto educativo (dalla riga in
 * fondo al JSON), oggi (i tesseramenti) e la stagione che si apre.
 */
export function tappeStoria({ hero, footer }, stagione) {
  const tappe = [];
  const piano = (hero.subtitle || "").replace(SENZA_TAG, "");

  // "Nata il 29 febbraio 2008 per educare attraverso lo sport, la Polisportiva…"
  const nascita = piano.match(/^(.*?\b\d{1,2}\s+\p{L}+\s+((?:19|20)\d{2})\b[^,]*),/u);
  if (nascita) {
    tappe.push({ quando: nascita[2], titolo: "La nascita", testo: `${nascita[1].trim()}.` });
  }

  // 'Progetto Educativo 2023 - 2026 "Sport al Futuro Presente"'
  const progetto = (footer || "").match(/^(.*?)\s*((?:19|20)\d{2})\s*-\s*((?:19|20)\d{2})\s*"([^"]+)"/);
  if (progetto) {
    tappe.push({
      quando: `${progetto[2]}–${progetto[3]}`,
      titolo: progetto[1].trim(),
      testo: `«${progetto[4]}»`,
    });
  }

  // "… oggi conta <strong>350 tesseramenti</strong>, fondati su valori …"
  const tesserati = leggiTesseramenti(hero.subtitle);
  if (tesserati) {
    const dopo = (hero.subtitle.split("</strong>")[1] || "").replace(SENZA_TAG, "").replace(/^[\s,]+/, "").trim();
    tappe.push({
      quando: "Oggi",
      numero: tesserati.quanti,
      titolo: tesserati.nome,
      testo: dopo ? maiuscola(dopo) : "",
    });
  }

  if (stagione) {
    tappe.push({ quando: stagione, titolo: "La nuova stagione", ancora: "chs-membership" });
  }
  return tappe;
}
