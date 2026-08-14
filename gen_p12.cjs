const forge = require('node-forge');
const fs = require('fs');

try {
  console.log('Reading private key...');
  const privateKeyPem = fs.readFileSync('ios_distribution.key', 'utf8');
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

  console.log('Reading Apple Certificate...');
  const cerDer = fs.readFileSync('distribution.cer');
  const asn1 = forge.asn1.fromDer(cerDer.toString('binary'));
  const cert = forge.pki.certificateFromAsn1(asn1);

  console.log('Generating p12 file...');
  // Generamos el p12 con la contraseña 'wepi2026'
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    privateKey, [cert], 'wepi2026',
    {generateLocalKeyId: true, friendlyName: 'Wepi Distribution'}
  );
  
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  fs.writeFileSync('ios_distribution.p12', p12Der, 'binary');
  
  console.log('Successfully created ios_distribution.p12');
} catch (error) {
  console.error('Error generating p12:', error);
}
