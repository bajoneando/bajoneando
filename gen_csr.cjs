const forge = require('node-forge');
const fs = require('fs');

console.log('Generating 2048-bit RSA key pair...');
forge.pki.rsa.generateKeyPair({bits: 2048, workers: 2}, function(err, keypair) {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }

  const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
  fs.writeFileSync('ios_distribution.key', privateKeyPem);
  console.log('Saved ios_distribution.key');

  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keypair.publicKey;
  csr.setSubject([{
    name: 'commonName',
    value: 'Wepi App'
  }, {
    name: 'countryName',
    value: 'AR'
  }, {
    shortName: 'O',
    value: 'Wepi'
  }]);

  csr.sign(keypair.privateKey);
  const csrPem = forge.pki.certificationRequestToPem(csr);
  fs.writeFileSync('ios_distribution.csr', csrPem);
  console.log('Saved ios_distribution.csr');
});
