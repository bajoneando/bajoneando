const fs = require('fs');

function updateFile() {
    let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

    // 1. Inactive cities logic
    const oldLogic = "if (norm === 'goya') return 'Goya (Corrientes)';";
    const newLogic = "if (norm === 'goya') return 'Goya (Corrientes)';\n    if (norm === 'paso de los libres' || norm === 'paso-de-los-libres') return 'Paso de los Libres (Corrientes)';\n    if (norm === 'san vicente' || norm === 'san-vicente') return 'San Vicente (Misiones)';\n    if (norm === 'colon' || norm === 'colón') return 'Colon (Entre Ríos)';";
    
    if(content.includes(oldLogic)) {
        content = content.replace(oldLogic, newLogic);
        console.log("Replaced logic.");
    }

    // 2. Select option
    const oldOption = '<option value="Goya (Corrientes)">Goya (Corrientes)</option>';
    const newOption = '<option value="Goya (Corrientes)">Goya (Corrientes)</option>\n                    <option value="Paso de los Libres (Corrientes)">Paso de los Libres (Corrientes)</option>\n                    <option value="San Vicente (Misiones)">San Vicente (Misiones)</option>\n                    <option value="Colon (Entre Ríos)">Colon (Entre Ríos)</option>';
    
    if(content.includes(oldOption)) {
        content = content.replace(oldOption, newOption);
        console.log("Replaced options.");
    }

    // 3. The exact string of buttons, using Regex matching that ignores \r\n vs \n
    const newButtons = `\n              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
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
              </div>\n            `;

    // Regex that specifically matches the 3 buttons after Próximos Lanzamientos
    const btnRegex = /<button[\s\S]*?Alem \(Misiones\)\s*<\/button>[\s\S]*?<button[\s\S]*?Apóstoles \(Misiones\)\s*<\/button>[\s\S]*?<button[\s\S]*?Goya \(Corrientes\)\s*<\/button>/;
    
    // BUT we must only replace the buttons that come after "Próximos Lanzamientos"
    let startIndex = content.indexOf('Próximos Lanzamientos');
    if(startIndex !== -1) {
        const preContent = content.slice(0, startIndex);
        const postContent = content.slice(startIndex);
        
        if (btnRegex.test(postContent)) {
            const newPostContent = postContent.replace(btnRegex, newButtons);
            content = preContent + newPostContent;
            console.log("Replaced buttons properly.");
        } else {
            console.log("Regex did not match in postContent.");
        }
    } else {
        console.log("Could not find start marker.");
    }

    fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
    console.log("Done.");
}

updateFile();
