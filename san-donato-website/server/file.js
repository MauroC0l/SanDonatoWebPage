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

/** Indirizzo pubblico di una chiave nell'archivio. */
export function urlPubblico(chiave) {
  if (!chiave) return null;

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
