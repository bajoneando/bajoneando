const fs = require('fs');
let content = fs.readFileSync('src/pages/RestaurantDashboard.jsx', 'utf8');

// The lines we want to target:
// const envioVal = isEnvio ? (o.precioEnvio || 0) : 0;
// We should add fee_envio to it, or display it separately.
// For the thermal ticket (there are 2 HTML templates, one for local, one for Wepi maybe?)

content = content.replace(
  /const costoEnvioVal = Number\(o\.precioEnvio \|\| o\.costoEnvio \|\| 0\);/g,
  'const costoEnvioVal = Number(o.precioEnvio || o.costoEnvio || 0);\n    const feeEnvioVal = Number(o.fee_envio || 0);'
);

content = content.replace(
  /const finalTotalVal = subtotalVal \+ \(isEnvio \? costoEnvioVal : 0\);/g,
  'const finalTotalVal = subtotalVal + (isEnvio ? costoEnvioVal : 0) + feeEnvioVal;'
);

// Add fee to the ticket HTML if > 0
content = content.replace(
  /<div>Envo Wepi: \$\$\{costoEnvioVal.toFixed\(2\)\}<\/div>/g,
  '<div>Envío Wepi: $${costoEnvioVal.toFixed(2)}</div>\n          ${feeEnvioVal > 0 ? `<div>Costo de Servicio: $${feeEnvioVal.toFixed(2)}</div>` : ""}'
);

// Now for the second ticket (the print ticket inside RestaurantDashboard for native?)
content = content.replace(
  /const envioVal = isEnvio \? \(o\.precioEnvio \|\| 0\) : 0;/g,
  'const envioVal = isEnvio ? (o.precioEnvio || 0) : 0;\n      const feeEnvioVal = Number(o.fee_envio || 0);'
);

content = content.replace(
  /const grandTotal = \(o\.totalLocal && o\.totalLocal > subtotalVal\) \? o\.totalLocal : \(subtotalVal \+ envioVal\);/g,
  'const grandTotal = (o.totalLocal && o.totalLocal > subtotalVal && (o.totalLocal === subtotalVal + envioVal + feeEnvioVal)) ? o.totalLocal : (subtotalVal + envioVal + feeEnvioVal);'
);

content = content.replace(
  /Envo Wepi: \$\$\{envioVal.toFixed\(2\)\}/g,
  'Envío Wepi: $${envioVal.toFixed(2)}\n          </div>\n          ${feeEnvioVal > 0 ? `<div style="text-align: right; font-size: 13px;">Costo de Servicio: $${feeEnvioVal.toFixed(2)}</div>` : ""}'
);


fs.writeFileSync('src/pages/RestaurantDashboard.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\RestaurantDashboard.jsx', content);
