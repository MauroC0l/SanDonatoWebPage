import { useAuth } from "./auth";
import { areaDi } from "../utils/percorsi";

/**
 * Il prefisso degli indirizzi di chi è connesso: /admin, /segreteria,
 * /coach, /editor oppure /area-riservata.
 *
 * Ogni collegamento interno del pannello lo antepone, invece di scrivere
 * "/admin" a mano: la stessa schermata vive sotto quattro prefissi diversi, e
 * un collegamento fisso sbatterebbe l'allenatore dentro all'area
 * dell'amministratore, dove verrebbe subito rimbalzato fuori.
 */
export function useArea() {
  const { user } = useAuth();
  return areaDi(user?.role);
}
