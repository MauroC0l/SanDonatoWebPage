import {
  FaHome, FaNewspaper, FaUsers,
  FaEnvelope, FaCalendarAlt, FaFileAlt,
  FaHandshake, FaChild, FaScroll,
  FaFutbol, FaImages
} from "react-icons/fa";

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

// I documenti: i primi due sono file da scaricare, gli altri pagine del sito
export const DOCUMENTI = [
  { to: "/documenti/PSD_VADEMECUM_2025-2026.pdf", label: "Vademecum", icon: <FaFileAlt />, download: true },
  { to: "/documenti/PSD_STATUTO.pdf", label: "Statuto", icon: <FaScroll />, download: true },
  { to: "/privacy", label: "Privacy", icon: <FaFileAlt /> },
  { to: "/tutela-minori", label: "Tutela minori", icon: <FaChild /> },
  { to: "/cinquepermille", label: "5x1000", icon: <FaScroll /> },
  { to: "/contributi-pubblici", label: "Contributi", icon: <FaScroll /> },
];
