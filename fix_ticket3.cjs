const fs = require('fs');
let content = fs.readFileSync('src/pages/RestaurantDashboard.jsx', 'utf8');

// The original lines look like this:
// <div>Envío Wepi: $${costoEnvioVal.toFixed(2)}</div>
// Envío Wepi: $${envioVal.toFixed(2)}

content = content.replace(
  /(<div[^>]*>.*?)\$\$\{costoEnvioVal\.toFixed\(2\)\}(<\/div>)/g,
  '$1$$${costoEnvioVal.toFixed(2)}$2\n          ${feeEnvioVal > 0 ? `<div>Costo de Servicio: $${feeEnvioVal.toFixed(2)}</div>` : ""}'
);

content = content.replace(
  /([^\n]*?)\$\$\{envioVal\.toFixed\(2\)\}([^\n]*?\n\s*<\/div>)/g,
  '$1$$${envioVal.toFixed(2)}$2\n          ${feeEnvioVal > 0 ? `<div style="text-align: right; font-size: 13px;">Costo de Servicio: $${feeEnvioVal.toFixed(2)}</div>` : ""}'
);

fs.writeFileSync('src/pages/RestaurantDashboard.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\RestaurantDashboard.jsx', content);
