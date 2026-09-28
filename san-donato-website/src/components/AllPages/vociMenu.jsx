import {
  FaHome, FaNewspaper, FaUsers,
  FaEnvelope, FaCalendarAlt, FaFileAlt,
  FaHandshake, FaChild, FaScroll,
  FaFutbol, FaImages
} from "react-icons/fa";
import { useDocumenti } from "../../hooks/useDocumenti";

/*
 * Le voci del menu, in un file loro: le usano sia la riga del computer
 * (MyNavbar) sia il menu a tutto schermo del telefono (MenuSchermo), e
 * devono restare le stesse, nello stesso ordine.
 */
export const VOCI = [
  { to: "/", label: "Home", icon: <FaHome /> },
  { to: "/calendario", label: "Calendario", icon: <FaCalendarAlt /> },
  { to: "/news", label: "News", icon: <FaNewspaper /> },
  { to: "/sports", label: "Sport", icon: <FaFutbol /> },
  { to: "/iscrizione", label: "Iscriviti", icon: <FaHandshake /> },
  { to: "/galleria", label: "Galleria", icon: <FaImages /> },
  { to: "/chi-siamo", label: "Chi Siamo", icon: <FaUsers /> },
  { to: "/contatti", label: "Contatti", icon: <FaEnvelope /> },
  { to: "/sponsor", label: "Sponsor", icon: <FaScroll /> },
];

/*
 * Il menu "Documenti": prima i file da scaricare (Vademecum, Statuto…),
 * poi le pagine del sito dedicate ai documenti.
 *
 * I file non sono più scritti qui: li decide l'amministratore dalla scheda
 * "Documenti" dell'area riservata (sezione "menu") e arrivano da
 * /api/documenti. Le pagine invece restano fisse: sono pagine del sito,
 * non file che cambiano di anno in anno.
 */
export const PAGINE_DOCUMENTI = [
  { to: "/privacy", label: "Privacy", icon: <FaFileAlt /> },
  { to: "/tutela-minori", label: "Tutela minori", icon: <FaChild /> },
  { to: "/cinquepermille", label: "5x1000", icon: <FaScroll /> },
  { to: "/contributi-pubblici", label: "Contributi", icon: <FaScroll /> },
];

/**
 * Le voci del menu "Documenti", file e pagine insieme, nella stessa forma
 * di prima ({ to, label, icon, download }): chi le disegna non cambia.
 * "chiave" perché due voci potrebbero puntare allo stesso file.
 *
 * Finché i file non sono arrivati ci sono solo le pagine; se non arrivano
 * affatto, il menu resta comunque utilizzabile.
 */
export function useVociDocumenti() {
  const { documenti } = useDocumenti("menu");
  const file = documenti.map((d) => ({
    to: d.url,
    label: d.titolo,
    icon: <FaFileAlt />,
    download: true,
    chiave: `doc-${d.id}`
  }));
  return [...file, ...PAGINE_DOCUMENTI.map((p) => ({ ...p, chiave: p.to }))];
}
