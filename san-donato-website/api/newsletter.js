export default async function handler(req, res) {
  // --- LOG DI AVVIO ---
  console.log("--- [START] API Newsletter chiamata ---");

  // 1. Gestione CORS (Indispensabile)
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

  // 2. Controllo Metodo
  if (req.method !== 'POST') {
    console.warn(`[ERROR] Metodo non consentito: ${req.method}`);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 3. Controllo API Key
  const API_KEY = process.env.VITE_MAILERLITE_API_KEY;
  if (!API_KEY) {
    console.error("[CRITICAL] MAILERLITE_API_KEY non trovata nelle variabili d'ambiente!");
    return res.status(500).json({ 
      error: "Configurazione Server Errata: Manca la API Key. Controlla le Environment Variables su Vercel." 
    });
  }

  // 4. Controllo Dati in Arrivo (Debug dei campi)
  const { email, first_name, last_name } = req.body;
  
  console.log("[DEBUG] Dati ricevuti dal Frontend:", { 
    email, 
    first_name, 
    last_name 
  });

  if (!email) {
    console.warn("[ERROR] Campo email vuoto");
    return res.status(400).json({ error: 'Email mancante nel body della richiesta' });
  }

  // 5. Preparazione Dati per MailerLite
  const data = {
    email: email,
    fields: {
      name: first_name || "",     // Evita undefined
      last_name: last_name || ""  // Evita undefined
    }
  };

  try {
    console.log("[DEBUG] Tentativo di invio a MailerLite...");
    
    const response = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(data),
    });

    // 6. Gestione Risposta MailerLite
    const responseData = await response.json();

    if (response.status >= 400) {
      console.error("[ERROR] Risposta MailerLite (Errore):", JSON.stringify(responseData, null, 2));
      // Restituiamo l'errore ESATTO al frontend
      return res.status(400).json({ 
        message: "Errore da MailerLite", 
        details: responseData 
      });
    }

    console.log("[SUCCESS] Iscritto con successo:", responseData.data?.id);
    return res.status(200).json({ message: 'Success', id: responseData.data?.id });

  } catch (error) {
    console.error("[CRITICAL] Errore di rete o codice:", error);
    return res.status(500).json({ error: error.message });
  }
}