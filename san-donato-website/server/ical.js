/**
 * Il calendario di una squadra in formato iCalendar (RFC 5545): quello che
 * Google Calendar, Apple Calendario e Outlook sanno ABBONARE.
 *
 * Abbonarsi non è importare: il telefono rilegge l'indirizzo da solo, ogni
 * qualche ora, e le partite spostate si spostano anche lì. È il modo di
 * portare il calendario sui telefoni delle famiglie senza che esista una
 * seconda copia da tenere allineata: la fonte resta il nostro database, e
 * i calendari Google di squadra — che erano vuoti — non servono più.
 *
 * Il formato è vecchio e pignolo, e le sue regole stanno tutte qui:
 *
 *   - righe chiuse da CRLF, non da un a capo semplice;
 *   - righe di al massimo 75 BYTE (non caratteri: "à" ne pesa due), le
 *     più lunghe si spezzano e continuano con uno spazio in testa;
 *   - virgola, punto e virgola, barra rovescia e a capo si "scappano";
 *   - un evento di un giorno intero ha date senza ora, e la fine è il
 *     giorno DOPO: il 3 ottobre dura dal 3 al 4.
 */

const DOMINIO_UID = "polisportivasandonato.org";

/* Senza una fine, Google disegna l'evento come un'istante. Una partita di
   pallavolo o di calcio sta dentro le due ore; per gli altri eventi un'ora
   è la durata che un calendario si aspetta. */
const DURATA_PARTITA_MS = 2 * 60 * 60 * 1000;
const DURATA_EVENTO_MS = 60 * 60 * 1000;

export function scappa(testo) {
  return String(testo ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Spezza una riga in pezzi da al massimo 75 byte, senza tagliare un carattere a metà. */
export function piega(riga) {
  const pezzi = [];
  let corrente = "";
  let byte = 0;

  for (const carattere of riga) {
    const peso = Buffer.byteLength(carattere);
    // La prima riga ha 75 byte; le seguenti 74, perché lo spazio in testa conta
    const massimo = pezzi.length === 0 ? 75 : 74;

    if (byte + peso > massimo) {
      pezzi.push(corrente);
      corrente = "";
      byte = 0;
    }
    corrente += carattere;
    byte += peso;
  }
  pezzi.push(corrente);

  return pezzi.join("\r\n ");
}

const dueCifre = (n) => String(n).padStart(2, "0");

/** 20261003T130000Z: sempre in UTC, così nessun fuso orario va dichiarato a parte. */
function istanteUtc(data) {
  const d = new Date(data);
  return `${d.getUTCFullYear()}${dueCifre(d.getUTCMonth() + 1)}${dueCifre(d.getUTCDate())}`
    + `T${dueCifre(d.getUTCHours())}${dueCifre(d.getUTCMinutes())}${dueCifre(d.getUTCSeconds())}Z`;
}

const GIORNO_ROMA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit"
});

/** 20261003: il giorno com'è a Torino, per gli eventi senza orario. */
function giornoRoma(data) {
  return GIORNO_ROMA.format(new Date(data)).replace(/-/g, "");
}

function giornoDopo(aaaammgg) {
  const d = new Date(Date.UTC(Number(aaaammgg.slice(0, 4)), Number(aaaammgg.slice(4, 6)) - 1, Number(aaaammgg.slice(6, 8)) + 1));
  return `${d.getUTCFullYear()}${dueCifre(d.getUTCMonth() + 1)}${dueCifre(d.getUTCDate())}`;
}

/** Il testo della descrizione: quello che serve a chi guarda la partita sul telefono. */
function descrizioneDi(evento) {
  const righe = [];

  if (evento.inCasa === true) righe.push("In casa");
  if (evento.inCasa === false) righe.push("In trasferta");
  if (evento.risultato) {
    righe.push(`Risultato: ${evento.risultato}${evento.parziali ? ` (${evento.parziali})` : ""}`);
  }
  if (evento.marcatori?.length) righe.push(`Marcatori: ${evento.marcatori.join(", ")}`);
  if (evento.noteUfficiali) righe.push(evento.noteUfficiali);
  if (evento.descrizione) righe.push(evento.descrizione);
  if (evento.diretta) righe.push(`Diretta: ${evento.diretta}`);

  return righe.join("\n");
}

function vevento(evento, adesso) {
  const inizio = new Date(evento.inizio);
  const ePartita = evento.tipo === "partita" || evento.tipo === "torneo";
  const righe = [
    "BEGIN:VEVENT",
    // Stabile per sempre: è quello che fa riconoscere al telefono che la
    // partita spostata è la stessa di prima, e non una seconda.
    `UID:evento-${evento.id}@${DOMINIO_UID}`,
    `DTSTAMP:${istanteUtc(adesso)}`
  ];

  if (evento.tuttoIlGiorno) {
    const primo = giornoRoma(inizio);
    const ultimo = evento.fine ? giornoRoma(evento.fine) : primo;
    righe.push(`DTSTART;VALUE=DATE:${primo}`, `DTEND;VALUE=DATE:${giornoDopo(ultimo)}`);
  } else {
    const fine = evento.fine
      ? new Date(evento.fine)
      : new Date(inizio.getTime() + (ePartita ? DURATA_PARTITA_MS : DURATA_EVENTO_MS));
    righe.push(`DTSTART:${istanteUtc(inizio)}`, `DTEND:${istanteUtc(fine)}`);
  }

  // Il risultato nel titolo: sul telefono si legge senza aprire l'evento
  const titolo = evento.risultato ? `${evento.titolo} (${evento.risultato})` : evento.titolo;
  righe.push(`SUMMARY:${scappa(titolo)}`);

  if (evento.luogo) righe.push(`LOCATION:${scappa(evento.luogo)}`);
  if (evento.latitudine != null && evento.longitudine != null) {
    righe.push(`GEO:${evento.latitudine};${evento.longitudine}`);
  }

  const descrizione = descrizioneDi(evento);
  if (descrizione) righe.push(`DESCRIPTION:${scappa(descrizione)}`);
  if (evento.diretta) righe.push(`URL:${evento.diretta}`);

  righe.push("END:VEVENT");
  return righe;
}

/**
 * @param squadra  { id, nome }
 * @param eventi   gli eventi come li restituisce elencaEventi(), già filtrati:
 *                 solo quelli visibili sul sito, senza le partite sparite
 */
export function calendarioIcs(squadra, eventi, { adesso = new Date() } = {}) {
  const righe = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Polisportiva San Donato//Calendario squadre//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${scappa(`${squadra.nome} · PSD`)}`,
    "X-WR-TIMEZONE:Europe/Rome",
    `X-WR-CALDESC:${scappa(`Partite e appuntamenti di ${squadra.nome}, Polisportiva San Donato`)}`,
    /* Ogni quanto rileggere. È un suggerimento: Google decide da sé e di
       solito ci mette di più, Apple lo rispetta. Sei ore bastano per le
       partite spostate, che si sanno giorni prima. */
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H"
  ];

  for (const evento of eventi) righe.push(...vevento(evento, adesso));
  righe.push("END:VCALENDAR");

  return `${righe.map(piega).join("\r\n")}\r\n`;
}
