import React, { useState } from 'react';
import { FaTimes, FaPaperPlane, FaCheckCircle, FaArrowRight, FaTimesCircle } from 'react-icons/fa';
import '../../css/NewsletterForm.css';

const NewsletterForm = ({ onClose }) => {
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [status, setStatus] = useState(null); // 'loading', 'success', 'error'

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.first_name.trim()) newErrors.first_name = 'Nome richiesto';
    if (!formData.last_name.trim()) newErrors.last_name = 'Cognome richiesto';
    if (!formData.email.trim()) {
      newErrors.email = 'Email richiesta';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Formato non valido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) setErrors({ ...errors, [name]: '' });
    if (serverError) setServerError('');
    if (status === 'error') setStatus(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setStatus('loading');
    setServerError('');

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setTimeout(() => { if (onClose) onClose(); }, 3500);
      } else {
        setStatus('error');
        setServerError(data.error || 'Si è verificato un errore.');
      }
    } catch (err) {
      setStatus('error');
      setServerError('Errore di rete. Riprova.');
    }
  };

  return (
    <div className="nl-modal-overlay" onClick={onClose}>
      <div className="nl-modal-container">
        <div className="nl-modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="nl-close-btn" onClick={onClose} aria-label="Chiudi">
            <FaTimes />
          </button>
          
          <div className="nl-header">
            <div className={`nl-icon-pulse ${status}`}>
              {status === 'success' ? <FaCheckCircle /> : status === 'error' ? <FaTimesCircle /> : <FaPaperPlane />}
            </div>
            <h2>
              {status === 'success' ? 'Iscrizione Completata' : status === 'error' ? 'Qualcosa è andato storto' : 'Resta nel Loop'}
            </h2>
            <p>
              {status === 'success' 
                ? `Grazie ${formData.first_name}, sei dei nostri!` 
                : status === 'error' 
                ? serverError 
                : 'Le notizie migliori, direttamente nella tua casella di posta.'}
            </p>
          </div>

          {status === 'success' ? (
            <div className="nl-success-view">
              <div className="success-animation"><FaCheckCircle /></div>
              <button className="nl-btn-secondary" onClick={onClose}>Chiudi finestra</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="nl-form" noValidate>
              <div className="nl-grid-row">
                <div className={`nl-input-group ${errors.first_name ? 'has-error' : ''}`}>
                  <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} placeholder=" " />
                  <label>Nome</label>
                  {errors.first_name && <span className="nl-error-text">{errors.first_name}</span>}
                </div>
                <div className={`nl-input-group ${errors.last_name ? 'has-error' : ''}`}>
                  <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} placeholder=" " />
                  <label>Cognome</label>
                  {errors.last_name && <span className="nl-error-text">{errors.last_name}</span>}
                </div>
              </div>

              <div className={`nl-input-group ${errors.email || serverError ? 'has-error' : ''}`}>
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder=" " />
                <label>Indirizzo Email</label>
                {(errors.email || serverError) && <span className="nl-error-text">{errors.email || serverError}</span>}
              </div>

              <button type="submit" className={`nl-submit-btn ${status}`} disabled={status === 'loading'}>
                {status === 'loading' ? (
                  <span className="spinner"></span>
                ) : (
                  <>
                    {status === 'error' ? 'Riprova' : 'Iscriviti Ora'} <FaArrowRight className="btn-icon" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewsletterForm;