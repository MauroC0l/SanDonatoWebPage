import { Container } from "react-bootstrap";
import NewsList from "./NewsList";
import Gallery from "./Gallery";

import "../css/Home.css"

export default function Home() {
    const sampleImages = [
        "/assets/photo1.jpg",
        "/assets/photo2.jpg",
        "/assets/photo3.jpg"
    ];

    return (
        <>
            {/* About Section */}
            <section className="about-section">
                <div className="about-content">
                    <h2 className="about-subtitle">
                        ⚽ CALCIO &mdash; 🏐 PALLAVOLO &mdash; 🏀 BASKET
                    </h2>
                    <p className="about-text">
                        La PSD promuove attività sportive ed educative, favorendo aggregazione, socialità e benessere sul territorio.
                    </p>
                </div>
                <div className="about-wave"></div>
            </section>

            {/* News Section */}
            <Container className="section-spacing">
                <NewsList />
            </Container>

            {/* Gallery Section */}
            <Container className="section-spacing">
                <Gallery images={sampleImages} />
            </Container>
        </>
    );
}
