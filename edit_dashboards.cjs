const fs = require('fs');

function updateDashboard(filename) {
    let content = fs.readFileSync(filename, 'utf8');

    const regex = /<option value="" disabled>Seleccioná tu Ciudad<\/option>\s*<option value="Santo Tomé">Santo Tomé<\/option>\s*<option value="Oberá">Oberá<\/option>/;
                
    const newOptions = `<option value="" disabled>Seleccioná tu Ciudad</option>
                <option value="Santo Tomé">Santo Tomé</option>
                <option value="Oberá">Oberá</option>
                <option value="Alem (Misiones)">Alem (Misiones)</option>
                <option value="Apóstoles (Misiones)">Apóstoles (Misiones)</option>
                <option value="Goya (Corrientes)">Goya (Corrientes)</option>
                <option value="Paso de los Libres (Corrientes)">Paso de los Libres (Corrientes)</option>
                <option value="San Vicente (Misiones)">San Vicente (Misiones)</option>
                <option value="Colon (Entre Ríos)">Colon (Entre Ríos)</option>`;

    if(regex.test(content)) {
        content = content.replace(regex, newOptions);
        fs.writeFileSync(filename, content);
        console.log("Updated " + filename);
    } else {
        console.log("Could not find the options in " + filename);
    }
}

updateDashboard('src/pages/DriverDashboard.jsx');
updateDashboard('src/pages/RestaurantDashboard.jsx');
