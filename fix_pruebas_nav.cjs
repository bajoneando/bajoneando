const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

content = content.replace(
  `setEnEsperaExtra(true);\n                        setSearchSeconds(0);\n                        api.extenderEsperaRepartidor(pendingOrderId, whatsappCheckoutOptIn, user?.telefono);\n                        toast.success('El pedido quedó en espera por 10 minutos ?');`,
  `api.extenderEsperaRepartidor(pendingOrderId, whatsappCheckoutOptIn, user?.telefono);\n                        toast.success('El pedido quedó en espera por 10 minutos ?');\n                        localStorage.removeItem('pendingOrderDataPruebas');\n                        localStorage.removeItem('pendingOrderData');\n                        setPendingOrderId(null);\n                        setSearchingDriver(false);\n                        navigate('/mis-pedidos');`
);

fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\PruebasWalletApp.jsx', content);
