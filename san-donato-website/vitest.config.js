import { defineConfig } from "vitest/config";

/**
 * Configurazione dei test.
 *
 * Ambiente "node" e non "jsdom": qui si provano le regole, non i pixel —
 * chi può fare cosa, quali forme accetta un'API, come si fanno i conti sui
 * soldi. Sono le cose che, se si rompono, si rompono in silenzio; un bottone
 * spostato invece si vede aprendo la pagina.
 *
 * I file dei test stanno in test/ e non accanto al codice: così `vite build`
 * non li incontra nemmeno, e nessuno rischia di spedirli in produzione.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
    // Niente file di setup e nessun mock globale: se un test ha bisogno di
    // un trucco per passare, di solito il problema è il codice.
    globals: false
  }
});
