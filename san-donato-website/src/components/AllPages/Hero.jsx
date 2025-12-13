import React from "react";
import "../../css/Hero.css";

export default function Hero() {
    const title = "Polisportiva San Donatoooooooooooooooooo";
    const subtitle = "La community dello sport in San Donato a Torino";
    const message = "\"Chi gioca divertendosi vince sempre\""; 
    const logoImage = "/logo-polisportiva.png"; // Assicurati che il percorso sia corretto

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
                    <div className="hero-message">{message}</div> 
                </div>
            </div>
        </section>
    );
}