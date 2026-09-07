const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

content = content.replace(
  /if \(prev >= \(enEsperaExtra \? 600 : 5\)\) \{ \/\/ After 1 or 10 mins of UNACCEPTED search/,
  `if (prev >= 60) { // After 1 min of UNACCEPTED search`
);

fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Antigravity\\src\\pages\\PruebasWalletApp.jsx', content);
