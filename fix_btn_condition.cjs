const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

content = content.replace(
  `{cart.paymentMethod === 'mercado_pago' && (() => {`,
  `{!getIsCashOrder() && (() => {`
);

fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
