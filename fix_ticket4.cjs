const fs = require('fs');
let content = fs.readFileSync('src/pages/RestaurantDashboard.jsx', 'utf8');

content = content.replace(
  /Costo de Servicio: \$\{feeEnvioVal\.toFixed\(2\)\}/g,
  'Costo de Servicio: $${feeEnvioVal.toFixed(2)}'
);

fs.writeFileSync('src/pages/RestaurantDashboard.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\RestaurantDashboard.jsx', content);
