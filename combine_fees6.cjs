const fs = require('fs');
let content = fs.readFileSync('src/pages/RestaurantDashboard.jsx', 'utf8');

// First block
let startIdx = content.indexOf('<div>Env');
let endIdx = content.indexOf('</div>', startIdx + 50); // After Costo de Servicio

if (startIdx !== -1 && endIdx !== -1) {
    let before = content.substring(0, startIdx);
    let after = content.substring(endIdx + 6);
    
    // Find the TOTAL div
    let totalIdx = content.indexOf('<div style="font-size: 1.1rem; margin-top: 4px;">TOTAL: $${finalTotalVal.toFixed(2)}</div>', startIdx);
    if(totalIdx !== -1) {
        let replace = '<div>Envío Wepi: $${(costoEnvioVal + feeEnvioVal).toFixed(2)}</div>\n          ';
        content = content.substring(0, startIdx) + replace + content.substring(totalIdx);
    }
}

// Second block
let startIdx2 = content.indexOf('Env', content.indexOf('<div style="text-align: right; font-size: 13px;">', content.indexOf('const itemsHtml =')));
let endIdx2 = content.indexOf('</div>', startIdx2);

if (startIdx2 !== -1 && endIdx2 !== -1) {
    let totalSectionIdx = content.indexOf('<div class="total-section"', startIdx2);
    if(totalSectionIdx !== -1) {
        let replace = 'Envío Wepi: $${(envioVal + feeEnvioVal).toFixed(2)}\n          </div>\n          ';
        content = content.substring(0, startIdx2) + replace + content.substring(totalSectionIdx);
    }
}

fs.writeFileSync('src/pages/RestaurantDashboard.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\RestaurantDashboard.jsx', content);
