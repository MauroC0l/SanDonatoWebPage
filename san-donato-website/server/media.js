/**
 * La libreria dei file: sfogliare, cercare, etichettare.
 *
 * Nasce da un problema concreto: i file caricati sono già qualche centinaio
 * e l'unico modo di riusarne uno era ricordarsi in quale articolo stava.
 * Chi cerca "la foto della festa di Natale di due anni fa" non ha nessuno
 * strumento, e finisce per ricaricare la stessa immagine una terza volta.
 *
 * COSA NON ENTRA NELLA LIBRERIA
 *
 * I certificati medici. Sono file sanitari di minorenni, e una galleria che
 * li sfoglia tutti insieme sarebbe una cattiva idea anche con i permessi
 * giusti davanti: si guardano uno alla volta, dalla scheda dell'atleta a
 * cui appartengono, da chi ha il permesso di vedere quella scheda.
 *
 * Le foto del profilo. Non sono materiale della società: sono di chi le ha
 * messe, compaiono dove servono e non in un archivio da spulciare.
 *
 * Resta il materiale redazionale — copertine delle notizie, foto degli
 * eventi — e le centinaia di file ereditati da WordPress, che non hanno
 * cartella perché quando furono caricati non esistevano.
 */

import { and, asc, desc, eq, ilike, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  media, cartelleMedia, notizie, mediaEvento, utenti, schedeAtleta
} from "../db/schema.js";
import { urlFile } from "./file.js";
import { ErroreHttp } from "./risposte.js";

/**
 * I prefissi di chiave che la libreria mostra.
 *
 * ATTENZIONE: non sono le cartelle che si vedono nella schermata — quelle
 * stanno in tabella e si rinominano. Questi sono i prefissi dentro al
 * bucket, e servono a una cosa sola: tenere fuori dalla libreria i
 * certificati medici e le foto del profilo, qualunque cartella qualcuno
 * decida di dargli.
 */
export const PREFISSI_SFOGLIABILI = ["notizie", "eventi"];

/**
 * La condizione che tiene fuori il materiale personale.
 *
 * Scritta come "sta in una cartella ammessa OPPURE non ha cartella" invece
 * che come "non sta fra le cartelle escluse": così una cartella nuova che
 * qualcuno aggiungerà domani resta fuori finché non la si nomina qui. È la
 * differenza fra dimenticarsi di mostrare qualcosa e dimenticarsi di
 * nasconderlo.
 */
function condizioneSfogliabile() {
  const inCartella = PREFISSI_SFOGLIABILI.map((c) => ilike(media.chiave, `${c}/%`));

  // Chiave nulla: i file ancora su WordPress, che cartella non ne hanno.
  return or(sql`${media.chiave} is null`, ...inCartella);
}

/**
 * Quanti giorni resta un file nel cestino prima di sparire davvero.
 *
 * Dieci: abbastanza perché ci si accorga di aver cancellato la foto
 * sbagliata — di solito se ne accorge chi la cerca, non chi l'ha tolta —
 * e abbastanza poco perché il cestino non diventi un secondo archivio che
 * nessuno guarda e che intanto si paga.
 */
export const GIORNI_CESTINO = 10;

/**
 * Cosa può vedere chi sta guardando, in una condizione sola.
 *
 * Tre regole insieme: il materiale personale resta fuori sempre, il
 * cestino resta fuori dalla libreria (e da solo dentro al cestino), e chi
 * ha una libreria "solo mia" — un allenatore — vede i propri file più
 * quelli delle cartelle condivise, che sono il posto dove la società mette
 * le cose che servono a tutti.
 *
 * Prima la seconda parte non c'era e i conteggi delle cartelle si
 * facevano su tutto: un allenatore apriva la libreria, leggeva "Notizie
 * 312" e ci trovava dentro i suoi quattro file. Un numero che promette
 * quello che non c'è è peggio di nessun numero.
 */
function condizioneVisibile({ caricatoDa = null, cestino = false, conCondivise = true } = {}) {
  const parti = [condizioneSfogliabile()];

  parti.push(cestino ? isNotNull(media.cestinatoIl) : isNull(media.cestinatoIl));

  if (caricatoDa) {
    const mio = eq(media.caricatoDa, Number(caricatoDa));

    /* Nel cestino niente eccezione per le cartelle condivise: ripescare
       quello che ha buttato via un altro è roba di chi amministra, e
       vedere nel proprio cestino file che non si sono mai toccati
       confonde e basta. */
    parti.push(conCondivise && !cestino
      ? or(mio, sql`${media.cartellaId} in (select id from cartelle_media where condivisa)`)
      : mio);
  }

  return and(...parti);
}

/** Il tipo grosso di un file, per il filtro: immagine, video, documento. */
function famiglia(mime) {
  if (mime?.startsWith("image/")) return "immagine";
  if (mime?.startsWith("video/")) return "video";
  return "documento";
}

export async function elencaMedia({
  pagina = 1,
  perPagina = 24,
  cerca = null,
  tag = null,
  cartellaId = null,
  tipo = null,
  caricatoDa = null,
  cestino = false
} = {}) {
  const db = getDb();

  /* Chi è "caricatoDa": per un allenatore lo impone la rotta ed è la sua
     libreria; per un amministratore è un modo di guardare. */
  const condizioni = [condizioneVisibile({ caricatoDa, cestino })];

  // "senza" è una scelta come le altre: i file non ancora ordinati sono
  // quelli su cui c'è da lavorare, e devono potersi isolare.
  if (cartellaId === "senza") {
    condizioni.push(isNull(media.cartellaId));
  } else if (cartellaId) {
    /* Un numero o niente. Senza questo controllo un parametro storto
       arrivava fino a Postgres come NaN e tornava indietro come 500: un
       errore del chiamante raccontato come un guasto del server. */
    const numero = Number(cartellaId);
    if (!Number.isInteger(numero) || numero <= 0) {
      throw new ErroreHttp(400, "Cartella non valida.");
    }
    condizioni.push(eq(media.cartellaId, numero));
  }

  if (tipo === "immagine") condizioni.push(ilike(media.mime, "image/%"));
  if (tipo === "video") condizioni.push(ilike(media.mime, "video/%"));
  if (tipo === "documento") {
    condizioni.push(sql`${media.mime} not like 'image/%' and ${media.mime} not like 'video/%'`);
  }

  // Le etichette sono un array di testo: si chiede se lo contiene, non se
  // gli assomiglia. L'indice GIN su quella colonna serve proprio a questo.
  if (tag) condizioni.push(sql`${media.tag} @> ARRAY[${tag}]::text[]`);

  if (cerca) {
    const modello = `%${cerca}%`;
    condizioni.push(or(
      ilike(media.titolo, modello),
      ilike(media.alt, modello),
      ilike(media.chiave, modello)
    ));
  }

  const dove = and(...condizioni);

  const [{ totale }] = await db
    .select({ totale: sql`count(*)::int` })
    .from(media)
    .where(dove);

  const righe = await db
    .select({
      id: media.id,
      chiave: media.chiave,
      urlWp: media.urlOriginaleWp,
      mime: media.mime,
      byte: media.byte,
      larghezza: media.larghezza,
      altezza: media.altezza,
      alt: media.alt,
      titolo: media.titolo,
      tag: media.tag,
      creatoIl: media.creatoIl,
      cestinatoIl: media.cestinatoIl,
      cartellaId: media.cartellaId,
      cartella: cartelleMedia.nome,
      cartellaCondivisa: cartelleMedia.condivisa,
      caricatoDa: utenti.nome,
      caricatoDaCognome: utenti.cognome
    })
    .from(media)
    .leftJoin(utenti, eq(utenti.id, media.caricatoDa))
    .leftJoin(cartelleMedia, eq(cartelleMedia.id, media.cartellaId))
    .where(dove)
    .orderBy(desc(media.creatoIl), desc(media.id))
    .limit(perPagina)
    .offset((pagina - 1) * perPagina);

  return {
    media: righe.map((r) => ({
      id: r.id,
      url: urlFile(r.chiave, r.urlWp),
      mime: r.mime,
      tipo: famiglia(r.mime),
      byte: r.byte,
      larghezza: r.larghezza,
      altezza: r.altezza,
      alt: r.alt ?? "",
      titolo: r.titolo ?? "",
      tag: r.tag ?? [],
      cartellaId: r.cartellaId ?? null,
      cartella: r.cartella ?? null,
      cartellaCondivisa: r.cartellaCondivisa ?? false,
      creatoIl: r.creatoIl,
      cestinatoIl: r.cestinatoIl ?? null,
      caricatoDa: [r.caricatoDa, r.caricatoDaCognome].filter(Boolean).join(" ") || null
    })),
    totale,
    pagina,
    perPagina,
    pagine: Math.max(1, Math.ceil(totale / perPagina))
  };
}

/**
 * Le etichette in uso, con quante volte compaiono.
 *
 * Servono a proporle invece di farle riscrivere a mano: chi etichetta a
 * memoria scrive "under14", "under 14" e "u14", e dopo un mese nessuna
 * delle tre ritrova tutto.
 */
export async function tagUsati() {
  const righe = await getDb()
    .select({
      tag: sql`unnest(${media.tag})`.as("tag"),
      quanti: sql`count(*)::int`.as("quanti")
    })
    .from(media)
    .where(and(condizioneVisibile(), sql`${media.tag} is not null`))
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`, sql`1`);

  return righe.map((r) => ({ tag: r.tag, quanti: r.quanti }));
}

/**
 * Chi ha caricato file, con quanti ne ha.
 *
 * Nella libreria dell'amministratore ogni persona diventa una cartella:
 * con quattro allenatori che caricano le foto delle proprie partite, un
 * elenco unico ordinato per data diventa presto illeggibile, e la domanda
 * che ci si fa è "cosa ha messo il mister del volley".
 */
export async function personeConFile() {
  const righe = await getDb()
    .select({
      id: utenti.id,
      nome: utenti.nome,
      cognome: utenti.cognome,
      email: utenti.email,
      ruolo: utenti.ruolo,
      quanti: sql`count(*)::int`
    })
    .from(media)
    .innerJoin(utenti, eq(utenti.id, media.caricatoDa))
    .where(condizioneVisibile())
    .groupBy(utenti.id, utenti.nome, utenti.cognome, utenti.email, utenti.ruolo)
    .orderBy(asc(utenti.cognome), asc(utenti.nome));

  return righe.map((r) => ({
    id: r.id,
    nome: [r.nome, r.cognome].filter(Boolean).join(" ") || r.email,
    ruolo: r.ruolo,
    quanti: r.quanti
  }));
}

/** Ripulisce le etichette: minuscole, senza doppioni, al massimo venti. */
export function normalizzaTag(elenco) {
  if (!Array.isArray(elenco)) return null;

  const pulite = elenco
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);

  const senzaDoppioni = [...new Set(pulite)];

  // "Nessuna etichetta" si scrive in un modo solo: null. Un array vuoto
  // vorrebbe dire la stessa cosa, e due modi di dire la stessa cosa sono
  // due casi da ricordarsi in ogni interrogazione che le filtra.
  return senzaDoppioni.length ? senzaDoppioni : null;
}

/**
 * Un file solo, se è fra quelli sfogliabili.
 *
 * "ancheCestinati" serve a chi il cestino lo gestisce: per ripescare un
 * file o per buttarlo via davvero bisogna prima poterlo trovare.
 */
export async function trovaMedia(id, { ancheCestinati = false } = {}) {
  const [riga] = await getDb()
    .select({
      id: media.id,
      chiave: media.chiave,
      urlWp: media.urlOriginaleWp,
      mime: media.mime,
      alt: media.alt,
      titolo: media.titolo,
      tag: media.tag,
      cartellaId: media.cartellaId,
      cartella: cartelleMedia.nome,
      cartellaCondivisa: cartelleMedia.condivisa,
      cestinatoIl: media.cestinatoIl,
      caricatoDa: media.caricatoDa
    })
    .from(media)
    .leftJoin(cartelleMedia, eq(cartelleMedia.id, media.cartellaId))
    .where(and(
      eq(media.id, Number(id)),
      condizioneSfogliabile(),
      ...(ancheCestinati ? [] : [isNull(media.cestinatoIl)])
    ))
    .limit(1);

  if (!riga) return null;

  return {
    id: riga.id,
    url: urlFile(riga.chiave, riga.urlWp),
    mime: riga.mime,
    tipo: famiglia(riga.mime),
    alt: riga.alt ?? "",
    titolo: riga.titolo ?? "",
    tag: riga.tag ?? [],
    cartellaId: riga.cartellaId ?? null,
    cartella: riga.cartella ?? null,
    cartellaCondivisa: riga.cartellaCondivisa ?? false,
    cestinatoIl: riga.cestinatoIl ?? null,
    caricatoDa: riga.caricatoDa ?? null
  };
}

/**
 * Cambia titolo, testo alternativo ed etichette.
 *
 * Il file in sé non si tocca: qui si scrive solo come lo si ritrova. Non
 * esiste modo di sostituire i byte di un media già registrato — un'immagine
 * cambiata sotto ai piedi comparirebbe diversa in tutti gli articoli che la
 * usano, e nessuno saprebbe perché.
 */
export async function aggiornaMedia(id, campi) {
  const modifiche = {};

  if (campi.titolo !== undefined) modifiche.titolo = campi.titolo || null;
  if (campi.alt !== undefined) modifiche.alt = campi.alt || null;
  if (campi.tag !== undefined) modifiche.tag = normalizzaTag(campi.tag);

  // null significa "tiralo fuori da ogni cartella", ed è una richiesta
  // legittima quanto spostarlo dentro a un'altra.
  if (campi.cartellaId !== undefined) {
    modifiche.cartellaId = campi.cartellaId === null ? null : Number(campi.cartellaId);
  }

  if (Object.keys(modifiche).length === 0) return trovaMedia(id);

  await getDb()
    .update(media)
    .set(modifiche)
    .where(and(eq(media.id, Number(id)), condizioneSfogliabile(), isNull(media.cestinatoIl)));

  return trovaMedia(id);
}

/**
 * Dove è usato un file.
 *
 * Serve prima di cancellarlo: un'immagine tolta mentre fa da copertina a un
 * articolo lascia un riquadro vuoto in home, e chi l'ha cancellata non lo
 * scopre mai. Conta anche gli usi che la libreria non mostra — certificati
 * e foto del profilo — perché per la cancellazione contano lo stesso.
 */
export async function usoDiMedia(id) {
  const db = getDb();
  const numero = Number(id);

  const [{ quante }] = await db
    .select({ quante: sql`count(*)::int` })
    .from(notizie)
    .where(eq(notizie.copertinaId, numero));

  const [{ quanti }] = await db
    .select({ quanti: sql`count(*)::int` })
    .from(mediaEvento)
    .where(eq(mediaEvento.mediaId, numero));

  const [{ quanteSchede }] = await db
    .select({ quanteSchede: sql`count(*)::int` })
    .from(schedeAtleta)
    .where(eq(schedeAtleta.certificatoMediaId, numero));

  const [{ quantiProfili }] = await db
    .select({ quantiProfili: sql`count(*)::int` })
    .from(utenti)
    .where(eq(utenti.immagineId, numero));

  return {
    notizie: quante,
    eventi: quanti,
    certificati: quanteSchede,
    profili: quantiProfili,
    totale: quante + quanti + quanteSchede + quantiProfili
  };
}

/* =====================================================
   Il cestino
   ===================================================== */

/**
 * Butta un file nel cestino: sparisce dalla libreria, non dal database.
 *
 * Il controllo sugli usi resta un rifiuto e non un avvertimento. Un file
 * cestinato non si vede più in pagina, quindi cestinare una copertina
 * lascia un riquadro vuoto in home esattamente come cancellarla: che poi
 * sia recuperabile non aiuta, perché nessuno si accorge del buco.
 */
export async function cestinaMedia(id, utenteId) {
  const numero = Number(id);

  const file = await trovaMedia(numero);
  if (!file) return { esito: "assente" };

  const uso = await usoDiMedia(numero);
  if (uso.totale > 0) return { esito: "in_uso", uso };

  await getDb()
    .update(media)
    .set({ cestinatoIl: new Date(), cestinatoDa: utenteId ?? null })
    .where(eq(media.id, numero));

  return { esito: "cestinato", file };
}

/** Lo ripesca: torna dov'era, nella cartella in cui stava. */
export async function ripristinaMedia(id) {
  const [tornato] = await getDb()
    .update(media)
    .set({ cestinatoIl: null, cestinatoDa: null })
    .where(and(eq(media.id, Number(id)), isNotNull(media.cestinatoIl)))
    .returning({ id: media.id, titolo: media.titolo });

  if (!tornato) throw new ErroreHttp(404, "Nel cestino non c'è nessun file con questo numero.");
  return tornato;
}

/**
 * Butta via davvero quello che nel cestino è scaduto.
 *
 * Si chiama all'apertura della libreria e non da un lavoro pianificato,
 * perché un lavoro pianificato qui non c'è: su Vercel sarebbe un cron da
 * configurare, e in locale non esisterebbe affatto. La query è una sola e
 * ha il suo indice; nove volte su dieci non trova niente e costa quanto
 * niente.
 *
 * Il difetto di questo modo, scritto qui perché non si scopra dopo: se
 * per due mesi nessuno apre la libreria, i file restano lì due mesi. Non
 * è un dato sbagliato, è solo spazio pagato più a lungo.
 */
export async function spurgaCestino({ eliminaFile } = {}) {
  const limite = new Date(Date.now() - GIORNI_CESTINO * 24 * 60 * 60 * 1000);

  const scaduti = await getDb()
    .select({ id: media.id, chiave: media.chiave })
    .from(media)
    .where(and(isNotNull(media.cestinatoIl), lt(media.cestinatoIl, limite)))
    .limit(50);

  if (scaduti.length === 0) return { tolti: 0 };

  for (const riga of scaduti) {
    await getDb().delete(media).where(eq(media.id, riga.id));

    if (riga.chiave && typeof eliminaFile === "function") {
      try {
        await eliminaFile(riga.chiave);
      } catch (e) {
        console.error("File non rimosso dall'archivio:", riga.chiave, e.message);
      }
    }
  }

  return { tolti: scaduti.length };
}

/* =====================================================
   Cancellazione di un file
   ===================================================== */

/**
 * Toglie un file dalla libreria, se non lo sta usando nessuno.
 *
 * Il controllo sugli usi non è un consiglio ma un rifiuto: un'immagine
 * cancellata mentre fa da copertina lascia un riquadro vuoto in home, e chi
 * l'ha cancellata non lo scopre mai — se ne accorge un genitore tre giorni
 * dopo. Chi vuole davvero cancellarla stacca prima la copertina, e a quel
 * punto sa cosa sta facendo.
 *
 * I byte nell'archivio si cancellano DOPO la riga in tabella, e un errore
 * lì non fa fallire l'operazione: un file rimasto nel bucket senza più
 * nessuno che lo nomini è spazio sprecato, mentre una riga che punta a un
 * file inesistente è un'immagine rotta in pagina.
 */
export async function eliminaMedia(id, { eliminaFile } = {}) {
  const numero = Number(id);

  // Anche i cestinati: da lì si può buttare via subito, senza aspettare
  // i dieci giorni.
  const file = await trovaMedia(numero, { ancheCestinati: true });
  if (!file) return { esito: "assente" };

  const uso = await usoDiMedia(numero);
  if (uso.totale > 0) return { esito: "in_uso", uso };

  const [riga] = await getDb()
    .select({ chiave: media.chiave })
    .from(media)
    .where(eq(media.id, numero))
    .limit(1);

  await getDb().delete(media).where(eq(media.id, numero));

  if (riga?.chiave && typeof eliminaFile === "function") {
    try {
      await eliminaFile(riga.chiave);
    } catch (e) {
      console.error("File non rimosso dall'archivio:", riga.chiave, e.message);
    }
  }

  return { esito: "eliminato", file };
}

/* =====================================================
   Cartelle
   ===================================================== */

/**
 * Le cartelle che una persona può vedere, con quanti file CI TROVA LEI.
 *
 * Il conteggio è il punto. Prima contava tutto per tutti, e un allenatore
 * leggeva "Notizie 312" per poi aprire e trovarci i suoi quattro file: un
 * numero che promette quello che non c'è è peggio di nessun numero.
 *
 * Le cartelle riservate spariscono per chi non amministra, e con loro il
 * mucchio del vecchio sito — che nella libreria di un allenatore era la
 * voce più grossa e la meno sua.
 */
export async function elencaCartelle({ caricatoDa = null, amministratore = false } = {}) {
  const db = getDb();
  const visibile = condizioneVisibile({ caricatoDa });

  const righe = await db
    .select({
      id: cartelleMedia.id,
      nome: cartelleMedia.nome,
      condivisa: cartelleMedia.condivisa,
      quanti: sql`count(${media.id}) filter (where ${visibile})::int`
    })
    .from(cartelleMedia)
    .leftJoin(media, eq(media.cartellaId, cartelleMedia.id))
    .where(amministratore ? sql`true` : eq(cartelleMedia.soloAdmin, false))
    .groupBy(cartelleMedia.id, cartelleMedia.nome, cartelleMedia.condivisa)
    /* La condivisa in cima: è l'unica che riguarda tutti, e in mezzo
       all'alfabeto si perdeva. */
    .orderBy(desc(cartelleMedia.condivisa), asc(cartelleMedia.nome));

  const [{ senza }] = await db
    .select({ senza: sql`count(*)::int` })
    .from(media)
    .where(and(visibile, isNull(media.cartellaId)));

  /* Quanti ce n'è nel cestino: la voce si mostra comunque, ma il numero
     accanto dice se c'è qualcosa da ripescare. */
  const [{ cestinati }] = await db
    .select({ cestinati: sql`count(*)::int` })
    .from(media)
    .where(condizioneVisibile({ caricatoDa, cestino: true }));

  return { cartelle: righe, senzaCartella: senza, cestinati };
}

/** Il nome di una cartella, ripulito. */
function nomeCartella(grezzo) {
  const nome = String(grezzo ?? "").trim().replace(/\s+/g, " ");

  if (nome.length < 2) throw new ErroreHttp(400, "Il nome della cartella è troppo corto.");
  if (nome.length > 60) throw new ErroreHttp(400, "Il nome della cartella è troppo lungo.");

  return nome;
}

export async function creaCartella(nome, autoreId) {
  const pulito = nomeCartella(nome);

  const [esistente] = await getDb()
    .select({ id: cartelleMedia.id })
    .from(cartelleMedia)
    // Confronto senza distinguere maiuscole: due cartelle "Feste" e "feste"
    // sarebbero due posti diversi che si chiamano uguale, e nessuno
    // ricorderebbe in quale ha messo cosa.
    .where(sql`lower(${cartelleMedia.nome}) = lower(${pulito})`)
    .limit(1);

  if (esistente) throw new ErroreHttp(409, `La cartella "${pulito}" esiste già.`);

  const [creata] = await getDb()
    .insert(cartelleMedia)
    .values({ nome: pulito, creataDa: autoreId })
    .returning({ id: cartelleMedia.id, nome: cartelleMedia.nome });

  return creata;
}

export async function rinominaCartella(id, nome) {
  const pulito = nomeCartella(nome);
  const numero = Number(id);

  const [occupato] = await getDb()
    .select({ id: cartelleMedia.id })
    .from(cartelleMedia)
    .where(and(
      sql`lower(${cartelleMedia.nome}) = lower(${pulito})`,
      sql`${cartelleMedia.id} <> ${numero}`
    ))
    .limit(1);

  if (occupato) throw new ErroreHttp(409, `La cartella "${pulito}" esiste già.`);

  const [aggiornata] = await getDb()
    .update(cartelleMedia)
    .set({ nome: pulito })
    .where(eq(cartelleMedia.id, numero))
    .returning({ id: cartelleMedia.id, nome: cartelleMedia.nome });

  if (!aggiornata) throw new ErroreHttp(404, "Cartella non trovata.");
  return aggiornata;
}

/**
 * Cancella una cartella.
 *
 * Di suo non porta via niente: i file che conteneva restano, senza
 * cartella. Se riordinare potesse distruggere, nessuno riordinerebbe più.
 *
 * Con "conFile" invece li butta anche: non li cancella, li mette nel
 * cestino, dove restano dieci giorni. È la differenza fra una scelta
 * sbagliata e una scelta irreparabile.
 *
 * I file ancora usati da qualche parte non li tocca e li conta a parte:
 * una copertina che sparisce lascia un buco in home, e che sia stata una
 * spunta a portarla via non lo rende meno buco.
 */
export async function eliminaCartella(id, { conFile = false, utenteId = null } = {}) {
  const numero = Number(id);
  const conto = { cestinati: 0, saltati: 0 };

  if (conFile) {
    const dentro = await getDb()
      .select({ id: media.id })
      .from(media)
      .where(and(eq(media.cartellaId, numero), isNull(media.cestinatoIl)));

    for (const riga of dentro) {
      const esito = await cestinaMedia(riga.id, utenteId);
      if (esito.esito === "cestinato") conto.cestinati += 1;
      else conto.saltati += 1;
    }
  }

  const [tolta] = await getDb()
    .delete(cartelleMedia)
    .where(eq(cartelleMedia.id, numero))
    .returning({ id: cartelleMedia.id, nome: cartelleMedia.nome });

  if (!tolta) throw new ErroreHttp(404, "Cartella non trovata.");
  return { ...tolta, ...conto };
}
