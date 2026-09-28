/**
 * Piccoli aiuti condivisi fra l'archivio (/news) e la pagina della singola
 * notizia (/news/:id). In un file a parte perché servono a tutte e due, e
 * un file di componenti che esporta anche funzioni rompe l'aggiornamento
 * a caldo di Vite.
 */

export const etichetteDi = (post) => (Array.isArray(post?.etichette) ? post.etichette : []);

/* Minivolley è pallavolo per chi legge: come filtro a sé faceva una voce in
   più che quasi nessuno avrebbe premuto. */
export const sportVisibile = (sport) => (sport === "Minivolley" ? "Pallavolo" : sport);

/**
 * La data di una notizia, dal campo ISO.
 *
 * Mai da `date`: quello è già formattato all'italiana ("07/09/2026"), e
 * new Date() lo legge come mese/giorno — o non lo legge affatto sopra il
 * dodici.
 */
export function quando(post) {
  const d = new Date(post?.dateISO ?? "");
  return isNaN(d.getTime()) ? new Date(0) : d;
}

const BREVE = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });
const LUNGA = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });

/* "7 set 2026": più leggibile di "07/09/2026" in una scheda, e non si
   confonde con le date all'americana. Se il campo ISO manca resta quella
   già formattata dal server. */
export function dataBreve(post) {
  const d = quando(post);
  return d.getTime() === 0 ? (post?.date ?? "") : BREVE.format(d).replace(".", "");
}

export function dataLunga(post) {
  const d = quando(post);
  return d.getTime() === 0 ? (post?.date ?? "") : LUNGA.format(d);
}

/* "oggi", "ieri", "3 giorni fa": per l'ultima uscita conta quanto è fresca,
   non il giorno esatto. Oltre il mese torna la data. */
export function daQuanto(post) {
  const d = quando(post);
  if (d.getTime() === 0) return post?.date ?? "";
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const giorno = new Date(d);
  giorno.setHours(0, 0, 0, 0);
  const giorni = Math.round((oggi - giorno) / 86400000);
  if (giorni <= 0) return "oggi";
  if (giorni === 1) return "ieri";
  if (giorni < 7) return `${giorni} giorni fa`;
  if (giorni < 14) return "una settimana fa";
  if (giorni < 31) return `${Math.floor(giorni / 7)} settimane fa`;
  return dataBreve(post);
}

/* Il testo nudo di un pezzo di HTML: per contare le parole e per l'alt
   delle immagini, dove i tag non devono finire. Il browser fa il lavoro
   (DOMParser non esegue niente di quello che legge). */
export function soloTesto(html) {
  if (!html) return "";
  if (typeof DOMParser === "undefined") return String(html).replace(/<[^>]+>/g, " ");
  return new DOMParser().parseFromString(String(html), "text/html").body.textContent ?? "";
}

/* Minuti di lettura, a duecento parole al minuto: la media di chi legge
   in italiano da uno schermo. Mai meno di uno. */
export function minutiDiLettura(html) {
  const parole = soloTesto(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(parole / 200));
}
