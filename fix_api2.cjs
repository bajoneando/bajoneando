const fs = require('fs');
let content = fs.readFileSync('src/services/api.js', 'utf8');

const oldFunc = `      const { data: pg } = await supabase
        .from('pedidos_general')
        .select('usuario_id, telefono_cliente')
        .eq('id', orderId)
        .maybeSingle();`;

const newFunc = `      const { data: pg } = await supabase
        .from('pedidos_general')
        .select('usuario_id, telefono_cliente, estado')
        .eq('id', orderId)
        .maybeSingle();

      if (pg && ['Confirmado', 'Aceptado', 'Preparando', 'Listo', 'Retirado', 'En camino', 'Entregado'].includes(pg.estado)) {
        return { success: false, error: 'Pedido ya confirmado/en proceso' };
      }`;

if (content.includes(oldFunc)) {
  content = content.replace(oldFunc, newFunc);
  fs.writeFileSync('src/services/api.js', content);
  fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\services\\api.js', content);
  console.log("Success api.js");
} else {
  console.log("Failed api.js");
}
