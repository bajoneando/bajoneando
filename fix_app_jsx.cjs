const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// Remove the injected code inside return
content = content.replace(/const isApp =[\s\S]*?test\(navigator\.userAgent\);/, '');

// Find return ( and insert before it
content = content.replace(
  /return \(/,
  `const isApp = Capacitor.isNativePlatform() || 
                window.matchMedia('(display-mode: standalone)').matches || 
                window.navigator.standalone || 
                /Capacitor|wv|Wepi/i.test(navigator.userAgent);\n\n    return (`
);

fs.writeFileSync('src/App.jsx', content);
