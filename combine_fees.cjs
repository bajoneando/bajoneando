const fs = require('fs');
let content = fs.readFileSync('src/pages/RestaurantDashboard.jsx', 'utf8');

// The lines we want to target:
// <div>Envío Wepi: $${costoEnvioVal.toFixed(2)}</div>
// ${feeEnvioVal > 0 ? `<div>Costo de Servicio: $${feeEnvioVal.toFixed(2)}</div>` : ""}

content = content.replace(
  /<div>Envío Wepi: \$\$\{costoEnvioVal\.toFixed\(2\)\}<\/div>\n\s*\$\{feeEnvioVal > 0 \? `<div>Costo de Servicio: \$\$\{feeEnvioVal\.toFixed\(2\)\}<\/div>` : ""\}/g,
  '<div>Envío Wepi: $${(costoEnvioVal + feeEnvioVal).toFixed(2)}</div>'
);

// For the thermal ticket
content = content.replace(
  /Envío Wepi: \$\$\{envioVal\.toFixed\(2\)\}\n\s*<\/div>\n\s*\$\{feeEnvioVal > 0 \? `<div style="text-align: right; font-size: 13px;">Costo de Servicio: \$\$\{feeEnvioVal\.toFixed\(2\)\}<\/div>` : ""\}/g,
  'Envío Wepi: $${(envioVal + feeEnvioVal).toFixed(2)}\n          </div>'
);

fs.writeFileSync('src/pages/RestaurantDashboard.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\RestaurantDashboard.jsx', content);
