/**
 * Il collegamento che porta qualcuno sul posto.
 *
 * Sta qui, e non dentro al componente che sceglie il luogo, perché serve a
 * due mondi diversi: al pannello, per provare il collegamento prima di
 * salvare, e al sito pubblico, per il pulsante "Apri su Maps". Importarlo
 * dal componente del pannello trascinerebbe Leaflet dentro al bundle che
 * scarica chiunque apra il calendario.
 *
 * Con le coordinate apre il punto esatto; senza, fa cercare a Google il testo
 * dell'indirizzo — che per "Campo Le Chiuse, Torino" funziona, ma per una
 * palestra con tre omonime in città no. È il motivo per cui le coordinate
 * esistono.
 *
 * La destinazione è Google Maps anche se il punto viene da OpenStreetMap:
 * l'applicazione che la gente ha già aperta sul telefono è quella, e la
 * coppia di coordinate è la stessa ovunque.
 */
export function linkMappa({ luogo, latitudine, longitudine } = {}) {
  if (latitudine != null && longitudine != null) {
    return `https://www.google.com/maps/search/?api=1&query=${latitudine}%2C${longitudine}`;
  }
  if (luogo) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(luogo)}`;
  }
  return null;
}
