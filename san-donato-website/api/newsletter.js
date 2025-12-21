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

  if (req.method === 'GET') {
    return res.status(200).json({ status: 'Online' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Manteniamo first_name e last_name in ingresso (dal Frontend)
    const { email, first_name, last_name } = req.body;

    // --- LEGGERE LE VARIABILI D'AMBIENTE ---
    const BREVO_API_KEY = process.env.VITE_BREVO_API_KEY;
    const BREVO_LIST_ID = Number(process.env.BREVO_LIST_ID); 

    console.log("--- DEBUG START ---");
    console.log("API Key letta:", BREVO_API_KEY ? "SI" : "NO");
    console.log("List ID letto:", BREVO_LIST_ID);
    // ------------------------------------

    // Check dati frontend
    if (!email || !first_name || !last_name) {
      return res.status(400).json({ error: 'Dati mancanti dal form (email, first_name, last_name)' });
    }

    // Check configurazione server
    if (!BREVO_API_KEY) {
      console.error("Configurazione mancante API KEY.");
      return res.status(500).json({ 
         error: 'Errore configurazione server (manca API KEY)',
         debug: { apiKeyExists: false }
      });
    }
    
    if (!BREVO_LIST_ID) {
      console.error("Configurazione mancante LIST ID.");
      return res.status(500).json({ 
         error: 'Errore configurazione server (manca LIST ID)',
         debug: { listId: BREVO_LIST_ID }
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
          // Brevo spesso usa questi internamente anche se mostra "NOME" nella UI
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
        console.error("Errore Brevo:", errorData);
        // Restituiamo l'errore esatto di Brevo
        return res.status(400).json({ error: errorData });
    }

    return res.status(200).json({ message: 'Iscrizione completata' });

  } catch (error) {
    console.error("Errore server critico:", error);
    return res.status(500).json({ error: 'Errore interno del server: ' + error.message });
  }
}