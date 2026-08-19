import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as api from '../services/api';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [deliveryType, setDeliveryType] = useState('envio');
  const [costoEnvioDelivery, setCostoEnvioDelivery] = useState(1800); 
  const [costoEnvioShops, setCostoEnvioShops] = useState(2000); 
  const [incentivoActivo, setIncentivoActivo] = useState(0);
  const [customShippingCost, setCustomShippingCost] = useState(null);

  useEffect(() => {
    const fetchCosto = async () => {
      try {
        // Consultamos el incentivo dinámico y la configuración base
        const [config, activation] = await Promise.all([
          api.getConfiguracion(),
          api.getSystemActivation()
        ]);

        const baseDelivery = Number(config?.valor_envio) || 1800;
        const baseShops = Number(config?.valor_envio_shops) || 2000;
        const incentivo = Number(activation?.valor_incentivo) || 0;

        setCostoEnvioDelivery(baseDelivery + incentivo);
        setCostoEnvioShops(baseShops);
        setIncentivoActivo(incentivo);
      } catch (err) {
        console.error('Error fetching dynamic shipping cost:', err);
        setCostoEnvioDelivery(1800);
        setCostoEnvioShops(2000);
      }
    };
    
    fetchCosto();
    
    // Opcional: Refrescar cada 2 minutos para reflejar cambios de tarifa
    const interval = setInterval(fetchCosto, 120000);
    return () => clearInterval(interval);
  }, []);

  const [isCheckoutInProgress, setIsCheckoutInProgress] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // DETECTOR Y REGISTRO AUTOMÁTICO DE CARRITO ABANDONADO
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!items || items.length === 0) return;

    const checkAndLogAbandonment = () => {
      // Si el usuario está realizando la compra, confirmando o pagando vía Mercado Pago, NO es abandono
      if (isCheckoutInProgress || sessionStorage.getItem('wepi_checkout_in_progress') === 'true') {
        return;
      }

      const uId = localStorage.getItem('userId');
      if (!uId) return;

      const lastLogged = Number(localStorage.getItem('wepi_last_cart_abandoned_time') || 0);
      const now = Date.now();

      // Evitar duplicar en menos de 2 minutos
      if (now - lastLogged < 120000) return;

      localStorage.setItem('wepi_last_cart_abandoned_time', String(now));
      api.adminLogCRMEvent(uId, 'CARRITO_ABANDONADO', {
        items_count: items.reduce((s, i) => s + i.qty, 0),
        subtotal: items.reduce((sum, i) => sum + (Number(i.precio) * i.qty), 0),
        items: items.map(i => i.nombre)
      }).catch(e => console.error("Error al registrar carrito abandonado:", e));
    };

    // 1. Temporizador de inactividad (20 segundos tras modificar el carrito sin comprar)
    const timer = setTimeout(() => {
      checkAndLogAbandonment();
    }, 20000);

    // 2. Escuchadores de salida / ocultamiento de la PWA o pestaña
    const handleVisibilityOrPageHide = () => {
      if (document.visibilityState === 'hidden') {
        checkAndLogAbandonment();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrPageHide);
    window.addEventListener('pagehide', handleVisibilityOrPageHide);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityOrPageHide);
      window.removeEventListener('pagehide', handleVisibilityOrPageHide);
    };
  }, [items, isCheckoutInProgress]);

  const isShops = window.location.pathname.startsWith('/shops');
  const costoEnvio = customShippingCost !== null ? customShippingCost : (isShops ? costoEnvioShops : costoEnvioDelivery);

  const addItem = useCallback((menu) => {
    setItems(prev => {
      // Validar local único
      if (prev.length > 0) {
        const existingLocalId = prev[0].local_id;
        if (existingLocalId && menu.local_id && existingLocalId !== menu.local_id) {
          toast.error('Tu carrito ya tiene productos de otro local. Finalizá ese pedido para comprar en éste.');
          return prev;
        }
      }

      const existing = prev.find(i => i.id === menu.id);
      if (existing) {
        return prev.map(i => i.id === menu.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...menu, qty: 1 }];
    });
  }, []);

  const removeItem = useCallback((id) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQty = useCallback((id, delta) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const newQty = i.qty + delta;
      return newQty <= 0 ? null : { ...i, qty: newQty };
    }).filter(Boolean));
  }, []);

  const markCheckoutStarted = useCallback(() => {
    setIsCheckoutInProgress(true);
    sessionStorage.setItem('wepi_checkout_in_progress', 'true');
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setIsCheckoutInProgress(false);
    sessionStorage.removeItem('wepi_checkout_in_progress');
  }, []);

  const subtotal = items.reduce((sum, i) => sum + (Number(i.precio) * i.qty), 0);
  const hasDrink = items.some(i => i.categoria?.toLowerCase().includes('bebida'));
  
  const shippingCost = deliveryType === 'retiro' ? 0 : costoEnvio;
  const total = subtotal + shippingCost;
  const totalItems = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, updateQty, clearCart, markCheckoutStarted, setIsCheckoutInProgress,
      deliveryType, setDeliveryType,
      subtotal, shippingCost, total, totalItems, hasDrink,
      COSTO_ENVIO: costoEnvio,
      incentivoActivo,
      customShippingCost, setCustomShippingCost
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
