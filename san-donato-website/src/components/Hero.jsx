import "../css/Hero.css";

export default function Hero() {
    const title = "Polisportiva San Donato";
    const subtitle = "Lo sport in borgo San Donato a Torino";
    const message = "Iscrizioni aperte, attività per tutte le età.";
    const logoImage = "logo-polisportiva.png";

    return (
        <section className="hero-section">
            <div className="hero-content">
                <div className="hero-text">
                    <h1 className="hero-title">{title}</h1>
                    <div className="hero-subtitle">{subtitle}</div>
                </div>

                <div className="hero-logo-container">
                    <img
                        src={logoImage}
                        alt="Logo Polisportiva San Donato"
                        className="hero-logo"
                    />
                </div>
            </div>
        </section>
    );
}
