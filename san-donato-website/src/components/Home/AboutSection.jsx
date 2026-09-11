import { useEffect, useState } from "react";
import "../../css/AboutSection.css";
// Assicurati che il percorso del file JSON sia corretto
import sectionData from "../../data/AboutSection.json";

export default function AboutSection() {
  // Destrutturiamo i dati dal JSON per comodità
  const { carouselImages, content, settings } = sectionData;

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    // Chi ha chiesto meno animazioni al sistema operativo resta sulla prima
    // immagine: il carosello è decorativo, non porta informazione.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    // Usiamo settings.intervalSpeed dal JSON (default 6000 se non presente)
    const speed = settings?.intervalSpeed || 6000;

    const interval = setInterval(() => {
      // A scheda nascosta non ha senso avanzare: si tornerebbe indietro
      // di parecchie immagini tutte insieme al rientro.
      if (document.hidden) return;
      setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length);
    }, speed);

    return () => clearInterval(interval);
  }, [carouselImages.length, settings?.intervalSpeed]);

  return (
    <section className="about-section">
      {/* Le immagini sono livelli sovrapposti che si dissolvono l'uno
          nell'altro. Cambiando background-image su un solo elemento il
          passaggio era uno stacco netto: background-image non è animabile. */}
      <div className="about-layers" aria-hidden="true">
        {carouselImages.map((image, index) => (
          <div
            key={image}
            className={`about-layer ${index === currentImageIndex ? "is-active" : ""}`}
            style={{ backgroundImage: `url(${image})` }}
          />
        ))}
      </div>

      <div className="about-overlay" aria-hidden="true"></div>

      <div className="about-content">
        <h2 className="about-subtitle">
          {content.subtitle}
        </h2>
        <p className="about-text">
          {content.description}
        </p>
      </div>
    </section>
  );
}
