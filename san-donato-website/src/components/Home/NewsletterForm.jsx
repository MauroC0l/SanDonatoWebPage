import React, { useState } from 'react';
import { FaTimes, FaPaperPlane, FaCheckCircle, FaExclamationCircle, FaArrowRight, FaInfoCircle } from 'react-icons/fa';
import '../../css/NewsletterForm.css';

const NewsletterForm = ({ onClose }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: ''
  });
  
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null); // 'loading', 'success', 'error', 'exists'
  const [apiMessage, setApiMessage] = useState('');

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.first_name.trim()) newErrors.first_name = 'Il nome è obbligatorio';
    if (!formData.last_name.trim()) newErrors.last_name = 'Il cognome è obbligatorio';
    if (!formData.email.trim()) {
      newErrors.email = "L'email è obbligatoria";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Formato email non valido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) setErrors({ ...errors, [name]: '' });
    if (status === 'exists' || status === 'error') setStatus(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setStatus('loading');

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        // Salviamo il nome per il messaggio di successo prima di resettare
        const savedName = formData.first_name;
        setFormData({ first_name: savedName, last_name: '', email: '' });
      } else if (response.status === 409) {
        setStatus('exists');
        setApiMessage(data.error || 'Sei già dei nostri!');
      } else {
        setStatus('error');
        setApiMessage(data.error || 'Errore di connessione.');
      }
    } catch (error) {
      setStatus('error');
      setApiMessage('Errore di sistema. Riprova più tardi.');
    }
  };

  return (
    <div className="nl-modal-overlay" onClick={onClose}>
      <div className="nl-modal-container">
        <div className={`nl-modal-content ${status === 'exists' ? 'nl-shake' : ''}`} onClick={(e) => e.stopPropagation()}>
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
                <div className={`nl-input-group ${errors.first_name ? 'has-error' : ''}`}>
                  <input
                    type="text"
                    name="first_name"
                    id="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    placeholder=" "
                    autoComplete="given-name"
                  />
                  <label htmlFor="first_name">Nome</label>
                  {errors.first_name && <span className="nl-error-text">{errors.first_name}</span>}
                </div>

                <div className={`nl-input-group ${errors.last_name ? 'has-error' : ''}`}>
                  <input
                    type="text"
                    name="last_name"
                    id="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    placeholder=" "
                    autoComplete="family-name"
                  />
                  <label htmlFor="last_name">Cognome</label>
                  {errors.last_name && <span className="nl-error-text">{errors.last_name}</span>}
                </div>
              </div>

              <div className={`nl-input-group ${errors.email || status === 'exists' ? 'has-error' : ''}`}>
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder=" "
                  autoComplete="email"
                />
                <label htmlFor="email">Indirizzo Email</label>
                {errors.email && <span className="nl-error-text">{errors.email}</span>}
              </div>

              {status === 'exists' && (
                <div className="nl-feedback exists">
                  <FaInfoCircle /> {apiMessage}
                </div>
              )}

              {status === 'error' && (
                <div className="nl-feedback error">
                  <FaExclamationCircle /> {apiMessage}
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
              
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewsletterForm;