/**
 * /api/iscrizione/fratelli — "ho un fratello o una sorella già iscritti".
 *
 *   POST    { codiceFiscale }   lo dichiara
 *   DELETE  ?id=…               ritira la propria dichiarazione
 *
 * Una rotta a parte e non un campo in più dentro a /api/iscrizione perché
 * non è un dato della propria scheda: è una richiesta rivolta alla
 * segreteria, che ha uno stato e una risposta.
 *
 * QUELLO CHE QUESTA ROTTA NON FA È IL PUNTO: non assegna nessuna tariffa e
 * non dice se quel codice fiscale corrisponde a un iscritto. La risposta è
 * sempre la stessa — l'abbiamo presa in carico — perché altrimenti chiunque
 * potrebbe provare il codice fiscale di una persona qualsiasi e scoprire se
 * quella persona fa sport qui. Chi cerca la persona è il server, e quello
 * che trova lo legge solo chi tiene le quote.
 */

import { z } from "zod";
import { dichiaraLegame, legamiDichiaratiDa, ritiraLegame } from "../../legami.js";
import { richiedeAccesso } from "../../autenticazione.js";
import { annota } from "../../registro.js";
import { json, errore, conGestioneErrori, ErroreHttp } from "../../risposte.js";
import { leggiCorpo } from "../../richiesta.js";
import { valida } from "../../validazione.js";

const schemaDichiarazione = z.object({
  /* Solo la lunghezza, qui: la forma e il carattere di controllo li
     verifica dichiaraLegame(), che risponde con una frase che spiega cosa
     c'è di storto invece del "16 caratteri" di uno schema. */
  codiceFiscale: z.string().trim().min(16).max(20)
});

async function dichiara(req, res) {
  const dati = valida(schemaDichiarazione, await leggiCorpo(req));
  const creato = await dichiaraLegame(req.utente, dati.codiceFiscale);

  /* null vuol dire che quella dichiarazione c'era già: niente riga nel
     registro, perché non è successo niente — è il pulsante premuto due
     volte. */
  if (creato) {
    await annota(req.utente, {
      azione: "iscrizione.fratello_dichiara",
      tipo: "atleta",
      id: req.utente.id,
      descrizione: "Ha dichiarato un fratello o una sorella già iscritti"
    });
  }

  return json(res, { fratelli: await legamiDichiaratiDa(req.utente.id) }, creato ? 201 : 200);
}

async function ritira(req, res) {
  const id = Number(req.query?.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ErroreHttp(400, "Identificativo della dichiarazione non valido.");
  }

  await ritiraLegame(id, req.utente.id);

  await annota(req.utente, {
    azione: "iscrizione.fratello_ritira",
    tipo: "atleta",
    id: req.utente.id,
    descrizione: "Ha ritirato una dichiarazione di parentela"
  });

  return json(res, { fratelli: await legamiDichiaratiDa(req.utente.id) });
}

export default conGestioneErrori(
  richiedeAccesso(async (req, res) => {
    if (req.method === "POST") return dichiara(req, res);
    if (req.method === "DELETE") return ritira(req, res);

    res.setHeader("Allow", "POST, DELETE");
    return errore(res, 405, `Metodo ${req.method} non consentito.`);
  })
);
