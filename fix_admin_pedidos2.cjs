const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminPedidos.jsx', 'utf8');

// Find the precise block
let searchStr = `<span>Costo de Envío</span>\n                                                <span>\${Number(pedidoDetalle.precio_envio).toLocaleString('es-AR')}</span>\n                                            </div>`;
// Actually, due to encoding issues with Envío, I'll just use indexOf

let startIdx = content.indexOf('<span>Costo de Env');
if (startIdx !== -1) {
    let endIdx = content.indexOf('</div>', startIdx);
    if (endIdx !== -1) {
        let replacement = content.substring(startIdx, endIdx + 6) + 
            `\n                                        {Number(pedidoDetalle.fee_envio) > 0 && (\n                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: '8px', fontSize: '0.9rem' }}>\n                                                <span>Tarifa de Servicio Wepi</span>\n                                                <span>\${Number(pedidoDetalle.fee_envio).toLocaleString('es-AR')}</span>\n                                            </div>\n                                        )}`;
        
        content = content.substring(0, startIdx) + replacement + content.substring(endIdx + 6);
    }
}

fs.writeFileSync('src/pages/AdminPedidos.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\AdminPedidos.jsx', content);
