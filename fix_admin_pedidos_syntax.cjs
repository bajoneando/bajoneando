const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminPedidos.jsx', 'utf8');

// The buggy part:
// </div>
//                                         {Number(pedidoDetalle.fee_envio) > 0 && (

content = content.replace(
  /<\/div>\s*\{Number\(pedidoDetalle\.fee_envio\)/g,
  '</div>\n                                          )}\n                                          {Number(pedidoDetalle.fee_envio)'
);

// We must also remove the extra `)}` at the end
content = content.replace(
  /\)\}\s*\)\}\s*<div style=\{\{ display: 'flex', justifyContent: 'space-between', fontSize: '1\.25rem'/g,
  ')}\n                                          <div style={{ display: \'flex\', justifyContent: \'space-between\', fontSize: \'1.25rem\''
);

fs.writeFileSync('src/pages/AdminPedidos.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\AdminPedidos.jsx', content);
