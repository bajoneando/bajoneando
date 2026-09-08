const fs = require('fs');
let content = fs.readFileSync('src/services/api.js', 'utf8');

content = content.replace(
  /precioEnvio: Number\(gen\.precio_envio \|\| gen\.costo_envio \|\| gen\.envio \|\| gen\.costo_delivery\) \|\| 0,/g,
  'precioEnvio: Number(gen.precio_envio || gen.costo_envio || gen.envio || gen.costo_delivery) || 0,\n        fee_envio: Number(gen.fee_envio) || 0,'
);

fs.writeFileSync('src/services/api.js', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\services\\api.js', content);
