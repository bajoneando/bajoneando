const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

// Replace all window.location.href = mpRedirectUrl; with window.open(mpRedirectUrl, '_blank');
content = content.replace(/window\.location\.href\s*=\s*mpRedirectUrl;/g, "window.open(mpRedirectUrl, '_blank');");

fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\PruebasWalletApp.jsx', content);
console.log("Success");
