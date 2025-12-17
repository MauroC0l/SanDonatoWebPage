import React, { useEffect, useState } from "react";
import { fetchPastResults } from "../api/calendarApi";
import { FaTrophy, FaTimes, FaCalendarDay, FaRunning, FaListOl, FaFutbol } from "react-icons/fa";
import "../css/ResultsModal.css";

const ResultCard = ({ event }) => {
    // Parsing del risultato per visualizzazione grafica
    // Se il risultato è nel formato "X - Y", lo dividiamo per estetica
    const scoreParts = event.result ? event.result.split('-').map(s => s.trim()) : [];
    const isStandardScore = scoreParts.length === 2 && !isNaN(scoreParts[0]) && !isNaN(scoreParts[1]);

    return (
        <div className="rm-card" style={{ borderTop: `4px solid ${event.color}` }}>
            
            {/* CARD HEADER: Data e Categoria */}
            <div className="rm-card-header">
                <span className="rm-date">
                    {new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(event.start)}
                </span>
                <span className="rm-category-badge" style={{ backgroundColor: event.color }}>
                    {event.category}
                </span>
            </div>
            
            {/* CARD HERO: Il Risultato */}
            <div className="rm-hero-score">
                {isStandardScore ? (
                    <div className="rm-score-display">
                        <span className="rm-score-num">{scoreParts[0]}</span>
                        <span className="rm-score-divider">:</span>
                        <span className="rm-score-num">{scoreParts[1]}</span>
                    </div>
                ) : (
                    // Fallback se il risultato è testo (es. "Rinviata" o "3-1 dts")
                    <span className="rm-score-text">{event.result || "Risultato non disponibile"}</span>
                )}
            </div>

            {/* CARD FOOTER: Dettagli (Marcatori & Parziali) */}
            <div className="rm-details-container">
                
                {/* Sezione Marcatori */}
                {event.scorers && event.scorers.length > 0 && (
                    <div className="rm-detail-row">
                        <div className="rm-icon-wrapper" style={{ color: event.color }}>
                            <FaFutbol />
                        </div>
                        <div className="rm-detail-content">
                            <span className="rm-label">Marcatori</span>
                            <span className="rm-value">{event.scorers.join(", ")}</span>
                        </div>
                    </div>
                )}

                {/* Sezione Parziali (Stesso stile di Marcatori) */}
                {event.partials && (
                    <div className="rm-detail-row">
                        <div className="rm-icon-wrapper" style={{ color: event.color }}>
                            <FaListOl />
                        </div>
                        <div className="rm-detail-content">
                            <span className="rm-label">Parziali</span>
                            <span className="rm-value font-mono">{event.partials}</span>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default function ResultsModal({ onClose }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const data = await fetchPastResults();
                if (mounted) {
                    setEvents(data.events);
                    setLoading(false);
                }
            } catch (e) {
                console.error(e);
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, []);

    return (
        <div className="rm-overlay" onClick={onClose}>
            <div className="rm-container" onClick={e => e.stopPropagation()}>
                
                <div className="rm-header">
                    <div className="rm-header-title">
                        <FaTrophy className="rm-trophy-icon" />
                        <h2>Risultati Settimana</h2>
                    </div>
                    <button className="rm-close-btn" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>

                <div className="rm-content">
                    {loading ? (
                        <div className="rm-loader">
                            <div className="spinner"></div>
                            <p>Recupero risultati...</p>
                        </div>
                    ) : (
                        events.length > 0 ? (
                            <div className="rm-list">
                                {events.map(ev => <ResultCard key={ev.id} event={ev} />)}
                            </div>
                        ) : (
                            <div className="rm-empty">
                                <FaCalendarDay size={48} className="rm-empty-icon" />
                                <p>Nessun risultato registrato questa settimana.</p>
                            </div>
                        )
                    )}
                </div>
                
            </div>
        </div>
    );
}