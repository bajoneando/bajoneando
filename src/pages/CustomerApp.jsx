import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useJsApiLoader } from '@react-google-maps/api';
import * as api from '../services/api';
import { iniciarPagoMercadoPago } from '../services/mercadopago';
import { isValidEmail } from '../utils/validation';
import toast from 'react-hot-toast';
import AddressSelector from '../components/AddressSelector';
import HelpChatbot from '../components/HelpChatbot';
import { isLocalOpen as isLocalOpenFlexible, getNextStatusChange } from '../utils/businessHours';
import './CustomerApp.css';

const GOOGLE_MAPS_LIBRARIES = ['places'];

export default function CustomerApp() {
  // Map Loading
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!googleMapsApiKey) {
    console.error("❌ ERROR: VITE_GOOGLE_MAPS_API_KEY is missing in .env file or build process.");
  }

  const { isLoaded: isMapLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey,
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  if (loadError) {
    console.error("❌ Error loading Google Maps in CustomerApp:", loadError);
  }
  
  const { user, loginAsUser, logoutUser: doLogout, updateUserAddress } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();

  const [locals, setLocals] = React.useState([]);
  const [menus, setMenus] = React.useState([]);
  const [menuTitle, setMenuTitle] = React.useState('');
  const [showMenus, setShowMenus] = React.useState(false);
  const [loadingMenus, setLoadingMenus] = React.useState(false);
  const [favorites, setFavorites] = React.useState([]);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [filteredLocals, setFilteredLocals] = React.useState(null);
  const [selectedCategory, setSelectedCategory] = React.useState(null);
  const [loadingLocals, setLoadingLocals] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [modal, setModal] = React.useState(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [localCommission, setLocalCommission] = React.useState(0.08); // Comisión por defecto de Wepi (8%)

  React.useEffect(() => {
    const localId = cart.items[0]?.local_id;
    if (localId) {
      api.getPlanInfo(localId)
        .then(res => {
          if (res && res.success && typeof res.comision_actual === 'number') {
            console.log(`📊 CustomerApp: Comisión dinámica para local ${localId}: ${res.comision_actual}%`);
            setLocalCommission(res.comision_actual / 100);
          } else {
            setLocalCommission(0.08);
          }
        })
        .catch(() => setLocalCommission(0.08));
    } else {
      setLocalCommission(0.08);
    }
  }, [cart.items]);
  const [iceCreamModal, setIceCreamModal] = React.useState(null);
  const [iceCreamFlavors, setIceCreamFlavors] = React.useState([]);
  const [iceCreamSauces, setIceCreamSauces] = React.useState([]);
  const [iceCreamExtras, setIceCreamExtras] = React.useState([]);
  const [selectedSize, setSelectedSize] = React.useState('1/4kg');
  const [selectedFlavors, setSelectedFlavors] = React.useState([]);
  const [selectedSauces, setSelectedSauces] = React.useState([]);
  const [selectedExtras, setSelectedExtras] = React.useState([]);
  const [burgerModal, setBurgerModal] = React.useState(null);
  const [selectedVariant, setSelectedVariant] = React.useState(null);
  const [selectedBurgerExtras, setSelectedBurgerExtras] = React.useState([]);
  const [withFries, setWithFries] = React.useState(false);
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [drinks, setDrinks] = React.useState([]);
  const [hasRepartidores, setHasRepartidores] = React.useState(true);
  const [metodoPago, setMetodoPago] = React.useState('');
  const [hasActiveOrder, setHasActiveOrder] = React.useState(false);
  const [orderCount, setOrderCount] = React.useState(null);
  const [showRegretModal, setShowRegretModal] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [banners, setBanners] = React.useState([]);
  const [bannersLoading, setBannersLoading] = React.useState(true);
  const [promoItems, setPromoItems] = React.useState([]);
  const [loadingPromos, setLoadingPromos] = React.useState(false);
  
  // States for Address Selector
  const [showAddressSelector, setShowAddressSelector] = React.useState(false);
  const [showProfileAddressSelector, setShowProfileAddressSelector] = React.useState(false);
  
  const [addressData, setAddressData] = React.useState({
    address: user?.direccion || '',
    lat: user?.lat || null,
    lng: user?.lng || null,
    reference: ''
  });

  const [unavailableLocal, setUnavailableLocal] = React.useState(null);
  const [selectedLocal, setSelectedLocal] = React.useState(null);

  // Actualizar addressData cuando el usuario carga (login)
  React.useEffect(() => {
    if (user && !addressData.address) {
      setAddressData(prev => ({
        ...prev,
        address: user.direccion || '',
        lat: user.lat || null,
        lng: user.lng || null
      }));
    }
  }, [user]);

  // Session ID for demand tracking
  const sessionId = React.useMemo(() => {
    let sid = sessionStorage.getItem('weep_demand_session');
    if (!sid) {
      sid = 'SESS-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      sessionStorage.setItem('weep_demand_session', sid);
    }
    return sid;
  }, []);

  const searchTimeout = React.useRef(null);
  
  const isClosedToday = React.useCallback((local) => {
    if (!local) return false;
    const config = local.config_horarios || {};
    const daysMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const currentDayName = daysMap[new Date().getDay()];
    
    // Si tiene la nueva configuración, verificamos si ese día está "cerrado"
    if (config[currentDayName]) {
      return config[currentDayName].tipo === 'cerrado';
    }

    // Fallback a lógica vieja si no hay config_horarios
    if (local.modo_automatico && local.dias_apertura && Array.isArray(local.dias_apertura)) {
      const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const normalizedDays = local.dias_apertura.map(normalize);
      const normalizedCurrentDay = normalize(currentDayName);
      return !normalizedDays.includes(normalizedCurrentDay);
    }
    return false;
  }, []);

  const isLocalOpen = React.useCallback((local) => {
    if (!local) return false;

    // Red de seguridad: si es un item de menú (tiene local_id) pero no tiene config_horarios,
    // intentar buscar el local completo en la lista de locales cargados.
    const localId = local.local_id || local.id;
    const realLocal = (locals.find(l => l.id === localId)) || local;
    
    // Mapeo de compatibilidad para items que vienen de api.getPromos() u otros joins
    const localToPass = {
      ...realLocal,
      disponible_desde: realLocal.disponible_desde || realLocal.local_disponible_desde
    };

    // 1. Verificar si ya pasó la fecha de disponibilidad
    if (localToPass.disponible_desde) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parts = localToPass.disponible_desde.split('-');
      const availableDate = new Date(parts[0], parts[1] - 1, parts[2]);
      if (today < availableDate) return false;
    }

    // 2. Usar utilidad flexible (que ya maneja modo_automatico, estado manual y fallback)
    return isLocalOpenFlexible(localToPass);
  }, [locals]);

  // Load locals + drinks on mount
  React.useEffect(() => {
    // La limpieza de inactividad ahora es manejada por el CRON de la BD.

    // Tracking: Page View
    api.trackDemandSignal('page_view', sessionId).catch(() => {});

    // [Resto del código existente]
    api.getLocales().then(d => setLocals(d || [])).catch(() => {});
    api.getBebidas().then(d => setDrinks(d || [])).catch(() => {});
    api.getBanners().then(d => {
      const filtered = (d || []).filter(b => !b.ciudad || b.ciudad === 'Todas' || b.ciudad === 'Santo Tomé');
      setBanners(filtered);
    }).catch(() => {}).finally(() => setBannersLoading(false));
    
    // Cargar promociones
    setLoadingPromos(true);
    api.getPromos().then(d => setPromoItems(d || [])).catch(() => {}).finally(() => setLoadingPromos(false));

    // Verificar repartidores al cargar
    api.checkActiveRepartidores().then(r => setHasRepartidores(r.hasActive)).catch(() => {});
    if (user) {
      api.getFavoritos(user.id).then(d => {
        if (Array.isArray(d)) setFavorites(d);
      }).catch(() => {});
      
      // Verificar si hay pedidos activos
      api.getMisPedidos(user.id).then(res => {
        if (res.enCurso && res.enCurso.length > 0) {
          setHasActiveOrder(true);
        } else {
          setHasActiveOrder(false);
        }
      }).catch(() => {});

      // Obtener el conteo total de pedidos del usuario
      api.getUserOrderCount(user.id).then(c => {
        setOrderCount(c);
      }).catch(() => {});
    } else {
      setOrderCount(null);
    }
  }, [user]);
  
  // Forzar cambio a retiro si no hay repartidores y está seleccionado envio
  React.useEffect(() => {
    if (hasRepartidores === false && cart.deliveryType === 'envio') {
      // Intentar obtener el local del primer item del carrito si selectedLocal es null
      const localRef = selectedLocal || (cart.items.length > 0 ? locals.find(l => l.id === cart.items[0].local_id) : null);
      const puedeRetirar = localRef?.acepta_retiro === true;
      if (puedeRetirar) {
        cart.setDeliveryType('retiro');
      }
    }
  }, [hasRepartidores, cart.deliveryType, selectedLocal, cart, locals]);

  // MP Return URL Parse
  React.useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const status = query.get('status');
    const payment_id = query.get('payment_id');
    const preference_id = query.get('preference_id');

    if (status && payment_id) {
      if (!user) return; // Guard for async auth restoration
      const pendingRaw = localStorage.getItem('pendingOrderData');
      if (pendingRaw) {
        try {
          const pendingData = JSON.parse(pendingRaw);
          if (status === 'approved') {
            toast.success(`¡Pago confirmado! Tu pedido #${pendingData.pedidoId} está siendo procesado.`);
            
            // Actualizar estado del pedido en la base de datos
            api.markOrderAsPaid(
              pendingData.pedidoId, 
              payment_id, 
              preference_id, 
              pendingData.externalReference
            ).then(async (res) => {
              if (res.success && user?.id) {
                // Si el pedido tiene un repartidor asignado, notificarlo
                try {
                  const orderRes = await api.getOrderDetail(user.id, pendingData.pedidoId);
                  if (orderRes.success && orderRes.detalle.repartidor_id) {
                    await api.notifyDriverAboutPaymentApproved(
                      pendingData.pedidoId, 
                      orderRes.detalle.repartidor_id
                    );
                  }
                } catch (err) {
                  console.error("Error al notificar al repartidor:", err);
                }
              }
            }).catch(e => console.error("Error al marcar pedido como pagado:", e));
            
            // Facebook Pixel: Purchase
            if (window.fbq) {
              window.fbq('track', 'Purchase', {
                value: pendingData.total,
                currency: 'ARS',
                content_ids: [pendingData.pedidoId],
                content_type: 'product_group'
              });
            }

            // Google Analytics: purchase
            if (window.gtag) {
              window.gtag('event', 'purchase', {
                transaction_id: pendingData.pedidoId,
                value: pendingData.total,
                currency: 'ARS',
                items: pendingData.cart.map(i => ({
                  item_id: i.id,
                  item_name: i.nombre,
                  quantity: i.qty,
                  price: i.price || i.precio
                }))
              });
            }

            // Notificar a los locales sobre el nuevo pedido pagado
            api.notifyLocalsAboutNewOrder(
              pendingData.pedidoId, pendingData.cart,
              pendingData.direccion, pendingData.tipoEntrega,
              pendingData.observaciones, pendingData.metodoPago
            ).catch(e => console.error("Error notificando locales (MP Success):", e));

            cart.clearCart();
          } else if (status === 'pending') {
            toast.error('El pago está pendiente de aprobación');
          } else {
            toast.error('El pago no fue aprobado');
          }
        } catch(e) { console.error('Error parsing pending order data', e); }
        finally {
          localStorage.removeItem('pendingOrderData');
        }
      }
      
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [cart, user]);

  // Refrescar repartidores cada vez que el carrito se abre
  React.useEffect(() => {
    if (cartOpen) {
      api.checkActiveRepartidores().then(r => setHasRepartidores(r.hasActive)).catch(() => {});
    }
  }, [cartOpen]);

  // Search
  React.useEffect(() => {
    clearTimeout(searchTimeout.current);
    if (search.length >= 3) {
      searchTimeout.current = setTimeout(() => {
        setLoadingMenus(true);
        api.buscarMenu(search).then(d => {
          setMenus(d || []);
          setMenuTitle(`Resultados para "${search}"`);
          setShowMenus(true);
        }).catch(() => toast.error('Error en búsqueda')).finally(() => setLoadingMenus(false));
      }, 500);
    } else if (search === '') {
      setShowMenus(false);
    }
  }, [search]);

  const fetchMenusByLocal = React.useCallback((localId, catId = null) => {
    setLoadingMenus(true);
    const local = (filteredLocals || locals).find(l => l.id === localId) || locals.find(l => l.id === localId);
    setSelectedLocal(local);

    // Tracking: Local View
    api.trackDemandSignal('local_view', sessionId).catch(() => {});
    
    // Auto-select delivery type if only one is available
    if (local) {
      if (local.acepta_envio === false && cart.deliveryType === 'envio') {
        if (local.acepta_retiro === true) cart.setDeliveryType('retiro');
      } else if (local.acepta_retiro !== true && cart.deliveryType === 'retiro') {
        if (local.acepta_envio !== false) cart.setDeliveryType('envio');
      }
    }

    api.getMenuByLocalId(localId).then(d => {
      let mapped = (d || [])
        .filter(i => i.disponibilidad !== false)
        .map(i => ({
          ...i, 
          local_nombre: local?.nombre || 'Local', 
          local_logo: local?.logo || '',
          local_disponible_desde: local?.disponible_desde || null,
        }));
      if (catId) {
        mapped = mapped.filter(i => (i.categoria || '').toLowerCase() === catId.toLowerCase());
      }
      setMenus(mapped);
      setMenuTitle(catId ? `${catId} en ${local?.nombre || 'Local'}` : `Menú de ${local?.nombre || 'Local'}`);
      setShowMenus(true);
    }).catch(() => toast.error('No pudimos cargar el menú')).finally(() => setLoadingMenus(false));
  }, [locals, filteredLocals]);

  const fetchByCategory = React.useCallback((cat) => {
    api.trackDemandSignal('category_view', sessionId).catch(() => {});
    if (cat === 'favoritos') {
      if (!user) { setModal('login'); return; }
      setLoadingMenus(true);
      api.getMenuCompleto().then(all => {
        const favMenus = all.filter(m => favorites.includes(m.id));
        setMenus(favMenus);
        setMenuTitle('Mis Favoritos');
        setShowMenus(true);
      }).catch(() => toast.error('Error al cargar favoritos')).finally(() => setLoadingMenus(false));
      return;
    }
    
    setLoadingLocals(true);
    api.getLocalesByCategoria(cat).then(d => {
      const mapped = (d || []).map(l => ({
        id: l.local_id,
        nombre: l.nombre_local,
        logo: l.logo_url,
        estado: l.estado,
        precio_min: l.precio_min_categoria || 0,
        horario_apertura: l.horario_apertura,
        horario_cierre: l.horario_cierre,
        horario_apertura2: l.horario_apertura2,
        horario_cierre2: l.horario_cierre2,
        modo_automatico: l.modo_automatico,
        dias_apertura: l.dias_apertura,
        disponible_desde: l.disponible_desde,
        config_horarios: l.config_horarios || {},
        rubro: l.rubro
      }));
      setFilteredLocals(mapped);
      setSelectedCategory(cat);
      setShowMenus(false);
      setTimeout(() => {
        document.querySelector('.locals-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }).catch(() => toast.error('Error al cargar locales')).finally(() => setLoadingLocals(false));
  }, [user, favorites]);

  const toggleFav = React.useCallback(async (menuId) => {
    if (!user) { setModal('login'); return; }
    try {
      const r = await api.toggleFavorito(user.id, menuId);
      if (r.added) {
        setFavorites(prev => [...prev, menuId]);
        toast.success('♥ Agregado a favoritos');
      } else {
        setFavorites(prev => prev.filter(id => id !== menuId));
        toast.success('Quitado de favoritos');
      }
    } catch { toast.error('Error'); }
  }, [user, favorites]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setAuthLoading(true);
    try {
      const d = await api.loginUsuario(fd.get('email').toLowerCase(), fd.get('password'));
      if (d.success) {
        loginAsUser({ 
          userId: d.userId, 
          name: d.nombre, 
          email: d.email || fd.get('email'), 
          address: d.direccion, 
          telefono: d.telefono, 
          emailConfirmado: d.emailConfirmado 
        });
        setModal(null);
        toast.success('¡Bienvenido!');
      } else toast.error('Credenciales incorrectas');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
  };

  const handleResendConfirmation = async () => {
    if (!user?.email) return;
    const loading = toast.loading('Reenviando email...');
    try {
      const res = await api.reenviarEmailConfirmacion(user.email, 'usuario');
      if (res.success) toast.success('¡Email reenviado! Revisa tu bandeja de entrada.', { id: loading });
      else toast.error(res.error || 'Error al reenviar', { id: loading });
    } catch { toast.error('Error de conexión', { id: loading }); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = fd.get('email').toLowerCase();
    const nombre = fd.get('nombre');
    const password = fd.get('password');
    const direccion = fd.get('direccion');
    const prefix = fd.get('prefix');
    const localNumber = fd.get('telefono');
    const telefono = `${prefix}${localNumber}`;

    if (!isValidEmail(email)) { toast.error('Ingresá un email válido'); return; }
    if (password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
    if (!localNumber) { toast.error('El teléfono es obligatorio'); return; }
    
    setAuthLoading(true);
    try {
      const d = await api.registerUsuario(
        nombre, email, password, direccion, telefono,
        fd.get('terms_accepted') === 'on' || !!fd.get('terms_accepted'),
        fd.get('terms_accepted') === 'on' || !!fd.get('terms_accepted')
      );
      if (d.success) {
        loginAsUser({ 
          userId: d.userId, 
          name: nombre, 
          email: email, 
          address: direccion,
          telefono: telefono
        });
        setModal(null);
        toast.success('¡Registro exitoso!');
      } else toast.error('Error al registrar');
    } catch (err) { toast.error(err.message || 'Error de conexión'); }
    setAuthLoading(false);
  };

  const handleEditProfile = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nombre = fd.get('nombre');
    const email = fd.get('email');
    const prefix = fd.get('prefix');
    const localNumber = fd.get('telefono');
    const telefono = `${prefix}${localNumber}`;
    const newPass = fd.get('newPassword');

    if (!nombre || !email || !localNumber) { toast.error('Nombre, email y teléfono son obligatorios'); return; }
    if (!isValidEmail(email)) { toast.error('Ingresá un email válido'); return; }
    if (newPass && newPass.length < 6) { toast.error('La nueva contraseña debe tener 6+ caracteres'); return; }
    
    setAuthLoading(true);
    try {
      await api.updateProfile(user.id, nombre, email, telefono, newPass || null);
      // Update local state
      loginAsUser({ userId: user.id, name: nombre, email, address: user.address, telefono });
      toast.success('Perfil actualizado');
      setModal('profile');
    } catch { toast.error('Error al actualizar perfil'); }
    setAuthLoading(false);
  };

  // --- Business Logic for Totals ---
  const MP_FEE_RATE = 0.0824;

  const calculateCheckoutTotals = (P, E, method) => {
    const net_commission = P * localCommission;
    const net_local = P - net_commission;
    const total_net = P + E;

    if (method === 'transferencia') {
      const marketplace_fee = E + net_commission;

      return {
        total: Math.round(total_net),
        product_total: P,
        delivery_fee: E,
        commission: Math.round(net_commission),
        mp_fee: 0,
        merchant_payout: Math.round(total_net - marketplace_fee),
        platform_gross: Math.round(marketplace_fee),
        platform_net: Math.round(E + net_commission)
      };
    }

    // Default (Efectivo)
    return {
      total: Math.round(P + E),
      product_total: P,
      delivery_fee: E,
      commission: Math.round(net_commission),
      mp_fee: 0,
      merchant_payout: Math.round(net_local),
      platform_gross: 0,
      platform_net: Math.round(net_commission + E)
    };
  };

  const checkoutTotals = calculateCheckoutTotals(cart.subtotal, cart.shippingCost, metodoPago);
  const totalConComision = checkoutTotals.total;
  const mpFeeUI = checkoutTotals.mp_fee;

  const calculateDiscountedPrice = React.useCallback((item) => {
    if (!item) return 0;
    let price = Number(item.precio);
    
    // 1. Item Discount (%) - Takes precedence
    if (item.descuento > 0) {
      price = price * (1 - Number(item.descuento) / 100);
    } else {
      // 2. General Local Discount (Percentage)
      const discountDays = item.local_dias_descuento || item.dias_descuento || [];
      const generalDiscount = Number(item.local_descuento_general || item.descuento_general || 0);
      const categoryDiscount = item.local_categoria_descuento || item.categoria_descuento || '';
      
      if (generalDiscount > 0 && discountDays.length > 0) {
        const today = new Date().toLocaleString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
        const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const todayNorm = normalize(today);
        
        const isCorrectDay = discountDays.some(d => normalize(d) === todayNorm);
        const isCorrectCategory = !categoryDiscount || categoryDiscount === item.categoria;

        if (isCorrectDay && isCorrectCategory) {
          price = price * (1 - generalDiscount / 100);
        }
      }
    }
    
    return Math.round(price);
  }, []);

  // UI-only disguise for "envio"

  // When shipping is $2,000, we show it as $1,700 and add the $300 to the fee label.
  const showSurchargeDisguise = false;
  const visibleShipping = showSurchargeDisguise ? 1500 : cart.shippingCost;
  const visibleMpFee = showSurchargeDisguise ? (mpFeeUI + 300) : mpFeeUI;

  const handleAddToCart = async (menu) => {
    // Red de seguridad: Verificar disponibilidad antes de cualquier acción
    const availabilityDate = menu.local_disponible_desde;
    if (availabilityDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parts = availabilityDate.split('-');
      const availableDate = new Date(parts[0], parts[1] - 1, parts[2]);
      if (today < availableDate) {
        toast.error(`Este local abrirá el ${availableDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' })}`);
        return;
      }
    }

    // Verificar si el local está abierto
    const localRef = (selectedLocal && selectedLocal.id === menu.local_id) 
      ? selectedLocal 
      : (locals.find(l => l.id === menu.local_id) || menu);

    if (!isLocalOpen(localRef)) {
      toast.error('Este local está cerrado por el momento');
      return;
    }

    // Detect category and configuration
    let cfg = null;
    try {
      if (typeof menu.variantes === 'string') cfg = JSON.parse(menu.variantes);
      else if (typeof menu.variantes === 'object') cfg = menu.variantes;
    } catch (e) {}

    const isIceCream = cfg?.es_helado;
    const isBurgerOrCombo = cfg?.es_hamburguesa || cfg?.es_combo || cfg?.es_pancho || cfg?.con_papas;

    if (isIceCream) {
      setSelectedSize('1/4kg');
      setSelectedFlavors([]);
      setSelectedSauces([]);
      setSelectedExtras([]);
      try {
        const [flavors, extras] = await Promise.all([
          api.getSaboresByLocal(menu.local_id),
          api.getAdicionalesByLocal(menu.local_id)
        ]);
        
        const filteredFlavors = flavors.filter(f => f.disponible && (f.tipo === 'Sabor' || f.tipo === 'sabor'));
        const filteredSauces = flavors.filter(f => f.disponible && (f.tipo === 'Salsa' || f.tipo === 'salsa'));
        
        setIceCreamFlavors(filteredFlavors);
        setIceCreamSauces(filteredSauces);
        setIceCreamExtras(extras.filter(e => e.disponible));
        
        // Inyectamos las salsas directamente en el objeto del modal para mayor seguridad
        setIceCreamModal({
          ...menu,
          salsasDisponibles: filteredSauces
        });
        return; 
      } catch {
        toast.error('Error al cargar opciones de helado');
      }
    }

    if (isBurgerOrCombo) {
      setBurgerModal(menu);
      setSelectedVariant(cfg.variants?.find(v => v.disponible !== false) || null);
      setSelectedBurgerExtras([]);
      setWithFries(false);
      return; 
    }

    // Facebook Pixel: AddToCart
    if (window.fbq) {
      window.fbq('track', 'AddToCart', {
        content_name: menu.nombre,
        content_ids: [menu.id],
        content_type: 'product',
        value: menu.precio,
        currency: 'ARS'
      });
    }

    // Google Analytics: add_to_cart
    if (window.gtag) {
      window.gtag('event', 'add_to_cart', {
        currency: 'ARS',
        value: menu.precio,
        items: [{
          item_id: menu.id,
          item_name: menu.nombre,
          price: menu.precio,
          quantity: 1
        }]
      });
    }

    // Tracking: Add to Cart
    api.trackDemandSignal('add_to_cart', sessionId).catch(() => {});

    // Default addition for other items
    const discountedPrice = calculateDiscountedPrice(menu);
    const itemToAdd = {
      ...menu,
      precio: discountedPrice,
      precioOriginal: menu.precioOriginal || menu.precio
    };
    cart.addItem(itemToAdd);
    toast((t) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        ¡{menu.nombre} agregado! ✓
        <button onClick={() => { openCart(); toast.dismiss(t.id); }} style={{ background: 'var(--red-500)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
          Ver carrito
        </button>
      </span>
    ), { duration: 3000, style: { padding: '12px 16px' } });
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!user) { setModal('login'); return; }
    if (cart.items.length === 0) { toast.error('Tu carrito está vacío'); return; }
    const fd = new FormData(e.target);
    const mp = metodoPago; // Use state instead of FormData
    const dir = addressData.address;
    if (cart.deliveryType === 'envio' && !dir) { toast.error('Ingresá tu dirección de entrega'); return; }

    // Validación de dirección correcta (no solo el nombre de la ciudad)
    if (cart.deliveryType === 'envio') {
      const lowerAddr = dir.toLowerCase();
      const cityStrings = [
        'santo tomé, corrientes', 
        'santo tomé', 
        'santo tome, corrientes', 
        'santo tome',
        'santo tomé, corrientes province',
        'santo tome, corrientes province',
        'santo tomé, provincia de corrientes',
        'santo tome, provincia de corrientes'
      ];
      const isJustCity = cityStrings.some(s => lowerAddr.startsWith(s)) && lowerAddr.length < 60;

      if (isJustCity) {
        toast.error('Dirección no encontrada, por favor indica tu dirección con el marcador');
        setShowAddressSelector(true);
        return;
      }
    }

    if (!mp) { toast.error('Seleccioná un método de pago'); return; }
    
    // Facebook Pixel: InitiateCheckout
    if (window.fbq) {
      window.fbq('track', 'InitiateCheckout');
    }

    // Google Analytics: begin_checkout
    if (window.gtag) {
      window.gtag('event', 'begin_checkout', {
        currency: 'ARS',
        value: cart.subtotal,
        items: cart.items.map(i => ({
          item_id: i.id,
          item_name: i.nombre,
          price: i.precio,
          quantity: i.qty
        }))
      });
    }

    const currentLocal = selectedLocal || (cart.items.length > 0 ? locals.find(l => l.id === cart.items[0].local_id) : null);

    // Validación estricta de horario de comercio cerrado antes de iniciar confirmación
    if (currentLocal && !isLocalOpen(currentLocal)) {
      toast.error(`El local "${currentLocal.nombre || 'seleccionado'}" se encuentra cerrado en este momento y no está aceptando pedidos.`);
      return;
    }

    // Check repartidores active strictly before proceeding if envio is selected
    if (cart.deliveryType === 'envio') {
      const freshRiders = await api.checkActiveRepartidores();
      if (!freshRiders.hasActive) {
        setHasRepartidores(false);
        const puedeRetirar = currentLocal?.acepta_retiro === true;
        if (puedeRetirar) {
          cart.setDeliveryType('retiro');
        }
        return;
      }
    }

    if (cart.deliveryType === 'retiro' && currentLocal?.acepta_retiro !== true) {
      toast.error('Este local no ofrece la opción de retiro en el local.');
      return;
    }

    // Validación de primer pedido por transferencia
    if (mp === 'efectivo' && (orderCount === 0 || orderCount === null)) {
      // Si es null, por seguridad asumimos que es el primero si ya logramos obtener user e intentamos cargar orderCount
      toast.error('Por seguridad, tu primer pedido debe ser por transferencia / Mercado Pago.');
      setMetodoPago('transferencia');
      return;
    }

    setCheckoutLoading(true);
    try {
      // --- NUEVA VALIDACIÓN DE DISPONIBILIDAD EN TIEMPO REAL ---
      const uniqueLocalIds = [...new Set(cart.items.map(i => i.local_id).filter(Boolean))];
      const uniqueItemIds = [...new Set(cart.items.map(i => i.menuId || i.id))];

      const availability = await api.validateOrderAvailability(uniqueLocalIds, uniqueItemIds);

      // 1. Validar Locales
      for (const localId of uniqueLocalIds) {
        const freshLocal = availability.locales.find(l => l.id === localId);
        if (!freshLocal) {
          toast.error("Uno de los locales ya no está disponible.");
          setCheckoutLoading(false);
          return;
        }
        if (!isLocalOpen(freshLocal)) {
          toast.error(`El local "${freshLocal.nombre}" acaba de cerrar o no está aceptando pedidos en este momento.`);
          setCheckoutLoading(false);
          return;
        }
      }

      // 2. Validar Platos
      for (const item of cart.items) {
        const freshItem = availability.items.find(i => i.id === (item.menuId || item.id));
        if (!freshItem || !freshItem.disponibilidad) {
          toast.error(`El plato "${item.nombre}" ya no está disponible.`);
          setCheckoutLoading(false);
          return;
        }
      }
      // --- FIN VALIDACIÓN ---

      // 7. Calculate exact prices using new logic
      const calcSubtotal = cart.items.reduce((sum, i) => sum + (Number(i.precio) * i.qty), 0);
      const tieneBebida = cart.items.some(i => i.categoria?.toLowerCase() === 'bebidas');
      // [PAUSED] Lógica de envío gratis con bebida desactivada temporalmente.
      // const shipping = (cart.deliveryType === 'envio' && !tieneBebida) ? 1800 : 0;
      const shipping = cart.deliveryType === 'envio' ? cart.COSTO_ENVIO : 0;
      
      const finalTotals = calculateCheckoutTotals(calcSubtotal, shipping, mp);
      const exactTotal = finalTotals.total;

      const orderItems = cart.items.map(i => ({
        id: i.menuId || i.id, // Use original menu item ID for database
        nombre: i.descripcion ? `${i.nombre} (${i.descripcion})` : i.nombre,
        precio: Number(i.precio),
        cantidad: i.qty, local_id: i.local_id || '',
      }));

      // Rama Efectivo
      if (mp === 'efectivo') {
        const response = await api.crearPedido({
          userId: user.id,
          direccion: cart.deliveryType === 'envio' ? dir : 'Retiro en local',
          tipoEntrega: cart.deliveryType === 'envio' ? 'Con Envío' : 'Para Retirar',
          metodoPago: mp, observaciones: (fd.get('observaciones') || '') + (addressData.reference ? ` | Ref: ${addressData.reference}` : ''),
          items: orderItems,
          emailCliente: user.email, nombreCliente: user.name,
          estadoInicial: (cart.deliveryType === 'envio') ? 'Buscando Repartidor' : 'Confirmado',
          totalCalculado: exactTotal,
          lat: addressData.lat,
          lng: addressData.lng,
          precioEnvio: shipping
        });

        toast.success(`¡Pedido #${response.pedidoId} registrado exitosamente!`);
        
        // Facebook Pixel: Purchase (Cash)
        if (window.fbq) {
          window.fbq('track', 'Purchase', {
            value: exactTotal,
            currency: 'ARS',
            content_ids: [response.pedidoId],
            content_type: 'product_group'
          });
        }

        // Google Analytics: purchase (Cash)
        if (window.gtag) {
          window.gtag('event', 'purchase', {
            transaction_id: response.pedidoId,
            value: exactTotal,
            currency: 'ARS',
            items: cart.items.map(i => ({
              item_id: i.id,
              item_name: i.nombre,
              quantity: i.qty,
              price: i.precio
            }))
          });
        }

        api.notifyLocalsAboutNewOrder(
          response.pedidoId, cart.items, 
          cart.deliveryType === 'envio' ? dir : 'Retiro en local', 
          cart.deliveryType === 'envio' ? 'Con Envío' : 'Para Retirar', 
          fd.get('observaciones') || '', mp
        ).catch(e => console.error(e));

        // El correo de confirmación al cliente ahora se envía cuando el local acepta el pedido (en RestaurantDashboard)
        /*
        api.notifyCustomerAboutNewOrder(
          response.pedidoId, cart.items,
          cart.deliveryType === 'envio' ? dir : 'Retiro en local', 
          cart.deliveryType === 'envio' ? 'Con Envío' : 'Para Retirar', 
          response.numConfirmacion, user.email, user.name
        ).catch(e => console.error(e));
        */

        cart.clearCart();
        setCartOpen(false);
        e.target.reset();
      } 
      // Rama Transferencia / MP
      else if (mp === 'transferencia') {
        const pregeneratedId = 'ORD-' + Math.random().toString(36).substring(2, 12).toUpperCase();
        
        const orderInfo = {
          direccion: cart.deliveryType === 'envio' ? dir : 'Retiro en local',
          tipoEntrega: cart.deliveryType === 'envio' ? 'Con Envío' : 'Para Retirar',
          metodoPago: mp, observaciones: (fd.get('observaciones') || '') + (addressData.reference ? ` | Ref: ${addressData.reference}` : ''),
          emailCliente: user.email, nombreCliente: user.name,
          totalCalculado: exactTotal,
          lat: addressData.lat,
          lng: addressData.lng,
          precioEnvio: shipping
        };

        await api.crearPedidoTemporal({
          pedidoId: pregeneratedId,
          userId: user.id,
          cart: orderItems,
          orderInfo: orderInfo
        });

        // Registrar evento PEDIDO_NO_PAGADO en el CRM (se marcará pagado cuando vuelva de MP)
        api.adminLogCRMEvent(user.id, 'PEDIDO_NO_PAGADO', { order_id: pregeneratedId, total: exactTotal }).catch(e => console.error(e));

        const loadingToast = toast.loading('Redirigiendo a Mercado Pago...');
        try {
          const extRef = pregeneratedId; 
          const successUrl = "https://wepi.com.ar/pedir";
          
          const paymentData = {
            external_reference: extRef,
            back_urls: { success: successUrl, failure: successUrl, pending: successUrl },
            auto_return: "approved",
            items: [{
              title: `Pedido Wepi #${pregeneratedId}`,
              quantity: 1,
              currency_id: "ARS",
              unit_price: Number(exactTotal)
            }],
            local_id: cart.items[0]?.local_id,
            marketplace_fee: finalTotals.platform_gross
          };

          const paymentResponse = await iniciarPagoMercadoPago(paymentData);

          if (paymentResponse?.init_point) {
            toast.dismiss(loadingToast);
            const pendingData = {
              pedidoId: pregeneratedId,
              userId: user.id,
              fecha: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
              direccion: orderInfo.direccion,
              metodoPago: 'Transferencia / Mercado Pago',
              observaciones: orderInfo.observaciones,
              envioGratis: shipping === 0,
              tipoEntrega: orderInfo.tipoEntrega,
              cart: cart.items,
              total: exactTotal,
              preferenceId: paymentResponse.id,
              externalReference: extRef,
              emailCliente: user.email,
              nombreCliente: user.name
            };
            localStorage.setItem('pendingOrderData', JSON.stringify(pendingData));
            
            window.location.href = paymentResponse.init_point;
            return;
          } else {
            throw new Error(paymentResponse?.error || 'No se pudo generar el link de pago');
          }
        } catch (err) {
          toast.dismiss(loadingToast);
          
          let errorMsg = err.message;
          if (errorMsg.includes('non-2xx status code')) {
             errorMsg = 'El local no tiene configurado Mercado Pago o hubo un problema de conexión.';
          }
          
          toast.error('No pudimos iniciar el pago: ' + errorMsg);
        }
      }
    } catch (err) { 
      toast.error('Error al realizar el pedido: ' + err.message); 
      console.error("DETALLE ERROR CHECKOUT:", err);
    }
    setCheckoutLoading(false);
  };

  // Check repartidores when cart opens
  const openCart = async () => {
    try {
      const r = await api.checkActiveRepartidores();
      console.log("DEBUG: checkActiveRepartidores result:", r);
      setHasRepartidores(r.hasActive);
      if (!r.hasActive) {
        console.log("DEBUG: No drivers found");
      }
    } catch (err) { 
      console.error("DEBUG: Error in openCart check:", err);
    }
    setCartOpen(true);
  };

  const categories = [
    { type: 'Hamburguesas', label: 'Burguers', img: 'https://i.postimg.cc/VLtZ23Km/descarga-(1)-(8).jpg' },
    { type: 'Helados', label: 'Helados', img: 'https://i.postimg.cc/VLPKFCY9/buscamos-repartidores-(18).png' },
    { type: 'Pizzas', label: 'Pizzas', img: 'https://i.postimg.cc/cJkcvmFw/descarga-(1)-(10).jpg' },
    { type: 'Empanadas', label: 'Empanadas', img: 'https://i.postimg.cc/KYjPhTmk/descarga-(1)-(11).jpg' },
    { type: 'Panchos', label: 'Panchos', img: 'https://i.postimg.cc/XqcCXxZr/buscamos-repartidores-(30).png' },
    { type: 'Cafetería', label: 'Cafetería', img: 'https://i.postimg.cc/HnYWFwgm/descarga-(1)-(13).jpg' },
    { type: 'Combos', label: 'Combos', img: 'https://i.postimg.cc/1X1wQDX5/buscamos-repartidores-(19).png' },
    { type: 'Bebidas', label: 'Bebidas', img: 'https://i.postimg.cc/KvhCcGkT/descarga-(1)-(14).jpg' },
    { type: 'favoritos', label: 'Mis favoritos', img: 'https://i.postimg.cc/RCktgLyZ/buscamos-repartidores-(7).png' },
  ];

  // Show drinks carousel when no drink in cart and delivery is envio
  const showDrinks = cart.items.length > 0 && cart.deliveryType === 'envio' && !cart.hasDrink && drinks.length > 0;

  return (
    <div className="customer-app">
      <header className="app-header">
        <Link to="/" className="app-logo-link">
          <img src="https://i.postimg.cc/Y0Ln7qb3/Digitalizacion-y-logistica-para-Santo-Tome-(1).png" alt="Wepi" className="app-logo" />
        </Link>
        <div className="search-wrapper">
          <img src="https://i.postimg.cc/TPXmybcH/18611-(1)-(2).png" alt="Buscar" className="search-icon" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          <input type="text" placeholder="Buscar menús o locales..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
        </div>
        <div className="header-actions">
          <button className="profile-btn" onClick={() => user ? setModal('profile') : setModal('login')}>
            <img src="https://i.postimg.cc/1RWxRcKM/18611-(1)-(1).png" alt="Perfil" className="profile-avatar-img" />
            <span className="hide-mobile">{user ? 'Mi Perfil' : 'Ingresar'}</span>
          </button>
          <button className="cart-btn" onClick={openCart}>
            <img src="https://i.postimg.cc/QCcjwFRf/18611-(1).png" alt="Carrito" className="cart-icon-img" />
            {cart.totalItems > 0 && <span className="cart-badge">{cart.totalItems}</span>}
          </button>
        </div>
      </header>

      {!hasRepartidores && (
          <div className="no-drivers-alert animate-fade-in" style={{
            backgroundColor: '#fffbeb',
            borderBottom: '1px solid #fef3c7',
            padding: '10px 20px',
            textAlign: 'center',
            color: '#92400e',
            fontSize: '0.85rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <span>⚠️</span> No hay repartidores disponibles en este momento, vuelve intentar en unos minutos. Solo retiro en local disponible.
          </div>
        )}

      <main className="app-main">
        <div className="banners-container" style={{ marginBottom: '20px' }}>
          {user && hasActiveOrder && (
            <div className="active-order-banner" style={{
              background: '#ff9800',
              color: 'white',
              padding: '12px 20px',
              textAlign: 'center',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              borderBottom: '2px solid #e68a00',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(255,152,0,0.3)',
              fontWeight: '600',
              zIndex: 90
            }}>
              <span>🛵 ¡Tienes un pedido en proceso!</span>
              <button 
                onClick={() => navigate('/mis-pedidos')} 
                style={{
                  background: 'white',
                  color: '#ff9800',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                Ver Mis Pedidos
              </button>
            </div>
          )}
        </div>
        
        {/* ─── Banners Carousel ─── */}
        {!bannersLoading && banners.length > 0 && (
          <div className="banners-carousel-wrapper animate-fade-in">
            <div className="banners-carousel">
              {banners.map(b => (
                <div 
                  key={b.id} 
                  className={`banner-slide ${b.link ? 'clickable' : ''}`}
                  onClick={() => b.link && window.open(b.link, '_blank')}
                >
                  <img 
                    src={b.imagen_url} 
                    alt="Promo" 
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="app-greeting-container">
          {user && !user.telefono && (
            <div className="missing-phone-banner">
              <div className="missing-phone-content">
                <span className="missing-phone-icon">📞</span>
                <div>
                  <p style={{ margin: 0 }}>¡Completá tu cuenta!</p>
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Agregá tu teléfono para que el repartidor pueda contactarte.</span>
                </div>
              </div>
              <button className="btn btn-sm" onClick={() => setModal('editProfile')}>
                Agregar ahora
              </button>
            </div>
          )}
          <h1 className="app-greeting animate-fade-in">¿Qué se te antoja?</h1>
        </div>

        {/* ─── Promotions (Horizontal Scroll) ─── */}
        {!showMenus && !filteredLocals && promoItems.length > 0 && (
          <section className="promos-section animate-slide-up" style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '1.2rem' }}>🔥</span>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', background: 'linear-gradient(90deg, var(--red-600), #ff4d4d)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                ¡DESCUENTOS IMPERDIBLES!
              </h2>
            </div>
            <div className="promos-scroll" style={{ display: 'flex', gap: '16px', overflowX: 'auto', padding: '4px 4px 16px 4px', scrollSnapType: 'x mandatory' }}>
              {promoItems.map((item, i) => {
                const discPrice = calculateDiscountedPrice(item);
                const percent = Math.round((1 - discPrice / Number(item.precio)) * 100);
                const localRef = locals.find(l => l.id === item.local_id);
                const open = isLocalOpen(localRef);

                return (
                  <div 
                    key={item.id} 
                    className={`promo-item-card ${!open ? 'closed' : ''}`}
                    onClick={() => open && handleAddToCart(item)}
                  >
                    <div className="promo-img-container">
                      <img 
                        src={item.imagen_url || 'https://placehold.co/240x140?text=Promo'} 
                        alt={item.nombre} 
                        className="promo-item-img"
                      />
                      <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'var(--red-600)', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '800', boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)' }}>
                        {percent}% OFF
                      </div>
                      {!open && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          CERRADO
                        </div>
                      )}
                    </div>
                    <div className="promo-content">
                      <div className="promo-local-info">
                        {item.local_logo && <img src={item.local_logo} alt="" className="promo-local-logo" />}
                        <span className="promo-local-name">{item.local_nombre}</span>
                      </div>
                      <h3 className="promo-item-title">
                        {item.nombre}
                      </h3>
                      <div className="promo-price-container" style={{ marginBottom: '8px' }}>
                        <span className="promo-price-new">${discPrice.toLocaleString('es-AR')}</span>
                        <span className="promo-price-old">${Number(item.precio).toLocaleString('es-AR')}</span>
                      </div>
                      <div className="promo-schedule" style={{ fontSize: '0.65rem', fontWeight: '600', color: open ? 'var(--green-600)' : 'var(--red-500)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{open ? '🟢' : '🔴'}</span>
                        {open ? (
                          `Solo hasta las ${localRef?.horario_cierre?.substring(0, 5) || '--:--'} hs`
                        ) : (
                          `Disponible desde ${localRef?.horario_apertura?.substring(0, 5) || '--:--'} hs`
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── Categories ─── */}
        <div className="categories-scroll animate-slide-up">
          {categories.map(cat => (
            <button key={cat.type} className="category-card" onClick={() => fetchByCategory(cat.type)}>
              <img src={cat.img} alt={cat.label} />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>



        {/* ─── Locals Carousel ─── */}
        <section className="locals-section animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2>{filteredLocals ? `Locales con ${selectedCategory}` : 'Sugerencias de Locales'}</h2>
            {filteredLocals && (
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => { 
                  setFilteredLocals(null); 
                  setSelectedCategory(null); 
                  setSelectedLocal(null);
                }}
                style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}
              >
                ✕ Ver todos
              </button>
            )}
          </div>
          <div className="locals-scroll">
            {loadingLocals && <p className="empty-text">Buscando locales...</p>}
            {!loadingLocals && !filteredLocals && locals.length === 0 && (
              <div className="empty-locals-striking animate-fade-in">
                <div className="empty-icon">🛵</div>
                <p>No hay locales activos en este momento</p>
                <span>¡Volvé pronto para pedir tu antojo!</span>
              </div>
            )}
            {!loadingLocals && filteredLocals && filteredLocals.length === 0 && (
              <div className="empty-locals-striking animate-fade-in">
                <div className="empty-icon">🍳</div>
                <p>No hay {selectedCategory} hoy</p>
                <span>Probá con otra categoría o buscá más abajo</span>
              </div>
            )}
             {!loadingLocals && (filteredLocals || locals).map(local => {
               const open = isLocalOpen(local);
               const isYPF = local.disponible_desde === '2030-12-31';
               
               // Verificar si es una apertura futura
               let isFutureOpening = false;
               let availabilityMsg = "";
               if (local.disponible_desde) {
                 const today = new Date();
                 today.setHours(0, 0, 0, 0);
                 const parts = local.disponible_desde.split('-');
                 const availableDate = new Date(parts[0], parts[1] - 1, parts[2]);
                 if (today < availableDate) {
                   isFutureOpening = true;
                   availabilityMsg = `Disponible desde ${availableDate.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`;
                 }
               }

               if (filteredLocals) {
                 return (
                   <button
                     key={local.id}
                     className={`suggestion-categoria ${open ? 'open' : 'closed'} ${(isFutureOpening || isYPF) ? 'future-opening' : ''}`}
                     onClick={() => {
                       if (isFutureOpening || isYPF) {
                         setUnavailableLocal(local);
                       } else {
                         setUnavailableLocal(null);
                       }
                       fetchMenusByLocal(local.id, selectedCategory);
                     }}
                     style={{ 
                       flex: '0 0 auto', 
                       border: 'none',
                       filter: (isFutureOpening || isYPF) ? 'none' : '',
                       opacity: (isFutureOpening || isYPF) ? 1 : ''
                     }}
                   >
                     <img
                       src={local.logo || `https://placehold.co/120x120?text=${encodeURIComponent(local.nombre)}`}
                       alt={local.nombre}
                       onError={(e) => { e.target.src = 'https://placehold.co/120x120?text=Local'; }}
                       style={(isFutureOpening || isYPF) ? { filter: 'none', opacity: 1 } : {}}
                     />
                     <div className="suggestion-info">
                       <div className="local-name">{local.nombre}</div>
                       {isYPF ? (
                         <div className="availability-badge" style={{ color: 'var(--amber-600)', fontSize: '0.7rem', fontWeight: 'bold' }}>
                           PRÓXIMAMENTE
                         </div>
                       ) : isFutureOpening ? (
                         <div className="availability-badge" style={{ color: 'var(--red-600)', fontSize: '0.7rem', fontWeight: 'bold' }}>
                           {availabilityMsg}
                         </div>
                       ) : isClosedToday(local) ? (
                         <div className="availability-badge" style={{ color: 'var(--red-600)', fontSize: '0.7rem', fontWeight: 'bold' }}>
                           Cerrado hoy
                         </div>
                       ) : !open ? (
                         <div className="availability-badge" style={{ color: 'var(--red-600)', fontSize: '0.7rem', fontWeight: 'bold' }}>
                           CERRADO
                         </div>
                       ) : (
                         <div className="categoria-precio">
                           <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                             <span className="cat">{selectedCategory}</span>
                           </div>
                           <span className="precio-min">desde ${Number(local.precio_min || 0).toLocaleString('es-AR')}</span>
                         </div>
                       )}
                     </div>
                     {open && <span className="open-dot" style={{ position: 'absolute', top: 5, right: 5, width: 12, height: 12, borderWidth: 2 }} />}
                   </button>
                 );
               }

               return (
                 <button
                   key={local.id}
                   className={`local-circle ${open ? 'open' : 'closed'} ${(isFutureOpening || isYPF) ? 'future-opening' : ''}`}
                   onClick={() => {
                     if (isFutureOpening || isYPF) {
                       setUnavailableLocal(local);
                     } else {
                       setUnavailableLocal(null);
                     }
                     fetchMenusByLocal(local.id, selectedCategory);
                   }}
                   title={isYPF ? 'PRÓXIMAMENTE' : isFutureOpening ? availabilityMsg : local.nombre}
                   style={(isFutureOpening || isYPF) ? { filter: 'none', opacity: 1 } : {}}
                 >
                   <img
                     src={local.logo || `https://placehold.co/200x200?text=${encodeURIComponent(local.nombre)}`}
                     alt={local.nombre}
                     onError={(e) => { e.target.src = 'https://placehold.co/200x200?text=Local'; }}
                     style={(isFutureOpening || isYPF) ? { filter: 'none', opacity: 1 } : {}}
                   />
                   {open && <span className="open-dot" />}
                   {isYPF ? (
                     <div className="future-badge" style={{
                       position: 'absolute',
                       bottom: -10,
                       background: 'var(--amber-600)',
                       color: 'white',
                       fontSize: '0.6rem',
                       padding: '2px 6px',
                       borderRadius: '10px',
                       whiteSpace: 'nowrap',
                       border: '1px solid white'
                     }}>
                       PRÓXIMAMENTE
                     </div>
                   ) : open && local.modo_automatico && local.horario_cierre && (
                     <div className="future-badge" style={{
                       position: 'absolute',
                       bottom: -10,
                       background: 'var(--green-600)',
                       color: 'white',
                       fontSize: '0.6rem',
                       padding: '2px 6px',
                       borderRadius: '10px',
                       whiteSpace: 'nowrap',
                       border: '1px solid white'
                     }}>
                       Cierra {local.horario_cierre.substring(0, 5)} hs
                     </div>
                   )}
                   {isFutureOpening && !isYPF && (
                     <div className="future-badge" style={{
                       position: 'absolute',
                       bottom: -10,
                       background: 'black',
                       color: 'white',
                       fontSize: '0.6rem',
                       padding: '2px 6px',
                       borderRadius: '10px',
                       whiteSpace: 'nowrap',
                       border: '1px solid white'
                     }}>
                       Abre {new Date(local.disponible_desde.split('-')[0], local.disponible_desde.split('-')[1]-1, local.disponible_desde.split('-')[2]).toLocaleDateString('es-AR', {day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires'})}
                     </div>
                   )}
                   {isClosedToday(local) && !isFutureOpening && !isYPF && (
                     <div className="future-badge" style={{
                       position: 'absolute',
                       bottom: -10,
                       background: 'black',
                       color: 'white',
                       fontSize: '0.6rem',
                       padding: '2px 6px',
                       borderRadius: '10px',
                       whiteSpace: 'nowrap',
                       border: '1px solid white'
                     }}>
                       Cerrado hoy
                     </div>
                   )}
                   {!open && !isClosedToday(local) && !isFutureOpening && !isYPF && local.modo_automatico && local.horario_apertura && (
                     <div className="future-badge" style={{
                       position: 'absolute',
                       bottom: -10,
                       background: 'black',
                       color: 'white',
                       fontSize: '0.6rem',
                       padding: '2px 6px',
                       borderRadius: '10px',
                       whiteSpace: 'nowrap',
                       border: '1px solid white'
                     }}>
                       Abre a las {local.horario_apertura.substring(0, 5)} hs
                     </div>
                   )}
                 </button>
               );
            })}
          </div>

          {unavailableLocal && (
            <div className="unavailable-local-info animate-fade-in" style={{
              marginTop: '16px',
              padding: '12px 20px',
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: '12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ fontSize: '1.2rem' }}>📅</span>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--red-600)' }}>
                <strong>{unavailableLocal.nombre}</strong> estará disponible próximamente.
              </p>
              <button 
                className="btn btn-ghost btn-xs" 
                onClick={() => setUnavailableLocal(null)}
                style={{ fontSize: '0.75rem', marginTop: '4px' }}
              >
                Cerrar aviso
              </button>
            </div>
          )}
        </section>

        {/* ─── Menu Display ─── */}
        {showMenus && (
          <section className="menu-section animate-fade-in">
            <div className="menu-header">
              <h2>{menuTitle}</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedCategory && menus.length > 0 && menus[0].local_id && (
                  <button className="btn btn-secondary btn-sm" onClick={() => fetchMenusByLocal(menus[0].local_id)}>
                    Ver menú completo
                  </button>
                )}
                 <button className="back-btn" onClick={() => { setShowMenus(false); setSelectedLocal(null); }}>← Volver</button>
              </div>
            </div>
            {loadingMenus ? (
              <div className="loading-state"><div className="spinner" /> Cargando...</div>
            ) : menus.length === 0 ? (
              <p className="empty-text" style={{ padding: '40px' }}>No se encontraron platos.</p>
            ) : (
              <div className="menu-list">
                {menus.map((menu, i) => (
                  <div 
                    key={menu.id || i} 
                    className="menu-card card card-hover" 
                    style={{ animationDelay: `${i * 0.05}s`, cursor: 'pointer' }}
                    onClick={() => handleAddToCart(menu)}
                  >
                    <div className="menu-card-img-container">
                      <img
                        src={menu.imagen_url || 'https://placehold.co/120x120?text=Sin+Imagen'}
                        alt={menu.nombre}
                        className="menu-card-img"
                        onError={(e) => { e.target.src = 'https://placehold.co/120x120?text=Sin+Imagen'; }}
                      />
                      {(() => {
                        const discountedPrice = calculateDiscountedPrice(menu);
                        if (discountedPrice < Number(menu.precio)) {
                          const percent = Math.round((1 - discountedPrice / Number(menu.precio)) * 100);
                          return <div className="menu-discount-badge">{percent}% OFF</div>;
                        }
                        return null;
                      })()}
                    </div>
                    <div className="menu-card-body">
                      <div className="menu-card-local">
                        {menu.local_logo && <img src={menu.local_logo} alt="" className="menu-local-logo" />}
                        <span>{menu.local_nombre || 'Local'}</span>
                      </div>
                      <h3>{menu.nombre}</h3>
                      <p>{menu.descripcion || ''}</p>
                      <div className="menu-card-footer">
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {(() => {
                            const discountedPrice = calculateDiscountedPrice(menu);
                            const hasDiscount = discountedPrice < Number(menu.precio);
                            return (
                              <>
                                {hasDiscount && (
                                  <span style={{ fontSize: '0.75rem', textDecoration: 'line-through', color: 'var(--gray-400)' }}>
                                    ${Number(menu.precio).toLocaleString('es-AR')}
                                  </span>
                                )}
                                <span className="menu-card-price" style={{ color: hasDiscount ? 'var(--red-600)' : 'inherit' }}>
                                  ${discountedPrice.toLocaleString('es-AR')}
                                </span>
                              </>
                            );
                          })()}
                        </div>

                        <div className="menu-card-actions">
                          {(() => {
                            const availabilityDate = (selectedLocal?.disponible_desde) || (menu.local_disponible_desde);
                            if (availabilityDate) {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const parts = availabilityDate.split('-');
                              const availableDate = new Date(parts[0], parts[1] - 1, parts[2]);
                              if (today < availableDate) {
                                return (
                                  <span style={{ fontSize: '0.85rem', color: 'var(--primary-600)', fontWeight: '600' }}>
                                    Disponible el {availableDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' })}
                                  </span>
                                );
                              }
                            }
                            
                            const localRef = selectedLocal || locals.find(l => l.id === menu.local_id) || menu;
                            const currentlyOpen = isLocalOpen(localRef);
                            
                            if (!currentlyOpen) {
                              if (localRef?.modo_automatico && localRef?.horario_apertura) {
                                return (
                                  <span style={{ fontSize: '0.85rem', color: 'var(--gray-500)', fontWeight: '600' }}>
                                    Abre a las {localRef.horario_apertura.substring(0, 5)} hs
                                  </span>
                                );
                              }
                              return (
                                <span style={{ fontSize: '0.85rem', color: 'var(--gray-500)', fontWeight: '600' }}>
                                  Local cerrado
                                </span>
                              );
                            }

                            const itemCfg = typeof menu.variantes === 'string' ? JSON.parse(menu.variantes || '{}') : (menu.variantes || {});
                            const needsCustomization = itemCfg.es_helado || itemCfg.es_hamburguesa || itemCfg.es_combo || itemCfg.con_papas;

                            return (
                              <button 
                                className="btn btn-primary btn-sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToCart(menu);
                                }}
                              >
                                {needsCustomization ? 'Elegir' : 'Agregar'}
                              </button>
                            );
                          })()}

                          <button 
                            className={`fav-btn ${favorites.includes(menu.id) ? 'active' : ''}`} 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFav(menu.id);
                            }}
                          >
                            <img 
                              src={favorites.includes(menu.id) 
                                ? "https://i.postimg.cc/BZYZmSz1/Instagram-Heart-Png-Love-Heart-Transparent-Png(1000x1000)-Png-Find.png" 
                                : "https://i.postimg.cc/W4Gb8MRV/Instagram-Heart-Png-Love-Heart-Transparent-Png(1000x1000)-Png-Find-(1).png"}
                              alt="Favorito" 
                              style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
      {/* ─── Cart Sidebar ─── */}
      <div className={`cart-backdrop ${cartOpen ? 'active' : ''}`} onClick={() => setCartOpen(false)} />
      <aside className={`cart-sidebar ${cartOpen ? 'active' : ''}`}>
        <div className="cart-header-bar">
          <h2>Tu Carrito</h2>
          <button className="cart-close-btn" onClick={() => setCartOpen(false)}>✕</button>
        </div>
        <div className="cart-body-content">
          {!hasRepartidores && (
            <div 
              className="no-drivers-cart-top-notice animate-fade-in" 
              style={{
                background: '#fffbeb',
                color: '#92400e',
                fontSize: '0.9rem',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '20px',
                fontWeight: '700',
                border: '2px solid #fef3c7',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.1)'
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🚫</div>
              No hay repartidores disponibles en este momento.
              <p style={{ fontWeight: '400', fontSize: '0.8rem', marginTop: '4px', opacity: 0.9 }}>
                Vuelve a intentar en unos minutos para envíos a domicilio.
              </p>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Tipo de entrega</label>
            <select 
              className="form-select" 
              value={cart.deliveryType} 
              onChange={e => {
                const val = e.target.value;
                cart.setDeliveryType(val);

                if (val === 'envio') {
                  api.checkActiveRepartidores().then(fresh => {
                    setHasRepartidores(fresh.hasActive);
                    if (!fresh.hasActive) {
                      // Si al final no había, revertimos a retiro (si se permite)
                      const currentLocal = selectedLocal || (cart.items.length > 0 ? locals.find(l => l.id === cart.items[0].local_id) : null);
                      if (currentLocal?.acepta_retiro === true) {
                        cart.setDeliveryType('retiro');
                      }
                    }
                  }).catch(() => {});
                }
              }}
              style={{ 
                borderColor: !hasRepartidores ? 'var(--amber-400)' : '',
                backgroundColor: !hasRepartidores ? '#fff9f0' : ''
              }}
            >
              {(() => {
                const currentLocal = selectedLocal || (cart.items.length > 0 ? locals.find(l => l.id === cart.items[0].local_id) : null);
                return (
                  <>
                    {(currentLocal?.acepta_envio !== false) && (
                      <option 
                        value="envio" 
                        disabled={!hasRepartidores}
                        style={{ color: !hasRepartidores ? '#999' : 'inherit' }}
                      >
                        {hasRepartidores ? 'Con envío a domicilio' : '🛵 Con envío (sin repartidores disponibles)'}
                      </option>
                    )}
                    {(currentLocal?.acepta_retiro === true) && (
                      <option value="retiro">🥡 Retirar en local</option>
                    )}
                  </>
                );
              })()}
            </select>
          </div>

          {cart.items.length === 0 ? (
            <div className="cart-empty">
              <img src="https://i.postimg.cc/QCcjwFRf/18611-(1).png" alt="Carrito Vacío" style={{ width: '64px', height: '64px', margin: '0 auto 16px', opacity: 0.8 }} />
              <p>Tu carrito está vacío</p>
              <button className="btn btn-secondary btn-sm" onClick={() => setCartOpen(false)}>Seguir comprando</button>
            </div>
          ) : (
            <>
              {cart.items.map(item => (
                <div key={item.id} className="cart-item-row">
                  <div className="cart-item-info">
                    <span className="cart-item-name">{item.nombre}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {item.precioOriginal > item.precio && (
                        <span style={{ fontSize: '0.75rem', textDecoration: 'line-through', color: 'var(--gray-400)' }}>
                          ${(Number(item.precioOriginal) * item.qty).toLocaleString('es-AR')}
                        </span>
                      )}
                      <span className="cart-item-price" style={{ color: item.precioOriginal > item.precio ? 'var(--red-600)' : 'inherit' }}>
                        ${(Number(item.precio) * item.qty).toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>

                  <div className="cart-item-controls">
                    <button className="qty-btn" onClick={() => cart.updateQty(item.id, -1)}>−</button>
                    <span className="qty-display">{item.qty}</span>
                    <button className="qty-btn" onClick={() => cart.updateQty(item.id, 1)}>+</button>
                    <button className="remove-btn-small" onClick={() => cart.removeItem(item.id)}>🗑</button>
                  </div>
                </div>
              ))}

              <div className="payment-method-selector" style={{ marginTop: '20px', marginBottom: '10px' }}>
                <label className="form-label">Seleccionar método de pago</label>
                <select 
                  className="form-select" 
                  value={metodoPago} 
                  onChange={e => setMetodoPago(e.target.value)}
                  style={{ marginBottom: '5px' }}
                >
                  <option value="" disabled>Elegí cómo pagar</option>
                  <option value="transferencia">Transferencia / Mercado Pago</option>
                  <option 
                    value="efectivo" 
                    disabled={orderCount === 0 || orderCount === null}
                    style={{ color: (orderCount === 0 || orderCount === null) ? '#999' : 'inherit' }}
                  >
                    { (orderCount === 0 || orderCount === null) ? 'Efectivo (Inhabilitado 1er pedido)' : 'Efectivo' }
                  </option>
                </select>
                {(orderCount === 0 || orderCount === null) && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--red-500)', marginTop: '4px', fontStyle: 'italic' }}>
                    * Por seguridad, tu primer pedido debe ser con Transferencia.
                  </p>
                )}
              </div>

              <div className="cart-summary">
                <div className="cart-line">
                  <span>{cart.deliveryType === 'retiro' ? 'Subtotal valor pedido' : 'Subtotal'}</span>
                  <span>${cart.subtotal.toLocaleString('es-AR')}</span>
                </div>
                {cart.deliveryType !== 'retiro' && (
                  <div className="cart-line">
                    <span>
                      Envío
                      {cart.incentivoActivo > 0 && (
                        <span style={{ color: 'var(--red-500)', fontWeight: 600, marginLeft: 8, fontSize: '0.75rem' }}>
                          ⚡ Dinámica
                        </span>
                      )}
                    </span>
                    <span>{visibleShipping === 0 ? '¡GRATIS!' : `$${visibleShipping.toLocaleString('es-AR')}`}</span>
                  </div>
                )}
                {visibleMpFee > 0 && (
                  <div className="cart-line comision-line">
                    <span>Gestión de pago</span>
                    <span>+${visibleMpFee.toLocaleString('es-AR')}</span>
                  </div>
                )}
                <div className="cart-line total-line">
                  <span>Total</span>
                  <span>${totalConComision.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              <form onSubmit={handleCheckout} className="checkout-form">
                {cart.deliveryType === 'envio' && (
                  <div className="address-selector-input-group" style={{ marginBottom: '16px', position: 'relative' }}>
                    <label className="form-label" style={{ display: 'block', textAlign: 'left', marginBottom: '8px' }}>
                      Dirección de entrega
                    </label>
                    <div 
                      className="input-with-icon" 
                      onClick={() => setShowAddressSelector(true)}
                      style={{ cursor: 'pointer', position: 'relative' }}
                    >
                      <input 
                        type="text"
                        className="form-input"
                        placeholder="📍 Seleccioná tu dirección en el mapa..."
                        value={addressData.address || ''}
                        readOnly
                        style={{ paddingLeft: '40px', cursor: 'pointer', backgroundColor: '#fff', border: '1px solid #ddd' }}
                      />
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem' }}>
                        📍
                      </span>
                    </div>
                    {addressData.address && (
                      <button 
                        type="button" 
                        className="btn-text" 
                        style={{ display: 'block', margin: '4px 0', fontSize: '0.8rem', color: 'var(--red-500)', fontWeight: 'bold' }}
                        onClick={() => setShowAddressSelector(true)}
                      >
                        (Cambiar ubicación)
                      </button>
                    )}
                    {addressData.reference && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '4px', textAlign: 'left' }}>
                        Ref: {addressData.reference}
                      </p>
                    )}
                  </div>
                )}
                {/* Observaciones removidas por solicitud */}
                <input type="hidden" name="observaciones" value="" />
                <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={checkoutLoading}>
                  {checkoutLoading ? <span className="spinner spinner-white" /> : 'Realizar Pedido'}
                </button>
              </form>
            </>
          )}
        </div>
      </aside>

      {/* ─── Modals ─── */}
      {modal && (
        <div className="modal-overlay" onClick={() => { setModal(null); setShowPassword(false); }}>
          <div className="modal-box animate-fade-in" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setModal(null); setShowPassword(false); }}>✕</button>

            {modal === 'login' && (
              <form onSubmit={handleLogin}>
                <h2>Iniciar Sesión</h2>
                <input name="email" type="email" className="form-input" placeholder="Email" required autoComplete="username" />
                <div className="password-container">
                  <input 
                    name="password" 
                    type={showPassword ? "text" : "password"} 
                    className="form-input" 
                    placeholder="Contraseña" 
                    required 
                    autoComplete="current-password" 
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                    <img 
                      src={showPassword ? "https://i.postimg.cc/mrfJz5P3/buscamos-repartidores-(8).png" : "https://i.postimg.cc/Zq8grxNr/buscamos-repartidores-(9).png"} 
                      alt="Ver" 
                    />
                  </button>
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Entrar'}
                </button>
                <p className="modal-switch">¿No tenés cuenta? <button type="button" onClick={() => { setModal('register'); setShowPassword(false); }}>Registrate</button></p>
              </form>
            )}

            {modal === 'register' && (
              <form onSubmit={handleRegister}>
                <h2>Registro</h2>
                <input name="email" type="email" className="form-input" placeholder="Email" required autoComplete="username" />
                <input name="nombre" className="form-input" placeholder="Nombre completo" required autoComplete="name" />
                <div className="password-container">
                  <input 
                    name="password" 
                    type={showPassword ? "text" : "password"} 
                    className="form-input" 
                    placeholder="Contraseña (6+ caracteres)" 
                    required 
                    autoComplete="new-password" 
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                    <img 
                      src={showPassword ? "https://i.postimg.cc/mrfJz5P3/buscamos-repartidores-(8).png" : "https://i.postimg.cc/Zq8grxNr/buscamos-repartidores-(9).png"} 
                      alt="Ver" 
                    />
                  </button>
                </div>
                <input name="direccion" className="form-input" placeholder="Dirección (opcional)" autoComplete="street-address" />
                <div className="phone-input-group">
                  <select name="prefix" className="phone-prefix-select">
                    <option value="+549">🇦🇷 +549</option>
                    <option value="+55">🇧🇷 +55</option>
                  </select>
                  <input name="telefono" type="tel" className="form-input phone-number-input" placeholder="Número (ej: 1123456789)" required autoComplete="tel-national" />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '16px', textAlign: 'left' }}>
                  <input type="checkbox" id="terms_accepted" name="terms_accepted" required style={{ width: 'auto', marginTop: '4px' }} />
                  <label htmlFor="terms_accepted" style={{ fontSize: '0.85rem', color: 'var(--gray-600)', lineHeight: '1.4' }}>
                    Acepto los <button type="button" style={{ background: 'none', border: 'none', color: 'var(--red-500)', padding: 0, textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }} onClick={() => setModal('terms')}>Términos y Condiciones y Política de Privacidad</button> para Usuarios.
                  </label>
                </div>

                <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Registrarme'}
                </button>
                <p className="modal-switch">¿Ya tenés cuenta? <button type="button" onClick={() => { setModal('login'); setShowPassword(false); }}>Iniciar sesión</button></p>
              </form>
            )}

            {modal === 'profile' && user && (
              <div>
                <h2>Mi Perfil</h2>
                <div className="profile-info">
                  <p><strong>Nombre:</strong> {user.name}</p>
                  <p><strong>Email:</strong> {user.email}</p>
                  <p><strong>Teléfono:</strong> {user.telefono || 'No configurado'}</p>
                  <p><strong>Dirección:</strong> {user.address || 'No configurada'}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                  <button className="btn btn-primary btn-full" onClick={() => setModal('editProfile')}>✏️ Editar perfil</button>
                  <button className="btn btn-secondary btn-full" onClick={() => setModal('editAddress')}>📍 Cambiar dirección</button>
                  <button className="btn btn-secondary btn-full" onClick={() => navigate('/mis-pedidos')}>📦 Mis Pedidos</button>
                  <button className="btn btn-secondary btn-full" onClick={() => setModal('configuracion')}>⚙️ Configuración</button>
                  <button className="btn btn-ghost btn-full" onClick={() => { doLogout(); setModal(null); toast.success('Sesión cerrada'); }}>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}

            {modal === 'configuracion' && user && (
              <div>
                <h2>Configuración</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0', padding: '16px', background: '#262626', borderRadius: '12px' }}>
                  <span style={{ color: 'white', fontSize: '14px' }}>Notificaciones para el dispositivo</span>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                    <input 
                      type="checkbox" 
                      style={{ opacity: 0, width: 0, height: 0 }}
                      checked={!!user.onesignal_id}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          try {
                            const { PushNotifications } = await import('@capacitor/push-notifications');
                            const { Capacitor } = await import('@capacitor/core');
                            if (!Capacitor.isNativePlatform()) {
                               toast.error("Notificaciones solo disponibles en celular nativo");
                               return;
                            }
                            let permStatus = await PushNotifications.checkPermissions();
                            if (permStatus.receive === 'prompt') {
                               permStatus = await PushNotifications.requestPermissions();
                            }
                            if (permStatus.receive !== 'granted') {
                               toast.error("Permisos denegados. Actívalos en Ajustes del teléfono.");
                               return;
                            }
                            await PushNotifications.register();
                            toast.loading("Activando notificaciones...", { id: 'push-toast' });
                            // The actual saving is done by PushNotificationManager which listens to 'registration'
                            // Let's manually trigger a reload of the user after 3 seconds to see if it saved
                            setTimeout(() => {
                              window.location.reload();
                            }, 3000);
                          } catch (err) {
                            toast.error("Error al activar: " + err.message);
                          }
                        } else {
                           toast.loading("Desactivando...", { id: 'push-toast' });
                           import('../services/api').then(api => {
                             api.usuarioUpdateOneSignalId(user.id, null).then(() => {
                               toast.success("Notificaciones desactivadas", { id: 'push-toast' });
                               setTimeout(() => window.location.reload(), 1000);
                             });
                           });
                        }
                      }} 
                    />
                    <span className="slider round" style={{ 
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                      backgroundColor: user.onesignal_id ? '#e63946' : '#ccc', 
                      transition: '.4s', borderRadius: '24px' 
                    }}>
                      <span style={{
                        position: 'absolute', content: '""', height: '18px', width: '18px', 
                        left: user.onesignal_id ? '22px' : '3px', bottom: '3px', 
                        backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
                      }}></span>
                    </span>
                  </label>
                </div>
                <button className="btn btn-ghost btn-full" onClick={() => setModal('profile')}>Volver</button>
              </div>
            )}

            {modal === 'editProfile' && user && (
              <form onSubmit={handleEditProfile}>
                <h2>Editar Perfil</h2>
                <label className="form-label">Nombre completo</label>
                <input name="nombre" className="form-input" defaultValue={user.name} required />
                <label className="form-label">Email</label>
                <input name="email" type="email" className="form-input" defaultValue={user.email} required />
                <label className="form-label">Teléfono</label>
                <div className="phone-input-group">
                  <select name="prefix" className="phone-prefix-select" defaultValue={user.telefono?.startsWith('+55') ? '+55' : '+549'}>
                    <option value="+549">🇦🇷 +549</option>
                    <option value="+55">🇧🇷 +55</option>
                  </select>
                  <input 
                    name="telefono" 
                    type="tel" 
                    className="form-input phone-number-input" 
                    defaultValue={user.telefono ? user.telefono.replace(/^\+549|^\+54|^\+55/, '') : ''} 
                    placeholder="Número (ej: 1123456789)" 
                    required 
                  />
                </div>
                <label className="form-label">Nueva contraseña (opcional)</label>
                <input name="newPassword" type="password" className="form-input" placeholder="Dejar en blanco si no deseas cambiarla" />
                <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Guardar cambios'}
                </button>
              </form>
            )}

            {modal === 'editAddress' && (
              <div>
                <h2>Cambiar Mi Dirección</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)', marginBottom: '16px' }}>
                  Seleccioná tu ubicación predeterminada en el mapa para futuras compras.
                </p>
                <button 
                  className="btn btn-primary btn-full" 
                  onClick={() => setShowProfileAddressSelector(true)}
                >
                  📍 Abrir Mapa de Dirección
                </button>
                <p style={{ marginTop: '12px', fontSize: '0.85rem' }}>
                  <strong>Actual:</strong> {user?.address || 'No configurada'}
                </p>
              </div>
            )}
            {modal === 'terms' && (
              <div>
                <h2>Términos y Condiciones y Política de Privacidad</h2>
                <div style={{ fontSize: '0.88rem', color: 'var(--gray-600)', lineHeight: 1.5, maxHeight: '350px', overflowY: 'auto', paddingRight: '10px', textAlign: 'left' }}>
                  <h3 style={{ color: 'var(--red-600)', marginTop: 0 }}>📄 1. USUARIOS – TÉRMINOS Y CONDICIONES</h3>
                  <p><strong>1. Naturaleza del servicio</strong></p>
                  <p>Wepi es una plataforma que Intermedia entre usuarios y comercios, facilita la gestión de pedidos y coordina la logística de entrega. Wepi no elabora ni comercializa productos.</p>
                  <p><strong>2. Relación contractual</strong></p>
                  <p>El usuario acepta que la compra es con el comercio, la entrega es realizada por repartidores independientes, y Wepi no es parte directa de dichas relaciones.</p>
                  <p><strong>3. Productos</strong></p>
                  <p>Los comercios son los únicos responsables de Calidad, Ingredientes, Higiene y Estado. Wepi no garantiza los productos.</p>
                  <p><strong>4. Entregas</strong></p>
                  <p>Wepi coordina entregas mediante repartidores independientes. El usuario acepta que los tiempos son estimados, pueden existir demoras y existen riesgos inherentes a la logística.</p>
                  <p><strong>5. Limitación de responsabilidad</strong></p>
                  <p>Wepi no será responsable por intoxicaciones, problemas de salud, daños derivados del producto, demoras razonables o fallas de terceros.</p>
                  <p><strong>6. Pagos</strong></p>
                  <p>Los pagos se procesan mediante Mercado Pago. Wepi no es entidad financiera, no fija precios y puede aplicar comisiones.</p>
                  <p><strong>7. Cancelaciones</strong></p>
                  <p>Dependen del comercio y estado del pedido.</p>
                  <p><strong>8. Indemnidad</strong></p>
                  <p>El usuario mantiene indemne a Wepi ante reclamos derivados del uso.</p>
                  <p><strong>9. Aceptación</strong></p>
                  <p>Mediante registro y confirmación electrónica.</p>
                  <hr style={{ margin: '15px 0', borderColor: '#eee' }} />
                  <h3 style={{ color: 'var(--red-600)' }}>🔒 USUARIOS – POLÍTICA DE PRIVACIDAD</h3>
                  <p><strong>Datos recolectados:</strong></p>
                  <ul style={{ paddingLeft: '18px', marginBottom: '10px' }}>
                    <li>Nombre, teléfono, email</li>
                    <li>Dirección</li>
                    <li>Ubicación en tiempo real</li>
                    <li>Historial de pedidos</li>
                  </ul>
                  <p><strong>Uso de datos:</strong></p>
                  <ul style={{ paddingLeft: '18px', marginBottom: '10px' }}>
                    <li>Procesar pedidos</li>
                    <li>Coordinar entregas</li>
                    <li>Asignar repartidores</li>
                  </ul>
                  <p><strong>Compartición:</strong></p>
                  <ul style={{ paddingLeft: '18px', marginBottom: '10px' }}>
                    <li>Comercios</li>
                    <li>Repartidores</li>
                    <li>Proveedores de pago (Mercado Pago)</li>
                  </ul>
                </div>
                <button className="btn btn-secondary btn-full" onClick={() => setModal('register')} style={{ marginTop: 16 }}>Volver al Registro</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Ice Cream Modal ─── */}
      {iceCreamModal && (
        <div className="modal-overlay" onClick={() => setIceCreamModal(null)}>
          <div className="modal-box animate-scale-in" style={{ maxWidth: 500, padding: '24px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIceCreamModal(null)}>✕</button>
            <h2 style={{ color: 'var(--red-600)', marginBottom: 8, fontSize: '1.5rem' }}>{iceCreamModal.nombre}</h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--gray-500)', marginBottom: 20 }}>{iceCreamModal.descripcion}</p>
            
            <h3 style={{ fontSize: '1.1rem', marginBottom: 12, fontWeight: '700' }}>1. Elegí el tamaño:</h3>
            <div className="size-selector" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
              {Object.keys(JSON.parse(iceCreamModal.variantes).precios).map(size => (
                <div 
                  key={size}
                  className={`selection-card ${selectedSize === size ? 'active' : ''}`}
                  onClick={() => { setSelectedSize(size); setSelectedFlavors([]); }}
                  style={{ 
                    padding: '16px 8px', borderRadius: '12px', border: selectedSize === size ? '2px solid var(--red-500)' : '2px solid #eee',
                    backgroundColor: selectedSize === size ? '#fff5f5' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s ease',
                    boxShadow: selectedSize === size ? '0 4px 12px rgba(220, 38, 38, 0.1)' : 'none'
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', color: selectedSize === size ? 'var(--red-600)' : 'inherit' }}>{size}</div>
                  <div style={{ color: 'var(--gray-500)', fontSize: '0.8rem', marginTop: '4px' }}>
                    ${JSON.parse(iceCreamModal.variantes).precios[size].precio}
                  </div>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: '1.1rem', marginBottom: 12, fontWeight: '700' }}>
               2. Seleccioná tus sabores:
               <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', fontWeight: '400', marginTop: '2px' }}>
                Máximo {JSON.parse(iceCreamModal.variantes).precios[selectedSize].max} sabores
               </div>
            </h3>
            
            <div className="flavors-list" style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24, padding: '4px' }}>
              {iceCreamFlavors.map(flavor => {
                const isSelected = selectedFlavors.includes(flavor.nombre);
                const max = JSON.parse(iceCreamModal.variantes).precios[selectedSize].max;
                const canSelect = selectedFlavors.length < max;
                
                return (
                  <button 
                    key={flavor.id}
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                    style={{ 
                      justifyContent: 'flex-start', textAlign: 'left', minHeight: 48, borderRadius: '10px',
                      borderWidth: isSelected ? '2px' : '1px', fontSize: '0.9rem'
                    }}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedFlavors(prev => prev.filter(f => f !== flavor.nombre));
                      } else if (canSelect) {
                        setSelectedFlavors(prev => [...prev, flavor.nombre]);
                      } else {
                        toast.error(`Máximo ${max} sabores para este tamaño`);
                      }
                    }}
                  >
                    {flavor.nombre}
                    {isSelected && <span style={{ marginLeft: 'auto' }}>✓</span>}
                  </button>
                );
              })}
            </div>

            {/* Sección de Salsas Forzada */}
            {(iceCreamModal.salsasDisponibles || []).length > 0 && (
              <div style={{ background: '#fff9f0', padding: '12px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #ffe4bc' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: 10, fontWeight: '700', color: '#b45309' }}>
                  🍯 ¿Querés agregar salsas?
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(iceCreamModal.salsasDisponibles || []).map(sauce => {
                    const isSelected = selectedSauces.includes(sauce.nombre);
                    return (
                      <button 
                        key={sauce.id}
                        className={`btn btn-xs ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                        style={{ borderRadius: '20px', padding: '6px 14px', fontSize: '0.8rem' }}
                        onClick={() => {
                          if (isSelected) setSelectedSauces(prev => prev.filter(s => s !== sauce.nombre));
                          else setSelectedSauces(prev => [...prev, sauce.nombre]);
                        }}
                      >
                        {sauce.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {iceCreamExtras.length > 0 && (
              <>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 12, fontWeight: '700' }}>{iceCreamSauces.length > 0 ? '4' : '3'}. Adicionales <small style={{ fontWeight: '400', color: 'var(--gray-500)' }}>(Opcional)</small></h3>
                <div className="extras-list" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
                  {iceCreamExtras.map(extra => {
                    const selectedExtra = selectedExtras.find(e => e.id === extra.id);
                    const qty = selectedExtra ? selectedExtra.cantidad : 0;
                    
                    if (qty > 0) {
                      return (
                        <div 
                          key={extra.id}
                          className="btn btn-xs btn-primary animate-scale-in"
                          style={{ 
                            borderRadius: '20px', 
                            padding: '2px 8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: '#22c55e',
                            color: 'white',
                            borderColor: '#22c55e',
                            height: '28px',
                            userSelect: 'none'
                          }}
                        >
                          <button 
                            type="button"
                            onClick={() => {
                              setSelectedExtras(prev => {
                                const existing = prev.find(e => e.id === extra.id);
                                if (existing.cantidad === 1) {
                                  return prev.filter(e => e.id !== extra.id);
                                } else {
                                  return prev.map(e => e.id === extra.id ? { ...e, cantidad: e.cantidad - 1 } : e);
                                }
                              });
                            }}
                            style={{ 
                              background: 'rgba(255,255,255,0.2)',
                              border: 'none',
                              color: 'white',
                              borderRadius: '50%',
                              width: '18px',
                              height: '18px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 'bold',
                              padding: 0
                            }}
                          >
                            -
                          </button>
                          <span style={{ fontSize: '0.78rem' }}>{extra.nombre} x{qty} (+${Math.round(extra.precio * qty)})</span>
                          <button 
                            type="button"
                            onClick={() => {
                              setSelectedExtras(prev => 
                                prev.map(e => e.id === extra.id ? { ...e, cantidad: e.cantidad + 1 } : e)
                              );
                            }}
                            style={{ 
                              background: 'rgba(255,255,255,0.2)',
                              border: 'none',
                              color: 'white',
                              borderRadius: '50%',
                              width: '18px',
                              height: '18px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 'bold',
                              padding: 0
                            }}
                          >
                            +
                          </button>
                        </div>
                      );
                    }
                    
                    return (
                      <button 
                        key={extra.id}
                        type="button"
                        className="btn btn-xs btn-outline"
                        style={{ 
                          borderRadius: '20px', 
                          padding: '6px 14px',
                          background: '#f0fdf4',
                          color: '#166534',
                          border: '1px solid #bbf7d0'
                        }}
                        onClick={() => {
                          setSelectedExtras(prev => [...prev, { ...extra, cantidad: 1 }]);
                        }}
                      >
                        {extra.nombre} (+${Math.round(extra.precio)})
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {(() => {
              const configuration = JSON.parse(iceCreamModal.variantes);
              const basePrice = parseFloat(configuration.precios[selectedSize].precio || 0);
              const extrasPrice = selectedExtras.reduce((sum, e) => sum + parseFloat(e.precio || 0) * (e.cantidad || 1), 0);
              const rawTotal = basePrice + extrasPrice;
              const currentTotal = calculateDiscountedPrice({ ...iceCreamModal, precio: rawTotal });
              const hasDiscount = currentTotal < rawTotal;

              return (
                <button 
                  className="btn btn-primary btn-full btn-lg"
                  disabled={selectedFlavors.length === 0}
                  style={{ borderRadius: '12px', height: '56px', fontSize: '1.1rem' }}
                  onClick={() => {
                    const details = [];
                    details.push(`Sabores: ${selectedFlavors.join(', ')}`);
                    if (selectedSauces.length > 0) details.push(`Salsas: ${selectedSauces.join(', ')}`);
                    if (selectedExtras.length > 0) {
                      details.push(`Extras: ${selectedExtras.map(e => `${e.nombre}${e.cantidad > 1 ? ` (x${e.cantidad})` : ''}`).join(', ')}`);
                    }

                    const finalItem = {
                      ...iceCreamModal,
                      menuId: iceCreamModal.id,
                      id: `${iceCreamModal.id}-${selectedSize}-${Date.now()}`,
                      nombre: `${iceCreamModal.nombre} ${selectedSize}`,
                      precioOriginal: rawTotal,
                      precio: currentTotal,
                      flavors: selectedFlavors,
                      sauces: selectedSauces,
                      extras: selectedExtras,
                      descripcion: details.join(' | ')
                    };
                    cart.addItem(finalItem);
                    setIceCreamModal(null);
                    toast.success('¡Helado agregado!');
                  }}
                >
                  Agregar • {hasDiscount && <span style={{ textDecoration: 'line-through', opacity: 0.7, fontSize: '0.95rem', marginRight: '8px' }}>${rawTotal}</span>} ${currentTotal}
                </button>
              );
            })()}

          </div>
        </div>
      )}

      {burgerModal && (
        <div className="modal-overlay" onClick={() => setBurgerModal(null)}>
          <div className="modal-box animate-scale-in" style={{ maxWidth: 500, padding: '24px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setBurgerModal(null)}>✕</button>
            <h2 style={{ color: 'var(--red-600)', marginBottom: 8, fontSize: '1.5rem' }}>{burgerModal.nombre}</h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--gray-500)', marginBottom: 24 }}>{burgerModal.descripcion}</p>
            
            {(() => {
              const cfg = JSON.parse(burgerModal.variantes);
              const baseVariantPrice = Number(selectedVariant?.precio || burgerModal.precio);
              const extrasPriceTotal = selectedBurgerExtras.reduce((sum, e) => sum + Number(e.precio || 0), 0);
              const friesPrice = withFries ? Number(cfg.precio_papas || 0) : 0;
              const rawTotal = baseVariantPrice + extrasPriceTotal + friesPrice;
              const totalCalculated = calculateDiscountedPrice({ ...burgerModal, precio: rawTotal });
              const hasDiscount = totalCalculated < rawTotal;

              return (
                <>
                  {cfg.variants?.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: 12, fontWeight: '700' }}>1. Seleccioná la opción:</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        {cfg.variants.filter(v => v.disponible !== false).map((v, i) => (
                          <div 
                            key={i}
                            className={`selection-card ${selectedVariant?.nombre === v.nombre ? 'active' : ''}`}
                            onClick={() => setSelectedVariant(v)}
                            style={{ 
                              padding: '12px 6px', borderRadius: '12px', border: selectedVariant?.nombre === v.nombre ? '2px solid var(--red-500)' : '1px solid #eee',
                              backgroundColor: selectedVariant?.nombre === v.nombre ? '#fff5f5' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s ease'
                            }}
                          >
                            <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{v.nombre}</div>
                            <div style={{ color: 'var(--red-600)', fontWeight: '700', fontSize: '0.85rem', marginTop: '4px' }}>${v.precio}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {cfg.extras?.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: 12, fontWeight: '700' }}>2. Adicionales:</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {cfg.extras.map((ex, i) => {
                          const isIncluded = selectedBurgerExtras.some(e => e.nombre === ex.nombre);
                          return (
                            <button 
                              key={i}
                              className={`btn btn-xs ${isIncluded ? 'btn-primary' : 'btn-outline'}`}
                              style={{ borderRadius: '20px', padding: '6px 14px' }}
                              onClick={() => {
                                if (isIncluded) setSelectedBurgerExtras(prev => prev.filter(e => e.nombre !== ex.nombre));
                                else setSelectedBurgerExtras(prev => [...prev, ex]);
                              }}
                            >
                              {ex.nombre} (+${ex.precio})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {cfg.con_papas && (
                    <div style={{ marginBottom: 28 }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: 12, fontWeight: '700' }}>3. ¿Lo hacemos COMBO?</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div 
                          className={`selection-card ${withFries ? 'active' : ''}`}
                          onClick={() => setWithFries(true)}
                          style={{ 
                            padding: '20px 10px', borderRadius: '12px', border: withFries ? '2px solid var(--red-500)' : '1px solid #eee',
                            backgroundColor: withFries ? '#fff5f5' : '#fff', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                            boxShadow: withFries ? '0 4px 12px rgba(220, 38, 38, 0.1)' : 'none'
                          }}
                        >
                          <div style={{ fontSize: '2.5rem' }}>🍟</div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: '700', fontSize: '1rem' }}>¡Si, papas!</div>
                            <div style={{ color: 'var(--red-600)', fontWeight: '800', fontSize: '0.9rem' }}>+ ${cfg.precio_papas}</div>
                          </div>
                        </div>

                        <div 
                          className={`selection-card ${!withFries ? 'active' : ''}`}
                          onClick={() => setWithFries(false)}
                          style={{ 
                            padding: '20px 10px', borderRadius: '12px', border: !withFries ? '2px solid var(--gray-600)' : '1px solid #eee',
                            backgroundColor: !withFries ? '#f9fafb' : '#fff', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                            opacity: !withFries ? 1 : 0.7
                          }}
                        >
                          <div style={{ fontSize: '2.5rem' }}>{cfg.es_pancho ? '🌭' : '🍔'}</div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: '700', fontSize: '1rem' }}>Solo el {cfg.es_pancho ? 'pancho' : 'plato'}</div>
                            <div style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>Sin papas</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <button 
                    className="btn btn-primary btn-full btn-lg"
                    style={{ borderRadius: '12px', height: '56px', fontSize: '1.1rem' }}
                    onClick={() => {
                      const variantText = selectedVariant ? `${selectedVariant.nombre}` : '';
                      const extrasText = selectedBurgerExtras.map(e => e.nombre).join(' + ');
                      const friesText = withFries ? ' + PAPAS' : '';
                      
                      let finalName = burgerModal.nombre;
                      if (variantText) finalName += ` ${variantText}`;
                      if (extrasText) finalName += ` c/ ${extrasText}`;
                      finalName += friesText;

                      const finalItem = {
                        ...burgerModal,
                        menuId: burgerModal.id,
                        id: `${burgerModal.id}-${Date.now()}`,
                        nombre: finalName,
                        precioOriginal: rawTotal,
                        precio: totalCalculated,
                        variant: selectedVariant,
                        burgerExtras: selectedBurgerExtras,
                        withFries: withFries
                      };
                      cart.addItem(finalItem);
                      setBurgerModal(null);
                      toast.success(`¡Agregado al carrito!`);
                    }}
                  >
                    Agregar • {hasDiscount && <span style={{ textDecoration: 'line-through', opacity: 0.7, fontSize: '0.95rem', marginRight: '8px' }}>${rawTotal}</span>} ${totalCalculated}
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}



      <footer className="footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 20px' }}>
        <img src="https://i.postimg.cc/Y0Ln7qb3/Digitalizacion-y-logistica-para-Santo-Tome-(1).png" alt="Wepi" style={{ height: '80px', objectFit: 'contain' }} />
        <p>© 2026 <strong>Wepi</strong> — Plataforma de Pedidos y Delivery</p>
        <p>
          <Link to="/locales">Registrá tu local</Link> •{' '}
          <button className="footer-link" style={{ color: 'white' }} onClick={() => setModal('terms')}>Términos</button> •{' '}
          <a href="mailto:bajoneando.st@gmail.com">Soporte</a> •{' '}
          <button 
            className="footer-link" 
            style={{ color: 'white', fontWeight: 'bold' }} 
            onClick={() => setShowRegretModal(true)}
          >
            Botón de Arrepentimiento
          </button>
        </p>
      </footer>

      {/* Regret Modal */}
      {showRegretModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowRegretModal(false)}>
          <div className="modal-box animate-fade-in" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--red-600)', marginBottom: '16px' }}>Botón de Arrepentimiento</h3>
            <p style={{ marginBottom: '20px', color: 'var(--gray-600)', fontSize: '0.95rem' }}>
              ¿Deseas arrepentirte de tu registro y eliminar tu cuenta permanentemente de Wepi? <br/>
              <strong>Esta acción no se puede deshacer.</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className="btn btn-primary" 
                style={{ background: 'var(--red-600)' }} 
                disabled={deleting}
                onClick={async () => {
                  if (!user?.userId) {
                    toast.error("Debes iniciar sesión para eliminar tu cuenta.");
                    setShowRegretModal(false);
                    return;
                  }
                  setDeleting(true);
                  try {
                    await api.deleteUsuarioAccount(user.userId);
                    toast.success("Cuenta eliminada correctamente.");
                    doLogout();
                    window.location.href = "/";
                  } catch (e) {
                    toast.error("No se pudo eliminar la cuenta. Es posible que tengas pedidos activos.");
                  } finally {
                    setDeleting(false);
                    setShowRegretModal(false);
                  }
                }}
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar mi registro'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowRegretModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Address Selector Modals ─── */}
      {showAddressSelector && (
        <AddressSelector
          isLoaded={isMapLoaded}
          initialAddress={addressData.address}
          initialCoords={addressData.lat ? { lat: addressData.lat, lng: addressData.lng } : null}
          onConfirm={(data) => {
            setAddressData(data);
            setShowAddressSelector(false);
          }}
          onCancel={() => setShowAddressSelector(false)}
        />
      )}

      {showProfileAddressSelector && (
        <AddressSelector
          isLoaded={isMapLoaded}
          initialAddress={user?.direccion || ''}
          initialCoords={user?.lat ? { lat: user.lat, lng: user.lng } : null}
          onConfirm={async (data) => {
            try {
              await api.updateDireccion(user.id, data.address, data.lat, data.lng);
              updateUserAddress(data.address);
              // Podríamos necesitar recargar el usuario localmente o actualizar el context
              toast.success('Dirección de perfil actualizada');
              setShowProfileAddressSelector(false);
              setModal('profile');
            } catch (e) {
              toast.error('Error al actualizar perfil');
            }
          }}
          onCancel={() => setShowProfileAddressSelector(false)}
        />
      )}

      {/* Chatbot de Ayuda */}
      <HelpChatbot />
    </div>
  );
}
