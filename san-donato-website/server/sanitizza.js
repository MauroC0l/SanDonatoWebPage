/**
 * Ripulitura dell'HTML delle notizie.
 *
 * Il contenuto arriva da un editor e finisce in pagina con
 * dangerouslySetInnerHTML. Chi scrive è fidato, ma "fidato" non vuol dire
 * che possa iniettare uno <script> nel sito della società, né per malizia
 * né per un copia-incolla da una pagina altrui.
 *
 * La ripulitura si fa in SCRITTURA, una volta sola: così il contenuto nel
 * database è già sicuro e non dipende dal fatto che chi lo legge si ricordi
 * di ripulirlo.
 */

import sanitizeHtml from "sanitize-html";

const CONFIGURAZIONE = {
  allowedTags: [
    "p", "br", "hr",
    "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "blockquote", "code", "pre",
    "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tr", "th", "td",
    "span", "div"
  ],

  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "srcset", "sizes", "alt", "title", "width", "height", "loading"],
    // L'allineamento del testo è l'unico stile che l'editor produce
    "*": ["class"]
  },

  // Niente javascript: né data: negli href e nei src
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href", "src", "cite"],

  transformTags: {
    // Un link che apre una scheda nuova senza noopener lascia alla pagina
    // di destinazione un riferimento alla nostra: si chiude sempre.
    a: (nomeTag, attributi) => {
      if (attributi.target === "_blank") attributi.rel = "noopener noreferrer";
      return { tagName: nomeTag, attribs: attributi };
    }
  },

  // I commenti HTML possono nascondere di tutto e non servono a nulla
  allowedIframeHostnames: []
};

export function ripulisciHtml(html) {
  if (!html) return "";
  return sanitizeHtml(String(html), CONFIGURAZIONE);
}

/** Versione in solo testo, per sommari e ricerche. */
export function soloTesto(html, limite = null) {
  // Senza questo passaggio la fine di un paragrafo e l'inizio del successivo
  // si incollano: "Testo normale.trappola" invece di "Testo normale. trappola".
  const conSpazi = String(html ?? "")
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .replace(/<\/\s*(p|div|li|h[1-6]|blockquote|tr|figcaption|pre)\s*>/gi, " ");

  const testo = sanitizeHtml(conSpazi, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();

  if (!limite || testo.length <= limite) return testo;
  const tagliato = testo.slice(0, limite);
  return tagliato.slice(0, tagliato.lastIndexOf(" ")).trimEnd() + "…";
}

/** Indirizzo leggibile a partire dal titolo. */
export function creaSlug(testo) {
  return String(testo ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // toglie gli accenti
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "notizia";
}
