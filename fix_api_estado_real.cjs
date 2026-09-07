const fs = require('fs');
let content = fs.readFileSync('src/services/api.js', 'utf8');

content = content.replace(
  /en_espera_repartidor_10m:\s*true,\s*espera_hasta:\s*esperaHasta/,
  "estado: 'Buscando Repartidor',\n        en_espera_repartidor_10m: true,\n        espera_hasta: esperaHasta"
);

// also the locales update
content = content.replace(
  /\}\)\.eq\('id',\s*pedidoId\);\s*return\s*\{\s*success:\s*true\s*\};/,
  "}).eq('id', pedidoId);\n      await supabase.from('pedidos_locales').update({ estado: 'Buscando Repartidor' }).eq('pedido_id', pedidoId);\n      return { success: true };"
);

fs.writeFileSync('src/services/api.js', content);
