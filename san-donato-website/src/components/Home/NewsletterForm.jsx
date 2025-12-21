"use client"; // Necessario se usi Next.js App Router
import { useState } from 'react';

export default function NewsletterForm() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: ''
  });
  const [status, setStatus] = useState('idle'); // idle, loading, success, error

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Errore iscrizione');

      setStatus('success');
      setFormData({ first_name: '', last_name: '', email: '' }); // Reset form
    } catch (e) {
      setStatus('error');
    }
  };

  return (
    <div className="p-4 border rounded shadow-md max-w-md mx-auto">
      <h3 className="text-lg font-bold mb-4">Iscriviti alla Newsletter</h3>
      
      {status === 'success' ? (
        <p className="text-green-600">Grazie! Ti sei iscritto con successo.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium">Nome</label>
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Cognome</label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
          </div>

          <button 
            type="submit" 
            disabled={status === 'loading'}
            className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {status === 'loading' ? 'Caricamento...' : 'Iscriviti'}
          </button>
          
          {status === 'error' && <p className="text-red-500 text-sm">Qualcosa è andato storto. Riprova.</p>}
        </form>
      )}
    </div>
  );
}