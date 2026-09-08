const fs = require('fs');
let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

const oldFunc = `const handleCancelPendingOrder = async () => {
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

const newFunc = `const handleCancelPendingOrder = async () => {
    const orderIdToCancel = pendingOrderId;
    const recipientPhone = user && user.telefono;
    
    if (orderIdToCancel) {
      try {
        // SEGURIDAD: Verificar el estado actual antes de rechazar
        const { data: currentOrder } = await api.supabase
          .from('pedidos_general')
          .select('estado')
          .eq('id', orderIdToCancel)
          .single();
          
        if (currentOrder && ['Confirmado', 'Aceptado', 'Preparando', 'Listo', 'Retirado', 'En camino', 'Entregado'].includes(currentOrder.estado)) {
          console.log('El pedido ya fue confirmado/pagado. No se rechazaro.');
          toast.success('Pago confirmado! Tu pedido esto siendo procesado.');
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

        // Si realmente esto pendiente, lo rechazamos
        await Promise.all([
          api.supabase.from('pedidos_general').update({ estado: 'Rechazado' }).eq('id', orderIdToCancel),
          api.supabase.from('pedidos_locales').update({ estado: 'Rechazado' }).eq('pedido_id', orderIdToCancel)
        ]);`;

if (content.includes(oldFunc)) {
  content = content.replace(oldFunc, newFunc);
  
  // also need to move the state clears for the rejection path AFTER the check
  content = content.replace(
    /        \]\);\n\n        \/\/ Registrar evento CRM/,
    `        ]);\n\n        setSearchingDriver(false);\n        setFoundDriver(null);\n        setAcceptedOrder(null);\n        setMpRedirectUrl(null);\n        setPendingOrderId(null);\n        setCartOpen(true);\n        localStorage.removeItem('pendingOrderDataPruebas');\n\n        // Registrar evento CRM`
  );

  fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
  fs.writeFileSync('C:\\Users\\Axel\\OneDrive\\Desktop\\Wepi Repartidores\\src\\pages\\PruebasWalletApp.jsx', content);
  console.log("Success");
} else {
  console.log("Could not find the function to replace.");
}
