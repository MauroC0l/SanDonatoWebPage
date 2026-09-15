/**
 * Lettura delle notizie: interrogazioni condivise fra le API pubbliche e
 * quelle del pannello.
 *
 * Sta qui e non dentro ai singoli endpoint perché la forma con cui una
 * notizia esce deve essere una sola: se il pannello e il sito pubblico la
 * componessero ciascuno per conto proprio, prima o poi divergerebbero.
 */

import { urlFile } from "./file.js";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { notizie, media, utenti } from "../db/schema.js";

/**
 * Cosa vede il sito pubblico: pubblicata E con la data di pubblicazione già
 * passata.
 *
 * È così che funziona la programmazione, e volutamente senza stato nuovo né
 * lavoro pianificato: una notizia programmata è già "pubblicata", ha solo una
 * data nel futuro, e diventa visibile da sola quando l'orologio la supera.
 *
 * L'alternativa — uno stato "programmata" e un processo che a una certa ora
 * lo cambia — richiede qualcosa che giri a intervalli regolari. Su Vercel le
 * funzioni esistono solo mentre arriva una richiesta: quel processo andrebbe
 * aggiunto, pagato e sorvegliato, e il giorno che si inceppa le notizie
 * restano invisibili senza che nessuno se ne accorga.
 *
 * L'indice idx_notizie_elenco è già su (stato, pubblicata_il): copre
 * entrambe le condizioni senza aggiungerne uno.
 */
function condizioneVisibile() {
  return and(
    eq(notizie.stato, "pubblicata"),
    sql`${notizie.pubblicataIl} is not null and ${notizie.pubblicataIl} <= now()`
  );
}

/**
 * L'altra metà: pubblicata ma non ancora sul sito, cioè programmata.
 *
 * È scritta come la NEGAZIONE esatta della condizione qui sopra, dentro alle
 * notizie pubblicate, e non come "data nel futuro". Le due formulazioni si
 * assomigliano ma non coincidono: una notizia pubblicata senza data non
 * sarebbe né visibile né "nel futuro", e sparirebbe da entrambi i filtri del
 * pannello senza che nessuno possa più trovarla. Così invece ogni riga
 * pubblicata cade in uno dei due, sempre.
 */
function condizioneProgrammata() {
  return and(
    eq(notizie.stato, "pubblicata"),
    sql`not (${notizie.pubblicataIl} is not null and ${notizie.pubblicataIl} <= now())`
  );
}

/**
 * Indirizzo pubblico di un file.
 *
 * Finché i file stanno su WordPress si usa l'indirizzo originale. Quando
 * passeranno su R2 basterà che "chiave" sia valorizzata e che
 * URL_PUBBLICO_FILE sia impostata: gli articoli non vanno toccati.
 */

/** Colonne restituite da ogni interrogazione sulle notizie. */
const COLONNE = {
  id: notizie.id,
  wpId: notizie.wpId,
  slug: notizie.slug,
  titolo: notizie.titolo,
  sommario: notizie.sommario,
  contenuto: notizie.contenuto,
  sport: notizie.sport,
  categoria: notizie.categoria,
  stato: notizie.stato,
  pubblicataIl: notizie.pubblicataIl,
  creataIl: notizie.creataIl,
  aggiornataIl: notizie.aggiornataIl,
  copertinaId: notizie.copertinaId,
  copertinaChiave: media.chiave,
  copertinaUrlWp: media.urlOriginaleWp,
  copertinaAlt: media.alt,
  autoreNome: utenti.nome,
  autoreCognome: utenti.cognome
};

function daRiga(riga, { conContenuto = true } = {}) {
  const autore = [riga.autoreNome, riga.autoreCognome].filter(Boolean).join(" ");

  return {
    id: riga.id,
    wpId: riga.wpId,
    slug: riga.slug,
    titolo: riga.titolo,
    sommario: riga.sommario ?? "",
    ...(conContenuto ? { contenuto: riga.contenuto } : {}),
    sport: riga.sport,
    categoria: riga.categoria,
    stato: riga.stato,
    copertinaId: riga.copertinaId ?? null,
    copertina: urlFile(riga.copertinaChiave, riga.copertinaUrlWp),
    copertinaAlt: riga.copertinaAlt ?? "",
    autore: autore || "Staff",
    pubblicataIl: riga.pubblicataIl,
    aggiornataIl: riga.aggiornataIl
  };
}

function base(db) {
  return db
    .select(COLONNE)
    .from(notizie)
    .leftJoin(media, eq(media.id, notizie.copertinaId))
    .leftJoin(utenti, eq(utenti.id, notizie.autoreId));
}

/**
 * Elenco paginato.
 *
 * `soloPubblicate` è il confine fra sito pubblico e pannello: da fuori non
 * deve esistere alcun modo di vedere una bozza o un articolo cestinato.
 */
export async function elencaNotizie({
  pagina = 1,
  perPagina = 12,
  sport,
  categoria,
  stato,
  cerca,
  soloPubblicate = true,
  conContenuto = false
} = {}) {
  const db = getDb();
  const condizioni = [];

  // Il pannello chiede più stati insieme ("bozza,in_revisione" per dire "le
  // non pubblicate"): arriva come elenco o come stringa con le virgole.
  const stati = Array.isArray(stato)
    ? stato
    : String(stato ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  /**
   * Ogni voce del filtro diventa una condizione, e le condizioni si sommano
   * in OR.
   *
   * Non si può più usare inArray sulla colonna: "programmata" non è un valore
   * dello stato, è "pubblicata con la data ancora da venire". E per simmetria
   * "pubblicata" qui significa davvero online, non solo con quello stato in
   * tabella: altrimenti le due voci si sovrapporrebbero e la stessa notizia
   * comparirebbe sotto entrambe.
   */
  const condizioneDi = (s) => {
    if (s === "pubblicata") return condizioneVisibile();
    if (s === "programmata") return condizioneProgrammata();
    return eq(notizie.stato, s);
  };

  if (soloPubblicate) {
    condizioni.push(condizioneVisibile());
  } else if (stati.length === 1) {
    condizioni.push(condizioneDi(stati[0]));
  } else if (stati.length > 1) {
    condizioni.push(or(...stati.map(condizioneDi)));
  } else {
    // Nel pannello il cestino si guarda apposta, non per sbaglio
    condizioni.push(sql`${notizie.stato} <> 'cestino'`);
  }

  if (sport) condizioni.push(eq(notizie.sport, sport));
  if (categoria) condizioni.push(eq(notizie.categoria, categoria));

  if (cerca) {
    const modello = `%${cerca}%`;
    condizioni.push(or(ilike(notizie.titolo, modello), ilike(notizie.sommario, modello)));
  }

  const dove = condizioni.length ? and(...condizioni) : undefined;

  const [{ totale }] = await db
    .select({ totale: sql`count(*)::int` })
    .from(notizie)
    .where(dove);

  const righe = await base(db)
    .where(dove)
    // Le bozze non hanno data di pubblicazione: si ordinano per creazione
    .orderBy(desc(sql`coalesce(${notizie.pubblicataIl}, ${notizie.creataIl})`))
    .limit(perPagina)
    .offset((pagina - 1) * perPagina);

  return {
    notizie: righe.map((r) => daRiga(r, { conContenuto })),
    totale,
    pagina,
    perPagina,
    pagine: Math.max(1, Math.ceil(totale / perPagina))
  };
}

/**
 * Una notizia sola.
 *
 * L'identificativo può essere lo slug, il nostro id, oppure il vecchio id
 * di WordPress: i collegamenti già condivisi usano quest'ultimo e devono
 * continuare a funzionare. Il wp_id ha la precedenza proprio per quello.
 */
export async function trovaNotizia(identificativo, { soloPubblicate = true } = {}) {
  const db = getDb();
  const numero = Number(identificativo);

  const condizione = Number.isInteger(numero) && numero > 0
    ? or(eq(notizie.wpId, numero), eq(notizie.id, numero))
    : eq(notizie.slug, String(identificativo));

  const righe = await base(db)
    .where(soloPubblicate ? and(condizione, condizioneVisibile()) : condizione)
    // Se un nostro id coincidesse con un wp_id altrui, vince il wp_id
    .orderBy(desc(sql`case when ${notizie.wpId} = ${numero || 0} then 1 else 0 end`))
    .limit(1);

  return righe[0] ? daRiga(righe[0]) : null;
}

/** Le ultime notizie di ogni sport, per la home. */
export async function ultimePerSport(quante = 4) {
  const db = getDb();

  // Una sola interrogazione invece di una per sport: la numerazione per
  // gruppo la fa Postgres, e si evita di scaricare tutto per poi tagliarlo.
  const numerate = db
    .select({
      id: notizie.id,
      posizione: sql`row_number() over (
        partition by ${notizie.sport}
        order by coalesce(${notizie.pubblicataIl}, ${notizie.creataIl}) desc
      )`.as("posizione")
    })
    .from(notizie)
    .where(condizioneVisibile())
    .as("numerate");

  const righe = await base(db)
    .innerJoin(numerate, eq(numerate.id, notizie.id))
    .where(sql`${numerate.posizione} <= ${quante}`)
    .orderBy(desc(sql`coalesce(${notizie.pubblicataIl}, ${notizie.creataIl})`));

  const perSport = {};
  for (const riga of righe) {
    (perSport[riga.sport] ??= []).push(daRiga(riga, { conContenuto: false }));
  }
  return perSport;
}

/**
 * Slug libero a partire da uno desiderato.
 *
 * Se è già occupato aggiunge -2, -3 e così via. `escludiId` serve in
 * modifica: una notizia non deve considerare occupato il proprio slug.
 */
export async function slugLibero(desiderato, escludiId = null) {
  const db = getDb();
  let candidato = desiderato;

  for (let tentativo = 2; tentativo < 100; tentativo++) {
    const righe = await db
      .select({ id: notizie.id })
      .from(notizie)
      .where(eq(notizie.slug, candidato))
      .limit(1);

    const occupato = righe[0] && righe[0].id !== escludiId;
    if (!occupato) return candidato;

    candidato = `${desiderato}-${tentativo}`;
  }

  // Non dovrebbe succedere, ma meglio uno slug brutto di un errore
  return `${desiderato}-${Date.now()}`;
}

// Riesportata: mezzo front-end la importa da qui.
export { urlFile };
