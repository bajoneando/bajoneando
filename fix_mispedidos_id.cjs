const fs = require('fs');
let content = fs.readFileSync('src/pages/MisPedidos.jsx', 'utf8');

content = content.replace(/pedido\.id/g, 'pedido.idPedido');

fs.writeFileSync('src/pages/MisPedidos.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\MisPedidos.jsx', content);
