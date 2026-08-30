const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

content = content.replace(/className="wa-optin-modal-overlay"/g, 'className="wa-optin-modal-overlay" style={{ zIndex: 999999 }}');
content = content.replace(/enEsperaExtra \? 600 : 60/g, 'enEsperaExtra ? 600 : 5');

fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\PruebasWalletApp.jsx', content);
