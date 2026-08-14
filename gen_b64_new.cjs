const fs = require('fs');
const p12 = fs.readFileSync('ios_distribution_new.p12');
fs.writeFileSync('cert_base64_new.txt', p12.toString('base64'));
console.log('done');
