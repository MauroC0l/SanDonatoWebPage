import { PROVINCE, COMUNI, COMUNI_PER_PROVINCIA } from "../data/luoghi";

/**
 * Comuni e province, nella forma che serve ai moduli.
 *
 * Sta a parte da src/data/luoghi.js perché quello è GENERATO da uno script:
 * ogni riga scritta lì dentro sparirebbe alla prima rigenerazione.
 */

/** I nomi delle province, per il campo dei suggerimenti. */
export const NOMI_PROVINCE = PROVINCE.map((p) => p.nome);

const SIGLA_PER_NOME = new Map(PROVINCE.map((p) => [p.nome.toLowerCase(), p.sigla]));

/**
 * I comuni di una provincia, dal suo nome.
 *
 * Senza provincia si restituiscono tutti: chi non l'ha ancora scelta deve
 * comunque poter scrivere il proprio comune, e la ricerca su ottomila voci
 * è istantanea. Il filtro serve a ridurre gli omonimi — in Italia ci sono
 * sedici "San Giorgio" — non a far funzionare il campo.
 */
export function comuniDi(nomeProvincia) {
  if (!nomeProvincia) return COMUNI;

  const sigla = SIGLA_PER_NOME.get(String(nomeProvincia).trim().toLowerCase());
  return sigla ? COMUNI_PER_PROVINCIA[sigla] ?? COMUNI : COMUNI;
}

/** La sigla di una provincia, dal nome. Serve a stampare "Torino (TO)". */
export function siglaDi(nomeProvincia) {
  return SIGLA_PER_NOME.get(String(nomeProvincia ?? "").trim().toLowerCase()) ?? null;
}
