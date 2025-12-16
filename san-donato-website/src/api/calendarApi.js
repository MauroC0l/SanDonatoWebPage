// src/api/calendarApi.js

// Variabili d'ambiente VITE
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY; 

// ====================================================
// CONFIGURAZIONE CALENDARI (Multi-Calendar)
// ====================================================
const CALENDARS_CONFIG = [
    // --- GENERALE ---
    {
        id: import.meta.env.VITE_PSD_CALENDAR_ID,
        label: "Eventi PSD",
        cssVar: "eventi-psd",
        color: "#6c5ce7" // Royal Purple
    },
    // --- CALCIO (Palette Verdi, Smeraldo, Arancio-Giallo) ---
    {
        id: import.meta.env.VITE_CALCIO_SECONDA_CATEGORIA_CALENDAR_ID,
        label: "Calcio Seconda Categoria",
        cssVar: "calcio-seconda-categoria",
        color: "#27ae60" // Nephritis Green
    },
    {
        id: import.meta.env.VITE_CALCIO_ALLIEVI_CALENDAR_ID,
        label: "Calcio Allievi",
        cssVar: "calcio-allievi",
        color: "#2ecc71" // Emerald
    },
    {
        id: import.meta.env.VITE_CALCIO_JUNIORES_CALENDAR_ID,
        label: "Calcio Juniores",
        cssVar: "calcio-juniores",
        color: "#16a085" // Green Sea
    },
    {
        id: import.meta.env.VITE_CALCIO_OPEN_CALENDAR_ID,
        label: "Calcio Open",
        cssVar: "calcio-open",
        color: "#1abc9c" // Turquoise
    },
    {
        id: import.meta.env.VITE_CALCIO_RAGAZZI_CALENDAR_ID,
        label: "Calcio Ragazzi",
        cssVar: "calcio-ragazzi",
        color: "#e67e22" // Carrot Orange
    },
    {
        id: import.meta.env.VITE_CALCIO_U12_CALENDAR_ID,
        label: "Calcio U12",
        cssVar: "calcio-u12",
        color: "#f39c12" // Orange
    },
    // --- VOLLEY (Palette Rosa, Viola, Blu, Ciano) ---
    {
        id: import.meta.env.VITE_VOLLEY_ECCELLENZA_B_CALENDAR_ID,
        label: "Volley Eccellenza B",
        cssVar: "volley-eccellenza-b",
        color: "#d63031" // Persian Red
    },
    {
        id: import.meta.env.VITE_VOLLEY_ECCELLENZA_C_CALENDAR_ID,
        label: "Volley Eccellenza C",
        cssVar: "volley-eccellenza-c",
        color: "#e17055" // Burnt Orange
    },
    {
        id: import.meta.env.VITE_VOLLEY_MISTA_CALENDAR_ID,
        label: "Volley Mista",
        cssVar: "volley-mista",
        color: "#fd79a8" // Pico Pink
    },
    {
        id: import.meta.env.VITE_VOLLEY_MISTA_LIGHT_CALENDAR_ID,
        label: "Volley Mista Light",
        cssVar: "volley-mista-light",
        color: "#e84393" // Prunus Avium
    },
    {
        id: import.meta.env.VITE_VOLLEY_U14_CALENDAR_ID,
        label: "Volley U14",
        cssVar: "volley-u14",
        color: "#8e44ad" // Wisteria
    },
    {
        id: import.meta.env.VITE_VOLLEY_U15_CALENDAR_ID,
        label: "Volley U15",
        cssVar: "volley-u15",
        color: "#9b59b6" // Amethyst
    },
    {
        id: import.meta.env.VITE_VOLLEY_U16_CALENDAR_ID,
        label: "Volley U16",
        cssVar: "volley-u16",
        color: "#74b9ff" // Green Darner Blue
    },
    {
        id: import.meta.env.VITE_VOLLEY_U17_CALENDAR_ID,
        label: "Volley U17",
        cssVar: "volley-u17",
        color: "#0984e3" // Electron Blue
    },
    {
        id: import.meta.env.VITE_VOLLEY_U18_CALENDAR_ID,
        label: "Volley U18",
        cssVar: "volley-u18",
        color: "#2980b9" // Belize Hole
    },
    // --- BASKET (Palette Rossi scuri, Marroni) ---
    {
        id: import.meta.env.VITE_BASKET_OPEN_CALENDAR_ID,
        label: "Basket Open",
        cssVar: "basket-open",
        color: "#c0392b" // Old Brick
    },
    {
        id: import.meta.env.VITE_BASKET_U19_CALENDAR_ID,
        label: "Basket U19",
        cssVar: "basket-u19",
        color: "#d35400" // Pumpkin
    }

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