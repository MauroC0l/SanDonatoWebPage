export default function SubscriptionPage() {
  return (
    <div className="container mt-4">
      <h3>Portale Subscription</h3>
      <p className="text-muted">Accesso tramite Proxy Sicuro</p>
      
      <div 
        style={{ 
          width: '100%', 
          height: '800px', // Abbastanza alto per vedere tutto il form e il captcha
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
      >
        <iframe 
          // NOTA BENE: Uso il percorso relativo. 
          // Vite intercetterà questa chiamata grazie al proxy configurato prima.
          src="/PSD/" 
          
          title="Portale Subscription"
          width="100%"
          height="100%"
          style={{ border: 'none' }}
          // Manteniamo i permessi per sicurezza
          sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation"
        />
      </div>
    </div>
  );
}