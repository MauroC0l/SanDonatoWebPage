export default function SubscriptionPage() {
  const externalUrl = "https://www.uffwebsm.it/PSD/"; // <--- URL completo
  
  return (
    <div className="container mt-4">
      <h3>Portale Subscription</h3>
      <p className="text-muted">Accesso al Portale Esterno</p>
      
      <div 
        style={{ 
          width: '100%', 
          height: '800px', 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
      >
        <iframe 
          src={externalUrl} 
          title="Portale Subscription"
          width="100%"
          height="100%"
          style={{ border: 'none' }}
          // Rimosso il sandbox per il momento per escluderlo come causa.
          // Tuttavia, il vero problema è il Mixed Content.
        />
      </div>
    </div>
  );
}