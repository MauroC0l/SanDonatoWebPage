export default async function handler(req, res) {
  // Questo controllo è fondamentale per evitare l'errore 405
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { email, first_name, last_name } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const API_KEY = process.env.MAILERLITE_API_KEY;

  const data = {
    email: email,
    fields: {
      name: first_name,
      last_name: last_name
    }
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

    return res.status(200).json({ message: 'Iscritto!' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}