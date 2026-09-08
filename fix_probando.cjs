const fs = require('fs');
let code = fs.readFileSync('src/pages/DriverProbando.jsx', 'utf8');

const startStr = "<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>";
const endStr = "{notificationStatus !== 'denied' && (!isIOS || isStandalone) && (";

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const target = code.substring(startIndex, endIndex + endStr.length);
    const replacement = `<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {notificationStatus === 'denied' ? (
                <>🚫 <strong>Bloqueadas:</strong> No recibirás alertas de pedidos. Revisa los permisos.</>
              ) : (
                <>🔔 <strong>Activa alertas:</strong> Presiona el botón para recibir pedidos al instante.</>
              )}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: window.innerWidth < 500 ? '100%' : 'auto', justifyContent: window.innerWidth < 500 ? 'flex-end' : 'flex-start' }}>
              {notificationStatus !== 'denied' && (`;
    
    code = code.replace(target, replacement);

    // Remove the modal `{showPWAInstructions && (`
    const modalStart = "{showPWAInstructions && (";
    const modalStartIndex = code.indexOf(modalStart);
    if (modalStartIndex !== -1) {
        // We know it ends with `}); }` or something. Let's just use regex for the modal.
        code = code.replace(/\{showPWAInstructions && \([\s\S]*?\}\);?\s*\}/, '');
    }

    // Duplicate push check for Probando
    const duplicatePushTarget = /const platform = Capacitor\.getPlatform\(\);\s*if \(platform === 'ios' \|\| platform === 'android'\) \{[\s\S]*?PushNotifications\.addListener\('registrationError'[\s\S]*?\}\);\s*\} else \{/;
    const duplicatePushReplacement = `const platform = Capacitor.getPlatform();
      if (platform === 'ios' || platform === 'android') {
        console.log("Push: Native environment detected. PushNotificationManager handles registration.");
        setNotificationStatus('granted');
      } else {`;
    if (duplicatePushTarget.test(code)) {
        code = code.replace(duplicatePushTarget, duplicatePushReplacement);
    }

    fs.writeFileSync('src/pages/DriverProbando.jsx', code);
    console.log("Success probando");
} else {
    console.log("Target not found dynamically");
}
