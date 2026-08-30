const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

content = content.replace(
  /export default function PruebasWalletApp\(\) \{/,
  `export default function PruebasWalletApp() {\n  const [otaVersion, setOtaVersion] = React.useState('v1.1.1');`
);

fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\PruebasWalletApp.jsx', content);
