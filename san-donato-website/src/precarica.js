/**
 * I pezzi di sito che si possono scaricare PRIMA che qualcuno li chieda.
 *
 * L'area riservata — accesso, registrazione e tutto quello che c'è dietro —
 * è un pacchetto a parte: chi visita il sito pubblico non ne scarica una
 * riga, ed è giusto così. Il prezzo è che al primo clic su "Accedi" quel
 * pacchetto va chiesto, e per qualche decimo di secondo non c'è niente da
 * mostrare.
 *
 * La soluzione che usano i siti fatti bene non è una rotella più bella: è
 * cominciare a scaricare quando il dito si avvicina al pulsante. Fra il
 * momento in cui il puntatore entra nel collegamento e il clic passano in
 * media due o trecento millisecondi — abbastanza perché il pacchetto sia
 * già arrivato, e la pagina compaia come se fosse sempre stata lì.
 *
 * Chiamarla più volte non costa niente: il browser tiene il modulo già
 * caricato e la seconda chiamata torna subito.
 */

let cominciato = false;

export function precaricaAreaRiservata() {
  if (cominciato) return;
  cominciato = true;

  /* L'errore si ingoia di proposito: questo è un anticipo, non un dovere.
     Se la rete cade adesso, il caricamento vero riproverà al clic e sarà
     quello a dirlo — qui un errore non avrebbe nessuno a cui parlare. */
  import("./components/Admin/AdminRoot").catch(() => { cominciato = false; });
}

/**
 * Da attaccare a un collegamento che porta nell'area riservata.
 *
 * Tre eventi e non uno: il puntatore per chi usa il mouse, il fuoco per chi
 * naviga da tastiera, il tocco per chi sta su un telefono — dove fra il
 * dito che si appoggia e il dito che si stacca passa comunque il tempo di
 * scaricare qualcosa.
 */
export const attesaAreaRiservata = {
  onMouseEnter: precaricaAreaRiservata,
  onFocus: precaricaAreaRiservata,
  onTouchStart: precaricaAreaRiservata
};
