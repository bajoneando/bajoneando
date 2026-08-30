const fs = require('fs');
let content = fs.readFileSync('src/services/api.js', 'utf8');

content = content.replace(
  `en_espera_repartidor_10m: true,\n        espera_hasta: esperaHasta`,
  `estado: 'Buscando Repartidor',\n        en_espera_repartidor_10m: true,\n        espera_hasta: esperaHasta`
);

fs.writeFileSync('src/services/api.js', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\services\\api.js', content);
