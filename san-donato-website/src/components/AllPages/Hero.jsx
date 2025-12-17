import React from "react";
import "../../css/Hero.css";

export default function Hero() {
    const title = "Polisportiva San Donato";
    const subtitle = "La community dello sport in San Donato a Torino";
    const message = "\"Chi gioca divertendosi vince sempre\""; 
    const logoImage = "/logo-polisportiva.png"; 

    return (
        <section className="hero-section">
            <div className="hero-grid">
                
                {/* 1. Testi (Titolo + Sottotitolo) */}
                <div className="hero-text">
                    <h1 className="hero-title">{title}</h1>
                    <div className="hero-subtitle">{subtitle}</div>
                </div>

                {/* 2. Logo */}
                <div className="hero-visual">
                    <img
                        src={logoImage}
                        alt="Logo Polisportiva San Donato"
                        className="hero-logo"
                    />
                </div>

                {/* 3. Messaggio */}
                <div className="hero-message-box">
                    {message}
                </div>

            </div>
        </section>
    );
}