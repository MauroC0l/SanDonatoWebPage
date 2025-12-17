import React from "react";
import "../css/EventDetailsModal.css";

// --- UTILITIES INTERNE ---
const formatDate = (date) => new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date));
const formatTime = (date) => new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(date));

// --- ICONE SVG ---
const IconX = () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const IconCalendar = () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const IconClock = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconMap = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const IconVideo = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
const IconReplay = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
const IconTrophy = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;
const IconBall = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconList = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;

export default function EventDetailsModal({ event, onClose }) {
  if (!event) return null;

  // Controllo fine evento per decidere tra Live o Replay
  const isEventEnded = (() => {
      const now = new Date();
      const end = event.end ? new Date(event.end) : new Date(event.start);
      return now > end;
  })();

  return (
    <div className="cp-modal-overlay" onClick={onClose}>
      <div className="cp-modal-card" onClick={e => e.stopPropagation()}>

        <div className="cp-modal-header" style={{ backgroundColor: event.color }}>
          <div className="cp-modal-header-top">
            <span className="cp-category-badge cp-badge-large" style={{ color: '#fff' }}>
              {event.category}
            </span>
            <button className="cp-btn-close" onClick={onClose}><IconX /></button>
          </div>
          <h2 className="cp-modal-title" style={{ color: '#fff' }}>{event.title}</h2>
        </div>

        <div className="cp-modal-body">
          <div className="cp-detail-grid">
            
            {/* DATA */}
            <div className="cp-detail-row">
              <div className="cp-icon-box"><IconCalendar /></div>
              <div className="cp-detail-content">
                <label>Data</label>
                <p>{formatDate(event.start)}</p>
              </div>
            </div>

            {/* ORARIO */}
            <div className="cp-detail-row">
              <div className="cp-icon-box"><IconClock /></div>
              <div className="cp-detail-content">
                <label>Orario</label>
                <p>
                  {event.hasTime
                    ? `${formatTime(event.start)} - ${formatTime(event.end)}`
                    : "Orario da definire"
                  }
                </p>
              </div>
            </div>

            {/* LUOGO */}
            <div className="cp-detail-row">
              <div className="cp-icon-box"><IconMap /></div>
              <div className="cp-detail-content">
                <label>Luogo</label>
                <p>{event.location !== "" ? event.location : "Luogo da definire"}</p>
              </div>
            </div>

            {/* --- DATI PARSATI DALL'API --- */}
            
            {event.result && (
                <div className="cp-detail-row">
                    <div className="cp-icon-box" style={{color: event.color, backgroundColor: '#fff', border: `1px solid ${event.color}`}}>
                        <IconTrophy />
                    </div>
                    <div className="cp-detail-content">
                        <label>Risultato</label>
                        <p className="cp-result-text">{event.result}</p>
                    </div>
                </div>
            )}

            {event.partials && (
                <div className="cp-detail-row">
                    <div className="cp-icon-box"><IconList /></div>
                    <div className="cp-detail-content">
                        <label>Parziali Set</label>
                        <p className="cp-mono-text">{event.partials}</p>
                    </div>
                </div>
            )}

            {event.scorers && event.scorers.length > 0 && (
                <div className="cp-detail-row">
                    <div className="cp-icon-box"><IconBall /></div>
                    <div className="cp-detail-content">
                        <label>Marcatori</label>
                        <ul className="cp-scorers-list">
                            {event.scorers.map((scorer, idx) => (
                                <li key={idx}>{scorer}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* STREAMING */}
            {event.diretta && (
              <div className="cp-detail-row">
                <div className="cp-icon-box">
                    {isEventEnded ? <IconReplay /> : <IconVideo />}
                </div>
                <div className="cp-detail-content">
                  <label>{isEventEnded ? "Streaming On-Demand" : "Diretta Streaming"}</label>
                  <p>
                    <a
                      href={event.diretta}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cp-link-diretta"
                      style={{ color: event.color }}
                    >
                      {isEventEnded ? "Rivedi partita" : "Guarda Live"}
                    </a>
                  </p>
                </div>
              </div>
            )}

            {/* DESCRIZIONE PULITA */}
            {event.description && (
              <div className="cp-detail-row cp-desc-row">
                <div className="cp-detail-content">
                  <label>Dettagli</label>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{event.description}</p>
                </div>
              </div>
            )}
          </div>

          {/* FOOTER ACTIONS */}
          {(event.location && event.location !== "") && (
            <div className="cp-modal-footer">
              <button
                className="cp-btn-primary"
                onClick={() => {
                  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`);
                }}
              >
                Apri su Maps
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}