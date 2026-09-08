const fs = require('fs');

function updateFile() {
    let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

    // Replace the specific lingering text
    content = content.replace("Goya (Corrientes)", "Villaguay (Entre Ríos)");
    
    fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
    console.log("Done.");
}

updateFile();
