const fs = require('fs');
let content = fs.readFileSync('src/pages/MisPedidos.jsx', 'utf8');

const targetUseEffect = `  React.useEffect(() => {
    loadPedidos();
  }, [user]);`;

const replacementUseEffect = `  React.useEffect(() => {
    loadPedidos();
  }, [user]);

  // Handle 10 min background ping & auto reject
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1); // trigger re-render for timers
      enCurso.forEach(async (pedido) => {
        if (pedido.estado === 'Buscando Repartidor' && pedido.en_espera_repartidor_10m && pedido.espera_hasta) {
          const expiresAt = new Date(pedido.espera_hasta).getTime();
          const now = Date.now();
          if (now >= expiresAt) {
            // Auto reject
            try {
              await api.handleCancelOrderSinRepartidores({
                orderId: pedido.id,
                phone: user?.telefono,
                city: '',
                optIn: false
              });
              await api.supabase.from('pedidos_general').update({ estado: 'Rechazado' }).eq('id', pedido.id);
              await api.supabase.from('pedidos_locales').update({ estado: 'Rechazado' }).eq('pedido_id', pedido.id);
              toast.error('Se agotó el tiempo de espera. Pedido cancelado automáticamente.');
              loadPedidos(true);
            } catch(e) { console.error('Error auto-rejecting:', e); }
          }
        }
      });
    }, 1000);

    const pingTimer = setInterval(() => {
      enCurso.forEach(pedido => {
        if (pedido.estado === 'Buscando Repartidor' && pedido.en_espera_repartidor_10m && pedido.espera_hasta) {
          const expiresAt = new Date(pedido.espera_hasta).getTime();
          const now = Date.now();
          if (now < expiresAt) {
             const localId = pedido.pedidos_locales?.[0]?.local_id || null;
             api.broadcastOrderToDrivers(pedido.id, pedido.total, localId, pedido.precio_envio || 0);
          }
        }
      });
    }, 30000); // every 30 seconds

    return () => { clearInterval(timer); clearInterval(pingTimer); };
  }, [enCurso, user]);`;

content = content.replace(targetUseEffect, replacementUseEffect);

fs.writeFileSync('src/pages/MisPedidos.jsx', content);
fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\MisPedidos.jsx', content);
