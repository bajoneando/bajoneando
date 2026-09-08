const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

const targetStr = `const handleCancelPendingOrder = async () => {
    const orderIdToCancel = pendingOrderId;
    const recipientPhone = user && user.telefono;
    setSearchingDriver(false);
    setFoundDriver(null);
    setAcceptedOrder(null);
    setMpRedirectUrl(null);
    setPendingOrderId(null);
    setCartOpen(true);
    localStorage.removeItem('pendingOrderDataPruebas');
    
    if (orderIdToCancel) {
      try {
        await Promise.all([
          api.supabase.from('pedidos_general').update({ estado: 'Rechazado' }).eq('id', orderIdToCancel),
          api.supabase.from('pedidos_locales').update({ estado: 'Rechazado' }).eq('pedido_id', orderIdToCancel)
        ]);`;

const targetIdx = content.indexOf('const handleCancelPendingOrder = async () => {');
if (targetIdx !== -1) {
    const endIdx = content.indexOf(']);', targetIdx);
    
    const newFunc = `const handleCancelPendingOrder = async () => {
    const orderIdToCancel = pendingOrderId;
    const recipientPhone = user && user.telefono;
    
    if (orderIdToCancel) {
      try {
        const { data: currentOrder } = await api.supabase
          .from('pedidos_general')
          .select('estado')
          .eq('id', orderIdToCancel)
          .single();
          
        if (currentOrder && ['Confirmado', 'Aceptado', 'Preparando', 'Listo', 'Retirado', 'En camino', 'Entregado'].includes(currentOrder.estado)) {
          setConfirmedOrderId(orderIdToCancel);
          setShowConfirmedModal(true);
          setSearchingDriver(false);
          setFoundDriver(null);
          setAcceptedOrder(null);
          setMpRedirectUrl(null);
          setPendingOrderId(null);
          localStorage.removeItem('pendingOrderDataPruebas');
          return;
        }

        setSearchingDriver(false);
        setFoundDriver(null);
        setAcceptedOrder(null);
        setMpRedirectUrl(null);
        setPendingOrderId(null);
        setCartOpen(true);
        localStorage.removeItem('pendingOrderDataPruebas');

        await Promise.all([
          api.supabase.from('pedidos_general').update({ estado: 'Rechazado' }).eq('id', orderIdToCancel),
          api.supabase.from('pedidos_locales').update({ estado: 'Rechazado' }).eq('pedido_id', orderIdToCancel)
        ]);`;

    content = content.substring(0, targetIdx) + newFunc + content.substring(endIdx + 3);
    
    fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
    fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\PruebasWalletApp.jsx', content);
    console.log("Success");
} else {
    console.log("Not found");
}
