/*
 * I numeri di telefono: solo cifre, al massimo dieci (un cellulare
 * italiano; un fisso ne ha meno). Spazi, trattini e barre li scrive chi
 * copia il numero dalla rubrica, ma a chi lo compone servono le cifre.
 *
 * Sono le stesse regole della pagina Contatti dell'atleta: la segreteria
 * che corregge un numero dalla scheda deve trovare la stessa casella, e il
 * server le stesse cifre, chiunque le abbia scritte.
 *
 * Il +39 (o 0039) davanti si toglie invece di trasformarlo in "39…": è il
 * modo in cui la rubrica del telefono incolla quasi ogni numero, e tenerlo
 * farebbe dodici cifre che non stanno nel campo.
 */
export const CIFRE_TELEFONO = 10;

export function cifreTelefono(valore) {
  const testo = String(valore ?? "").trim();
  const cifre = testo.replace(/\D/g, "");
  if (testo.startsWith("+39")) return cifre.slice(2);
  if (testo.startsWith("0039")) return cifre.slice(4);
  return cifre;
}

/* Quello che si scrive o si incolla non va oltre le dieci cifre. Quello già
   salvato no: tagliarlo senza dirlo cambierebbe il numero, e un numero
   troppo lungo lo segnala il modulo al salvataggio. */
export const telefonoScritto = (valore) => cifreTelefono(valore).slice(0, CIFRE_TELEFONO);

/** Le proprietà di una casella di telefono: da stendere su un <input>. */
export function propsTelefono(valore, cambia) {
  return {
    type: "tel",
    inputMode: "numeric",
    /* Niente riempimento automatico: qui si scrive il numero di un altro,
       e il browser proporrebbe quello di chi sta alla tastiera. */
    autoComplete: "off",
    maxLength: CIFRE_TELEFONO,
    pattern: `[0-9]{6,${CIFRE_TELEFONO}}`,
    title: "Solo cifre, senza spazi: da sei a dieci.",
    value: valore,
    onChange: (e) => cambia(telefonoScritto(e.target.value)),
    /* maxLength taglierebbe l'incollato prima di togliergli spazi e +39:
       "+39 345 1234567" diventerebbe "39345123". Qui si pulisce intero. */
    onPaste: (e) => {
      e.preventDefault();
      cambia(telefonoScritto(e.clipboardData.getData("text")));
    }
  };
}
