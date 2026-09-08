const fs = require('fs');

function updateFile(filename) {
    let content = fs.readFileSync(filename, 'utf8');
    let modified = false;

    // PruebasWalletApp specific replacements
    if (filename.includes('PruebasWalletApp')) {
        const oldLogic = "if (norm === 'goya') return 'Goya (Corrientes)';";
        const newLogic = "if (norm === 'villaguay') return 'Villaguay (Entre Ríos)';";
        if(content.includes(oldLogic)) {
            content = content.replace(oldLogic, newLogic);
            modified = true;
        }

        const oldButton = "openInactiveCityModal('Goya (Corrientes)')";
        const newButton = "openInactiveCityModal('Villaguay (Entre Ríos)')";
        if(content.includes(oldButton)) {
            content = content.replace(oldButton, newButton);
            modified = true;
        }

        const oldButtonLabel = ">Goya (Corrientes)</button>";
        const newButtonLabel = ">Villaguay (Entre Ríos)</button>";
        if(content.includes(oldButtonLabel)) {
            content = content.replace(oldButtonLabel, newButtonLabel);
            modified = true;
        }
    }

    // Common replacements for options
    const oldOption1 = '<option value="Goya (Corrientes)">Goya (Corrientes)</option>';
    const newOption1 = '<option value="Villaguay (Entre Ríos)">Villaguay (Entre Ríos)</option>';
    if(content.includes(oldOption1)) {
        content = content.replace(oldOption1, newOption1);
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filename, content);
        console.log("Updated " + filename);
    } else {
        console.log("No replacements made in " + filename);
    }
}

updateFile('src/pages/PruebasWalletApp.jsx');
updateFile('src/pages/DriverDashboard.jsx');
updateFile('src/pages/RestaurantDashboard.jsx');
