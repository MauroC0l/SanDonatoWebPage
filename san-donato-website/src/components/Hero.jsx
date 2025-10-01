import { Container } from "react-bootstrap";
import "../css/Hero.css";

export default function Hero() {
    const title = "Polisportiva San Donato";
    const subtitle = "Lo sport in borgo San Donato";
    const message = "Iscrizioni aperte, attività per tutte le età.";
    const logoImage = "logo-polisportiva.png";

    return (
        <section className="hero-section">
            <Container>
                <div className="hero-content">
                    <div className="hero-text">
                        <h1 className="hero-title">{title}</h1>
                        <h2 className="hero-subtitle">{subtitle}</h2>
                        <p className="hero-message">{message}</p>
                    </div>
                    <div className="hero-logo-container">
                        <img src={logoImage} alt="Logo Polisportiva San Donato" className="hero-logo" />
                    </div>
                </div>
            </Container>
        </section>
    );
}
