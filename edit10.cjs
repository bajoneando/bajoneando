const fs = require('fs');

function updateFile() {
    let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

    // Replace "Próximos Lanzamientos"
    content = content.replace(
        "Próximos Lanzamientos",
        "Muy pronto en tu ciudad: Recibí novedades"
    );

    // Replace "Ciudades Disponibles"
    content = content.replace(
        "Ciudades Disponibles",
        "CIUDADES DISPONIBLES: Pedí ahora"
    );

    fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
    console.log("Done.");
}

updateFile();
