const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

if (!content.includes('otaVersion')) {
  content = content.replace(
    /const \[activeCity, setActiveCity\] = useState\(''\);/,
    `const [activeCity, setActiveCity] = useState('');\n  const [otaVersion, setOtaVersion] = useState('v1.1.1');`
  );
  
  content = content.replace(
    /useEffect\(\(\) => \{/,
    `useEffect(() => {\n    const getOtaVersion = async () => {\n      try {\n        if (Capacitor.isNativePlatform()) {\n          const { OtaKit } = await import('@otakit/capacitor-updater');\n          const state = await OtaKit.getState();\n          if (state?.current?.version) setOtaVersion('v' + state.current.version);\n        }\n      } catch (e) { console.error('Error fetching ota version', e); }\n    };\n    getOtaVersion();\n\n`
  );

  content = content.replace(
    /<span style=\{\{ display: 'inline-block', marginLeft: '8px', padding: '2px 8px', borderRadius: '12px', background: 'rgba\(56, 189, 248, 0\.15\)', color: '#38bdf8', border: '1px solid rgba\(56,189, 248, 0\.4\)', fontSize: '0\.75rem', fontWeight: 'bold' \}\}>v1\.1\.1<\/span>/,
    `<span style={{ display: 'inline-block', marginLeft: '8px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56,189, 248, 0.4)', fontSize: '0.75rem', fontWeight: 'bold' }}>{otaVersion}</span>`
  );
  fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
  fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\PruebasWalletApp.jsx', content);
}
