/**
 * Stato del certificato medico: una regola sola, in un posto solo.
 *
 * La leggono in tre — l'elenco degli atleti, la scheda del singolo e la
 * pagina dell'iscrizione — e devono dire tutte la stessa cosa. Quando ognuna
 * decideva per conto suo, la stessa persona risultava "Valido" in una
 * schermata e "file non caricato" in un'altra.
 *
 * VALIDO VUOL DIRE TRE COSE INSIEME, non una:
 *
 *   1. c'è il FILE. Una data battuta a mano non è un certificato: è una
 *      promessa. Senza il foglio, quel ragazzo non può scendere in campo.
 *   2. la segreteria l'ha GUARDATO e accettato. Arriva la foto storta, la
 *      pagina sbagliata, il certificato dell'anno prima, quello non
 *      agonistico per chi fa campionato.
 *   3. la data non è PASSATA.
 *
 * Il giorno di riferimento si passa da fuori invece di leggere l'orologio
 * qui: così la funzione dà sempre la stessa risposta alle stesse domande, e
 * chi disegna la pagina non si ritrova un risultato diverso a ogni passaggio.
 */

/** Sotto questa soglia la scadenza è "vicina": un mese basta per rifarlo. */
export const GIORNI_PREAVVISO = 30;

export const STATI_CERTIFICATO = {
  mancante: { etichetta: "Nessun certificato", classe: "adm-cert-mancante" },
  senza_file: { etichetta: "Manca la copia", classe: "adm-cert-mancante" },
  respinto: { etichetta: "Respinto", classe: "adm-cert-scaduto" },
  da_controllare: { etichetta: "Da controllare", classe: "adm-cert-scadenza" },
  scaduto: { etichetta: "Scaduto", classe: "adm-cert-scaduto" },
  in_scadenza: { etichetta: "In scadenza", classe: "adm-cert-scadenza" },
  valido: { etichetta: "Valido", classe: "adm-cert-valido" }
};

/**
 * @param scadenza     la data come "2026-05-14", oppure null
 * @param oggi         il giorno di riferimento (Date)
 * @param fileCaricato se la copia è stata consegnata
 * @param validazione  "da_validare" | "valido" | "rifiutato"
 * @returns { chiave, etichetta, classe, giorni }  giorni è negativo se scaduto
 */
export function statoCertificato(scadenza, oggi, { fileCaricato = false, validazione } = {}) {
  const nulla = (chiave, giorni = null) => ({ chiave, ...STATI_CERTIFICATO[chiave], giorni });

  if (!scadenza && !fileCaricato) return nulla("mancante");

  // Mezzanotte da entrambe le parti: contando con l'ora, un certificato che
  // scade oggi risulterebbe scaduto solo dal pomeriggio in poi.
  const giorni = scadenza
    ? Math.round(
      (new Date(`${scadenza}T00:00:00`)
        - new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate())) / 86400000
    )
    : null;

  /* Scaduto batte tutto: un certificato approvato ma vecchio non fa scendere
     in campo nessuno, e dirlo "valido" sarebbe pericoloso. */
  if (giorni != null && giorni < 0) return nulla("scaduto", giorni);

  if (validazione === "rifiutato") return nulla("respinto", giorni);

  // La data senza il foglio: è il caso più comune fra chi compila da solo.
  if (!fileCaricato) return nulla("senza_file", giorni);

  if (validazione === "da_validare") return nulla("da_controllare", giorni);

  if (giorni != null && giorni <= GIORNI_PREAVVISO) return nulla("in_scadenza", giorni);

  return nulla("valido", giorni);
}

/** Vero quando quella persona può scendere in campo. */
export function inRegola(stato) {
  return stato.chiave === "valido" || stato.chiave === "in_scadenza";
}

/** "fra 12 giorni", "scaduto da 3 giorni", "oggi". */
export function quantoManca(giorni) {
  if (giorni == null) return "";
  if (giorni === 0) return "scade oggi";
  if (giorni === 1) return "scade domani";
  if (giorni > 0) return `fra ${giorni} giorni`;
  if (giorni === -1) return "scaduto ieri";
  return `scaduto da ${Math.abs(giorni)} giorni`;
}
