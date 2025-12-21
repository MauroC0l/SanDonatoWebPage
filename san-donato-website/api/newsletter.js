// File: /api/newsletter.js

export default async function handler(req, res) {
  // 1. Configurazione CORS (Permette al tuo sito React di contattare l'API)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 2. Risposta immediata per le richieste di pre-flight (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 3. Controllo Metodo (Accettiamo solo POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito. Usa POST.' });
  }

  try {
    // 4. Ricezione Dati dal Frontend
    const { email, first_name, last_name } = req.body;

    if (!email || !first_name || !last_name) {
      return res.status(400).json({ error: 'Dati mancanti (email, nome o cognome)' });
    }

    // 5. Configurazione Brevo
    // NOTA: Uso VITE_BREVO_API_KEY perché hai confermato che nel tuo setup funziona così
    const BREVO_API_KEY = process.env.VITE_BREVO_API_KEY;
    const BREVO_LIST_ID = Number(process.env.VITE_BREVO_LIST_ID);

    if (!BREVO_API_KEY) {
      console.error("Chiave API mancante");
      return res.status(500).json({ error: 'Errore configurazione server' });
    }

    // 6. Costruzione Richiesta
    // IMPORTANTE: Qui devi mettere i nomi ESATTI che hai letto nel JSON di diagnostica
    const brevoAttributes = {
      // Sostituisci 'NOME' o 'FIRSTNAME' in base a quello che hai visto nel JSON
      FIRSTNAME: first_name, 
      LASTNAME: last_name
    };

    const payload = {
      email: email,
      attributes: brevoAttributes,
      listIds: [BREVO_LIST_ID],
      updateEnabled: true // Se l'utente esiste già, aggiorna i dati invece di dare errore
    };

    console.log("Invio a Brevo:", JSON.stringify(payload));

    // 7. Chiamata a Brevo
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Errore risposta Brevo:", data);
      // Gestione errore specifico "Utente già iscritto" (se updateEnabled è false) o altri
      return res.status(response.status).json({ error: data.message || 'Errore Brevo' });
    }

    return res.status(200).json({ success: true, message: 'Iscrizione avvenuta!' });

  } catch (error) {
    console.error("Errore server interno:", error);
    return res.status(500).json({ error: error.message });
  }
}