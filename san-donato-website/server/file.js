/**
 * Da dove si leggono i file: l'indirizzo pubblico di un media.
 *
 * Sta in un file suo, staccato da archivio.js, per un motivo di peso: quello
 * importa l'SDK di S3, che sono megabyte, e questo serve anche dove un file
 * non si scrive mai — il controllo della sessione, che gira a OGNI richiesta,
 * deve sapere dov'è l'immagine del profilo ma non ha nessun motivo di
 * caricare un client per scrivere su Cloudflare.
 */

/** Vero quando i file si scrivono su disco invece che su R2 (solo in locale). */
export function archivioLocale() {
  return process.env.ARCHIVIO_LOCALE === "1";
}

/**
 * I prefissi che finiscono nell'archivio RISERVATO: un secondo bucket,
 * senza indirizzo pubblico. Oggi i certificati medici, che sono dati sulla
 * salute: si aprono solo passando da /api/file/:id, che controlla chi
 * chiede e poi dà un link firmato valido due minuti.
 *
 * Un elenco di prefissi e non un campo in tabella: dove sta un file lo
 * decide la sua chiave, scritta dal server al momento del caricamento, e
 * non una colonna che qualcuno potrebbe cambiare dopo.
 */
export const PREFISSI_PRIVATI = ["certificati"];

/** Vero se la chiave sta nell'archivio riservato. */
export function chiavePrivata(chiave) {
  return typeof chiave === "string"
    && PREFISSI_PRIVATI.some((p) => chiave.startsWith(`${p}/`));
}

/** Indirizzo pubblico di una chiave nell'archivio. */
export function urlPubblico(chiave) {
  if (!chiave) return null;

  // Un file riservato un indirizzo pubblico non ce l'ha, per costruzione
  if (chiavePrivata(chiave)) return null;

  const base = (process.env.URL_PUBBLICO_FILE || (archivioLocale() ? "/caricamenti" : ""))
    .replace(/\/+$/, "");

  return base ? `${base}/${chiave}` : null;
}

/**
 * L'indirizzo di un media, da qualunque parte si trovi.
 *
 * Durante la transizione convivono due casi: i file già su R2, che hanno una
 * chiave, e le centinaia ancora su WordPress, che hanno solo l'indirizzo
 * originale. Chi mostra un'immagine non deve sapere in quale dei due mondi
 * si trova.
 */
export function urlFile(chiave, urlOriginale) {
  return urlPubblico(chiave) ?? urlOriginale ?? null;
}

/**
 * L'indirizzo da dare al browser per un media di cui si conosce l'id.
 *
 * Per un file riservato è la nostra rotta, che controlla la sessione a ogni
 * apertura: un link copiato e mandato a qualcun altro non apre niente.
 */
export function urlLettura({ id, chiave, urlWp = null }) {
  if (chiavePrivata(chiave)) return `/api/file/${id}`;
  return urlFile(chiave, urlWp);
}
