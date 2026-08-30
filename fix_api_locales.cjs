const fs = require('fs');
let content = fs.readFileSync('src/services/api.js', 'utf8');

content = content.replace(
  `}).eq('id', pedidoId);\n      return { success: true };`,
  `}).eq('id', pedidoId);\n      await supabase.from('pedidos_locales').update({ estado: 'Buscando Repartidor' }).eq('pedido_id', pedidoId);\n      return { success: true };`
);

fs.writeFileSync('src/services/api.js', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\services\\api.js', content);
