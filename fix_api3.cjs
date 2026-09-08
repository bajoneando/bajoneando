const fs = require('fs');
let content = fs.readFileSync('src/services/api.js', 'utf8');

const regex = /const \{ data: pg \} = await supabase\s*\.from\('pedidos_general'\)\s*\.select\('usuario_id, telefono_cliente'\)\s*\.eq\('id', orderId\)\s*\.maybeSingle\(\);/;

const newFunc = `const { data: pg } = await supabase
        .from('pedidos_general')
        .select('usuario_id, telefono_cliente, estado')
        .eq('id', orderId)
        .maybeSingle();

      if (pg && ['Confirmado', 'Aceptado', 'Preparando', 'Listo', 'Retirado', 'En camino', 'Entregado'].includes(pg.estado)) {
        return { success: false, error: 'Pedido ya confirmado/en proceso' };
      }`;

if (regex.test(content)) {
  content = content.replace(regex, newFunc);
  fs.writeFileSync('src/services/api.js', content);
  fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\services\\api.js', content);
  console.log("Success api.js regex");
} else {
  console.log("Failed api.js regex");
}
