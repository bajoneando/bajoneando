const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminPedidos.jsx', 'utf8');

// 1. Fix Total Local calculation
content = content.replace(
  /\$\{Number\(li\.total\)\.toLocaleString\('es-AR'\)\}/g,
  '${Number(localItems.reduce((acc, item) => acc + (Number(item.subtotal) || 0), 0) || li.total).toLocaleString(\'es-AR\')}'
);

// 2. Add Fee de Servicio line if fee_envio > 0
// We look for Costo de Envío
content = content.replace(
  /Costo de Envío<\/span>\s*<span[^>]*>\$\{Number\(pedidoDetalle\.precio_envio\)\.toLocaleString\('es-AR'\)\}<\/span>/g,
  `Costo de Envío</span>\n                                                  <span style={{ fontWeight: 600 }}>\${Number(pedidoDetalle.precio_envio).toLocaleString('es-AR')}</span>\n                                              </div>\n                                              {Number(pedidoDetalle.fee_envio) > 0 && (\n                                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.95rem' }}>\n                                                      <span style={{ color: '#64748b' }}>Tarifa de Servicio</span>\n                                                      <span style={{ fontWeight: 600 }}>\${Number(pedidoDetalle.fee_envio).toLocaleString('es-AR')}</span>\n                                                  </div>\n                                              )}`
);

fs.writeFileSync('src/pages/AdminPedidos.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\AdminPedidos.jsx', content);
