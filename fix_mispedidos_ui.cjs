const fs = require('fs');
let content = fs.readFileSync('src/pages/MisPedidos.jsx', 'utf8');

// Replace order card rendering
const targetRender = `{p.estado === 'Listo' ? 'Listo para envío' : p.estado}
                      </span>
                    </div>`;

const replacementRender = `{p.estado === 'Listo' ? 'Listo para envío' : p.estado}
                      </span>
                    </div>
                    {p.estado === 'Buscando Repartidor' && p.en_espera_repartidor_10m && p.espera_hasta && (
                      <div style={{ background: '#fefce8', padding: '10px', borderRadius: '8px', border: '1px solid #fef08a', marginTop: '10px', marginBottom: '10px', fontSize: '0.85rem', color: '#854d0e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span><strong>? En espera (10 min)</strong></span>
                        <span>
                          {Math.max(0, Math.floor((new Date(p.espera_hasta).getTime() - Date.now()) / 60000))}:
                          {String(Math.max(0, Math.floor(((new Date(p.espera_hasta).getTime() - Date.now()) % 60000) / 1000))).padStart(2, '0')}
                        </span>
                      </div>
                    )}`;

content = content.replace(targetRender, replacementRender);

fs.writeFileSync('src/pages/MisPedidos.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\MisPedidos.jsx', content);
