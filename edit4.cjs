const fs = require('fs');

function updateFile() {
    let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

    // 1
    content = content.replace(
        "if (norm === 'goya') return 'Goya (Corrientes)';",
        "if (norm === 'goya') return 'Goya (Corrientes)';\n    if (norm === 'paso de los libres' || norm === 'paso-de-los-libres') return 'Paso de los Libres (Corrientes)';\n    if (norm === 'san vicente' || norm === 'san-vicente') return 'San Vicente (Misiones)';\n    if (norm === 'colon' || norm === 'colón') return 'Colon (Entre Ríos)';"
    );

    // 2
    content = content.replace(
        '<option value="Goya (Corrientes)">Goya (Corrientes)</option>',
        '<option value="Goya (Corrientes)">Goya (Corrientes)</option>\n                    <option value="Paso de los Libres (Corrientes)">Paso de los Libres (Corrientes)</option>\n                    <option value="San Vicente (Misiones)">San Vicente (Misiones)</option>\n                    <option value="Colon (Entre Ríos)">Colon (Entre Ríos)</option>'
    );

    // 3
    const newButtons = `              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button onClick={() => openInactiveCityModal('Alem (Misiones)')} className="btn btn-full" style={{ background: '#f8fafc', color: '#334155', padding: '7px 11px', borderRadius: '9px', fontWeight: '500', fontSize: '0.82rem', border: '1px dashed #cbd5e1', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Alem (Misiones)
                </button>
                <button onClick={() => openInactiveCityModal('Apóstoles (Misiones)')} className="btn btn-full" style={{ background: '#f8fafc', color: '#334155', padding: '7px 11px', borderRadius: '9px', fontWeight: '500', fontSize: '0.82rem', border: '1px dashed #cbd5e1', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Apóstoles (Misiones)
                </button>
                <button onClick={() => openInactiveCityModal('Goya (Corrientes)')} className="btn btn-full" style={{ background: '#f8fafc', color: '#334155', padding: '7px 11px', borderRadius: '9px', fontWeight: '500', fontSize: '0.82rem', border: '1px dashed #cbd5e1', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Goya (Corrientes)
                </button>
                <button onClick={() => openInactiveCityModal('Paso de los Libres (Corrientes)')} className="btn btn-full" style={{ background: '#f8fafc', color: '#334155', padding: '7px 11px', borderRadius: '9px', fontWeight: '500', fontSize: '0.82rem', border: '1px dashed #cbd5e1', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Paso de los Libres
                </button>
                <button onClick={() => openInactiveCityModal('San Vicente (Misiones)')} className="btn btn-full" style={{ background: '#f8fafc', color: '#334155', padding: '7px 11px', borderRadius: '9px', fontWeight: '500', fontSize: '0.82rem', border: '1px dashed #cbd5e1', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  San Vicente (Mnes)
                </button>
                <button onClick={() => openInactiveCityModal('Colon (Entre Ríos)')} className="btn btn-full" style={{ background: '#f8fafc', color: '#334155', padding: '7px 11px', borderRadius: '9px', fontWeight: '500', fontSize: '0.82rem', border: '1px dashed #cbd5e1', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Colon (Entre Ríos)
                </button>
              </div>`;

    const regex = /<button[\s\S]*?onClick={\(\) => openInactiveCityModal\('Alem \(Misiones\)'\)}[\s\S]*?<\/button>\s*<button[\s\S]*?onClick={\(\) => openInactiveCityModal\('Apóstoles \(Misiones\)'\)}[\s\S]*?<\/button>\s*<button[\s\S]*?onClick={\(\) => openInactiveCityModal\('Goya \(Corrientes\)'\)}[\s\S]*?<\/button>/;

    if(regex.test(content)) {
        content = content.replace(regex, newButtons);
        console.log("Successfully replaced buttons!");
    } else {
        console.log("Could not match the regex for buttons.");
    }

    fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
    console.log("File saved.");
}

updateFile();
