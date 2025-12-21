// File: /api/newsletter.js (CODICE TEMPORANEO DI DIAGNOSI)

export default async function handler(req, res) {
  // Configurazione CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, api-key');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const BREVO_API_KEY = process.env.VITE_BREVO_API_KEY;

  try {
    // Chiediamo a Brevo: "Quali sono i tuoi attributi?"
    const response = await fetch('https://api.brevo.com/v3/contacts/attributes', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
      },
    });

    const data = await response.json();

    // Restituiamo la lista al browser così puoi leggerla
    return res.status(200).json({ 
      message: "Ecco i nomi REALI degli attributi su Brevo",
      attributes: data.attributes 
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}