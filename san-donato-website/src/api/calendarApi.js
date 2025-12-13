// calendarApi.js

// Variabili d'ambiente VITE
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY; 
const CALENDAR_ID = import.meta.env.VITE_CALENDAR_ID;

// ====================================================
// CONFIGURAZIONE DINAMICA CATEGORIE E COLORI
// ====================================================

// Definisci le classi CSS disponibili per i colori (devono esistere nel tuo CSS)
export const COLOR_CLASSES = [
    "volley-u18", "basket-maschile", "volley-misto", "calcio-default", 
    "amichevole-base", "torneo-speciale", "generico"
];

/**
 * Funzione per generare una categoria e un colore CSS basandosi sulla Descrizione.
 */
export const getDynamicCategory = (description = "", summary = "") => {
    let categoryName = "Altro Sport"; 

    // 1. Cerca la categoria nella Descrizione (Formato: Categoria: Nome Categoria)
    const categoryMatch = description.match(/Categoria:\s*(.*)/i);
    
    if (categoryMatch && categoryMatch[1].trim()) {
        categoryName = categoryMatch[1].trim();
    } else {
        // Fallback
        categoryName = summary || "Evento Senza Categoria"; 
    }

    // Normalizza la categoria per l'hashing (assicura un colore coerente)
    const normalizedName = categoryName.toLowerCase().replace(/\s/g, '');
    
    // Algoritmo di hashing semplice
    let hash = 0;
    for (let i = 0; i < normalizedName.length; i++) {
        hash = normalizedName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % COLOR_CLASSES.length;
    const cssVar = COLOR_CLASSES[colorIndex];

    return { id: categoryName, cssVar: cssVar };
};

// ====================================================
// FUNZIONE PRINCIPALE API
// ====================================================

/**
 * Recupera tutti gli eventi dal calendario Google nel range specificato.
 * @returns {Promise<{events: Array, categories: Array}>} Lista di eventi mappati e categorie uniche.
 */
export async function fetchCalendarEvents() {
    if (!GOOGLE_API_KEY || !CALENDAR_ID) {
        throw new Error("Chiavi API o ID Calendario non configurati.");
    }
    
    // Range temporale esteso (da 6 mesi fa a 1 anno nel futuro)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const timeMin = sixMonthsAgo.toISOString();
    
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const timeMax = nextYear.toISOString();
    
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?key=${GOOGLE_API_KEY}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=200`;

    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Errore nel caricamento del calendario. Status: ${response.status}. Controlla API Key, ID Calendario e permessi.`);
    }

    const data = await response.json();
    
    // Controlla se l'array items è vuoto
    if (!data.items || data.items.length === 0) {
        return { events: [], categories: [] };
    }

    const uniqueCategoriesMap = new Map();
    
    const mappedEvents = data.items.map((item, index) => {
        const startDate = new Date(item.start.dateTime || item.start.date);
        const endDate = new Date(item.end.dateTime || item.end.date);
        
        const categoryObj = getDynamicCategory(item.description || "", item.summary);
            
        // Aggiunge la categoria alla lista unica
        if (!uniqueCategoriesMap.has(categoryObj.id)) {
            uniqueCategoriesMap.set(categoryObj.id, categoryObj);
        }

        return {
            id: item.id || index,
            title: item.summary || "Evento senza titolo",
            start: startDate,
            end: endDate,
            location: item.location || "Luogo da definire",
            category: categoryObj.id, 
            cssVar: categoryObj.cssVar, 
            description: item.description 
        };
    });

    const categoriesArray = Array.from(uniqueCategoriesMap.values());

    return { events: mappedEvents, categories: categoriesArray };
}