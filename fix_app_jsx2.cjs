const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// Remove from MaintenanceGuard
content = content.replace(
  /const isApp = Capacitor\.isNativePlatform\(\) \|\|\s*window\.matchMedia\('\(display-mode: standalone\)'\)\.matches \|\|\s*window\.navigator\.standalone \|\|\s*\/Capacitor\|wv\|Wepi\/i\.test\(navigator\.userAgent\);/,
  ''
);

// Insert into App function
content = content.replace(
  /export default function App\(\) \{\s*const location = useLocation\(\);/,
  `export default function App() {\n  const location = useLocation();\n\n  const isApp = Capacitor.isNativePlatform() || window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || /Capacitor|wv|Wepi/i.test(navigator.userAgent);`
);

fs.writeFileSync('src/App.jsx', content);
