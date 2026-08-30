const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

content = content.replace(
  `{!getIsCashOrder() && (/* bypass isLocalOpen for testing */ true) && (`,
  `{true && (`
);

fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
