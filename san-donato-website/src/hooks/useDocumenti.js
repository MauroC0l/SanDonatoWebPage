import { useEffect, useState } from "react";

/**
 * I documenti pubblicati sul sito (privacy, statuto, policy, rendiconti),
 * letti da /api/documenti.
 *
 * Prima erano scritti a mano nei file JSON delle pagine; ora li gestisce
 * l'amministratore dalla scheda "Documenti" dell'area riservata.
 *
 * UNA RICHIESTA SOLA PER TUTTA LA VISITA, per tutte le sezioni insieme. Il
 * menu "Documenti" dell'intestazione è su ogni pagina e ne ha bisogno
 * subito: chiedendo sezione per sezione, chi apre la Privacy farebbe due
 * richieste (menu e pagina) per una manciata di righe. Chiedendo tutto una
 * volta, la seconda pagina dei documenti è già pronta e non lampeggia.
 */

let elenco = null;        // i documenti, quando sono arrivati
let inCorso = null;       // la richiesta, mentre viaggia

function carica() {
  if (!inCorso) {
    /* "no-cache": il browser chiede sempre al server invece di usare la
       sua copia. La risposta dice stale-while-revalidate, e senza questo
       il browser mostrava la versione PRECEDENTE (e aggiornava dietro le
       quinte): chi nascondeva un documento lo ritrovava ancora sul sito.
       È una richiesta sola per visita, costa poco. */
    inCorso = fetch("/api/documenti", { headers: { Accept: "application/json" }, cache: "no-cache" })
      .then(async (risposta) => {
        if (!risposta.ok) throw new Error(`Errore ${risposta.status}`);
        const dati = await risposta.json();
        elenco = Array.isArray(dati.documenti) ? dati.documenti : [];
        return elenco;
      })
      .catch((err) => {
        // Si riprova alla prossima pagina che li chiede, non mai più
        inCorso = null;
        throw err;
      });
  }
  return inCorso;
}

/**
 * Dimentica i documenti letti. La chiama la scheda dell'amministratore
 * dopo ogni modifica: tornando sul sito senza ricaricare, deve vedere
 * quello che ha appena cambiato e non la copia di prima.
 */
export function dimenticaDocumenti() {
  elenco = null;
  inCorso = null;
}

/**
 * @param sezione  "menu", "privacy", "tutela_minori", "safeguarding",
 *                 "contributi", "cinque_per_mille"; senza, tutti.
 * @returns { documenti, caricamento, errore }
 *
 * I documenti arrivano già nell'ordine deciso dall'amministratore.
 */
export function useDocumenti(sezione) {
  // Se sono già arrivati si parte da quelli: niente attesa, niente salto
  const [stato, setStato] = useState(() => (
    elenco ? { tutti: elenco, caricamento: false, errore: "" } : { tutti: [], caricamento: true, errore: "" }
  ));

  useEffect(() => {
    if (elenco) return undefined;
    let attivo = true;
    carica()
      .then((tutti) => { if (attivo) setStato({ tutti, caricamento: false, errore: "" }); })
      .catch(() => {
        if (attivo) {
          setStato({ tutti: [], caricamento: false, errore: "I documenti non si sono caricati. Riprova fra poco." });
        }
      });
    return () => { attivo = false; };
  }, []);

  const documenti = sezione ? stato.tutti.filter((d) => d.sezione === sezione) : stato.tutti;
  return { documenti, caricamento: stato.caricamento, errore: stato.errore };
}

/** Il formato da scrivere sul foglio, dall'estensione: "PDF", "DOCX"… */
export function formatoDi(url) {
  // Solo il percorso: in "https://esempio.it" il ".it" non è un formato
  let percorso = "";
  try { percorso = new URL(url ?? "", "http://sito.locale").pathname; } catch { /* indirizzo storto */ }
  const estensione = /\.([a-z0-9]{2,5})$/i.exec(percorso)?.[1];
  if (estensione) return estensione.toUpperCase();
  // Un indirizzo web senza estensione è una pagina, non un foglio
  return /^https?:\/\//i.test(url ?? "") ? "WEB" : "PDF";
}

/** "2025-12-03" → "03/12/2025". Senza passare da Date: niente fusi orari. */
export function dataItaliana(iso) {
  const [a, m, g] = String(iso ?? "").split("-");
  return a && m && g ? `${g}/${m}/${a}` : "";
}
