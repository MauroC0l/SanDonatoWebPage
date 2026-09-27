/**
 * Le cartelle Google Drive dei calendari ufficiali: cosa contengono e
 * come si scarica un file.
 *
 * Le cartelle le pubblica la federazione e sono aperte a chiunque abbia il
 * collegamento: per leggerle non serve un account. Le strade sono due:
 *
 *   - con GOOGLE_DRIVE_API_KEY, l'API ufficiale di Drive. È quella da
 *     preferire: è documentata e non cambia da un giorno all'altro. La
 *     chiave si crea gratis su Google Cloud, con l'API di Drive attiva, e
 *     non dà accesso a niente che non sia già pubblico;
 *   - senza chiave, la pagina pubblica con cui Google mostra una cartella
 *     condivisa dentro a un sito. Funziona subito, ma è una pagina e non
 *     un'API: se Google la ridisegna, l'elenco torna vuoto. Per questo un
 *     elenco vuoto è trattato come un ERRORE e non come "la federazione ha
 *     tolto tutti i file" — vedi sincronizza.js.
 *
 * Si leggono solo fogli di calcolo: un PDF o un'immagine nella stessa
 * cartella non sono un calendario che sappiamo leggere, e scaricarli
 * vorrebbe dire sprecare il tempo della lettura notturna.
 */

// Per tentativo: tre tentativi da 12 secondi stanno dentro al minuto che Vercel
// concede alla funzione, anche nel caso peggiore.
const ATTESA_MS = 12_000;

/* Oltre questa profondità una cartella di calendari non ha senso: è un
   collegamento sbagliato che porta in un archivio intero. */
const PROFONDITA_MASSIMA = 3;

const TIPO_CARTELLA = "application/vnd.google-apps.folder";
const TIPO_FOGLIO_GOOGLE = "application/vnd.google-apps.spreadsheet";
const TIPI_FOGLIO = new Set([
  TIPO_FOGLIO_GOOGLE,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel"
]);

/**
 * L'identificativo di una cartella a partire da quello che l'amministratore
 * incolla: il collegamento intero, con o senza "?usp=sharing", o il solo
 * identificativo.
 */
export function idCartella(testo) {
  const t = String(testo ?? "").trim();

  const daIndirizzo = t.match(/\/folders\/([A-Za-z0-9_-]{10,})/)
    ?? t.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (daIndirizzo) return daIndirizzo[1];

  return /^[A-Za-z0-9_-]{10,}$/.test(t) ? t : null;
}

export function indirizzoCartella(id) {
  return `https://drive.google.com/drive/folders/${id}`;
}

/* Le pause fra un tentativo e l'altro. Tre tentativi, perché la lettura
   notturna non la guarda nessuno: un intoppo di rete di un secondo — e
   capita, provato — non deve costare una notte senza aggiornamenti. */
const PAUSE_MS = [1_000, 3_000];

const aspetta = (ms) => new Promise((fatto) => setTimeout(fatto, ms));

/**
 * Una richiesta a Google, ritentata se la rete o Google inciampano.
 *
 * Si ritenta solo quello che può andare meglio fra un secondo: la rete che
 * non risponde e gli errori 5xx di Google. Un 404 resta un 404.
 */
async function chiedi(url) {
  let ultimo;

  for (let tentativo = 0; tentativo <= PAUSE_MS.length; tentativo++) {
    if (tentativo > 0) await aspetta(PAUSE_MS[tentativo - 1]);

    try {
      const risposta = await fetch(url, { signal: AbortSignal.timeout(ATTESA_MS), redirect: "follow" });
      if (risposta.status < 500) return risposta;
      ultimo = new Error(`Google Drive ha risposto ${risposta.status}.`);
    } catch (e) {
      ultimo = e;
    }
  }

  // "fetch failed" non dice niente a chi lo legge nel pannello
  throw new Error(
    `Google Drive non risponde (${ultimo?.cause?.code ?? ultimo?.message ?? "errore di rete"}), `
    + "nemmeno dopo tre tentativi. Non ho cambiato niente: riprovo alla prossima lettura."
  );
}

/* =====================================================
   Elenco dei file
   ===================================================== */

async function elencoConApi(cartellaId, chiave) {
  const voci = [];
  let pagina = null;

  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${cartellaId}' in parents and trashed = false`);
    url.searchParams.set("fields", "nextPageToken, files(id, name, mimeType, modifiedTime)");
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("key", chiave);
    if (pagina) url.searchParams.set("pageToken", pagina);

    const risposta = await chiedi(url);
    if (!risposta.ok) {
      const dettaglio = await risposta.text().catch(() => "");
      throw new Error(`Drive ha risposto ${risposta.status}: ${dettaglio.slice(0, 160)}`);
    }

    const dati = await risposta.json();
    for (const f of dati.files ?? []) {
      voci.push({ id: f.id, nome: f.name, tipo: f.mimeType, modificatoIl: f.modifiedTime ?? null });
    }
    pagina = dati.nextPageToken ?? null;
  } while (pagina);

  return voci;
}

const decodifica = (s) => s
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/**
 * L'elenco dalla pagina pubblica della cartella.
 *
 * Ogni file è un blocco "flip-entry" con l'identificativo, il nome e
 * l'icona del tipo — il cui indirizzo contiene il tipo MIME per esteso,
 * che è l'unico modo di distinguere un foglio da una sottocartella.
 */
export function vociDaPaginaPubblica(html) {
  const voci = [];

  for (const blocco of String(html).split('class="flip-entry"').slice(1)) {
    const id = blocco.match(/^\s*id="entry-([A-Za-z0-9_-]+)"/)?.[1];
    const nome = blocco.match(/class="flip-entry-title">([^<]*)</)?.[1];
    if (!id || nome === undefined) continue;

    const tipoIcona = blocco.match(/\/type\/([^"]+)"/)?.[1];
    const eCartella = /\/drive\/folders\//.test(blocco) || tipoIcona === TIPO_CARTELLA;

    voci.push({
      id,
      nome: decodifica(nome).trim(),
      tipo: eCartella ? TIPO_CARTELLA : (tipoIcona ?? null),
      modificatoIl: null
    });
  }

  return voci;
}

async function elencoPubblico(cartellaId) {
  const risposta = await chiedi(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(cartellaId)}`);

  if (risposta.status === 404) {
    throw new Error("La cartella non esiste, oppure non è condivisa con chiunque abbia il collegamento.");
  }
  if (!risposta.ok) throw new Error(`Drive ha risposto ${risposta.status}.`);

  return vociDaPaginaPubblica(await risposta.text());
}

/**
 * I fogli di calcolo di una cartella, sottocartelle comprese.
 *
 * @returns {Promise<Array<{ id, nome, tipo, modificatoIl }>>}
 */
export async function fogliDellaCartella(cartellaId, { profondita = 0 } = {}) {
  const chiave = process.env.GOOGLE_DRIVE_API_KEY;
  const voci = chiave ? await elencoConApi(cartellaId, chiave) : await elencoPubblico(cartellaId);

  const fogli = [];
  for (const voce of voci) {
    if (voce.tipo === TIPO_CARTELLA) {
      if (profondita < PROFONDITA_MASSIMA) {
        fogli.push(...await fogliDellaCartella(voce.id, { profondita: profondita + 1 }));
      }
    } else if (TIPI_FOGLIO.has(voce.tipo) || /\.xlsx?$/i.test(voce.nome)) {
      fogli.push(voce);
    }
  }

  return fogli;
}

/* =====================================================
   Scaricamento
   ===================================================== */

/* Ogni .xlsx è un archivio zip: comincia con "PK". Una pagina HTML di
   errore o di accesso no, e va riconosciuta prima di darla al lettore. */
function eUnFoglioExcel(contenuto) {
  return contenuto.length > 4 && contenuto[0] === 0x50 && contenuto[1] === 0x4b;
}

async function scaricaDa(url) {
  const risposta = await chiedi(url);
  if (!risposta.ok) return null;

  const contenuto = Buffer.from(await risposta.arrayBuffer());
  return eUnFoglioExcel(contenuto) ? contenuto : null;
}

/**
 * Il contenuto di un foglio, in formato .xlsx.
 *
 * Un foglio Google non ha un file da scaricare: va esportato. Un .xlsx
 * caricato così com'è invece si scarica e basta. Dall'elenco pubblico il
 * tipo non sempre si sa, quindi si prova l'esportazione e, se non è un
 * foglio Google, lo scaricamento diretto.
 */
export async function scaricaFoglio(voce) {
  const chiave = process.env.GOOGLE_DRIVE_API_KEY;
  const id = encodeURIComponent(voce.id);
  const xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const tentativi = chiave
    ? (voce.tipo === TIPO_FOGLIO_GOOGLE
        ? [`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(xlsx)}&key=${chiave}`]
        : [`https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${chiave}`])
    : (voce.tipo === TIPO_FOGLIO_GOOGLE || !voce.tipo
        ? [`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,
           `https://drive.google.com/uc?export=download&id=${id}`]
        : [`https://drive.google.com/uc?export=download&id=${id}`,
           `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`]);

  for (const url of tentativi) {
    const contenuto = await scaricaDa(url);
    if (contenuto) return contenuto;
  }

  throw new Error("Il file non si scarica come foglio Excel (non è pubblico, o non è un foglio).");
}
