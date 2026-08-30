const fs = require('fs');
let content = fs.readFileSync('src/services/api.js', 'utf8');

content = content.replace(
  `localId: p.local_id,`,
  `localId: p.local_id,\n        en_espera_repartidor_10m: p.en_espera_repartidor_10m,\n        espera_hasta: p.espera_hasta,\n        precio_envio: p.precio_envio,\n        id: p.id,`
);

fs.writeFileSync('src/services/api.js', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\services\\api.js', content);
