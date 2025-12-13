// src/api/calendarApi.js

// Variabili d'ambiente VITE
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY; 
const CALENDAR_ID = import.meta.env.VITE_CALENDAR_ID;

// ====================================================
// MAPPA COLORI GOOGLE CALENDAR (colorId -> Hex)
// ====================================================
const GOOGLE_COLORS = {
    "1": "#7986cb", // Lavender
    "2": "#33b679", // Sage
    "3": "#8e24aa", // Grape
    "4": "#e67c73", // Flamingo
    "5": "#f6c026", // Banana
    "6": "#f5511d", // Tangerine
    "7": "#039be5", // Peacock
    "8": "#616161", // Graphite
    "9": "#3f51b5", // Blueberry
    "10": "#0b8043", // Basil
    "11": "#d60000"  // Tomato
};

const DEFAULT_EVENT_COLOR = "#039be5";

// ====================================================
// HELPERS
// ====================================================

/**
 * Analizza la descrizione per estrarre metadati custom come Categoria e Diretta.
 */
const parseDescription = (description = "", summary = "") => {
    let category = "Altro";
    let diretta = null;

    if (description) {
        // 1. Estrazione Categoria (Es. "Categoria: Serie A")
        const catMatch = description.match(/Categoria:\s*(.*)/i);
        if (catMatch && catMatch[1].trim()) {
            category = catMatch[1].trim();
        }

        // 2. Estrazione Diretta (Es. "Diretta: https://youtube.com/...")
        const liveMatch = description.match(/Diretta:\s*(.*)/i);
        if (liveMatch && liveMatch[1].trim()) {
            diretta = liveMatch[1].trim();
        }
    }

    // Fallback per la categoria se non trovata nella descrizione
    if (category === "Altro" && summary) {
        // Opzionale: logica per dedurre categoria dal titolo se necessario
    }

    return { category, diretta };
};

/**
 * Pulisce la descrizione per la UI.
 * Rimuove le righe "Categoria:..." e "Diretta:..."
 * Rimuove il prefisso "Nota:" lasciando solo il contenuto.
 */
const cleanDescription = (description = "") => {
    if (!description) return "";

    return description
        .split('\n') // Divide in righe
        .filter(line => {
            // Rimuovi righe che iniziano con Categoria o Diretta
            const isMeta = line.match(/^(Categoria|Diretta):/i);
            return !isMeta; 
        })
        .map(line => {
            // Se la riga inizia con "Nota:", rimuovi il prefisso
            return line.replace(/^Nota:\s*/i, '');
        })
        .join('\n') // Riunisci le righe
        .trim(); // Rimuovi spazi extra inizio/fine
};

/**
 * Genera un colore statico per i FILTRI (non per gli eventi).
 */
export const getCategoryColorInfo = (categoryName) => {
    const COLOR_CLASSES = [
        "volley-u18", "basket-maschile", "volley-misto", "calcio-default", 
        "amichevole-base", "torneo-speciale", "generico"
    ];
    
    const normalizedName = categoryName.toLowerCase().replace(/\s/g, '');
    let hash = 0;
    for (let i = 0; i < normalizedName.length; i++) {
        hash = normalizedName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % COLOR_CLASSES.length;
    
    return { cssVar: COLOR_CLASSES[colorIndex] };
};

// ====================================================
// FUNZIONE PRINCIPALE API
// ====================================================

export async function fetchCalendarEvents() {
    if (!GOOGLE_API_KEY || !CALENDAR_ID) {
        throw new Error("Chiavi API o ID Calendario non configurati.");
    }
    
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const timeMin = sixMonthsAgo.toISOString();
    
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const timeMax = nextYear.toISOString();
    
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?key=${GOOGLE_API_KEY}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=200`;

    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Errore API Google: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
        return { events: [], categories: [] };
    }

    const uniqueCategoriesMap = new Map();
    
    const mappedEvents = data.items.map((item, index) => {
        const startDate = new Date(item.start.dateTime || item.start.date);
        const endDate = new Date(item.end.dateTime || item.end.date);
        
        // Parsing Metadati
        const { category, diretta } = parseDescription(item.description, item.summary);
        
        // Pulizia Descrizione per la UI (Rimuove Categoria, Diretta e prefix Nota)
        const displayDescription = cleanDescription(item.description);
        
        // Gestione Colore
        const eventColor = item.colorId && GOOGLE_COLORS[item.colorId] 
            ? GOOGLE_COLORS[item.colorId] 
            : DEFAULT_EVENT_COLOR;

        // Gestione Categorie per i filtri
        if (!uniqueCategoriesMap.has(category)) {
            uniqueCategoriesMap.set(category, {
                id: category,
                ...getCategoryColorInfo(category)
            });
        }

        return {
            id: item.id || index,
            title: item.summary || "Evento senza titolo",
            start: startDate,
            end: endDate,
            location: item.location || "Luogo da definire",
            description: displayDescription, // Qui passiamo la versione pulita
            category: category,
            diretta: diretta,
            color: eventColor,
            cssVar: getCategoryColorInfo(category).cssVar 
        };
    });

    const categoriesArray = Array.from(uniqueCategoriesMap.values());

    return { events: mappedEvents, categories: categoriesArray };
}