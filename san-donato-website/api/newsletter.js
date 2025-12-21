export default async function handler(req, res) {
  // LOG: Vediamo cosa arriva
  console.log(`Richiesta ricevuta: ${req.method}`);

  // CORS HEADERS
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
    // 1. Estraiamo i dati usando i nomi standard (come da tua regola)
    // Il frontend deve inviare: { email, first_name, last_name }
    const { email, first_name, last_name } = req.body;

    console.log('Dati estratti:', { email, first_name, last_name });

    // 2. Controllo validità
    if (!email || !first_name || !last_name) {
      return res.status(400).json({ 
        error: 'Dati mancanti. Assicurati che il frontend invii: email, first_name, last_name' 
      });
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const BREVO_LIST_ID = Number(process.env.BREVO_LIST_ID);

    if (!BREVO_API_KEY || !BREVO_LIST_ID) {
      console.error('Variabili ambiente mancanti!');
      return res.status(500).json({ error: 'Errore configurazione server' });
    }

    // 3. Chiamata a Brevo
    // NOTA: Qui mappiamo le variabili standard sugli attributi ITALIANI di Brevo
    const options = {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        email: email, // L'email va nella root, non negli attributes
        attributes: {
          NOME: first_name,    // Mappatura: first_name -> NOME
          COGNOME: last_name   // Mappatura: last_name -> COGNOME
        },
        listIds: [BREVO_LIST_ID],
        updateEnabled: true
      })
    };

    const response = await fetch('https://api.brevo.com/v3/contacts', options);
    
    if (!response.ok) {
        const errorData = await response.json();
        console.error("Errore Brevo API:", errorData);
        // Restituiamo l'errore esatto di Brevo per capire se è colpa degli attributi
        return res.status(400).json({ error: errorData }); 
    }

    return res.status(200).json({ message: 'Iscrizione completata con successo' });

  } catch (error) {
    console.error("Errore server:", error);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}