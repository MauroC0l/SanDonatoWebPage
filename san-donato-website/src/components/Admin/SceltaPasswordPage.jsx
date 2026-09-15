import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/auth";
import { areaDi } from "../../utils/percorsi";
import CambioPasswordPage from "./CambioPasswordPage";

/**
 * /select-password — la schermata di chi deve ancora scegliere una password sua.
 *
 * È lo stesso modulo del cambio volontario, montato però su un indirizzo
 * proprio. Prima sostituiva il contenuto del pannello lasciando l'indirizzo
 * di prima: ricaricare la pagina riportava lì senza spiegazione, e non si
 * poteva dire a qualcuno "apri questo indirizzo" mentre lo si aiuta.
 *
 * Chi passa di qui senza averne bisogno viene rimandato a casa propria: la
 * pagina esiste per una tappa obbligata, non è una schermata che si visita.
 */
export default function SceltaPasswordPage() {
  const { user, isAuthenticated, isChecking, deveCambiarePassword } = useAuth();

  if (isChecking) {
    return (
      <div className="adm-boot">
        <div className="adm-spinner" />
        <p>Verifica dell&apos;accesso…</p>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!deveCambiarePassword) return <Navigate to={areaDi(user?.role)} replace />;

  return <CambioPasswordPage obbligatorio />;
}
