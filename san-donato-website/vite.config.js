import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"]
  },
  server: {
    // Configurazione del Proxy per aggirare il blocco CORS/Cookie
    proxy: {
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