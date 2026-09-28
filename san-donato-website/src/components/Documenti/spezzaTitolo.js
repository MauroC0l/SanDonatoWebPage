/* L'ultima parola del titolo si accende d'arancio nell'apertura: i titoli
   arrivano dai JSON e non si può chiedere a chi li scrive di spezzarli a
   mano. In un file suo perché il ricaricamento a caldo di Vite vuole che
   i file dei componenti esportino solo componenti. */
export function spezzaTitolo(titolo = "") {
  const parole = titolo.trim().split(/\s+/);
  if (parole.length < 2) return { prima: "", accesa: titolo };
  return { prima: parole.slice(0, -1).join(" "), accesa: parole.at(-1) };
}
