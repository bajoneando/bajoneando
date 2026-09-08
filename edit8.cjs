const fs = require('fs');

function updateFile() {
    let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

    let startIndex = content.indexOf('Próximos Lanzamientos');
    if(startIndex !== -1) {
        // Find the closing div of "Próximos Lanzamientos"
        startIndex = content.indexOf('</div>', startIndex) + 6;
        
        // Find the start of the next section
        const endMarker = "</div>\n          </div>\n        </div>\n      )}";
        let endIndex = content.indexOf(endMarker, startIndex);
        
        if (endIndex !== -1) {
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
                
            const newButtons = `\n              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
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
                  Paso de los Libres
                </button>
                <button onClick={() => openInactiveCityModal('San Vicente (Misiones)')} className="btn btn-full" ${btnStyle}>
                  San Vicente (Mnes)
                </button>
                <button onClick={() => openInactiveCityModal('Colon (Entre Ríos)')} className="btn btn-full" ${btnStyle}>
                  Colon (Entre Ríos)
                </button>
              </div>\n            `;
            
            content = content.slice(0, startIndex) + newButtons + content.slice(endIndex);
            console.log("Replaced buttons grid.");
        } else {
            console.log("Could not find end marker.");
        }
    } else {
        console.log("Could not find start marker.");
    }

    fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
    console.log("Done.");
}

updateFile();
