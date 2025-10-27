import { useEffect, useState } from "react";
import "../css/SponsorPage.css";

export default function SponsorPage() {
  const sponsors = [
    { name: "Arcobaleno", image: "/immaginiSponsor/ARCOBALENO.jpg" },
    { name: "Brillo", image: "/immaginiSponsor/BRILLO.png" },
    { name: "Cartiera", image: "/immaginiSponsor/cartiera.png" },
    { name: "Da Michi", image: "/immaginiSponsor/DA MICHI.png" },
    { name: "Disgelo", image: "/immaginiSponsor/DISGELO.png" },
    { name: "Giandujot", image: "/immaginiSponsor/giandujot.png" },
    { name: "GMT", image: "/immaginiSponsor/GMT.png" },
    { name: "La Tosca", image: "/immaginiSponsor/LA TOSCA.png" },
    { name: "Terzo Tempo", image: "/immaginiSponsor/TERZO TEMPO.png" },
    { name: "Torino Nord", image: "/immaginiSponsor/torinonord.png" },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  // Cambio automatico ogni 5 secondi
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sponsors.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [sponsors.length]);

  // Funzioni per frecce manuali
  const handlePrev = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? sponsors.length - 1 : prev - 1
    );
  };

  const handleNext = () => {
    setCurrentIndex((prev) =>
      (prev + 1) % sponsors.length
    );
  };

  return (
    <div className="sponsor-page">
      <h1 className="page-title">I Nostri Sponsor</h1>

      <div className="sponsor-carousel">
        {/* Freccia sinistra */}
        <button className="arrow arrow-left" onClick={handlePrev}>
          &#8249;
        </button>

        {/* Immagini sponsor */}
        {sponsors.map((sponsor, index) => (
          <div
            key={index}
            className={`sponsor-slide ${
              index === currentIndex ? "active" : ""
            }`}
          >
            <img
              src={sponsor.image}
              alt={sponsor.name}
              className="sponsor-image"
            />
          </div>
        ))}

        {/* Freccia destra */}
        <button className="arrow arrow-right" onClick={handleNext}>
          &#8250;
        </button>

        <button className="arrow arrow-left" onClick={handlePrev}>
          &#8249;
        </button>
      </div>
    </div>
  );
}
