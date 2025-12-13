// src/api/calendarApi.js

// Variabili d'ambiente VITE
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY; 

// ====================================================
// CONFIGURAZIONE CALENDARI (Multi-Calendar)
// ====================================================
// Qui definisci i calendari da cui scaricare gli eventi.
// Ogni oggetto rappresenta una Categoria.
const CALENDARS_CONFIG = [
    {
        id: import.meta.env.VITE_PSD_CALENDAR_ID,
        label: "Eventi PSD",
        cssVar: "evnenti-psd",
        color: "#ff9900"
    },
    {
        id: import.meta.env.VITE_VOLLEY_U18F_CALENDAR_ID, 
        label: "Volley U18F",
        cssVar: "volley-u18f",     // Deve corrispondere a una variabile nel CSS
        color: "#0077b6"          // Colore di fallback (es. per le pillole)
    },
    {
        id: import.meta.env.VITE_BASKET_U18_CALENDAR_ID,
        label: "Basket U18",
        cssVar: "basket-u18",
        color: "#95eb15ff"
    },
    {
        id: import.meta.env.VITE_VOLLEY_MISTO_CALENDAR_ID,
        label: "Volley Misto",
        cssVar: "volley-misto",
        color: "#00b894"
    },
    // Aggiungi qui altri calendari se necessario (es. Calcio, Under 14, ecc.)
];

// ====================================================
// HELPERS
// ====================================================

/**
 * Pulisce la descrizione per la UI.
 * - Rimuove le righe che contengono il link della "Diretta".
 * - Rimuove il prefisso "Nota:" lasciando solo il testo.
 * NON cerca più la "Categoria" nel testo, perché è definita dal calendario di origine.
 */
const cleanDescription = (description = "") => {
    if (!description) return "";

    return description
        .split('\n')
        .filter(line => !line.match(/^Diretta:/i)) // Rimuove la riga della diretta
        .map(line => line.replace(/^Nota:\s*/i, '')) // Pulisce il prefisso Nota
        .join('\n')
        .trim();
};

/**
 * Estrae solo il link della diretta se presente nella descrizione.
 */
const parseDirectLink = (description = "") => {
    const match = description && description.match(/Diretta:\s*(.*)/i);
    
    if (!match || !match[1].trim()) return null;

    let url = match[1].trim();

    // CONTROLLO: Se l'URL non inizia con http:// o https://, lo aggiungiamo
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }

    return url;
};
// ====================================================
// FUNZIONE PRINCIPALE API
// ====================================================

export async function fetchCalendarEvents() {
    if (!GOOGLE_API_KEY) {
        throw new Error("Chiave API Google mancante (.env).");
    }
    
    // Impostiamo il range temporale (-6 mesi, +1 anno)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const timeMin = sixMonthsAgo.toISOString();
    
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const timeMax = nextYear.toISOString();
    
    // 1. Creiamo un array di Promesse (una fetch per ogni calendario configurato)
    const fetchPromises = CALENDARS_CONFIG.map(async (config) => {
        // Se l'ID non è configurato (è ancora il placeholder), saltiamo
        if (config.id.includes("INSERISCI_QUI")) return [];

        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.id)}/events?key=${GOOGLE_API_KEY}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=100`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`Errore fetch calendario "${config.label}": ${response.status}`);
                return []; // Ritorniamo array vuoto per non rompere l'intera pagina
            }
            const data = await response.json();
            
            // Trasformiamo gli eventi assegnando la categoria di QUESTO calendario
            return (data.items || []).map(item => transformEvent(item, config));

        } catch (error) {
            console.error(`Errore di rete calendario "${config.label}":`, error);
            return [];
        }
    });

    // 2. Eseguiamo tutte le richieste in parallelo
    const results = await Promise.all(fetchPromises);

    // 3. Uniamo tutti gli array di risultati in un unico array (flat)
    const allEvents = results.flat();

    // 4. Ordiniamo tutti gli eventi per data (poiché unendo liste diverse si perde l'ordine cronologico globale)
    allEvents.sort((a, b) => a.start - b.start);

    // 5. Prepariamo l'elenco delle categorie per i filtri basandoci sulla config
    const categories = CALENDARS_CONFIG.map(c => ({
        id: c.label,
        cssVar: c.cssVar,
        color: c.color
    }));

    return { events: allEvents, categories: categories };
}

/**
 * Trasforma l'evento Google grezzo nel formato interno.
 * La Categoria viene iniettata dalla config, non letta dal testo.
 */
function transformEvent(item, config) {
    // Controllo se esiste un orario preciso (dateTime) o se è solo data (date)
    const hasTime = !!item.start.dateTime;

    const startDate = new Date(item.start.dateTime || item.start.date);
    const endDate = new Date(item.end.dateTime || item.end.date);
    
    const displayDescription = cleanDescription(item.description);
    const direttaLink = parseDirectLink(item.description);

    return {
        id: item.id,
        title: item.summary || "Evento senza titolo",
        start: startDate,
        end: endDate,
        
        // MODIFICA QUI: Non mettere il testo di default, lascia vuoto se manca
        location: item.location || "", 
        
        description: displayDescription, 
        
        category: config.label,
        color: config.color,
        cssVar: config.cssVar,
        
        diretta: direttaLink,
        
        // MODIFICA QUI: Aggiungiamo il flag per sapere se mostrare l'orario
        hasTime: hasTime 
    };
}