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
        color: "#6c5ce7"
    },
    // --- CALCIO ---
    {
        id: import.meta.env.VITE_CALCIO_SECONDA_CATEGORIA_CALENDAR_ID,
        label: "Calcio Seconda Categoria",
        cssVar: "calcio-seconda-categoria",
        color: "#27ae60"
    },
    {
        id: import.meta.env.VITE_CALCIO_ALLIEVI_CALENDAR_ID,
        label: "Calcio Allievi",
        cssVar: "calcio-allievi",
        color: "#2ecc71"
    },
    {
        id: import.meta.env.VITE_CALCIO_JUNIORES_CALENDAR_ID,
        label: "Calcio Juniores",
        cssVar: "calcio-juniores",
        color: "#16a085"
    },
    {
        id: import.meta.env.VITE_CALCIO_OPEN_CALENDAR_ID,
        label: "Calcio Open",
        cssVar: "calcio-open",
        color: "#1abc9c"
    },
    {
        id: import.meta.env.VITE_CALCIO_RAGAZZI_CALENDAR_ID,
        label: "Calcio Ragazzi",
        cssVar: "calcio-ragazzi",
        color: "#e67e22"
    },
    {
        id: import.meta.env.VITE_CALCIO_U12_CALENDAR_ID,
        label: "Calcio U12",
        cssVar: "calcio-u12",
        color: "#f39c12"
    },
    // --- VOLLEY ---
    {
        id: import.meta.env.VITE_VOLLEY_ECCELLENZA_B_CALENDAR_ID,
        label: "Volley Eccellenza B",
        cssVar: "volley-eccellenza-b",
        color: "#d63031"
    },
    {
        id: import.meta.env.VITE_VOLLEY_ECCELLENZA_C_CALENDAR_ID,
        label: "Volley Eccellenza C",
        cssVar: "volley-eccellenza-c",
        color: "#e17055"
    },
    {
        id: import.meta.env.VITE_VOLLEY_MISTA_CALENDAR_ID,
        label: "Volley Mista",
        cssVar: "volley-mista",
        color: "#fd79a8"
    },
    {
        id: import.meta.env.VITE_VOLLEY_MISTA_LIGHT_CALENDAR_ID,
        label: "Volley Mista Light",
        cssVar: "volley-mista-light",
        color: "#e84393"
    },
    {
        id: import.meta.env.VITE_VOLLEY_U14_CALENDAR_ID,
        label: "Volley U14",
        cssVar: "volley-u14",
        color: "#8e44ad"
    },
    {
        id: import.meta.env.VITE_VOLLEY_U15_CALENDAR_ID,
        label: "Volley U15",
        cssVar: "volley-u15",
        color: "#9b59b6"
    },
    {
        id: import.meta.env.VITE_VOLLEY_U16_CALENDAR_ID,
        label: "Volley U16",
        cssVar: "volley-u16",
        color: "#74b9ff"
    },
    {
        id: import.meta.env.VITE_VOLLEY_U17_CALENDAR_ID,
        label: "Volley U17",
        cssVar: "volley-u17",
        color: "#0984e3"
    },
    {
        id: import.meta.env.VITE_VOLLEY_U18_CALENDAR_ID,
        label: "Volley U18",
        cssVar: "volley-u18",
        color: "#2980b9"
    },
    // --- BASKET ---
    {
        id: import.meta.env.VITE_BASKET_OPEN_CALENDAR_ID,
        label: "Basket Open",
        cssVar: "basket-open",
        color: "#c0392b"
    },
    {
        id: import.meta.env.VITE_BASKET_U19_CALENDAR_ID,
        label: "Basket U19",
        cssVar: "basket-u19",
        color: "#d35400"
    }
];

// ====================================================
// HELPERS DI PARSING
// ====================================================

const stripHtml = (html) => {
    if (!html) return "";
    let text = html.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n');
    text = text.replace(/<[^>]+>/g, '');
    const txt = document.createElement("textarea");
    txt.innerHTML = text;
    return txt.value;
};

/**
 * Estrae i metadati sportivi (Risultato, Marcatori, Parziali)
 * dalla descrizione testuale.
 */
const parseEventDetails = (description = "") => {
    const cleanDesc = stripHtml(description);
    const lines = cleanDesc.split('\n');
    
    let result = null;
    let scorers = [];
    let partials = null;
    let directLink = null;
    let displayLines = [];

    lines.forEach(line => {
        const trimmed = line.trim();
        const lower = trimmed.toLowerCase();
        
        if (lower.startsWith('partita:') || lower.startsWith('risultato:')) {
            // Es: "Partita: 3 - 1" -> "3 - 1"
            result = trimmed.substring(trimmed.indexOf(':') + 1).trim(); 
        } 
        else if (lower.startsWith('marcatori:')) {
            const raw = trimmed.substring(10).trim();
            if (raw) scorers = raw.split(',').map(s => s.trim()).filter(Boolean);
        }
        else if (lower.startsWith('parziali:')) {
            partials = trimmed.substring(9).trim(); 
        }
        else if (lower.startsWith('diretta:') || lower.startsWith('streaming:')) {
            const linkPart = trimmed.substring(trimmed.indexOf(':') + 1).trim();
            if (linkPart) {
                directLink = /^https?:\/\//i.test(linkPart) ? linkPart : 'https://' + linkPart;
            }
        }
        else if (trimmed !== "") {
            displayLines.push(trimmed);
        }
    });

    return {
        displayDescription: displayLines.join('\n').trim(),
        result,
        scorers,
        partials,
        directLink
    };
};

/**
 * Trasforma l'evento Google grezzo nel formato interno.
 */
function transformEvent(item, config) {
    const hasTime = !!item.start.dateTime;
    const startDate = new Date(item.start.dateTime || item.start.date);
    const endDate = new Date(item.end.dateTime || item.end.date);
    
    // Parsing avanzato descrizione
    const details = parseEventDetails(item.description);

    return {
        id: item.id,
        title: item.summary || "Evento senza titolo",
        start: startDate,
        end: endDate,
        location: item.location || "", 
        description: details.displayDescription, // Descrizione pulita
        
        // Metadati Parsati
        result: details.result,
        scorers: details.scorers,
        partials: details.partials,
        diretta: details.directLink,

        category: config.label,
        color: config.color,
        cssVar: config.cssVar,
        hasTime: hasTime 
    };
}

// ====================================================
// LOGICA CORE (Privata)
// ====================================================

async function fetchEventsInternal(timeMin, timeMax) {
    if (!GOOGLE_API_KEY) throw new Error("Chiave API Google mancante (.env).");

    const fetchPromises = CALENDARS_CONFIG.map(async (config) => {
        if (!config.id || config.id.includes("INSERISCI_QUI")) return [];
        
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.id)}/events?key=${GOOGLE_API_KEY}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=100`;

        try {
            const response = await fetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            return (data.items || []).map(item => transformEvent(item, config));
        } catch (error) {
            console.error(`Errore fetch ${config.label}:`, error);
            return [];
        }
    });

    const results = await Promise.all(fetchPromises);
    const allEvents = results.flat();
    
    // Ordinamento cronologico
    allEvents.sort((a, b) => a.start - b.start);

    // --- CORREZIONE: Generiamo l'array delle categorie per i filtri ---
    // Il componente si aspetta che 'id' sia uguale alla 'label' dell'evento (es. "Calcio Open")
    const categories = CALENDARS_CONFIG
        .filter(c => c.id && !c.id.includes("INSERISCI_QUI"))
        .map(c => ({
            id: c.label,   // Fondamentale: deve corrispondere a ev.category
            label: c.label,
            color: c.color
        }));

    // Restituiamo sia gli eventi che le categorie
    return { events: allEvents, categories }; 
}

// ====================================================
// API PUBBLICHE
// ====================================================

/** 1. Range ampio (-6 mesi, +1 anno) */
export async function fetchCalendarEvents() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    return fetchEventsInternal(sixMonthsAgo.toISOString(), nextYear.toISOString());
}

/** 2. Eventi di OGGI */
export async function fetchTodayEvents() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return fetchEventsInternal(start.toISOString(), end.toISOString());
}

/** 3. Eventi della SETTIMANA CORRENTE (Futuri per la Home) */
export async function fetchWeekEvents() {
    // Da "Adesso" fino a Domenica sera
    const now = new Date(); 
    const currentDay = now.getDay(); 
    const daysUntilSunday = currentDay === 0 ? 0 : 7 - currentDay;
    const sunday = new Date(now);
    sunday.setDate(now.getDate() + daysUntilSunday);
    sunday.setHours(23, 59, 59, 999);

    return fetchEventsInternal(now.toISOString(), sunday.toISOString());
}

/** * 4. NUOVA: Risultati della SETTIMANA CORRENTE (Lunedì - Domenica)
 * Carica gli eventi della settimana corrente che hanno un risultato.
 */
export async function fetchPastResults() {
    const now = new Date();
    
    // Calcolo del Lunedì della settimana corrente
    // getDay(): 0 = Domenica, 1 = Lunedì, ..., 6 = Sabato
    const currentDay = now.getDay();
    // Se è domenica (0), dobbiamo tornare indietro di 6 giorni per arrivare a lunedì.
    // Altrimenti torniamo indietro di (currentDay - 1) giorni.
    const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
    
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);

    // Calcolo della Domenica della settimana corrente
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    // Eseguiamo la fetch su tutto il range Lunedì-Domenica
    const data = await fetchEventsInternal(monday.toISOString(), sunday.toISOString());
    
    // Filtriamo solo eventi che hanno un risultato parsato
    // (Opcionale: se vuoi mostrare TUTTI gli eventi passati della settimana anche senza risultato, rimuovi il filtro)
    const resultsEvents = data.events
        .filter(ev => ev.result || ev.partials) 
        .sort((a, b) => b.start - a.start); // I più recenti in alto

    return { events: resultsEvents };
}