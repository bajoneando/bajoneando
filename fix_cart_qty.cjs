const fs = require('fs');
let content = fs.readFileSync('src/services/api.js', 'utf8');

// Inside crearPedido, modify the p_cart property
content = content.replace(
  /p_cart: items,/,
  `p_cart: items.map(i => ({ ...i, qty: i.qty !== undefined ? i.qty : i.cantidad })),`
);

fs.writeFileSync('src/services/api.js', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\services\\api.js', content);
