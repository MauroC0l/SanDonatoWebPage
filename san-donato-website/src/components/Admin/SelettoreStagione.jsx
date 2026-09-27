import { useStagione } from "../../context/stagione";
import Tendina from "./Tendina";

/**
 * Quale stagione guardare, in alto accanto al marchio.
 *
 * È la stessa Tendina di tutto il sito: con molte stagioni l'elenco scorre
 * al suo interno invece di allungarsi oltre lo schermo. Compare solo quando
 * c'è davvero da scegliere — con una stagione sola sarebbe un'etichetta.
 */
export default function SelettoreStagione() {
  const { stagioni, stagione, scegli } = useStagione();

  if (stagioni.length < 2 || !stagione) return null;

  const opzioni = stagioni.map((s) => ({
    valore: String(s.id),
    etichetta: `Stagione ${s.nome}`,
    nota: s.inCorso ? "in corso" : "passata, in sola lettura"
  }));

  return (
    <Tendina
      className={`adm-selettore-stagione ${stagione.inCorso ? "" : "is-passata"}`}
      valore={String(stagione.id)}
      onChange={scegli}
      opzioni={opzioni}
      cercabile={false}
      sovrapposta
      etichettaAria="Stagione da guardare"
    />
  );
}
