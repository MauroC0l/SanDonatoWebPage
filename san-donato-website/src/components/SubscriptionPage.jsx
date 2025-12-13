export default function SubscriptionPage() {
  const externalUrl = "https://www.uffwebsm.it/PSD/"; // <--- URL completo
  
  return (
    <div className="container mt-4">
      <h3>Portale Subscription</h3>
      <p className="text-muted">Accesso al Portale Esterno</p>
      
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
          // Usa l'URL assoluto completo.
          // In questo modo, funziona sia in sviluppo che in produzione,
          // e non si affida alla configurazione del proxy locale di Vite.
          src={externalUrl} 
          
          title="Portale Subscription"
          width="100%"
          height="100%"
          style={{ border: 'none' }}
          // Il sandbox è generalmente una buona pratica, ma se l'URL non viene visualizzato,
          // prova prima a rimuoverlo o a modificarlo come segue:
          sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation"
        />
      </div>
    </div>
  );
}