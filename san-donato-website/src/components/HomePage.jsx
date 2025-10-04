import { Container } from "react-bootstrap";
import NewsList from "./NewsList";
import AboutSection from "./AboutSection";
import "../css/HomePage.css";

export default function HomePage() {
    const mockNews = [
        { id: 1, title: "Iscrizioni aperte per la scuola calcio 2025", date: "04/10/2025", sport: "Calcio", author: "Staff PSD", image: "immaginiNotizie/scuolaCalcio.jpg", excerpt: "La scuola calcio apre le iscrizioni per tutti i bambini dai 6 ai 12 anni." },
        { id: 2, title: "Torneo di Pallavolo giovanile", date: "20/09/2025", sport: "Pallavolo", author: "Staff PSD", image: "immaginiNotizie/torneoPallavolo.jpg", excerpt: "Si terrà il torneo di pallavolo giovanile presso la palestra comunale." },
        { id: 3, title: "Nuovo corso di basket", date: "15/10/2025", sport: "Basket", author: "Staff PSD", image: "immaginiNotizie/corsoBasket.jpg", excerpt: "Iscriviti al nuovo corso di basket per principianti!" },
        { id: 4, title: "Camp estivo sportivo PSD", date: "05/07/2025", sport: "Multisport", author: "Dirigenza", image: "immaginiNotizie/campoEstivo.jpg", excerpt: "Il camp estivo PSD è aperto a tutti i bambini." },
    ];

    return (
        <div className="home-wrapper">
            <Container className="section-spacing">
                <NewsList news={mockNews} />
            </Container>
        </div>
    );
}
