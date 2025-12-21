// File: /api/newsletter.js

export default async function handler(req, res) {
  // 1. Logghiamo cosa sta arrivando (utile per il debug su Vercel Logs)
  console.log(`Richiesta ricevuta: ${req.method} da ${req.headers.origin}`);

  // 2. Impostiamo gli Headers CORS per permettere a chiunque di chiamare l'API
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 3. Gestiamo la richiesta "OPTIONS" (il browser chiede: "posso passare?")
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 4. TEST: Se apri l'URL nel browser, è una GET. Rispondiamo OK invece di errore.
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'API Online', 
      message: 'La funzione funziona! Usa POST per inviare dati.' 
    });
  }

  // 5. Se non è POST a questo punto, allora è un errore vero
  if (req.method !== 'POST') {
    console.error(`Metodo non consentito: ${req.method}`);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { email, first_name, last_name } = req.body;

    // Log dei dati ricevuti (ATTENZIONE: su Vercel i log sono visibili, non loggare password)
    console.log('Dati ricevuti:', { email, first_name, last_name });

    if (!email || !first_name || !last_name) {
      return res.status(400).json({ error: 'Dati mancanti: assicurati di inviare email, first_name e last_name' });
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const BREVO_LIST_ID = Number(process.env.BREVO_LIST_ID);

    if (!BREVO_API_KEY || !BREVO_LIST_ID) {
      console.error('Variabili ambiente mancanti su Vercel!');
      return res.status(500).json({ error: 'Configurazione server errata (API KEY mancante)' });
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
        console.error("Errore Brevo API:", errorData);
        return res.status(response.status).json({ error: errorData });
    }

    return res.status(200).json({ message: 'Iscrizione completata con successo' });

  } catch (error) {
    console.error("Errore generico server:", error);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}