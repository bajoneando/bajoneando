const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

content = content.replace(
  `{true && (`,
  `{!getIsCashOrder() && (() => {
                   let localId = cart.items?.[0]?.local_id;
                   if (!localId) {
                     try {
                       const pd = JSON.parse(localStorage.getItem('pendingOrderDataPruebas') || '{}');
                       localId = pd.localId;
                     } catch(e){}
                   }
                   const loc = locals.find(l => l.id === localId);
                   return loc ? isLocalOpen(loc) : true;
                })() && (`
);

fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\PruebasWalletApp.jsx', content);
