// Serverless function (Vercel) — iscrizione alla newsletter MailerLite.
//
// La chiave NON deve mai avere il prefisso VITE_: tutto ciò che inizia con VITE_
// viene inserito in chiaro dentro il bundle del browser da Vite. Questa chiave
// può scrivere sulla lista iscritti, quindi resta solo lato server.

// Domini autorizzati a chiamare questo endpoint da browser.
// In produzione la chiamata è same-origin, quindi il CORS serve solo in locale.
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  ...(process.env.ALLOWED_ORIGIN ? [process.env.ALLOWED_ORIGIN] : [])
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LENGTH = 100;

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  // Fallback sul vecchio nome per non rompere i deploy già configurati.
  // Da rimuovere una volta rinominata la variabile su Vercel.
  const API_KEY = process.env.MAILERLITE_API_KEY || process.env.VITE_MAILERLITE_API_KEY;
  if (!API_KEY) {
    console.error("MAILERLITE_API_KEY non configurata");
    return res.status(500).json({ error: "Configurazione server errata." });
  }

  const { email, first_name, last_name } = req.body ?? {};

  // Validazione lato server: quella nel form è solo comodità per l'utente
  // e chiunque può chiamare questo endpoint senza passare dal browser.
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ error: "Indirizzo email non valido" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = String(first_name ?? "").trim().slice(0, MAX_FIELD_LENGTH);
  const cleanLastName = String(last_name ?? "").trim().slice(0, MAX_FIELD_LENGTH);

  const mailerLiteHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };

  try {
    // Verifica se l'utente esiste già
    const checkResponse = await fetch(
      `https://connect.mailerlite.com/api/subscribers/${encodeURIComponent(cleanEmail)}`,
      { method: 'GET', headers: mailerLiteHeaders }
    );

    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      if (checkData.data?.id) {
        return res.status(409).json({ error: "Questa email è già iscritta." });
      }
    }

    // Iscrizione nuovo utente
    const subscribeResponse = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: mailerLiteHeaders,
      body: JSON.stringify({
        email: cleanEmail,
        fields: {
          name: cleanName,
          last_name: cleanLastName
        }
      }),
    });

    if (!subscribeResponse.ok) {
      console.error("MailerLite ha risposto", subscribeResponse.status);
      return res.status(400).json({ error: "Errore durante l'iscrizione. Riprova." });
    }

    return res.status(200).json({ message: 'Success' });

  } catch (error) {
    console.error("Errore di rete verso MailerLite:", error);
    return res.status(500).json({ error: "Errore di connessione al server." });
  }
}
