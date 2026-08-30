const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

const modal = `      {/* ESPERA PANEL MODAL */}
      {showEsperaPanel && (
        <div className="wa-optin-modal-overlay">
          <div className="wa-optin-modal-content animate-slide-up" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>?</div>
            <h4 style={{ margin: '0 0 12px 0', color: '#1e293b' }}>Dejar en espera</h4>
            <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '20px' }}>
              Durante 10 minutos seguiremos buscando un repartidor para tu pedido.
            </p>
            
            <div style={{ margin: '12px 0 20px 0', display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#f0fdf4', padding: '12px', borderRadius: '12px', border: '1px solid #bbf7d0', textAlign: 'left' }}>
              <input 
                type="checkbox" 
                id="wa-optin-espera"
                checked={whatsappCheckoutOptIn}
                onChange={e => setWhatsappCheckoutOptIn(e.target.checked)}
                style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#25D366' }}
              />
              <label htmlFor="wa-optin-espera" style={{ fontSize: '0.85rem', color: '#166534', lineHeight: '1.4', cursor: 'pointer', margin: 0, marginTop: '2px', fontWeight: '500' }}>
                Aceptalo para recibir un aviso cuando encontramos al repartidor.
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn btn-full"
                style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '12px' }}
                onClick={() => setShowEsperaPanel(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-full"
                style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '12px' }}
                onClick={() => {
                  setShowEsperaPanel(false);
                  setDriverSearchTimeout(false);
                  setEnEsperaExtra(true);
                  setSearchSeconds(0);
                  api.extenderEsperaRepartidor(pendingOrderId, whatsappCheckoutOptIn, user?.telefono);
                  toast.success('El pedido quedó en espera por 10 minutos ?');
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
`;

if (!content.includes('ESPERA PANEL MODAL')) {
  // replace at the very end
  content = content.replace(/(?:\s*<\/div>\s*<\/div>\s*\);\s*}\s*)$/, '\n' + modal + '\n      </div>\n    </div>\n  );\n}');
  fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
  fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\PruebasWalletApp.jsx', content);
}
