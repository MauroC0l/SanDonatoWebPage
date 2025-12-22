import React, { useState } from 'react';
import { FaTimes, FaPaperPlane, FaCheckCircle, FaExclamationCircle, FaArrowRight } from 'react-icons/fa';
import '../../css/NewsletterForm.css';

const NewsletterForm = ({ onClose }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: ''
  });
  
  // Stato per gestire gli errori di validazione manuale
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null); // 'loading', 'success', 'error'

  // Funzione di validazione manuale
  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Regex semplice per email

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'Il nome è obbligatorio';
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Il cognome è obbligatorio';
    }
    if (!formData.email.trim()) {
      newErrors.email = "L'email è obbligatoria";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Formato email non valido';
    }

    setErrors(newErrors);
    // Restituisce true se non ci sono errori (l'oggetto keys ha lunghezza 0)
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Rimuovi l'errore specifico non appena l'utente inizia a scrivere
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Esegui validazione manuale prima di inviare
    if (!validateForm()) {
      return; // Blocca l'invio se ci sono errori
    }

    setStatus('loading');

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setStatus('success');
        setFormData({ first_name: '', last_name: '', email: '' });
        setErrors({});
        setTimeout(() => {
           if(onClose) onClose();
        }, 3000);
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error(error);
      setStatus('error');
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
            <div className="nl-icon-pulse">
              <FaPaperPlane />
            </div>
            <h2>Resta nel Loop</h2>
            <p>Le notizie migliori, direttamente nella tua casella di posta.</p>
          </div>

          {status === 'success' ? (
            <div className="nl-success-view">
              <div className="success-animation">
                <FaCheckCircle />
              </div>
              <h3>Benvenuto a bordo!</h3>
              <p>Grazie {formData.first_name}, controlla la tua email per confermare.</p>
              <button className="nl-btn-secondary" onClick={onClose}>Torna al sito</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="nl-form" noValidate>
              
              <div className="nl-grid-row">
                {/* Gruppo First Name */}
                <div className={`nl-input-group ${errors.first_name ? 'has-error' : ''}`}>
                  <input
                    type="text"
                    name="first_name"
                    id="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    placeholder=" "
                  />
                  <label htmlFor="first_name">Nome</label>
                  {errors.first_name && <span className="nl-error-text">{errors.first_name}</span>}
                </div>

                {/* Gruppo Last Name */}
                <div className={`nl-input-group ${errors.last_name ? 'has-error' : ''}`}>
                  <input
                    type="text"
                    name="last_name"
                    id="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    placeholder=" "
                  />
                  <label htmlFor="last_name">Cognome</label>
                  {errors.last_name && <span className="nl-error-text">{errors.last_name}</span>}
                </div>
              </div>

              {/* Gruppo Email */}
              <div className={`nl-input-group ${errors.email ? 'has-error' : ''}`}>
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder=" "
                />
                <label htmlFor="email">Indirizzo Email</label>
                {errors.email && <span className="nl-error-text">{errors.email}</span>}
              </div>

              {status === 'error' && (
                <div className="nl-feedback error">
                  <FaExclamationCircle /> Errore di connessione. Riprova più tardi.
                </div>
              )}

              <button type="submit" className="nl-submit-btn" disabled={status === 'loading'}>
                {status === 'loading' ? (
                  <span className="spinner"></span>
                ) : (
                  <>
                    Iscriviti Ora <FaArrowRight className="btn-icon" />
                  </>
                )}
              </button>
              
              <p className="nl-footer-text">
                Cliccando su Iscriviti accetti la nostra Privacy Policy.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewsletterForm;