/**
 * Dove abita ciascun ruolo dentro al sito.
 *
 * L'indirizzo dice chi sei: /segreteria/atleti, /coach/eventi,
 * /editor/notizie, /admin/utenti. Un atleta sta sotto /area-riservata, che si
 * chiama con parole sue — "atleta" nell'indirizzo suonerebbe come
 * un'etichetta appiccicata addosso, e la sua area non amministra nulla.
 *
 * Le aree condividono sessione, API e schermate: cambia il prefisso e cambia
 * cosa si vede, perché le sezioni restano quelle che il ruolo può usare. Non
 * è una misura di sicurezza — il prefisso lo può scrivere chiunque — ma il
 * motivo per cui un allenatore non si ritrova "admin" nella barra degli
 * indirizzi di una pagina che è sua.
 *
 * Il calcolo sta qui e non sparso nei componenti perché lo fanno in tanti: il
 * login per sapere dove mandare chi entra, ogni collegamento interno del
 * pannello, e le radici per rimbalzare chi si presenta nell'area sbagliata.
 */

export const AREA_ATLETA = "/area-riservata";

const AREE = {
  admin: "/admin",
  segreteria: "/segreteria",
  editor: "/editor",
  coach: "/coach",
  atleta: AREA_ATLETA
};

/** I prefissi che portano al pannello, atleti esclusi. */
export const PREFISSI_STAFF = ["/admin", "/segreteria", "/editor", "/coach"];

/** L'area di questo ruolo. */
export function areaDi(ruolo) {
  return AREE[ruolo] ?? AREE.admin;
}

/** La pagina dei propri dati, che ha un indirizzo diverso in ogni area. */
export function percorsoProfilo(ruolo) {
  return ruolo === "atleta" ? AREA_ATLETA : `${areaDi(ruolo)}/profilo`;
}
