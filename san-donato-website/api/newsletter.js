// File: /api/newsletter.js

export default async function handler(req, res) {
  // 1. Impostazioni per permettere al browser di leggere la risposta
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST');
  
  // 2. Leggiamo la chiave API
  // NOTA: Assicurati che su Vercel la variabile si chiami esattamente così
  const apiKey = process.env.VITE_BREVO_API_KEY;

  // 3. Chiediamo a Brevo di dirci i suoi attributi
  try {
    const response = await fetch('https://api.brevo.com/v3/contacts/attributes', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey, // Usiamo la chiave letta sopra
      },
    });

    const data = await response.json();

    // 4. Stampiamo il risultato a video (JSON)
    return res.status(200).json({
      DEBUG_DIAGNOSTICA: {
        chiave_api_presente: apiKey ? "SI" : "NO (Verifica le Env Variables su Vercel)",
        status_risposta_brevo: response.status,
        messaggio_errore_brevo: response.ok ? "Nessun errore" : data,
        LISTA_ATTRIBUTI_BREVO: data.attributes // <--- QUI LEGGEREMO I NOMI CORRETTI
      }
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}