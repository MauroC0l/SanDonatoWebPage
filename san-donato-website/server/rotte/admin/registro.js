/**
 * GET /api/admin/registro — chi ha fatto cosa.
 *
 * Solo lettura, e non per pigrizia: un registro che si può correggere non
 * serve a niente. Non esistono POST né DELETE qui, e le righe le scrive
 * server/registro.js dentro alle operazioni che traccia.
 *
 * Riservato a chi amministra: contiene le azioni di tutti, e leggerle è un
 * potere di controllo, non un'informazione di servizio.
 */

import { z } from "zod";
import { elencaAttivita, autoriDelRegistro } from "../../registro.js";
import { richiedeCapacita } from "../../autenticazione.js";
import { json, conGestioneErrori, soloMetodi } from "../../risposte.js";
import { parametri } from "../../richiesta.js";
import { valida } from "../../validazione.js";

const schema = z.object({
  pagina: z.coerce.number().int().min(1).optional().default(1),
  perPagina: z.coerce.number().int().min(1).max(100).optional().default(40),
  utenteId: z.coerce.number().int().positive().optional(),
  tipo: z.string().trim().max(40).optional(),
  cerca: z.string().trim().max(120).optional(),
  da: z.coerce.date().optional(),
  a: z.coerce.date().optional()
});

export default conGestioneErrori(
  richiedeCapacita("registro.leggi", async (req, res) => {
    if (!soloMetodi(req, res, ["GET"])) return;

    const filtri = valida(schema, parametri(req));
    const risultato = await elencaAttivita(filtri);

    // L'elenco di chi compare nel registro viaggia insieme alla prima
    // pagina: serve a riempire il filtro per persona, e chiederlo a parte
    // sarebbe una seconda richiesta a ogni apertura.
    const autori = filtri.pagina === 1 ? await autoriDelRegistro() : undefined;

    res.setHeader("Cache-Control", "no-store");
    return json(res, { ...risultato, ...(autori ? { autori } : {}) });
  })
);
