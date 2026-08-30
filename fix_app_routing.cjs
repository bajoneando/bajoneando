const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// Insert the isApp constant before the Routes
const isAppCode = `
  const isApp = Capacitor.isNativePlatform() || 
                window.matchMedia('(display-mode: standalone)').matches || 
                window.navigator.standalone || 
                /Capacitor|wv|Wepi/i.test(navigator.userAgent);
`;

if (!content.includes('const isApp =')) {
  content = content.replace(
    /<Routes>/,
    isAppCode + '\n          <Routes>'
  );
}

content = content.replace(
  /Capacitor\.isNativePlatform\(\) \? <Navigate to="\/pedir" replace \/> : <Landing \/>/,
  `isApp ? <Navigate to="/pedir" replace /> : <Landing />`
);

fs.writeFileSync('src/App.jsx', content);
