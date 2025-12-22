export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const API_KEY = process.env.VITE_MAILERLITE_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "Configurazione server errata." });
  }

  const { email, first_name, last_name } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'L\'email è obbligatoria' });
  }

  try {
    // Verifica se l'utente esiste già
    const checkResponse = await fetch(`https://connect.mailerlite.com/api/subscribers/${email}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      }
    });

    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      if (checkData.data?.id) {
        return res.status(409).json({ error: "Questa email è già iscritta." });
      }
    }

    // Iscrizione nuovo utente
    const subscribeResponse = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        email,
        fields: { 
          name: first_name || "", 
          last_name: last_name || "" 
        }
      }),
    });

    if (!subscribeResponse.ok) {
      return res.status(400).json({ error: "Errore durante l'iscrizione. Riprova." });
    }

    return res.status(200).json({ message: 'Success' });

  } catch (error) {
    return res.status(500).json({ error: "Errore di connessione al server." });
  }
}