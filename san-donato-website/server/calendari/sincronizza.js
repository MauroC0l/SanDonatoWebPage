/**
 * La lettura dei calendari ufficiali: dalla cartella della federazione al
 * calendario del sito.
 *
 * Il giro, per ogni fonte attiva:
 *
 *   1. si elencano i fogli della cartella e si scaricano;
 *   2. il lettore del formato ne estrae tutte le partite;
 *   3. si tengono le nostre, raggruppate per nome della nostra squadra: ogni
 *      gruppo è un GIRONE, e le sue partite restano scritte sul girone;
 *   4. se il girone è collegato a una squadra del sito, le sue partite
 *      entrano nel calendario — nuove, spostate, con il risultato, sparite.
 *
 * REGOLA DI PRUDENZA. Una partita si dichiara sparita solo se il suo file
 * è stato letto per intero e non la contiene più. Una cartella che torna
 * vuota, un file che non si scarica, un foglio che non si legge: in tutti
 * questi casi non si toglie NIENTE. Quello che si vede è un errore nel
 * pannello, non un calendario svuotato di notte.
 *
 * Vince il calendario ufficiale: data, ora, luogo, avversario e risultato
 * vengono riscritti a ogni lettura, anche se qualcuno li aveva cambiati.
 * Marcatori, diretta, foto e descrizione restano di chi li ha scritti.
 */

import { and, eq, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { eventi, fontiCalendario, gironiUfficiali, squadre } from "../../db/schema.js";
import { annota } from "../registro.js";
import { FORMATI } from "./formati/index.js";
import { fogliDellaCartella, scaricaFoglio } from "./drive.js";
import { nostrePartite, campiEvento, differenze, chiaveUfficiale } from "./partite.js";

/* Chi firma nel registro le modifiche che arrivano dalla federazione.
   Anche quando la lettura la fa partire un amministratore col pulsante,
   a spostare la partita è stata la federazione, non lui. */
const CALENDARIO = { id: null, nome: "Calendario", cognome: "ufficiale", email: "" };

/* Quanti file si scaricano insieme. Pochi: sono fogli da 300 KB, ma la
   funzione ha un tempo massimo e Google non ama le raffiche. */
const IN_PARALLELO = 4;

/* Una lettura che tiene la fonte occupata più di così è morta a metà
   (la funzione è stata interrotta): la successiva può ripartire. */
const LETTURA_BLOCCATA_MINUTI = 10;

const formatoData = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome", weekday: "short", day: "2-digit", month: "2-digit",
  hour: "2-digit", minute: "2-digit"
});
const quando = (d) => (d ? formatoData.format(new Date(d)) : "—");

async function aGruppi(elementi, quanti, lavoro) {
  const esiti = new Array(elementi.length);
  let prossimo = 0;

  async function operaio() {
    while (prossimo < elementi.length) {
      const i = prossimo++;
      esiti[i] = await lavoro(elementi[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(quanti, elementi.length) }, operaio));
  return esiti;
}

/* =====================================================
   Dal girone al calendario
   ===================================================== */

function contatori() {
  return { nuove: 0, spostate: 0, risultati: 0, modificate: 0, sparite: 0, ricomparse: 0 };
}

/**
 * Scrive nel calendario le partite di un girone collegato.
 *
 * @param girone   la riga di gironi_ufficiali, con squadraId
 * @param partite  le nostre partite di quel girone, dall'ultima lettura
 * @param opzioni.completo  true se il file è stato letto per intero: solo
 *                 allora ciò che manca si può dire sparito
 */
export async function applicaGirone(girone, partite, { completo = true } = {}) {
  const conto = contatori();
  if (!girone.squadraId || girone.ignorato) return conto;

  const db = getDb();
  const esistenti = await db.select().from(eventi).where(eq(eventi.gironeId, girone.id));
  const perChiave = new Map(esistenti.map((e) => [e.chiaveUfficiale, e]));
  const viste = new Set();
  const etichetta = girone.nomeFile || girone.titolo || `girone ${girone.id}`;

  for (const partita of partite) {
    const chiave = chiaveUfficiale(girone.id, partita.numero);
    viste.add(chiave);
    const evento = perChiave.get(chiave);

    if (!evento) {
      const [creato] = await db.insert(eventi).values({
        squadraId: girone.squadraId,
        gironeId: girone.id,
        chiaveUfficiale: chiave,
        ...campiEvento(partita)
      }).onConflictDoNothing({ target: eventi.chiaveUfficiale }).returning({ id: eventi.id });

      if (creato) conto.nuove++;
      continue;
    }

    const { campi, genere } = differenze(evento, partita);
    const cambiaSquadra = evento.squadraId !== girone.squadraId;
    const ricompare = evento.sparitaIl !== null;

    if (!campi.length && !cambiaSquadra && !ricompare) continue;

    await db.update(eventi).set({
      ...campiEvento(partita),
      squadraId: girone.squadraId,
      sparitaIl: null,
      aggiornatoIl: new Date()
    }).where(eq(eventi.id, evento.id));

    if (ricompare) {
      conto.ricomparse++;
      await annota(CALENDARIO, {
        azione: "calendari.ricomparsa", tipo: "evento", id: evento.id,
        descrizione: `"${partita.titolo}" è tornata nel calendario ufficiale (${etichetta})`
      });
    }

    if (genere === "spostata") {
      conto.spostate++;
      await annota(CALENDARIO, {
        azione: "calendari.spostata", tipo: "evento", id: evento.id,
        descrizione: `"${partita.titolo}" spostata: da ${quando(evento.inizio)} a ${quando(partita.inizio)}`,
        dettaglio: { prima: evento.inizio, dopo: partita.inizio, campi }
      });
    } else if (genere === "risultato") {
      conto.risultati++;
      await annota(CALENDARIO, {
        azione: "calendari.risultato", tipo: "evento", id: evento.id,
        descrizione: `Risultato di "${partita.titolo}": ${partita.risultato ?? "tolto"}`
          + (partita.parziali ? ` (${partita.parziali})` : ""),
        dettaglio: { prima: evento.risultato, dopo: partita.risultato, parziali: partita.parziali }
      });
    } else if (genere === "modificata") {
      conto.modificate++;
      await annota(CALENDARIO, {
        azione: "calendari.modificata", tipo: "evento", id: evento.id,
        descrizione: `"${partita.titolo}" aggiornata dal calendario ufficiale (${campi.join(", ")})`,
        dettaglio: { campi }
      });
    }
  }

  if (conto.nuove) {
    const [squadra] = await db.select({ nome: squadre.nome }).from(squadre)
      .where(eq(squadre.id, girone.squadraId)).limit(1);

    await annota(CALENDARIO, {
      azione: "calendari.nuove", tipo: "girone", id: girone.id,
      descrizione: `${conto.nuove} ${conto.nuove === 1 ? "partita nuova" : "partite nuove"} `
        + `per ${squadra?.nome ?? "la squadra"} dal calendario ufficiale (${etichetta})`
    });
  }

  if (completo) {
    for (const evento of esistenti) {
      if (viste.has(evento.chiaveUfficiale) || evento.sparitaIl) continue;

      await db.update(eventi)
        .set({ sparitaIl: new Date(), aggiornatoIl: new Date() })
        .where(eq(eventi.id, evento.id));

      conto.sparite++;
      await annota(CALENDARIO, {
        azione: "calendari.sparita", tipo: "evento", id: evento.id,
        descrizione: `"${evento.titolo}" del ${quando(evento.inizio)} non è più nel calendario ufficiale (${etichetta})`
      });
    }
  }

  return conto;
}

/* =====================================================
   Una fonte
   ===================================================== */

/**
 * Prende la fonte per leggerla, se nessun altro la sta già leggendo.
 *
 * Un solo UPDATE condizionato: fra "controllo che sia libera" e "la segno
 * occupata" non c'è spazio per una seconda lettura che si infili.
 */
async function prendiFonte(fonteId) {
  const [presa] = await getDb()
    .update(fontiCalendario)
    .set({ inLetturaDal: new Date() })
    .where(and(
      eq(fontiCalendario.id, fonteId),
      or(
        isNull(fontiCalendario.inLetturaDal),
        lt(fontiCalendario.inLetturaDal, sql`now() - make_interval(mins => ${LETTURA_BLOCCATA_MINUTI})`)
      )
    ))
    .returning();

  return presa ?? null;
}

async function lasciaFonte(fonteId, { esito, riepilogo }) {
  await getDb()
    .update(fontiCalendario)
    .set({ inLetturaDal: null, ultimaLettura: new Date(), esito, riepilogo })
    .where(eq(fontiCalendario.id, fonteId));
}

/** Scarica e legge un file, senza mai lanciare: l'errore è un risultato. */
async function leggiFile(voce, formato) {
  try {
    const contenuto = await scaricaFoglio(voce);
    const { titolo, partite } = formato.leggi(contenuto);
    return { voce, titolo, partite, errore: null };
  } catch (e) {
    return { voce, titolo: null, partite: [], errore: e.message || String(e) };
  }
}

/**
 * Legge una fonte e aggiorna gironi e calendario.
 *
 * Non lancia: qualunque cosa succeda, il risultato è scritto sulla fonte
 * (esito e riepilogo) e restituito, perché chi l'ha fatta partire — la
 * notte o un amministratore — deve poter sapere com'è andata.
 */
export async function sincronizzaFonte(fonteId) {
  const fonte = await prendiFonte(fonteId);
  if (!fonte) {
    return { fonteId, esito: "occupata", riepilogo: { messaggio: "Un'altra lettura di questa fonte è in corso." } };
  }

  const riepilogo = {
    fogli: 0, letti: 0, conNostre: 0, gironi: 0, partite: 0,
    ...contatori(), errori: [], messaggio: null
  };

  try {
    const formato = FORMATI[fonte.formato];
    if (!formato) throw new Error(`Formato "${fonte.formato}" sconosciuto: questa versione del sito non sa leggerlo.`);

    const fogli = await fogliDellaCartella(fonte.cartella);
    riepilogo.fogli = fogli.length;

    // Vedi la regola di prudenza in cima al file
    if (!fogli.length) {
      throw new Error(
        "La cartella risulta vuota o non leggibile. Non ho tolto niente dal calendario: "
        + "controlla che il collegamento sia giusto e che la cartella sia ancora pubblica."
      );
    }

    const letture = await aGruppi(fogli, IN_PARALLELO, (voce) => leggiFile(voce, formato));
    const db = getDb();
    const adesso = new Date();

    for (const lettura of letture) {
      if (lettura.errore) {
        riepilogo.errori.push({ file: lettura.voce.nome, errore: lettura.errore });
        continue;
      }
      riepilogo.letti++;

      const gruppi = nostrePartite(lettura.partite, fonte);
      if (gruppi.size) riepilogo.conNostre++;

      const trovati = new Set();

      for (const [nomeNelGirone, partite] of gruppi) {
        trovati.add(nomeNelGirone);
        riepilogo.gironi++;
        riepilogo.partite += partite.length;

        const [girone] = await db.insert(gironiUfficiali).values({
          fonteId: fonte.id,
          fileId: lettura.voce.id,
          nomeFile: lettura.voce.nome,
          titolo: lettura.titolo,
          nomeNelGirone,
          partite,
          ultimaLettura: adesso
        }).onConflictDoUpdate({
          target: [gironiUfficiali.fonteId, gironiUfficiali.fileId, gironiUfficiali.nomeNelGirone],
          set: {
            nomeFile: lettura.voce.nome,
            titolo: lettura.titolo,
            partite,
            ultimaLettura: adesso,
            sparitoIl: null
          }
        }).returning();

        const conto = await applicaGirone(girone, partite, { completo: true });
        for (const [chiave, n] of Object.entries(conto)) riepilogo[chiave] += n;
      }

      /* Gironi di questo file in cui la nostra squadra non compare più:
         il file è stato letto per intero, quindi le loro partite sono
         davvero sparite. Succede se la federazione rinomina la squadra. */
      const precedenti = await db.select().from(gironiUfficiali).where(and(
        eq(gironiUfficiali.fonteId, fonte.id),
        eq(gironiUfficiali.fileId, lettura.voce.id)
      ));

      for (const girone of precedenti) {
        if (trovati.has(girone.nomeNelGirone)) continue;

        await db.update(gironiUfficiali)
          .set({ partite: [], ultimaLettura: adesso })
          .where(eq(gironiUfficiali.id, girone.id));

        const conto = await applicaGirone(girone, [], { completo: true });
        riepilogo.sparite += conto.sparite;
      }
    }

    /* File che non sono più nella cartella: il girone si segna, le partite
       no. A fine stagione la federazione toglie i file, e lo storico delle
       partite giocate è nostro. */
    const idPresenti = fogli.map((f) => f.id);
    await db.update(gironiUfficiali)
      .set({ sparitoIl: adesso })
      .where(and(
        eq(gironiUfficiali.fonteId, fonte.id),
        isNull(gironiUfficiali.sparitoIl),
        notInArray(gironiUfficiali.fileId, idPresenti)
      ));

    const esito = riepilogo.errori.length ? "avvisi" : "ok";
    await lasciaFonte(fonte.id, { esito, riepilogo });
    return { fonteId: fonte.id, nome: fonte.nome, esito, riepilogo };
  } catch (e) {
    console.error(`Lettura della fonte ${fonte.id} non riuscita:`, e);
    riepilogo.messaggio = e.message || String(e);
    await lasciaFonte(fonte.id, { esito: "errore", riepilogo });
    return { fonteId: fonte.id, nome: fonte.nome, esito: "errore", riepilogo };
  }
}

/**
 * Tutte le fonti attive, una dopo l'altra.
 *
 * In fila e non insieme: ogni fonte scarica già i suoi file in parallelo,
 * e due fonti insieme raddoppierebbero le richieste a Google senza far
 * finire prima la lettura.
 */
export async function sincronizzaTutte() {
  const attive = await getDb()
    .select({ id: fontiCalendario.id })
    .from(fontiCalendario)
    .where(eq(fontiCalendario.attiva, true))
    .orderBy(fontiCalendario.id);

  const esiti = [];
  for (const { id } of attive) esiti.push(await sincronizzaFonte(id));

  await annota(CALENDARIO, {
    azione: "calendari.lettura",
    descrizione: esiti.length
      ? `Lettura dei calendari ufficiali: ${esiti.map((e) => `${e.nome ?? e.fonteId} ${e.esito}`).join(", ")}`
      : "Lettura dei calendari ufficiali: nessuna fonte attiva",
    dettaglio: esiti.map(({ fonteId, esito, riepilogo }) => ({ fonteId, esito, riepilogo }))
  });

  return esiti;
}
