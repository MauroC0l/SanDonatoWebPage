// File: /api/newsletter.js

export default async function handler(req, res) {
  // Configurazione CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { email, first_name, last_name } = req.body;

    if (!email || !first_name || !last_name) {
      return res.status(400).json({ error: 'Dati mancanti' });
    }

    // CORREZIONE QUI: Usa process.env, NON import.meta.env
    // Inoltre, le chiavi segrete NON dovrebbero avere il prefisso VITE_
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const BREVO_LIST_ID = Number(process.env.BREVO_LIST_ID);

    console.log("Tentativo invio a Brevo con List ID:", BREVO_LIST_ID); // Log per debug

    const options = {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        email: email,
        attributes: {
          FIRSTNAME: first_name,
          LASTNAME: last_name
        },
        listIds: [BREVO_LIST_ID],
        updateEnabled: true
      })
    };

    const response = await fetch('https://api.brevo.com/v3/contacts', options);
    
    if (!response.ok) {
        const errorData = await response.json();
        console.error("Errore Brevo:", errorData); // Log errore backend
        return res.status(response.status).json({ error: errorData });
    }

    return res.status(200).json({ message: 'Successo' });

  } catch (error) {
    console.error("Errore Server:", error);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}