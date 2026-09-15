/**
 * L'elenco delle rotte: quale indirizzo porta a quale funzione.
 *
 * Scritto per esteso e non scoperto leggendo la cartella, come faceva il
 * server di sviluppo. Il motivo è che su Vercel il codice viene impacchettato
 * prima di partire, e chi lo impacchetta segue le importazioni scritte: un
 * `import(percorso)` calcolato a tempo di esecuzione non lo vedrebbe, e in
 * produzione mancherebbe metà del sito senza che niente lo annunci.
 *
 * ATTENZIONE: aggiungendo un file in server/rotte/ va aggiunto anche qui.
 * Non è una raccomandazione che si può dimenticare — c'è un test che
 * confronta questo elenco con i file sul disco e fallisce se divergono.
 */

import rotta_accesso from "./rotte/accesso.js";
import rotta_admin_atleti_index from "./rotte/admin/atleti/index.js";
import rotta_admin_carica_file from "./rotte/admin/carica-file.js";
import rotta_admin_eventi_index from "./rotte/admin/eventi/index.js";
import rotta_admin_iscrizioni from "./rotte/admin/iscrizioni.js";
import rotta_admin_media_index from "./rotte/admin/media/index.js";
import rotta_admin_media_cartelle_index from "./rotte/admin/media/cartelle/index.js";
import rotta_admin_notizie_index from "./rotte/admin/notizie/index.js";
import rotta_admin_quote_index from "./rotte/admin/quote/index.js";
import rotta_admin_registro from "./rotte/admin/registro.js";
import rotta_admin_squadre_index from "./rotte/admin/squadre/index.js";
import rotta_admin_utenti from "./rotte/admin/utenti.js";
import rotta_cambia_password from "./rotte/cambia-password.js";
import rotta_cruscotto from "./rotte/cruscotto.js";
import rotta_eventi_index from "./rotte/eventi/index.js";
import rotta_eventi_risultati from "./rotte/eventi/risultati.js";
import rotta_io from "./rotte/io.js";
import rotta_iscrizione from "./rotte/iscrizione.js";
import rotta_newsletter from "./rotte/newsletter.js";
import rotta_notizie_index from "./rotte/notizie/index.js";
import rotta_notizie_ultime_per_sport from "./rotte/notizie/ultime-per-sport.js";
import rotta_profilo from "./rotte/profilo.js";
import rotta_registrazione from "./rotte/registrazione.js";
import rotta_squadre from "./rotte/squadre.js";
import rotta_uscita from "./rotte/uscita.js";
import rotta_admin_atleti_id from "./rotte/admin/atleti/[id].js";
import rotta_admin_atleti_id_certificato from "./rotte/admin/atleti/[id]/certificato.js";
import rotta_admin_eventi_id from "./rotte/admin/eventi/[id].js";
import rotta_admin_eventi_id_media from "./rotte/admin/eventi/[id]/media.js";
import rotta_admin_media_id from "./rotte/admin/media/[id].js";
import rotta_admin_media_cartelle_id from "./rotte/admin/media/cartelle/[id].js";
import rotta_admin_notizie_id from "./rotte/admin/notizie/[id].js";
import rotta_admin_quote_id from "./rotte/admin/quote/[id].js";
import rotta_admin_squadre_id from "./rotte/admin/squadre/[id].js";
import rotta_notizie_identificativo from "./rotte/notizie/[identificativo].js";

/*
 * Le rotte FISSE stanno prima di quelle con un [parametro]: senza
 * quest'ordine, /api/notizie/ultime-per-sport finirebbe dentro
 * /api/notizie/[identificativo] e risponderebbe "notizia non trovata".
 */
const TABELLA = [
  ["accesso",                        rotta_accesso],
  ["admin/atleti",                   rotta_admin_atleti_index],
  ["admin/carica-file",              rotta_admin_carica_file],
  ["admin/eventi",                   rotta_admin_eventi_index],
  ["admin/iscrizioni",               rotta_admin_iscrizioni],
  ["admin/media",                    rotta_admin_media_index],
  ["admin/media/cartelle",           rotta_admin_media_cartelle_index],
  ["admin/notizie",                  rotta_admin_notizie_index],
  ["admin/quote",                    rotta_admin_quote_index],
  ["admin/registro",                 rotta_admin_registro],
  ["admin/squadre",                  rotta_admin_squadre_index],
  ["admin/utenti",                   rotta_admin_utenti],
  ["cambia-password",                rotta_cambia_password],
  ["cruscotto",                      rotta_cruscotto],
  ["eventi",                         rotta_eventi_index],
  ["eventi/risultati",               rotta_eventi_risultati],
  ["io",                             rotta_io],
  ["iscrizione",                     rotta_iscrizione],
  ["newsletter",                     rotta_newsletter],
  ["notizie",                        rotta_notizie_index],
  ["notizie/ultime-per-sport",       rotta_notizie_ultime_per_sport],
  ["profilo",                        rotta_profilo],
  ["registrazione",                  rotta_registrazione],
  ["squadre",                        rotta_squadre],
  ["uscita",                         rotta_uscita],
  ["admin/atleti/[id]",              rotta_admin_atleti_id],
  ["admin/atleti/[id]/certificato",  rotta_admin_atleti_id_certificato],
  ["admin/eventi/[id]",              rotta_admin_eventi_id],
  ["admin/eventi/[id]/media",        rotta_admin_eventi_id_media],
  ["admin/media/[id]",               rotta_admin_media_id],
  ["admin/media/cartelle/[id]",      rotta_admin_media_cartelle_id],
  ["admin/notizie/[id]",             rotta_admin_notizie_id],
  ["admin/quote/[id]",               rotta_admin_quote_id],
  ["admin/squadre/[id]",             rotta_admin_squadre_id],
  ["notizie/[identificativo]",       rotta_notizie_identificativo],
];

/** "admin/atleti/[id]" -> i pezzi da confrontare con l'indirizzo chiesto. */
function segmentiDi(percorso) {
  return percorso.split("/").filter(Boolean).map((pezzo) => {
    const dinamico = pezzo.match(/^\[(.+)\]$/);
    return dinamico
      ? { tipo: "parametro", nome: dinamico[1] }
      : { tipo: "fisso", valore: pezzo };
  });
}

export const ROTTE = TABELLA.map(([percorso, handler]) => ({
  percorso,
  segmenti: segmentiDi(percorso),
  handler
}));

/**
 * Quale rotta risponde a questo indirizzo, e con quali parametri.
 *
 * Riceve i pezzi del percorso senza "/api/" davanti e GIÀ DECODIFICATI:
 * scioglierli è compito di chi legge la richiesta, perché a seconda di
 * come arriva — dall'indirizzo o da una riscrittura — sono già sciolti
 * oppure no, e farlo due volte cambierebbe i nomi che contengono un %.
 *
 * Restituisce null se non risponde nessuno: sta a chi chiama decidere
 * cosa dire, che in fondo è sempre un 404.
 */
export function trovaRotta(pezzi) {
  for (const rotta of ROTTE) {
    if (rotta.segmenti.length !== pezzi.length) continue;

    const parametri = {};
    let combacia = true;

    for (let i = 0; i < rotta.segmenti.length; i++) {
      const atteso = rotta.segmenti[i];

      if (atteso.tipo === "parametro") {
        parametri[atteso.nome] = pezzi[i];
      } else if (atteso.valore !== pezzi[i]) {
        combacia = false;
        break;
      }
    }

    if (combacia) return { rotta, parametri };
  }

  return null;
}
