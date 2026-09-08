const fs = require('fs');
let code = fs.readFileSync('src/pages/DriverDashboard.jsx', 'utf8');

const regex = /const platform = Capacitor\.getPlatform\(\);\s*if \(platform === 'ios' \|\| platform === 'android'\) \{[\s\S]*?PushNotifications\.addListener\('registrationError'[\s\S]*?\}\);\s*\} else \{/;

const replacement = `const platform = Capacitor.getPlatform();
      if (platform === 'ios' || platform === 'android') {
        console.log("Push: Native environment detected. PushNotificationManager handles registration.");
        setNotificationStatus('granted');
      } else {`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('src/pages/DriverDashboard.jsx', code);
    console.log("Updated DriverDashboard.jsx successfully");
} else {
    console.log("Regex not found");
}
