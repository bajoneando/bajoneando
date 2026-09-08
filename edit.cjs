const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

// 1. Update getInactiveCityFromSlug
content = content.replace(
  /if \(norm === 'goya'\) return 'Goya \(Corrientes\)';/,
  `if (norm === 'goya') return 'Goya (Corrientes)';
    if (norm === 'paso de los libres' || norm === 'paso-de-los-libres') return 'Paso de los Libres (Corrientes)';
    if (norm === 'san vicente' || norm === 'san-vicente') return 'San Vicente (Misiones)';
    if (norm === 'colon' || norm === 'colón') return 'Colon (Entre Ríos)';`
);

// 2. Update select dropdown
content = content.replace(
  /<option value="Goya \(Corrientes\)">Goya \(Corrientes\)<\/option>/,
  `<option value="Goya (Corrientes)">Goya (Corrientes)</option>
                    <option value="Paso de los Libres (Corrientes)">Paso de los Libres (Corrientes)</option>
                    <option value="San Vicente (Misiones)">San Vicente (Misiones)</option>
                    <option value="Colon (Entre Ríos)">Colon (Entre Ríos)</option>`
);

const btnStyle = `style={{ 
                  background: '#f8fafc', 
                  color: '#334155', 
                  padding: '7px 11px', 
                  borderRadius: '9px', 
                  fontWeight: '500', 
                  fontSize: '0.82rem',
                  border: '1px dashed #cbd5e1',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center'
                }}`;

const buttonsReplacement = `
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button onClick={() => openInactiveCityModal('Alem (Misiones)')} className="btn btn-full" ${btnStyle}>
                  Alem (Misiones)
                </button>
                <button onClick={() => openInactiveCityModal('Apóstoles (Misiones)')} className="btn btn-full" ${btnStyle}>
                  Apóstoles (Misiones)
                </button>
                <button onClick={() => openInactiveCityModal('Goya (Corrientes)')} className="btn btn-full" ${btnStyle}>
                  Goya (Corrientes)
                </button>
                <button onClick={() => openInactiveCityModal('Paso de los Libres (Corrientes)')} className="btn btn-full" ${btnStyle}>
                  Paso de los Libres (Corrientes)
                </button>
                <button onClick={() => openInactiveCityModal('San Vicente (Misiones)')} className="btn btn-full" ${btnStyle}>
                  San Vicente (Misiones)
                </button>
                <button onClick={() => openInactiveCityModal('Colon (Entre Ríos)')} className="btn btn-full" ${btnStyle}>
                  Colon (Entre Ríos)
                </button>
              </div>`;

const regex = /<button[\s\S]*?onClick={\(\)\s*=>\s*openInactiveCityModal\('Alem \(Misiones\)'\)}[\s\S]*?<\/button>\s*<button[\s\S]*?onClick={\(\)\s*=>\s*openInactiveCityModal\('Apóstoles \(Misiones\)'\)}[\s\S]*?<\/button>\s*<button[\s\S]*?onClick={\(\)\s*=>\s*openInactiveCityModal\('Goya \(Corrientes\)'\)}[\s\S]*?<\/button>/;

content = content.replace(regex, buttonsReplacement);

fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
console.log('done');
