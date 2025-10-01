import { Container, Button } from "react-bootstrap";
import "../css/Hero.css";

export default function Hero() {
    const title = "Polisportiva San Donato";
    const subtitle = "Lo sport in borgo San Donato";
    const message = "Iscrizioni aperte, attività per tutte le età.";

    return (
        <section className="hero-section d-flex align-items-center text-center">
            <Container>
                <h1 className="hero-title">{title}</h1>
                <h2 className="hero-subtitle">{subtitle}</h2>
                <p className="hero-message">{message}</p>
                
            </Container>
        </section>
    );
}
