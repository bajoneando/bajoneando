const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

content = content.replace(
  `api.extenderEsperaRepartidor(pendingOrderId, whatsappCheckoutOptIn, user?.telefono);\n                        toast.success('El pedido quedó en espera por 10 minutos ?');\n                        localStorage.removeItem('pendingOrderDataPruebas');\n                        localStorage.removeItem('pendingOrderData');\n                        setPendingOrderId(null);\n                        setSearchingDriver(false);\n                        navigate('/mis-pedidos');`,
  `api.extenderEsperaRepartidor(pendingOrderId, whatsappCheckoutOptIn, user?.telefono).then(() => {\n                          toast.success('El pedido quedó en espera por 10 minutos ?');\n                          localStorage.removeItem('pendingOrderDataPruebas');\n                          localStorage.removeItem('pendingOrderData');\n                          setPendingOrderId(null);\n                          setSearchingDriver(false);\n                          navigate('/mis-pedidos');\n                        });`
);

fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\PruebasWalletApp.jsx', content);
