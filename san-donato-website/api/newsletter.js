export default async function handler(req, res) {
  // Gestiamo i CORS per permettere al frontend di parlare col backend
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Gestione pre-flight request (browser check)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, first_name, last_name } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email mancante' });
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
      const errorData = await response.json();
      return res.status(400).json({ error: errorData });
    }

    return res.status(200).json({ message: 'Success' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}