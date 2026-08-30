const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

content = content.replace(
  `            if (prev >= (enEsperaExtra ? 600 : 60)) { // After 1 or 10 mins of UNACCEPTED search
              setDriverSearchTimeout(true);
              return 60; 
            }`,
  `            if (prev >= (enEsperaExtra ? 600 : 60)) { // After 1 or 10 mins of UNACCEPTED search
              setDriverSearchTimeout(true);
              return (enEsperaExtra ? 600 : 60); 
            }`
);

fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
