import { Container } from "react-bootstrap";
import Hero from "./Hero";
import NewsList from "./NewsList";
import Gallery from "./Gallery";

export default function Home() {
    const sampleImages = [
        "/assets/photo1.jpg",
        "/assets/photo2.jpg",
        "/assets/photo3.jpg"
    ];

    return (
        <>
            <Hero />
            <Container className="section-spacing">
                <NewsList />
            </Container>
            <Container className="section-spacing">
                <Gallery images={sampleImages} />
            </Container>
        </>
    );
}
