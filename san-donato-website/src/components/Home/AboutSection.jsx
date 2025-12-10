import { useEffect, useState } from "react";
import "../../css/AboutSection.css";
// Assicurati che il percorso del file JSON sia corretto
import sectionData from "../../data/AboutSection.json"; 

export default function AboutSection() {
  // Destrutturiamo i dati dal JSON per comodità
  const { carouselImages, content, settings } = sectionData;
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    // Usiamo settings.intervalSpeed dal JSON (default 6000 se non presente)
    const speed = settings?.intervalSpeed || 6000;
    
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length);
    }, speed);
    
    return () => clearInterval(interval);
  }, [carouselImages.length, settings?.intervalSpeed]);

  const backgroundStyle = {
    backgroundImage: `url(${carouselImages[currentImageIndex]})`,
  };

  return (
    <section className="about-section" style={backgroundStyle}>
      <div className="about-overlay"></div>
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