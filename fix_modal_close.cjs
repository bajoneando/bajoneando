const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

content = content.replace(/Cancelar pedido\s*<\/button>\s*<\/div>\s*<\/div>/, 'Cancelar pedido\n                </button>\n              </div>\n              </>\n              )}\n            </div>');

fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\PruebasWalletApp.jsx', content);
