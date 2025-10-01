import { Container } from "react-bootstrap";
import NewsList from "./NewsList";

import "../css/Home.css";

export default function Home() {
    // Mock news
    const mockNews = [
        {
            id: 1,
            title: "Iscrizioni aperte per la scuola calcio 2025",
            date: "1 Ottobre 2025",
            author: "Staff PSD",
            image: "scuolaCalcio.jpg",
            excerpt: "La scuola calcio apre le iscrizioni per tutti i bambini dai 6 ai 12 anni. Vieni a provare i nostri allenamenti! Bla bla bla, divertimento assicurato per tutti."
        },
        {
            id: 2,
            title: "Torneo di Pallavolo giovanile",
            date: "20 Settembre 2025",
            author: "Staff PSD",
            image: "torneoPallavolo.jpg",
            excerpt: "Si terrà il torneo di pallavolo giovanile presso la palestra comunale. Tutti i team sono benvenuti!"
        },
        {
            id: 3,
            title: "Nuovo corso di basket per principianti",
            date: "15 Ottobre 2025",
            author: "Staff PSD",
            image: "corsoBasket.jpg",
            excerpt: "Iscriviti al nuovo corso di basket per principianti! Allenamenti divertenti, tecniche base e tanto spirito di squadra."
        },
        {
            id: 4,
            title: "Camp estivo sportivo PSD",
            date: "5 Luglio 2025",
            author: "Staff PSD",
            image: "campoEstivo.jpg",
            excerpt: "Il camp estivo PSD è aperto a tutti i bambini dai 6 ai 14 anni. Sport, giochi e nuove amicizie garantiti!"
        },
        {
            id: 5,
            title: "Torneo di calcetto adulti",
            date: "12 Novembre 2025",
            author: "Staff PSD",
            image: "torneoCalcetto.jpg",
            excerpt: "Non perderti il torneo di calcetto per adulti! Squadre miste e tanto divertimento. Iscrizioni aperte fino al 5 Novembre."
        },
        {
            id: 6,
            title: "Lezioni di ginnastica posturale",
            date: "1 Settembre 2025",
            author: "Staff PSD",
            image: "pilates.jpg",
            excerpt: "Partecipa alle nostre lezioni di ginnastica posturale per migliorare postura, flessibilità e benessere quotidiano."
        }
    ];


    return (
        <div className="home-wrapper">
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
                <NewsList news={mockNews} />
            </Container>
        </div>
    );
}
