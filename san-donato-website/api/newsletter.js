// Esempio per Next.js API Route / Node.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, first_name, last_name } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email mancante' });
  }

  const API_KEY = process.env.MAILERLITE_API_KEY; // Salva la chiave nel file .env

  // Struttura dati per MailerLite
  const data = {
    email: email,
    fields: {
      name: first_name,       // In MailerLite standard, 'name' è solitamente il nome proprio
      last_name: last_name    // 'last_name' è il cognome
    },
    // groups: ['123456789'] // Opzionale: ID del gruppo se vuoi segmentarli subito
  };

  try {
    const response = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(data),
    });

    if (response.status >= 400) {
      return res.status(400).json({ error: 'Errore MailerLite' });
    }

    return res.status(200).json({ message: 'Success' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}