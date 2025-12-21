// File: /api/newsletter.js

export default async function handler(req, res) {
  // 1. Configurazione CORS (Indispensabile per far parlare Frontend e Backend)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Gestione richiesta pre-flight (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Debug: Se apri l'URL nel browser vedi se sei online
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'API Newsletter Online' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  try {
    const { email, first_name, last_name } = req.body;

    // --- RECUPERO VARIABILI AMBIENTE ---
    // Assicurati di aver aggiunto VITE_BREVO_API_KEY su Vercel > Settings > Environment Variables
    const BREVO_API_KEY = process.env.VITE_BREVO_API_KEY;
    const BREVO_LIST_ID = Number(process.env.BREVO_LIST_ID) || 2; // Metto 2 come fallback se non trova l'ID

    // --- CONTROLLO SICUREZZA API KEY ---
    if (!BREVO_API_KEY) {
      console.error("ERRORE CRITICO: API Key mancante sul server.");
      return res.status(500).json({ 
        error: 'Errore configurazione server: API Key non trovata. Verifica le Environment Variables su Vercel.' 
      });
    }

    // --- CHIAMATA A BREVO ---
    const options = {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY, // Qui passiamo la chiave
      },
      body: JSON.stringify({
        email: email,
        attributes: {
          // USIAMO GLI STANDARD INTERNAZIONALI DI BREVO
          // Funzionano anche se il tuo pannello è in Italiano
          FIRSTNAME: first_name,
          LASTNAME: last_name
        },
        listIds: [BREVO_LIST_ID],
        updateEnabled: true // Aggiorna il contatto se esiste già
      })
    };

    const response = await fetch('https://api.brevo.com/v3/contacts', options);
    
    // Se Brevo risponde con errore, leggiamo il JSON per capire perché
    if (!response.ok) {
        const errorData = await response.json();
        console.error("Errore risposta Brevo:", errorData);
        
        // Gestione specifica dell'errore "Key not found" nel caso 401 vs 400
        if (response.status === 401) {
             return res.status(401).json({ error: "Errore di Autenticazione: API Key non valida o mancante." });
        }
        
        return res.status(400).json({ error: errorData, details: "Errore restituito da Brevo" });
    }

    return res.status(200).json({ message: 'Iscrizione completata con successo' });

  } catch (error) {
    console.error("Errore server interno:", error);
    return res.status(500).json({ error: 'Errore interno del server: ' + error.message });
  }
}