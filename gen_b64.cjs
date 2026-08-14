const fs = require('fs');

try {
  const p12 = fs.readFileSync('ios_distribution.p12');
  const p12Base64 = p12.toString('base64');
  
  const prov = fs.readFileSync('Wepi_AppStore_Profile.mobileprovision');
  const provBase64 = prov.toString('base64');
  
  const output = `--- IOS_CERTIFICATE_BASE64 ---\n${p12Base64}\n\n\n--- IOS_PROVISION_PROFILE_BASE64 ---\n${provBase64}\n`;
  
  fs.writeFileSync('secrets_for_github.txt', output);
  console.log('Secrets generated in secrets_for_github.txt');
} catch (error) {
  console.error('Error generating base64:', error);
}
