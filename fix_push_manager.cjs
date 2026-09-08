const fs = require('fs');
let code = fs.readFileSync('src/components/PushNotificationManager.jsx', 'utf8');

const target = 'api.repartidorUpdateOneSignalId(driver.id, token).catch(err => console.error("Error guardando en repartidores:", err));';
const replacement = `api.repartidorUpdateOneSignalId(driver.id, token).catch(err => console.error("Error guardando en repartidores:", err));
        api.repartidorUpdateFcmToken(driver.id, token).catch(err => console.error("Error guardando FCM en repartidores:", err));`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/PushNotificationManager.jsx', code);
console.log("Updated PushNotificationManager.jsx successfully");
