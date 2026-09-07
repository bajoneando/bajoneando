const fs = require('fs');
let content = fs.readFileSync('src/pages/MisPedidos.jsx', 'utf8');

content = content.replace(
  /!\['Entregado', 'Cancelado', 'Rechazado'\]\.includes\(p\.estado\)/g,
  `!['Pendiente', 'Pendiente de Pago', 'Buscando Repartidor', 'Entregado', 'Cancelado', 'Rechazado'].includes(p.estado)`
);

content = content.replace(
  /\{seguimiento\.numConfirmacion && String\(seguimiento\.tipoEntrega\)\.toLowerCase\(\)\.includes\('env'\) &&/g,
  `{seguimiento.numConfirmacion && String(seguimiento.tipoEntrega).toLowerCase().includes('env') && !['Pendiente', 'Pendiente de Pago', 'Buscando Repartidor', 'Entregado', 'Cancelado', 'Rechazado'].includes(seguimiento.estadoGeneral) &&`
);

fs.writeFileSync('src/pages/MisPedidos.jsx', content);
