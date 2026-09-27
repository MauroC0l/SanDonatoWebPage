/**
 * I formati di calendario ufficiale che il sito sa leggere.
 *
 * Aggiungere una federazione vuol dire aggiungere qui una voce: un nome da
 * mostrare all'amministratore e una funzione che, dato il contenuto di un
 * file, restituisce le partite di tutte le squadre nella forma comune
 * (vedi leggiUispPallavolo). Tutto il resto — trovare le nostre squadre,
 * collegarle, scrivere il calendario, accorgersi dei cambiamenti — è già
 * uguale per tutti.
 *
 * Il formato è una colonna di testo e non un tipo enumerato del database
 * proprio per questo: un formato nuovo è codice nuovo, e non deve portarsi
 * dietro anche una migrazione.
 */

import { leggiUispPallavolo } from "./uisp-pallavolo.js";

export const FORMATI = {
  uisp_pallavolo: {
    nome: "UISP Pallavolo",
    descrizione: "Un foglio Excel per girone, dal modello \"CALENDARIO E RISULTATI\" della UISP Torino.",
    sport: "Pallavolo",
    leggi: leggiUispPallavolo
  }
};

export const CODICI_FORMATO = Object.keys(FORMATI);

/** Quello che il pannello deve sapere dei formati, senza le funzioni. */
export function formatiPerPannello() {
  return Object.entries(FORMATI).map(([codice, f]) => ({
    codice,
    nome: f.nome,
    descrizione: f.descrizione,
    sport: f.sport
  }));
}
