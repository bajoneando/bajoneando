import re

def update_file():
    with open('src/pages/PruebasWalletApp.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1
    content = content.replace(
        "if (norm === 'goya') return 'Goya (Corrientes)';",
        "if (norm === 'goya') return 'Goya (Corrientes)';\n    if (norm === 'paso de los libres' || norm === 'paso-de-los-libres') return 'Paso de los Libres (Corrientes)';\n    if (norm === 'san vicente' || norm === 'san-vicente') return 'San Vicente (Misiones)';\n    if (norm === 'colon' || norm === 'colón') return 'Colon (Entre Ríos)';"
    )

    # 2
    content = content.replace(
        '<option value="Goya (Corrientes)">Goya (Corrientes)</option>',
        '<option value="Goya (Corrientes)">Goya (Corrientes)</option>\n                    <option value="Paso de los Libres (Corrientes)">Paso de los Libres (Corrientes)</option>\n                    <option value="San Vicente (Misiones)">San Vicente (Misiones)</option>\n                    <option value="Colon (Entre Ríos)">Colon (Entre Ríos)</option>'
    )

    # 3
    # Replace the inactive cities div and buttons
    # From "Próximos Lanzamientos" to the end of the div
    # Wait, the best way is to use regex with DOTALL or replace a specific chunk
    
    old_buttons = """              <button 
                onClick={() => openInactiveCityModal('Alem (Misiones)')} 
                className="btn btn-full"
                style={{ 
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
                }}
              >
                Alem (Misiones)
              </button>

              <button 
                onClick={() => openInactiveCityModal('Apóstoles (Misiones)')} 
                className="btn btn-full"
                style={{ 
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
                }}
              >
                Apóstoles (Misiones)
              </button>

              <button 
                onClick={() => openInactiveCityModal('Goya (Corrientes)')} 
                className="btn btn-full"
                style={{ 
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
                }}
              >
                Goya (Corrientes)
              </button>"""
              
    new_buttons = """              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
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
              </div>"""

    content = content.replace(old_buttons, new_buttons)

    with open('src/pages/PruebasWalletApp.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    update_file()
