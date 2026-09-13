import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"]
  },
  server: {
    proxy: {
      // Le API in locale girano su dev-server.mjs (porta 3001), perché le
      // funzioni di Vercel non esistono sotto `vite dev`. Passando dal proxy
      // il browser le vede sulla stessa origine del sito, esattamente come
      // in produzione: senza questo, il cookie di sessione SameSite=Strict
      // non verrebbe mai inviato.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: false
      },
      // Configurazione del Proxy per aggirare il blocco CORS/Cookie
      '/PSD': {
        target: 'https://www.uffwebsm.it',
        changeOrigin: true, // Fondamentale: cambia l'origine dell'header Host
        secure: false,      // Accetta anche certificati HTTPS non perfetti
        // Opzionale: riscrive i cookie per farli sembrare locali se necessario
        cookieDomainRewrite: "localhost"
      }
    }
  }
});
