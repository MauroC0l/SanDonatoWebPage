// src/api/calendarApi.js

// Variabili d'ambiente VITE
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY; 

// ====================================================
// CONFIGURAZIONE CALENDARI (Multi-Calendar)
// ====================================================
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
        cssVar: "volley-u18f",
        color: "#0077b6"
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
    // Aggiungi qui altri calendari...
];

// ====================================================
// HELPERS
// ====================================================

const cleanDescription = (description = "") => {
    if (!description) return "";
    return description
        .split('\n')
        .filter(line => !line.match(/^Diretta:/i))
        .map(line => line.replace(/^Nota:\s*/i, ''))
        .join('\n')
        .trim();
};

const parseDirectLink = (description = "") => {
    const match = description && description.match(/Diretta:\s*(.*)/i);
    if (!match || !match[1].trim()) return null;
    let url = match[1].trim();
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    return url;
};

/**
 * Trasforma l'evento Google grezzo nel formato interno.
 */
function transformEvent(item, config) {
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
        location: item.location || "", 
        description: displayDescription, 
        category: config.label,
        color: config.color,
        cssVar: config.cssVar,
        diretta: direttaLink,
        hasTime: hasTime 
    };
}

// ====================================================
// LOGICA CORE (Privata)
// ====================================================

/**
 * Funzione interna riutilizzabile che esegue la fetch
 * in base a un intervallo di date specifico.
 */
async function fetchEventsInternal(timeMin, timeMax) {
    if (!GOOGLE_API_KEY) {
        throw new Error("Chiave API Google mancante (.env).");
    }

    const fetchPromises = CALENDARS_CONFIG.map(async (config) => {
        if (!config.id || config.id.includes("INSERISCI_QUI")) return [];

        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.id)}/events?key=${GOOGLE_API_KEY}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=100`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`Errore fetch calendario "${config.label}": ${response.status}`);
                return [];
            }
            const data = await response.json();
            return (data.items || []).map(item => transformEvent(item, config));
        } catch (error) {
            console.error(`Errore di rete calendario "${config.label}":`, error);
            return [];
        }
    });

    const results = await Promise.all(fetchPromises);
    const allEvents = results.flat();
    allEvents.sort((a, b) => a.start - b.start);

    const categories = CALENDARS_CONFIG.map(c => ({
        id: c.label,
        cssVar: c.cssVar,
        color: c.color
    }));

    return { events: allEvents, categories: categories };
}

// ====================================================
// FUNZIONI EXPORTATE (API Pubbliche)
// ====================================================

/**
 * 1. Default: Range ampio (-6 mesi, +1 anno)
 * Usata per la pagina principale del calendario.
 */
export async function fetchCalendarEvents() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    
    return fetchEventsInternal(sixMonthsAgo.toISOString(), nextYear.toISOString());
}

/**
 * 2. Eventi di OGGI
 * Recupera eventi dalle 00:00 alle 23:59 di oggi.
 */
export async function fetchTodayEvents() {
    const start = new Date();
    start.setHours(0, 0, 0, 0); // Inizio giornata

    const end = new Date();
    end.setHours(23, 59, 59, 999); // Fine giornata

    return fetchEventsInternal(start.toISOString(), end.toISOString());
}

/**
 * 3. Eventi della SETTIMANA CORRENTE
 * Recupera eventi da Lunedì a Domenica della settimana corrente.
 */
export async function fetchWeekEvents() {
    const curr = new Date(); // Oggi
    
    // Calcola il primo giorno della settimana (Lunedì)
    // Se oggi è domenica (0), sottrai 6 giorni, altrimenti sottrai (day - 1)
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); 
    
    const monday = new Date(curr.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6); // Aggiungi 6 giorni per arrivare a domenica
    sunday.setHours(23, 59, 59, 999);

    return fetchEventsInternal(monday.toISOString(), sunday.toISOString());
}