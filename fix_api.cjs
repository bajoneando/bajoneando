const fs = require('fs');
let content = fs.readFileSync('src/services/api.js', 'utf8');

const targetStr = `      const { data: pg } = await supabase
        .from('pedidos_general')
        .select('usuario_id, telefono_cliente')
        .eq('id', orderId)
        .maybeSingle();

      if (pg) {
        targetUserId = pg.usuario_id;
      }

      await Promise.all([
        supabase.from('pedidos_general').update({ estado: 'Rechazado' }).eq('id', orderId),
        supabase.from('pedidos_locales').update({ estado: 'Rechazado' }).eq('pedido_id', orderId)
      ]);`;

const targetIdx = content.indexOf(`      const { data: pg } = await supabase
        .from('pedidos_general')
        .select('usuario_id, telefono_cliente')
        .eq('id', orderId)
        .maybeSingle();`);

if (targetIdx !== -1) {
    const endIdx = content.indexOf(']);', targetIdx);
    
    const newFunc = `      const { data: pg } = await supabase
        .from('pedidos_general')
        .select('usuario_id, telefono_cliente, estado')
        .eq('id', orderId)
        .maybeSingle();

      if (pg) {
        if (['Confirmado', 'Aceptado', 'Preparando', 'Listo', 'Retirado', 'En camino', 'Entregado'].includes(pg.estado)) {
            console.log("Abortando auto-rechazo, el pedido ya esto en progreso:", pg.estado);
            return { success: false, error: 'Pedido ya confirmado/en proceso' };
        }
        targetUserId = pg.usuario_id;
      }

      await Promise.all([
        supabase.from('pedidos_general').update({ estado: 'Rechazado' }).eq('id', orderId),
        supabase.from('pedidos_locales').update({ estado: 'Rechazado' }).eq('pedido_id', orderId)
      ]);`;

    content = content.substring(0, targetIdx) + newFunc + content.substring(endIdx + 3);
    
    fs.writeFileSync('src/services/api.js', content);
    fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\services\\api.js', content);
    console.log("Success api.js");
} else {
    console.log("Not found in api.js");
}
