// Componente SubscriptionPage.js
import "../css/SubscriptionPage.css";

export default function SubscriptionPage() {
  // L'iframe punterà ora alla tua API Route locale (che è HTTPS)
  const url = "https://www.uffwebsm.it/PSD/"; 
  
  return (
    <div className="container mt-4">
      <h3>Portale Subscription</h3>
      <p className="text-muted">Accesso al Portale Esterno</p>
      
      <div className="iframe-wrapper"> {/* Aggiunto un wrapper per il CSS responsive */}
        <iframe 
          src={url} 
          title="Portale Subscription"
          // Rimosso width e height per il CSS
          style={{ border: 'none' }}
          // Il sandbox non è necessario se usi il proxy, ma non fa male
          sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation"
        />
      </div>
    </div>
  );
}