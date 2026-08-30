const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

content = content.replace(
  `setFoundDriver(rep || { nombre: 'Repartidor' });
        setAcceptedOrder(orderData);`,
  `setFoundDriver(rep || { nombre: 'Repartidor' });
        setAcceptedOrder(orderData);
        if (enEsperaExtra && user?.id) {
          api.adminLogCRMEvent(user.id, 'repartidor_encontrado_espera', { order_id: orderData.id });
          setEnEsperaExtra(false);
        }`
);

fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
