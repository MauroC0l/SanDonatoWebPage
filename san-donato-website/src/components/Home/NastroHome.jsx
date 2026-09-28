import sectionData from "../../data/AboutSection.json";
import { MARCHIO } from "../AllPages/marchio";

/* Le parole del nastro: gli sport come li scrive AboutSection.json
   ("⚽ CALCIO — 🏐 PALLAVOLO — 🏀 BASKET"), più il quartiere e il motto.
   Chi aggiunge uno sport nel JSON se lo ritrova anche qui. */
const VOCI = [
  ...sectionData.content.subtitle.split("—").map((s) => s.trim()).filter(Boolean),
  "Borgo San Donato",
  MARCHIO.motto,
  "Sport per tutti"
];

/**
 * Il nastro arancione, storto, che fa da cucitura fra la prima schermata e
 * le notizie: lo stesso delle pagine Contatti e Sponsor, perché il sito si
 * riconosca da una pagina all'altra.
 *
 * Il contenuto è ripetuto due volte dentro la traccia: la seconda metà
 * prende il posto della prima e il giro non si vede. Per i lettori di
 * schermo è decorazione: le stesse cose sono scritte altrove.
 */
export default function NastroHome() {
  return (
    /* La cornice taglia di lato quello che il nastro, storto e un po'
       ingrandito, sporgerebbe oltre lo schermo: senza, la pagina del
       telefono scorrerebbe di qualche pixel in orizzontale. */
    <div className="hs-nastro-cornice" aria-hidden="true">
      <div className="mv-nastro hs-nastro">
        <div className="mv-nastro-traccia">
          {[...VOCI, ...VOCI].map((voce, i) => (
            <span className="hs-nastro-voce" key={i}>
              {voce}
              <span className="hs-nastro-stella">✦</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
