import { useState } from 'react';

const NewsletterForm = () => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: ''
  });
  const [status, setStatus] = useState(null); // 'loading', 'success', 'error'

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');

    try {
      // Chiamata al TUO backend (non direttamente a MailerLite)
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setStatus('success');
        setFormData({ first_name: '', last_name: '', email: '' }); // Reset form
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Campo First Name */}
      <input
        type="text"
        name="first_name"
        placeholder="Il tuo nome"
        value={formData.first_name}
        onChange={handleChange}
        required
        className="border p-2 rounded"
      />

      {/* Campo Last Name */}
      <input
        type="text"
        name="last_name"
        placeholder="Il tuo cognome"
        value={formData.last_name}
        onChange={handleChange}
        required
        className="border p-2 rounded"
      />

      {/* Campo Email */}
      <input
        type="email"
        name="email"
        placeholder="La tua email"
        value={formData.email}
        onChange={handleChange}
        required
        className="border p-2 rounded"
      />

      <button type="submit" disabled={status === 'loading'} className="bg-blue-600 text-white p-2 rounded">
        {status === 'loading' ? 'Invio in corso...' : 'Iscriviti'}
      </button>

      {status === 'success' && <p className="text-green-600">Iscrizione avvenuta con successo!</p>}
      {status === 'error' && <p className="text-red-600">Errore. Riprova più tardi.</p>}
    </form>
  );
};

export default NewsletterForm;