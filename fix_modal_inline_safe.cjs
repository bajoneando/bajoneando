const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

// 1. Remove the bottom modal
content = content.replace(/\s*\{\/\* ESPERA PANEL MODAL \*\/\}.+?\}\s*\)\}\s*<\/div>\s*<\/div>\s*\);\s*\}/s, '\n      </div>\n    </div>\n  );\n}');

// 2. Inject conditional render into searching-modal-card
const searchTarget = `className="searching-modal-card animate-slide-up" style={{ padding: '24px', maxWidth: '360px', borderRadius: '24px' }}>`;
const searchReplacement = `className="searching-modal-card animate-slide-up" style={{ padding: '24px', maxWidth: '360px', borderRadius: '24px' }}>
              {showEsperaPanel ? (
                <>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px', textAlign: 'center' }}>?</div>
                  <h4 style={{ margin: '0 0 12px 0', color: '#1e293b', textAlign: 'center', fontSize: '1.35rem' }}>Dejar en espera</h4>
                  <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '20px', textAlign: 'center' }}>
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
                </>
              ) : (
                <>`;

content = content.replace(searchTarget, searchReplacement);

// 3. Close the fragment
const closeTarget = `? Cancelar pedido\r\n                </button>\r\n              </div>\r\n            </div>`;
const closeReplacement = `? Cancelar pedido\r\n                </button>\r\n              </div>\r\n              </>\r\n              )}\r\n            </div>`;
const closeTarget2 = `? Cancelar pedido\n                </button>\n              </div>\n            </div>`;
const closeReplacement2 = `? Cancelar pedido\n                </button>\n              </div>\n              </>\n              )}\n            </div>`;

content = content.replace(closeTarget, closeReplacement);
content = content.replace(closeTarget2, closeReplacement2);

fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\PruebasWalletApp.jsx', content);
