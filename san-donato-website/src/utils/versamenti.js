/**
 * I versamenti divisi per anno, dal più recente, con il totale di ciascuno.
 *
 * Serve perché la quota è di una stagione mentre i versamenti si accumulano
 * per sempre: in un elenco unico, tre bonifici dell'anno scorso e due di
 * quest'anno sono la stessa fila, e alla domanda che si fanno tutti — "quanto
 * abbiamo versato quest'anno?" — non risponde più nessuno.
 *
 * L'anno si prende dalla data del versamento e non da una colonna. Una
 * colonna "stagione" andrebbe prima decisa: quando comincia, se a settembre
 * o a gennaio, e cosa succede a chi paga ad agosto. Finché quella decisione
 * non c'è, l'anno solare è un dato che esiste già invece di uno inventato —
 * con il difetto, che è bene sapere, di tagliare la stagione a Capodanno.
 */
export function raggruppaPerAnno(versamenti) {
  const gruppi = new Map();

  for (const v of versamenti ?? []) {
    // Le date arrivano come "2026-05-14": i primi quattro caratteri sono
    // l'anno, senza passare da un fuso orario che può spostarlo di un giorno.
    const anno = String(v.pagatoIl ?? "").slice(0, 4) || "—";

    if (!gruppi.has(anno)) gruppi.set(anno, []);
    gruppi.get(anno).push(v);
  }

  return [...gruppi.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([anno, righe]) => ({
      anno,
      // Dentro all'anno, dal più recente: è quello che si viene a cercare.
      righe: [...righe].reverse(),
      totale: righe.reduce((s, v) => s + v.importoCentesimi, 0)
    }));
}
