const fs = require('fs');
let content = fs.readFileSync('src/pages/RestaurantDashboard.jsx', 'utf8');

// Replace using literal strings
content = content.replace('<div>Envo Wepi: $${costoEnvioVal.toFixed(2)}</div>\n            ${feeEnvioVal > 0 ? `<div>Costo de Servicio: ${feeEnvioVal.toFixed(2)}</div>` : ""}', '<div>Envío Wepi: $${(costoEnvioVal + feeEnvioVal).toFixed(2)}</div>');

content = content.replace('Envo Wepi: $${envioVal.toFixed(2)}\n          </div>\n            ${feeEnvioVal > 0 ? `<div style="text-align: right; font-size: 13px;">Costo de Servicio: ${feeEnvioVal.toFixed(2)}</div>` : ""}', 'Envío Wepi: $${(envioVal + feeEnvioVal).toFixed(2)}\n          </div>');

fs.writeFileSync('src/pages/RestaurantDashboard.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\RestaurantDashboard.jsx', content);
