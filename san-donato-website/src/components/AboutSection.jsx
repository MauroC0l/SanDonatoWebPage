import { useEffect, useState } from "react";
import "../css/AboutSection.css";

export default function AboutSection() {
    const aboutImages = [
        "/caroselloHome/homeBackground.jpg",
        "/caroselloHome/homeBackground2.jpg",
        "/caroselloHome/homeBackground5.jpg",
        "/caroselloHome/homeBackground6.jpg",
        "/caroselloHome/homeBackground7.jpg",
        "/caroselloHome/homeBackground8.jpg",
    ];

    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex(prev => (prev + 1) % aboutImages.length);
        }, 6000); // 6 secondi di intervallo
        return () => clearInterval(interval);
    }, [aboutImages.length]);

    const backgroundStyle = {
        backgroundImage: `url(${aboutImages[currentImageIndex]})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        transition: "background-image 1s ease-in-out",
    };

    return (
        <section className="about-section" style={backgroundStyle}>
            <div className="about-overlay"></div>
            <div className="about-content">
                <h2 className="about-subtitle">
                    ⚽ CALCIO &mdash; 🏐 PALLAVOLO &mdash; 🏀 BASKET
                </h2>
                <p className="about-text">
                    La PSD promuove attività sportive ed educative,
                    favorendo aggregazione, socialità e benessere sul territorio.
                </p>
            </div>
        </section>
    );
}
