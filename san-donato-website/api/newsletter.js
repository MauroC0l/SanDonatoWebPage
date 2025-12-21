// File: /api/newsletter.js

export default async function handler(req, res) {
  console.log(`Richiesta ricevuta: ${req.method}`);

  // Headers CORS
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

  // Rispondi con 200 se apri l'URL nel browser (GET)
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'Online' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { email, first_name, last_name } = req.body;

    // --- DEBUG VARIABILI (LOG NELLA CONSOLE DI VERCEL) ---
    const rawApiKey = process.env.BREVO_API_KEY;
    const rawListId = process.env.VITE_BREVO_LIST_ID;
    
    console.log("--- DEBUG START ---");
    console.log("API Key letta:", rawApiKey ? "SI (Presente)" : "NO (Undefined)");
    console.log("List ID letto:", rawListId);
    // -----------------------------------------------------

    // Check dati frontend
    if (!email || !first_name || !last_name) {
      return res.status(400).json({ error: 'Dati mancanti dal form (email, first_name, last_name)' });
    }

    const BREVO_API_KEY = rawApiKey;
    const VITE_BREVO_LIST_ID = Number(rawListId);

    // Check configurazione server
    if (!BREVO_API_KEY || !VITE_VITE_BREVO_LIST_ID) {
      console.error("Configurazione mancante. Variabili non lette.");
      // Restituiamo info di debug al frontend per capire cosa succede
      return res.status(500).json({ 
         error: 'Errore configurazione server (Variabili mancanti)',
         debug: {
           apiKeyExists: !!BREVO_API_KEY,
           listIdRaw: rawListId,
           listIdParsed: VITE_BREVO_LIST_ID
         }
      });
    }

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
          NOME: first_name,
          COGNOME: last_name
        },
        listIds: [VITE_BREVO_LIST_ID],
        updateEnabled: true
      })
    };

    const response = await fetch('https://api.brevo.com/v3/contacts', options);
    
    if (!response.ok) {
        const errorData = await response.json();
        console.error("Errore Brevo:", errorData);
        return res.status(400).json({ error: errorData });
    }

    return res.status(200).json({ message: 'Iscrizione completata' });

  } catch (error) {
    console.error("Errore server critico:", error);
    return res.status(500).json({ error: 'Errore interno del server: ' + error.message });
  }
}