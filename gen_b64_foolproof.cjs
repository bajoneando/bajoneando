const fs = require('fs');

try {
  const p12 = fs.readFileSync('ios_distribution.p12');
  fs.writeFileSync('cert_base64.txt', p12.toString('base64'));
  
  const prov = fs.readFileSync('Wepi_AppStore_Profile.mobileprovision');
  fs.writeFileSync('prov_base64.txt', prov.toString('base64'));
  
  console.log('Se generaron cert_base64.txt y prov_base64.txt correctamente.');
} catch (error) {
  console.error('Error generating base64:', error);
}
