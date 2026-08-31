import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useJsApiLoader } from '@react-google-maps/api';
import AddressSelector from '../components/AddressSelector';
import * as api from '../services/api';
import { isValidEmail } from '../utils/validation';
import toast from 'react-hot-toast';
import './PruebaDashboard.css';

const GOOGLE_MAPS_LIBRARIES = ['places'];

// V2.2 - Reset Modals Cache Fix
const getLevelName = (lvl) => {
  if (lvl === 1) return 'Despegue';
  if (lvl === 2) return 'Crecimiento';
  if (lvl === 3) return 'Experto en ventas';
  if (lvl === 4) return 'Nivel pro';
  return 'Despegue';
};

export default function PruebaDashboard() {
  const { restaurant, loginAsRestaurant, logoutRestaurant } = useAuth();

  const [view, setView] = React.useState('orders'); // 'menu','addItem','orders','profile'
  const [authView, setAuthView] = React.useState('login');
  const [authEmail, setAuthEmail] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [localOpen, setLocalOpen] = React.useState(false);
  const [profileData, setProfileData] = React.useState(null);
  const [menuItems, setMenuItems] = React.useState([]);
  const [menuLoading, setMenuLoading] = React.useState(false);
  const [menuFilter, setMenuFilter] = React.useState('');
  const [menuCatFilter, setMenuCatFilter] = React.useState('');
  const [editItem, setEditItem] = React.useState(null);
  const [itemLoading, setItemLoading] = React.useState(false);
  const [orders, setOrders] = React.useState([]);
  const [ordersLoading, setOrdersLoading] = React.useState(false);
  const [orderSearch, setOrderSearch] = React.useState('');
  const [currentTab, setCurrentTab] = React.useState('pendientes');
  const [pendingCount, setPendingCount] = React.useState(0);
  const [cobrosData, setCobrosData] = React.useState(null);
  const [cobrosLoading, setCobrosLoading] = React.useState(false);
  const [showTerms, setShowTerms] = React.useState(false);
  const [sabores, setSabores] = React.useState([]);
  const [saboresLoading, setSaboresLoading] = React.useState(false);
  const [itemCategory, setItemCategory] = React.useState('');
  const [profileSubView, setProfileSubView] = React.useState('edit'); // 'ventas', 'cobros', 'edit'
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);
  const [addMenuOpen, setAddMenuOpen] = React.useState(false);
  const [adicionales, setAdicionales] = React.useState([]);
  const [adicionalesLoading, setAdicionalesLoading] = React.useState(false);
  const [showRegretModal, setShowRegretModal] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [hasRepartidores, setHasRepartidores] = React.useState(false);
  const [loadingRepartidores, setLoadingRepartidores] = React.useState(false);
  const [mpAccountInfo, setMpAccountInfo] = React.useState(null);
  const [mpAccountLoading, setMpAccountLoading] = React.useState(false);
  const [mpUnlinking, setMpUnlinking] = React.useState(false);

  // Plans & Gamification State
  const [planInfo, setPlanInfo] = React.useState(null);
  const [planLoading, setPlanLoading] = React.useState(false);
  const [availablePlans, setAvailablePlans] = React.useState([]);

  // NUEVO: Arquitectura de Planes y Roles
  const [selectedPlan, setSelectedPlan] = React.useState(null); // 'Emprendedor' | 'Empresa'
  const [localUserRole, setLocalUserRole] = React.useState('Admin'); // 'Admin' | 'Cajero'
  
  // Advanced Burger State
  const [burgerVariants, setBurgerVariants] = React.useState([{ nombre: '', precio: '' }]);
  const [burgerExtras, setBurgerExtras] = React.useState([{ nombre: '', precio: '' }]);
  const [burgerOfferPapas, setBurgerOfferPapas] = React.useState(false);
  const [burgerPrecioPapas, setBurgerPrecioPapas] = React.useState('');
  
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
    console.error("❌ Error loading Google Maps:", loadError);
  }

  // Tutorial State
  const [showTutorial, setShowTutorial] = React.useState(false);
  const [tutorialStep, setTutorialStep] = React.useState(1);
  const [tutorialSampleOrderState, setTutorialSampleOrderState] = React.useState('Pendiente'); // To simulate order states
  const [itemName, setItemName] = React.useState('');
  const [rejectionModalOpen, setRejectionModalOpen] = React.useState(false);
  const [orderToReject, setOrderToReject] = React.useState(null);
  const [rejectionReason, setRejectionReason] = React.useState('');
  const [securityModalOpen, setSecurityModalOpen] = React.useState(false);
  const [securityPassword, setSecurityPassword] = React.useState('');
  const [securityLoading, setSecurityLoading] = React.useState(false);
  const [onSecuritySuccess, setOnSecuritySuccess] = React.useState(null);
  const [isUnlocked, setIsUnlocked] = React.useState(false);

  // ─── Modal Arrepentimiento ───
  const renderRegretModal = () => (
    showRegretModal && (
      <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowRegretModal(false)}>
        <div className="modal-box animate-fade-in" style={{ maxWidth: '400px', textAlign: 'center', background: 'white', padding: '24px', borderRadius: '12px' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ color: 'var(--red-600)', marginBottom: '16px' }}>Botón de Arrepentimiento</h3>
          <p style={{ marginBottom: '20px', color: 'var(--gray-600)', fontSize: '0.95rem' }}>
            ¿Deseas arrepentirte de tu registro y eliminar tu cuenta de local permanentemente de Weep? <br/>
            <strong>Esta acción eliminará todos tus productos y datos.</strong>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              className="btn btn-primary" 
              style={{ background: 'var(--red-600)' }} 
              disabled={deleting}
              onClick={async () => {
                if (!restaurant?.id) {
                  toast.error("Debes iniciar sesión para eliminar tu cuenta.");
                  setShowRegretModal(false);
                  return;
                }
                setDeleting(true);
                try {
                  await api.deleteLocalAccount(restaurant.id);
                  toast.success("Cuenta de local eliminada.");
                  logoutRestaurant();
                  window.location.href = "/";
                } catch (e) {
                  toast.error("No se pudo eliminar la cuenta. Verifica que no tengas deudas o pedidos pendientes.");
                } finally {
                  setDeleting(false);
                  setShowRegretModal(false);
                }
              }}
            >
              {deleting ? 'Eliminando...' : 'Sí, eliminar mi local'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowRegretModal(false)}>Cancelar</button>
          </div>
        </div>
      </div>
    )
  );

  // ─── Modal Términos y Condiciones ───
  const renderTermsModal = () => (
    showTerms && (
      <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setShowTerms(false)}>
        <div className="modal-box animate-fade-in" style={{ maxWidth: '500px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'white', padding: '24px', borderRadius: '12px' }} onClick={e => e.stopPropagation()}>
          <h4 style={{ color: 'var(--red-600)', marginBottom: '16px', fontSize: '1.2rem' }}>Términos y Condiciones para Locales</h4>
          <div style={{ fontSize: '0.88rem', color: 'var(--gray-600)', lineHeight: 1.5, overflowY: 'auto', paddingRight: '10px', textAlign: 'left', flex: 1 }}>
            <h5 style={{ color: 'red', marginTop: 0 }}>📄 2. COMERCIOS – TÉRMINOS Y CONDICIONES</h5>
            <p><strong>1. Relación</strong></p>
            <p>El comercio utiliza Weep como plataforma de visibilidad y gestión de pedidos. No existe relación societaria ni laboral.</p>
            <p><strong>2. Calidad</strong></p>
            <p>El local es el único responsable por el estado, higiene y veracidad de los productos entregados.</p>
            <p><strong>3. Gestión de Pedidos</strong></p>
            <p>El comercio debe mantener su menú actualizado y responder a los pedidos en tiempo y forma.</p>
            <p><strong>4. Comisiones</strong></p>
            <p>Weep percibirá una comisión acordada sobre las ventas realizadas a través de la plataforma.</p>
            <p><strong>5. Cancelaciones</strong></p>
            <p>El comercio debe informar inmediatamente si no puede cumplir con un pedido aceptado.</p>
            <hr style={{ margin: '15px 0', borderColor: '#eee' }} />
            <h5 style={{ color: 'red' }}>🔒 COMERCIOS – POLÍTICA DE PRIVACIDAD</h5>
            <p><strong>Uso de Datos:</strong></p>
            <p>Recolectamos datos del comercio, ventas, productos y métricas de desempeño para mejorar el servicio y facilitar la facturación.</p>
          </div>
          <button className="btn btn-secondary btn-full" onClick={() => setShowTerms(false)} style={{ marginTop: 16 }}>Cerrar</button>
        </div>
      </div>
    )
  );

  React.useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);
  }, []);

  // Location State
  const [showAddressSelector, setShowAddressSelector] = React.useState(false);
  const [profileAddress, setProfileAddress] = React.useState('');
  const [profileLat, setProfileLat] = React.useState(null);
  const [profileLng, setProfileLng] = React.useState(null);
  const [isIOS, setIsIOS] = React.useState(false);
  const [notificationStatus, setNotificationStatus] = React.useState('default');

  const pollingRef = React.useRef(null);
  const previousOrdersRef = React.useRef([]);
  const localOpenRef = React.useRef(false);

  const playAlertSound = () => {
    try {
      api.playNotificationSound();
    } catch (e) {}
  };

  const loadRepartidoresStatus = React.useCallback(async () => {
    try {
      const r = await api.checkActiveRepartidores();
      setHasRepartidores(r.hasActive);
    } catch (err) {
      console.error("Error checking drivers:", err);
    }
  }, []);

  React.useEffect(() => {
    if (profileSubView === 'edit_mercadopago' && profileData?.mp_access_token) {
      setMpAccountLoading(true);

      const fetchMpUser = async () => {
        // 1. Intentar fetch directo desde el navegador
        try {
          const res = await fetch('https://api.mercadopago.com/users/me', {
            headers: { Authorization: `Bearer ${profileData.mp_access_token}` }
          });
          const data = await res.json();
          if (data && (data.id || data.nickname)) {
            setMpAccountInfo(data);
            return;
          }
        } catch (e) {
          console.warn('Fetch directo a MP con CORS falló, intentando Edge Function...', e);
        }

        // 2. Fallback a Edge Function para evitar problemas de CORS
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jskxfescamdjesdrcnkf.supabase.co';
          const res = await fetch(`${supabaseUrl}/functions/v1/get-mp-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: profileData.mp_access_token })
          });
          const data = await res.json();
          if (data && (data.id || data.nickname)) {
            setMpAccountInfo(data);
            return;
          }
        } catch (err) {
          console.error('Error invocando get-mp-user edge function:', err);
        }

        setMpAccountInfo({ error: true });
      };

      fetchMpUser().finally(() => {
        setMpAccountLoading(false);
      });
    }
  }, [profileSubView, profileData?.mp_access_token]);

  const handleDesvincularMP = async () => {
    if (!window.confirm('¿Estás seguro de que deseas desvincular la cuenta de Mercado Pago de tu local? Los clientes no podrán abonar con MP en tu comercio hasta que vuelvas a vincular una cuenta.')) {
      return;
    }
    try {
      setMpUnlinking(true);
      const { error } = await api.supabase
        .from('locales')
        .update({
          mp_access_token: null,
          mp_refresh_token: null,
          mp_public_key: null,
          mp_user_id: null,
          mp_token_expires_at: null
        })
        .eq('id', profileData.id);

      if (error) throw error;

      setProfileData(prev => ({
        ...prev,
        mp_access_token: null,
        mp_refresh_token: null,
        mp_public_key: null,
        mp_user_id: null,
        mp_token_expires_at: null
      }));
      setMpAccountInfo(null);
      toast.success('Cuenta de Mercado Pago desvinculada correctamente.');
    } catch (err) {
      console.error('Error desvinculando Mercado Pago:', err);
      toast.error('Error al desvincular: ' + (err.message || err));
    } finally {
      setMpUnlinking(false);
    }
  };

  const loadEstado = React.useCallback(async () => {
    if (!restaurant) return;
    try {
      const d = await api.getLocalEstado(restaurant.id);
      if (d && 'estado' in d) {
        const isOpen = String(d.estado).toLowerCase() === 'activo';
        setLocalOpen(isOpen);
        localOpenRef.current = isOpen;
      }
    } catch {}
  }, [restaurant]);

  const loadProfile = React.useCallback(async () => {
    if (!restaurant) return;
    try {
      const d = await api.getPerfilLocal(restaurant.id);
      if (d.success) {
        setProfileData(d);
        setProfileAddress(d.direccion || '');
        setProfileLat(d.lat);
        setProfileLng(d.lng);
        // Sync email confirmation state with context
        if (d.email_confirmado !== restaurant.emailConfirmado) {
          loginAsRestaurant({ localId: restaurant.id, emailConfirmado: d.email_confirmado });
        }
      }
    } catch {}
  }, [restaurant]);

  /* ─── Modo Automático ─── */
  const estaDentroDeHorario = React.useCallback((apertura, cierre, diasApertura) => {
    if (!apertura || !cierre) return false;
    
    // Verificar días de apertura si existen
    if (diasApertura && Array.isArray(diasApertura) && diasApertura.length > 0) {
      const daysMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const currentDayName = daysMap[new Date().getDay()];
      
      const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const normalizedDays = diasApertura.map(normalize);
      const normalizedCurrentDay = normalize(currentDayName);
      
      if (!normalizedDays.includes(normalizedCurrentDay)) {
        return false;
      }
    }

    const [hA, mA] = apertura.split(':').map(Number);
    const [hC, mC] = cierre.split(':').map(Number);
    const minApertura = hA * 60 + mA;
    const minCierre = hC * 60 + mC;
    
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();

    if (minApertura < minCierre) {
      return current >= minApertura && current <= minCierre;
    } else {
      return current >= minApertura || current <= minCierre;
    }
  }, []);

  const verificarEstadoAutomatico = React.useCallback(() => {
    if (!profileData || !profileData.modo_automatico || !profileData.horario_apertura || !profileData.horario_cierre) return;
    
    const shouldBeOpen = estaDentroDeHorario(profileData.horario_apertura, profileData.horario_cierre, profileData.dias_apertura);
    
    if (localOpenRef.current !== shouldBeOpen) {
      const nuevoEstado = shouldBeOpen ? 'Activo' : 'Inactivo';
      setLocalOpen(shouldBeOpen);
      localOpenRef.current = shouldBeOpen;
      
      api.updateLocalEstado(restaurant?.id, nuevoEstado).then(res => {
        if (!res.success) {
           console.error("Error auto-updating estado en backend");
        } else {
           console.log(`[AUTO] Estado cambiado a ${nuevoEstado} según horario`);
           toast.success(`[Modo Automático] Local ${shouldBeOpen ? 'Abierto' : 'Cerrado'}`, { icon: '🕰️' });
        }
      }).catch(err => console.error(err));
    }
  }, [profileData, restaurant, estaDentroDeHorario]);

  const loadMenu = React.useCallback(async () => {
    if (!restaurant) return;
    setMenuLoading(true);
    try {
      const items = await api.getMenuByLocalId(restaurant.id);
      setMenuItems(Array.isArray(items) ? items : []);
    } catch { toast.error('Error al cargar menú'); }
    setMenuLoading(false);
  }, [restaurant]);

  const loadOrders = React.useCallback(async (silent = false) => {
    if (!restaurant) return;
    if (!silent) setOrdersLoading(true);
    try {
      const processed = await api.getPedidosLocalesCompletosByLocal(restaurant.id);

      // Check new pending orders for alerts
      if (silent && previousOrdersRef.current.length > 0) {
        const previousIds = previousOrdersRef.current.map(o => o.idPedidoLocal);
        const newPendings = processed.filter(o => o.estadoActual === 'Pendiente' && !previousIds.includes(o.idPedidoLocal));
        if (newPendings.length > 0) {
          playAlertSound();
          toast.success(`Tenés ${newPendings.length} pedido(s) nuevo(s)!`, { icon: '🔔' });
        }
      }
      previousOrdersRef.current = processed;

      setOrders(processed);
      setPendingCount(processed.filter(o => o.estadoActual === 'Pendiente').length);
    } catch (err) { 
      console.error("Error in loadOrders (PruebaDashboard):", err);
      if (!silent) toast.error('Error al cargar pedidos'); 
    }
    if (!silent) setOrdersLoading(false);
  }, [restaurant]);

  // Load data on login and window focus
  React.useEffect(() => {
    if (!restaurant) return;
    loadEstado();
    loadProfile();
    loadOrders();
    loadPlanInfo();

    // Sync Edit Item to Burger States
    if (editItem && view === 'addItem') {
      const cat = editItem.categoria;
      setItemCategory(cat || '');
      if (cat !== 'Helados' && cat !== 'Base') {
        try {
          const cfg = typeof editItem.variantes === 'string' ? JSON.parse(editItem.variantes) : (editItem.variantes || {});
          setBurgerVariants(cfg.variants?.length > 0 ? cfg.variants : [{ nombre: '', precio: '' }]);
          setBurgerExtras(cfg.extras?.length > 0 ? cfg.extras : [{ nombre: '', precio: '' }]);
          setBurgerOfferPapas(!!cfg.con_papas);
          setBurgerPrecioPapas(cfg.precio_papas || '');
        } catch (e) {
          setBurgerVariants([{ nombre: '', precio: '' }]);
          setBurgerExtras([{ nombre: '', precio: '' }]);
          setBurgerOfferPapas(false);
          setBurgerPrecioPapas('');
        }
      } else {
        setBurgerVariants([{ nombre: '', precio: '' }]);
        setBurgerExtras([{ nombre: '', precio: '' }]);
        setBurgerOfferPapas(false);
        setBurgerPrecioPapas('');
      }
    } else if (view === 'addItem' && !editItem) {
        setItemCategory('');
        setBurgerVariants([{ nombre: '', precio: '' }]);
        setBurgerExtras([{ nombre: '', precio: '' }]);
        setBurgerOfferPapas(false);
        setBurgerPrecioPapas('');
    }

    // ─── Sync OneSignal ID ───
    if (restaurant && window.OneSignalDeferred) {
      window.OneSignalDeferred.push(async (OneSignal) => {
        try {
          const updateStatus = () => {
            const perm = OneSignal.Notifications.permission;
            setNotificationStatus(perm ? 'granted' : (OneSignal.Notifications.permissionNative === 'denied' ? 'denied' : 'default'));
          };
          updateStatus();

          const currentSubscription = OneSignal.User.PushSubscription;
          if (currentSubscription.id) {
            await api.localUpdateOneSignalId(restaurant.id, currentSubscription.id);
          }

          OneSignal.Notifications.addEventListener("permissionChange", (permission) => {
            updateStatus();
          });

          OneSignal.User.PushSubscription.addEventListener("change", async (event) => {
            const newId = event.current.id;
            if (newId) {
              await api.localUpdateOneSignalId(restaurant.id, newId);
            }
          });

          if (!isIOS && OneSignal.Notifications.permissionNative === 'default' && localOpen) {
            await OneSignal.Notifications.requestPermission();
          }
        } catch (err) {
          console.error("❌ OneSignal Sync Error:", err);
        }
      });
    }

    // Check if tutorial was already seen
    const hasSeenTutorial = localStorage.getItem(`tutorial_seen_${restaurant.id}`);
    if (!hasSeenTutorial) {
      setShowTutorial(true);
      setTutorialStep(1);
    }
    
    const handleFocus = () => loadOrders(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(pollingRef.current);
      window.removeEventListener('focus', handleFocus);
    };
  }, [restaurant, loadEstado, loadProfile, loadOrders, editItem, view, localOpen, isIOS]);

  // Polling
  React.useEffect(() => {
    if (!restaurant) return;
    loadRepartidoresStatus();
    pollingRef.current = setInterval(() => {
      loadOrders(true);
      loadRepartidoresStatus();
    }, 25000);
    return () => clearInterval(pollingRef.current);
  }, [restaurant, loadOrders, loadRepartidoresStatus]);

  // Modo Automatico Auto-update
  React.useEffect(() => {
    if (!profileData?.modo_automatico) return;
    
    verificarEstadoAutomatico(); // Check immediately
    
    const intervalId = setInterval(() => {
      verificarEstadoAutomatico();
    }, 60000);

    return () => clearInterval(intervalId);
  }, [profileData?.modo_automatico, profileData?.horario_apertura, profileData?.horario_cierre, verificarEstadoAutomatico]);

  // Click outside to close dropdowns
  React.useEffect(() => {
    if (!profileMenuOpen && !addMenuOpen) return;
    const handleClickOutside = () => {
      setProfileMenuOpen(false);
      setAddMenuOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [profileMenuOpen, addMenuOpen]);


  const loadCobros = async () => {
    if (!restaurant) return;
    setCobrosLoading(true);
    try {
      const d = await api.getCobrosByLocal(restaurant.id);
      if (d.success) setCobrosData(d);
    } catch { toast.error('Error al cargar cobros'); }
    setCobrosLoading(false);
  };

  const handleSolicitarCobro = async (monto) => {
    try {
      setCobrosLoading(true);
      const res = await api.solicitarCobro(restaurant.id, monto);
      if (res.success) {
        toast.success('Solicitud enviada');
        loadCobros();
      } else {
        toast.error(res.error || 'Error al solicitar');
      }
    } catch { toast.error('Error de red'); }
    setCobrosLoading(false);
  };

  const loadSabores = React.useCallback(async () => {
    if (!restaurant) return;
    setSaboresLoading(true);
    setAdicionalesLoading(true);
    try {
      const [sabs, ads] = await Promise.all([
        api.getSaboresByLocal(restaurant.id),
        api.getAdicionalesByLocal(restaurant.id)
      ]);
      setSabores(sabs);
      setAdicionales(ads);
    } catch { toast.error('Error al cargar datos de helados'); }
    setSaboresLoading(false);
    setAdicionalesLoading(false);
  }, [restaurant]);

  const handleAddSabor = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nombre = fd.get('nombre').trim();
    const tipo = fd.get('tipo') || 'Sabor';
    if (!nombre) return;
    try {
      await api.addSabor(restaurant.id, nombre, tipo);
      toast.success(`${tipo} agregado`);
      e.target.reset();
      loadSabores();
    } catch { toast.error('Error al agregar'); }
  };

  const handleAddAdicional = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nombre = fd.get('nombre').trim();
    const precio = fd.get('precio');
    if (!nombre || !precio) return;
    try {
      await api.addAdicional(restaurant.id, nombre, precio);
      toast.success('Adicional agregado');
      e.target.reset();
      loadSabores();
    } catch { toast.error('Error al agregar adicional'); }
  };

  const handleToggleAdicionalDisp = async (id, current) => {
    try {
      await api.updateAdicionalDisponibilidad(id, !current);
      setAdicionales(prev => prev.map(a => a.id === id ? { ...a, disponible: !current } : a));
    } catch { toast.error('Error'); }
  };

  const handleDeleteAdicional = async (id) => {
    if (!confirm('¿Eliminar este adicional?')) return;
    try {
      await api.deleteAdicional(id);
      toast.success('Adicional eliminado');
      loadSabores();
    } catch { toast.error('Error al eliminar'); }
  };

  const handleToggleSaborDisp = async (id, current) => {
    try {
      await api.updateSaborDisponibilidad(id, !current);
      setSabores(prev => prev.map(s => s.id === id ? { ...s, disponible: !current } : s));
    } catch { toast.error('Error'); }
  };

  const handleDeleteSabor = async (id) => {
    if (!confirm('¿Eliminar este sabor?')) return;
    try {
      await api.deleteSabor(id);
      toast.success('Sabor eliminado');
      loadSabores();
    } catch { toast.error('Error al eliminar'); }
  };

  const loadPlanInfo = React.useCallback(async () => {
    if (!restaurant) return;
    setPlanLoading(true);
    try {
      const info = await api.getPlanInfo(restaurant.id);
      if (info.success) {
        console.log("Plan Info Loaded:", info);
        setPlanInfo(info);
      }
      const allPlanes = await api.getDisponibilidadPlanes();
      setAvailablePlans(allPlanes);
    } catch (err) {
      console.error("Error loading plan info:", err);
    } finally {
      setPlanLoading(false);
    }
  }, [restaurant]);

  const handleSuscripPlan = async (planId) => {
    try {
      setPlanLoading(true);
      await api.suscribirAPlan(restaurant.id, planId);
      toast.success('¡Plan actualizado correctamente!', { icon: '🚀' });
      loadPlanInfo();
    } catch (err) {
      toast.error('Error al actualizar plan');
    } finally {
      setPlanLoading(false);
    }
  };

  const toggleEstado = async () => {
    const newState = localOpen ? 'Inactivo' : 'Activo';
    const newBool = !localOpen;
    setLocalOpen(newBool);
    localOpenRef.current = newBool;
    try {
      const d = await api.updateLocalEstado(restaurant.id, newState);
      if (!d.success) { 
        setLocalOpen(!newBool); 
        localOpenRef.current = !newBool;
        toast.error('No se pudo cambiar'); 
      }
    } catch { 
      setLocalOpen(!newBool); 
      localOpenRef.current = !newBool;
      toast.error('Error de conexión'); 
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setAuthLoading(true);
    try {
      const d = await api.loginLocal(fd.get('email'), fd.get('password'));
      if (d.success && d.localId) { 
        loginAsRestaurant({ localId: d.localId, emailConfirmado: d.emailConfirmado }); 
        setLocalUserRole(d.role || 'Admin');
        toast.success('¡Bienvenido!'); 
      }
      else toast.error('Credenciales incorrectas');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
  };

  const handleSolicitarCodigo = () => {
    const nombre = document.querySelector('input[name="nombre"]')?.value || '';
    const codigoArea = document.querySelector('select[name="codigo_area"]')?.value || '+549';
    const telefono = document.querySelector('input[name="telefono"]')?.value || '';
    const contacto = telefono ? `${codigoArea}${telefono}` : '';
    let text = "Hola! Quiero registrar mi local en Wepi y solicitar un código de acceso.";
    if (nombre || contacto) {
      text += ` Mi local se llama: ${nombre}.`;
      if (contacto) text += ` Celular de contacto: ${contacto}.`;
    }
    const url = `https://wa.me/5493756543610?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = fd.get('email');
    if (!isValidEmail(email)) { toast.error('Ingresá un email válido'); return; }
    setAuthLoading(true);
    try {
      const config = await api.getConfiguracion();
      const enteredCode = fd.get('codigo_acceso')?.trim();
      const expectedCode = config.codigo_acceso?.trim() || 'WEPI123';
      
      if (enteredCode !== expectedCode) {
        toast.error('El código de acceso ingresado es incorrecto. Solicítalo por WhatsApp.');
        setAuthLoading(false);
        return;
      }

      const codigoArea = fd.get('codigo_area') || '';
      const telefono = fd.get('telefono') || '';
      const contactoFull = telefono ? `${codigoArea}${telefono}` : '';

      await api.registerLocal(
        fd.get('nombre'), '', email, fd.get('password'),
        fd.get('terms_accepted') === 'on' || !!fd.get('terms_accepted'),
        fd.get('terms_accepted') === 'on' || !!fd.get('terms_accepted'),
        selectedPlan, // Pasamos el tipo de plan
        null,
        null,
        contactoFull
      );
      toast.success('¡Local registrado! Iniciá sesión.');
      setAuthEmail(email);
      setAuthView('login');
      setSelectedPlan(null); // Reset plan selection after registration
    } catch (err) { 
      toast.error('Error al registrar: ' + (err.message || err)); 
    }
    setAuthLoading(false);
  };

  const handleResendConfirmationService = async () => {
    if (!profileData?.email) {
      toast.error('No se encontró el email en tu perfil');
      return;
    }
    const loading = toast.loading('Reenviando email...');
    try {
      const res = await api.reenviarEmailConfirmacion(profileData.email, 'local');
      if (res.success) toast.success('¡Email reenviado! Revisa tu bandeja de entrada.', { id: loading });
      else toast.error(res.error || 'Error al reenviar', { id: loading });
    } catch { toast.error('Error de conexión', { id: loading }); }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const file = fd.get('foto');
    setItemLoading(true);
    try {
      let imgUrl = '';
      if (file && file.size > 0) imgUrl = await api.uploadImage(file);
      let precioVal = fd.get('precio');
      let variantesVal = fd.get('variantes');
      
      if (fd.get('categoria') === 'Helados') {
        const iceCreamConfig = {
          es_helado: true,
          precios: {
            '1/4kg': { precio: fd.get('p_14'), max: parseInt(fd.get('m_14')) || 3 },
            '1/2kg': { precio: fd.get('p_12'), max: parseInt(fd.get('m_12')) || 3 },
            '1kg': { precio: fd.get('p_1'), max: parseInt(fd.get('m_1')) || 4 }
          }
        };
        variantesVal = JSON.stringify(iceCreamConfig);
        precioVal = fd.get('p_14');
      } else if (fd.get('categoria') !== 'Helados' && fd.get('categoria') !== 'Base') {
        const filteredVariants = burgerVariants.filter(v => v.nombre.trim() !== '');
        const filteredExtras = burgerExtras.filter(e => e.nombre.trim() !== '');
        
        if (filteredVariants.length > 0 || filteredExtras.length > 0 || burgerOfferPapas) {
          const advancedConfig = {
            es_hamburguesa: fd.get('categoria') === 'Hamburguesas',
            es_combo: fd.get('categoria') === 'Combos',
            es_pancho: fd.get('categoria') === 'Panchos',
            variants: filteredVariants,
            extras: filteredExtras,
            con_papas: burgerOfferPapas,
            precio_papas: parseFloat(burgerPrecioPapas) || 0
          };
          variantesVal = JSON.stringify(advancedConfig);
          // Fallback: Use first variant price if regular price is empty
          if (!precioVal && filteredVariants.length > 0) {
            precioVal = filteredVariants[0].precio;
          }
        } else {
          variantesVal = null;
        }
      }

      const data = {
        localId: restaurant.id,
        nombre: fd.get('nombre'), categoria: fd.get('categoria'),
        descripcion: fd.get('descripcion'), precio: precioVal,
        descuento: fd.get('descuento') ? parseFloat(fd.get('descuento')) : 0,
        disponibilidad: fd.get('disponibilidad') === 'true',
        tamano_porcion: fd.get('tamano_porcion'), variantes: variantesVal,
        tiempo_preparacion: fd.get('tiempo_preparacion'),
        imagen_url: imgUrl,
      };
      if (editItem) {
        data.itemId = editItem.id;
        await api.updateMenuItem(data);
      } else {
        await api.addMenuItem(data);
      }
      toast.success(editItem ? 'Plato actualizado' : 'Plato agregado');
      setEditItem(null);
      setView('menu');
      loadMenu();
    } catch (err) { toast.error(err.message || 'Error al guardar'); }
    setItemLoading(false);
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('¿Eliminar este plato permanentemente?')) return;
    try {
      await api.deleteMenuItem(id);
      toast.success('Plato eliminado');
      loadMenu();
    } catch { toast.error('Error al eliminar'); }
  };

  const handleToggleDisp = async (id, current) => {
    try {
      await api.updateMenuItemAvailability(id, !current);
      setMenuItems(menuItems.map(m => m.id === id ? { ...m, disponibilidad: !current } : m));
    } catch (e) { toast.error('Error al actualizar disponibilidad'); }
  };

  const handleQuickDiscount = async (id, val) => {
    try {
      const discount = parseFloat(val) || 0;
      await api.updateMenuItemDiscount(id, discount);
      setMenuItems(menuItems.map(m => m.id === id ? { ...m, descuento: discount } : m));
      toast.success('Descuento actualizado', { id: `quick-disc-${id}` });
    } catch (e) { toast.error('Error al actualizar descuento'); }
  };

  const handleOrderAction = async (pedido, action, reason = '') => {
    try {
      await api.updateEstadoLocalOrder(pedido.idPedidoLocal, action);
      
      // Send notifications logic
      try {
        if (action === 'Aceptado') {
          // Mapear items (array de arrays) a formato esperado por notifyCustomerAboutNewOrder
          const mappedCart = pedido.items.map(item => ({
            id: item[2],
            nombre: item[4],
            precio: Number(item[5]),
            cantidad: Number(item[6]),
            qty: Number(item[6]),
            local_id: pedido.localId
          }));
          /*
          await api.notifyCustomerAboutNewOrder(
            pedido.idPedido, mappedCart, pedido.direccion, 
            pedido.tipoEntrega, pedido.numConfirmacion, 
            pedido.emailCliente, pedido.nombreCliente
          );
          */

          // Notificar al repartidor si está asignado
          /*
          if (pedido.repartidorId) {
            api.repartidorGetDatos(pedido.repartidorId).then(rep => {
              if (rep.success && rep.data?.Email) {
                api.notifyDriverAboutNewOrder(
                  pedido.idPedido, mappedCart, pedido.direccion, 
                  pedido.observaciones, pedido.totalLocal, pedido.metodoPago, rep.data.Email
                ).catch(e => console.error("Error notificando driver desde dashboard:", e));
              }
            }).catch(e => console.error(e));
          }
          */
        } else if (action === 'Listo') {
          const direccionLocal = profileData?.direccion || 'Dirección del local';
          /*
          await api.notifyOrderListo(pedido, direccionLocal);
          */
        } else if (action === 'Entregado') {
          /*
          await api.notifyOrderEntregado(pedido);
          */
        } else if (action === 'Rechazado') {
          await api.notifyOrderRechazado(pedido, reason);
        }
      } catch (e) {
        console.error('Error enviando email:', e);
      }

      const statusMap = {
        'Aceptado': 'En preparación',
        'Listo': 'Listos',
        'Entregado': 'Ventas',
        'Rechazado': 'Rechazados'
      };
      const nextTab = statusMap[action] || action;
      toast.success(`Pedido marcado como ${action}. El pedido se movió a ${nextTab}`);
      loadOrders();
    } catch { toast.error('Error al actualizar'); }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const file = fd.get('foto');
    const direccion = fd.get('direccion');
    const selectedDays = [];
    const email = fd.get('email');
    if (!isValidEmail(email)) { toast.error('Ingresá un email válido'); return; }
    
    ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach(day => {
      if (fd.get(`day_${day}`) === 'on') selectedDays.push(day);
    });

    try {
      let fotoUrl = '';
      if (file && file.size > 0) fotoUrl = await api.uploadImage(file);
      
      const discountDays = [];
      ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach(day => {
        if (fd.get(`desc_${day}`) === 'on') discountDays.push(day);
      });

      const params = {
        localId: restaurant.id, 
        nombre: fd.get('nombre'),
        direccion: profileAddress,
        lat: profileLat,
        lng: profileLng,
        email: fd.get('email'),
        horario_apertura: fd.get('horario_apertura'),
        horario_cierre: fd.get('horario_cierre'),
        modo_automatico: fd.get('modo_automatico') === 'true',
        dias_apertura: selectedDays,
        dias_descuento: discountDays,
        descuento_general: parseInt(fd.get('descuento_general')) || 0,
        acepta_retiro: fd.get('acepta_retiro') === 'on',
        acepta_envio: fd.get('acepta_envio') === 'on'
      };

      const pass = fd.get('password');
      if (pass) params.password = pass;
      if (fotoUrl) params.foto_url = fotoUrl;
      const success = await api.updatePerfilLocal(params);
      if (success) {
        toast.success('Perfil actualizado correctamente');
        setProfileData(prev => ({ ...prev, ...params }));
        if (view !== 'profile') setView('orders'); // Don't jump if we are in profile
      }
    } catch { toast.error('Error al guardar perfil'); }
  };

  const handleAddressConfirm = async (data) => {
    setProfileAddress(data.address);
    setProfileLat(data.lat);
    setProfileLng(data.lng);
    setShowAddressSelector(false);
    
    if (restaurant && restaurant.id) {
      try {
        const success = await api.updatePerfilLocal({
          localId: restaurant.id,
          direccion: data.address,
          lat: data.lat,
          lng: data.lng
        });
        if (success) {
          toast.success('Dirección guardada correctamente');
          setProfileData(prev => ({
            ...prev,
            direccion: data.address,
            lat: data.lat,
            lng: data.lng
          }));
        } else {
          toast.error('No se pudo guardar la dirección');
        }
      } catch (err) {
        console.error('Error saving address:', err);
        toast.error('Error al guardar la dirección');
      }
    }
  };

  // ─── Tutorial Mock Data logic ───
  const tutorialSampleDish = {
    id: 'sample-dish-1',
    nombre: 'Hamburguesa Weep (Muestra)',
    categoria: 'Hamburguesas',
    descripcion: 'Doble carne, mucho cheddar y bacon crocante.',
    precio: 4500,
    disponibilidad: true,
    imagen_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=300'
  };

  const tutorialSampleOrder = {
    idPedidoLocal: 'sample-order-1',
    idPedido: 'SAMPLE-1',
    estadoActual: tutorialSampleOrderState,
    items: [[null, null, 'sample-dish-1', 1, 'Hamburguesa Weep (Muestra)', '', 1, 4500]],
    direccion: 'Calle Falsa 123 (Muestra)',
    observaciones: 'Sin cebolla por favor',
    metodoPago: 'Efectivo',
    tipoEntrega: 'Delivery',
    emailCliente: 'cliente@ejemplo.com',
    nombreCliente: 'Juan Pérez (Muestra)',
    fecha: new Date().toISOString(),
    numConfirmacion: '1234',
    repartidorId: null,
    localId: restaurant?.id,
    totalLocal: 4500,
  };

  const finishTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem(`tutorial_seen_${restaurant?.id}`, 'true');
    setView('orders');
  };

  const handleTutorialNext = () => {
    if (tutorialStep === 1) {
      setTutorialStep(2);
    } else if (tutorialStep === 2) {
      setView('menu');
      setTutorialStep(3);
    } else if (tutorialStep === 3) {
      setView('orders');
      setCurrentTab('pendientes');
      playAlertSound();
      setTutorialStep(4);
    } else if (tutorialStep === 4) {
      setTutorialStep(5);
    } else {
      finishTutorial();
    }
  };

  const handleTutorialPrev = () => {
    if (tutorialStep === 2) setTutorialStep(1);
    else if (tutorialStep === 3) { setView('orders'); setTutorialStep(2); }
    else if (tutorialStep === 4) { setView('menu'); setTutorialStep(3); }
    else if (tutorialStep === 5) { setTutorialStep(4); }
  };

  // Categories for select
  const categories = [...new Set(menuItems.map(i => i.categoria).filter(Boolean))].sort();
  const filteredMenu = menuItems.filter(i => {
    const nameOk = !menuFilter || i.nombre.toLowerCase().includes(menuFilter.toLowerCase());
    const catOk = !menuCatFilter || i.categoria === menuCatFilter;
    return nameOk && catOk;
  });

  const finalMenu = showTutorial && view === 'menu' ? [tutorialSampleDish, ...filteredMenu] : filteredMenu;

  const processOrders = orders.filter(o => ['Pendiente', 'Aceptado', 'Listo'].includes(o.estadoActual));
  const finishedOrders = orders.filter(o => o.estadoActual === 'Entregado');
  
  const pendientesOrders = processOrders.filter(o => o.estadoActual === 'Pendiente').sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const preparacionOrders = processOrders.filter(o => o.estadoActual === 'Aceptado');
  const listosOrders = processOrders.filter(o => o.estadoActual === 'Listo');

  const currentTabOrders = (currentTab === 'pendientes' ? pendientesOrders :
                            currentTab === 'preparacion' ? preparacionOrders :
                            listosOrders).filter(o => 
                              !orderSearch || o.idPedido.toLowerCase().includes(orderSearch.toLowerCase())
                            );

  const finalOrders = (() => {
    if (!showTutorial || view !== 'orders') return currentTabOrders;
    
    const tabToState = {
      'pendientes': 'Pendiente',
      'preparacion': 'Aceptado',
      'listos': 'Listo'
    };
    
    if (tutorialSampleOrder.estadoActual === tabToState[currentTab]) {
      return [tutorialSampleOrder, ...currentTabOrders];
    }
    return currentTabOrders;
  })();

  // ─── Auth Screen ───
  if (!restaurant) return (
    <div className="rd-page">
      <header className="rd-header">
        <Link to="/">
          <img src="https://i.postimg.cc/Y0Ln7qb3/Digitalizacion-y-logistica-para-Santo-Tome-(1).png" alt="Weep" className="rd-logo" />
        </Link>
        <h1>Panel de Gestión {selectedPlan ? `- ${selectedPlan}` : ''}</h1>
      </header>
      <main className="rd-main">
        {(!selectedPlan && authView === 'register') ? (
          <div className="plan-selection-container animate-fade-in" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '32px', color: 'var(--gray-800)' }}>Elegí el mejor plan para tu negocio</h2>
            <div className="plan-selection-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              
              <div className="plan-card card" style={{ border: '2px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.3s ease' }} onClick={() => setSelectedPlan('Emprendedor')}>
                <div className="card-body" style={{ textAlign: 'center', padding: '32px' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🌱</div>
                  <h3 style={{ color: 'var(--red-600)', marginBottom: '8px' }}>Plan Emprendedor</h3>
                  <p style={{ color: 'var(--green-600)', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '20px' }}>GRATUITO</p>
                  <ul style={{ textAlign: 'left', listStyle: 'none', padding: 0, fontSize: '0.9rem', color: 'var(--gray-600)', marginBottom: '32px' }}>
                    <li style={{ marginBottom: '10px' }}>✅ Gestión de pedidos ilimitada</li>
                    <li style={{ marginBottom: '10px' }}>✅ Menú digital autogestionable</li>
                    <li style={{ marginBottom: '10px' }}>✅ Recibí pagos en efectivo</li>
                    <li style={{ marginBottom: '10px' }}>❌ Sin Facturación Fiscal (AFIP)</li>
                    <li style={{ marginBottom: '10px' }}>❌ Usuario único (Solo Admin)</li>
                  </ul>
                  <button className="btn btn-secondary btn-full">Comenzar Gratis</button>
                </div>
              </div>

              <div className="plan-card card" style={{ border: '2px solid var(--red-500)', cursor: 'pointer', transform: 'scale(1.05)', boxShadow: '0 10px 25px rgba(230, 57, 70, 0.15)' }} onClick={() => setSelectedPlan('Empresa')}>
                <div className="card-body" style={{ textAlign: 'center', padding: '32px' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏢</div>
                  <h3 style={{ color: 'var(--red-600)', marginBottom: '8px' }}>Plan Empresa</h3>
                  <p style={{ color: 'var(--gray-800)', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '20px' }}>CON COSTO</p>
                  <ul style={{ textAlign: 'left', listStyle: 'none', padding: 0, fontSize: '0.9rem', color: 'var(--gray-600)', marginBottom: '32px' }}>
                    <li style={{ marginBottom: '10px' }}>✅ Todo lo del Plan Emprendedor</li>
                    <li style={{ marginBottom: '10px' }}>✅ <strong>Integración AFIP (Facturación)</strong></li>
                    <li style={{ marginBottom: '10px' }}>✅ <strong>Roles: Admin y Cajero</strong></li>
                    <li style={{ marginBottom: '10px' }}>✅ Reportes de auditoría avanzados</li>
                    <li style={{ marginBottom: '10px' }}>✅ Soporte prioritario 24/7</li>
                  </ul>
                  <button className="btn btn-primary btn-full">Elegir Plan Empresa</button>
                </div>
              </div>

            </div>
            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <button className="btn btn-ghost" onClick={() => setAuthView('login')}>Ya tengo una cuenta, iniciar sesión</button>
            </div>
          </div>
        ) : (
          <div className="rd-auth-card card animate-fade-in" key={authView}>
            <div className="card-body">
              <h2>Acceso Local</h2>
              <div className="rd-auth-tabs">
                <button className={`btn ${authView === 'login' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => { setAuthView('login'); setShowPassword(false); setSelectedPlan(null); }}>Iniciar Sesión</button>
                <button className={`btn ${authView === 'register' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => { setAuthView('register'); setShowPassword(false); }}>Registrar Local</button>
              </div>
              {selectedPlan && (
                <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--gray-700)' }}>Plan Seleccionado: <span style={{ color: 'var(--red-600)' }}>{selectedPlan}</span></span>
                  <button className="btn btn-ghost btn-xs" onClick={() => setSelectedPlan(null)}>Cambiar</button>
                </div>
              )}
            {authView === 'login' ? (
              <form onSubmit={handleLogin} className="rd-auth-form">
                <input name="email" type="email" className="form-input" placeholder="Email" defaultValue={authEmail} required autoComplete="username" />
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
                  {authLoading ? <span className="spinner spinner-white" /> : 'Iniciar Sesión'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="rd-auth-form">
                <input name="email" type="email" className="form-input" placeholder="Email (Este será tu usuario)" required autoComplete="username" />
                <input name="nombre" className="form-input" placeholder="Nombre del Local" required autoComplete="organization" />
                <div className="password-container">
                  <input 
                    name="password" 
                    type={showPassword ? "text" : "password"} 
                    className="form-input" 
                    placeholder="Contraseña" 
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
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <select 
                    name="codigo_area" 
                    className="form-input" 
                    style={{ width: '105px', margin: 0, padding: '0 8px', height: '42px', minHeight: '42px' }}
                  >
                    <option value="+549">🇦🇷 +549</option>
                    <option value="+55">🇧🇷 +55</option>
                  </select>
                  <input 
                    name="telefono" 
                    type="tel" 
                    className="form-input" 
                    placeholder="Celular (ej: 3756123456)" 
                    required 
                    autoComplete="tel-national" 
                    style={{ margin: 0, flex: 1 }}
                  />
                </div>

                <div className="access-code-container" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input 
                    name="codigo_acceso" 
                    type="text" 
                    className="form-input" 
                    placeholder="Código de Acceso" 
                    required 
                    style={{ margin: 0, flex: 1 }} 
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={handleSolicitarCodigo} 
                    style={{ whiteSpace: 'nowrap', padding: '0 12px', fontSize: '0.85rem' }}
                  >
                    Solicitar Código
                  </button>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '16px', textAlign: 'left' }}>
                  {authView === 'register' && (
                    <input type="checkbox" id="terms_accepted" name="terms_accepted" required style={{ width: 'auto', marginTop: '4px' }} />
                  )}
                  <label htmlFor="terms_accepted" style={{ fontSize: '0.85rem', color: 'var(--gray-600)', lineHeight: '1.4' }}>
                    {authView === 'register' ? (
                      <>
                        Acepto los <button type="button" style={{ background: 'none', border: 'none', color: 'var(--red-500)', padding: 0, textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }} onClick={() => setShowTerms(true)}>Términos y Condiciones y Política de Privacidad</button> para Locales.
                      </>
                    ) : (
                      <span>Términos y Condiciones y Política de Privacidad para Locales.</span>
                    )}
                  </label>
                </div>

                <button type="submit" className="btn btn-success btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Registrar Local'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      </main>
      <footer className="footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 20px' }}>
        <img src="https://i.postimg.cc/Y0Ln7qb3/Digitalizacion-y-logistica-para-Santo-Tome-(1).png" alt="Weep" style={{ height: '50px', objectFit: 'contain' }} />
        <p>© 2026 <strong>Weep</strong> — Panel de Locales</p>
        <button 
          onClick={() => setShowTerms(true)} 
          style={{ background: 'none', border: 'none', color: 'var(--red-500)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          Ver Términos y Condiciones
        </button>
        <button 
          onClick={() => setShowRegretModal(true)} 
          style={{ background: 'none', border: 'none', color: 'var(--red-600)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem', marginTop: '4px', fontWeight: 'bold' }}
        >
          Botón de Arrepentimiento
        </button>
      </footer>
      {renderTermsModal()}
      {renderRegretModal()}
    </div>
  );

  const renderPlansView = () => {
    if (planLoading) return <div className="loading-state"><div className="spinner" /> Cargando planes...</div>;
    if (!planInfo) return <div>No se pudo cargar la información de planes.</div>;

    const { plan_nombre, nivel_actual, comision_actual, metricas_mes, proximo_nivel } = planInfo;
    const progress = proximo_nivel ? Math.min(100, (metricas_mes.pedidos / (metricas_mes.pedidos + proximo_nivel.falta_pedidos)) * 100) : 100;

    const planBenefits = {
      'Visible': [
        'Visibilidad en la plataforma',
        'Pedidos automáticos',
        'Gestión de menú en tiempo real',
        'Acceso a soporte vía email'
      ],
      'Básico': [
        'Visibilidad en la plataforma',
        'Pedidos automáticos',
        'Gestión de menú en tiempo real',
        'Acceso a soporte vía email'
      ],
      'Plan Básico': [
        'Visibilidad en la plataforma',
        'Pedidos automáticos',
        'Gestión de menú en tiempo real',
        'Acceso a soporte vía email'
      ],
      'Recomendado': [
        'Prioridad MEDIA en búsquedas',
        'Seccion Locales Recomendados',
        'Soporte prioritario',
        'Publicidad básica'
      ],
      'Destacado': [
        'Prioridad MÁXIMA (Top de lista)',
        'Banner destacado en Home',
        'Seccion Locales Recomendados',
        'Publicidad en redes Wepi'
      ]
    };

    return (
      <section className="plans-dashboard animate-fade-in">
        {/* Sección de Comisión - Basada en Ventas */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--gray-800)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>📈</span> Mi Nivel de Comisión
          </h3>
          <div className="plans-hero card" style={{ background: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)', boxShadow: '0 10px 25px rgba(30, 41, 59, 0.2)' }}>
            <div className="plans-hero-content">
              <div className="plan-stats-grid">
                <div className="plan-stat-card">
                  <span className="stat-label">Nivel Actual</span>
                  <span className="stat-value">🚀 {getLevelName(nivel_actual)}</span>
                </div>
                <div className="plan-stat-card">
                  <span className="stat-label">Comisión</span>
                  <span className="stat-value">{comision_actual}%</span>
                </div>
                <div className="plan-stat-card">
                  <span className="stat-label">Ventas (30 días)</span>
                  <span className="stat-value">{metricas_mes.pedidos} pedidos</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {proximo_nivel && (
          <div className="next-level-card card animate-slide-up">
            <div className="next-level-header">
              <h3>🎯 Próximo Objetivo: {getLevelName(proximo_nivel.nivel)}</h3>
              <span className="next-commission">Bajá a {proximo_nivel.comision}% de comisión</span>
            </div>
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${progress}%` }}>
                <span className="progress-text">{Math.round(progress)}%</span>
              </div>
            </div>
            <div className="next-level-footer">
              <p>Te faltan <strong>{proximo_nivel.falta_pedidos} pedidos</strong> para subir de nivel.</p>
              <p className="motivational-msg">¡Sigue así! Estás cada vez más cerca de maximizar tus ganancias. 🎯</p>
            </div>
          </div>
        )}

        {/* Sección de Visibilidad - Basada en Suscripción */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ margin: '32px 0 16px', color: 'var(--gray-800)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>💎</span> Plan de Visibilidad
          </h3>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginBottom: '20px' }}>
            Tu plan de visibilidad determina qué tan arriba apareces en la aplicación y qué beneficios publicitarios tienes.
          </p>
          <div className="plans-grid">
            {availablePlans.map(plan => (
              <div key={plan.id} className={`plan-select-card card ${plan.nombre === plan_nombre ? 'current' : ''}`}>
                {plan.nombre === plan_nombre && <div className="current-label">ACTUAL</div>}
                
                {plan.nombre === 'Destacado' && (
                  <img src="https://i.postimg.cc/50W06p4z/descarga-(31).png" alt="Icono Destacado" style={{ height: '40px', marginBottom: '12px' }} />
                )}
                {plan.nombre === 'Recomendado' && (
                  <img src="https://i.postimg.cc/K8dcHQg5/descarga-(31)-(4).png" alt="Icono Recomendado" style={{ height: '40px', marginBottom: '12px' }} />
                )}

                <h4>{plan.nombre}</h4>
                <p className="plan-price">${plan.precio_mensual.toLocaleString()} / mes</p>
                
                <ul className="plan-advantages" style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', textAlign: 'left' }}>
                  {(planBenefits[plan.nombre] || []).map((benefit, i) => (
                    <li key={i} style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '8px', display: 'flex', gap: '8px' }}>
                      <span style={{ color: 'var(--green-500)' }}>✔</span> {benefit}
                    </li>
                  ))}
                </ul>

                {plan.nombre !== plan_nombre ? (
                  <button className="btn btn-primary btn-full" onClick={() => handleSuscripPlan(plan.id)}>Elegir {plan.nombre}</button>
                ) : (
                  <button className="btn btn-secondary btn-full" disabled>Plan Activo</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tabla de Referencia de Comisiones */}
        <div style={{ marginTop: '48px', padding: '24px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ margin: '0 0 16px', color: '#1e293b' }}>Resumen de Escalas de Comisión</h4>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
            Las comisiones se ajustan automáticamente al inicio de cada mes según tu volumen de ventas.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
            {[
              { n: 'Despegue', c: '15%', t: '0+' },
              { n: 'Crecimiento', c: '12%', t: '15+' },
              { n: 'Experto', c: '10%', t: '30+' },
              { n: 'Nivel Pro', c: '8%', t: '50+' },
            ].map((tier, i) => (
              <div key={i} style={{ padding: '12px', background: 'white', borderRadius: '8px', textAlign: 'center', border: '1px solid #edf2f7' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e63946', marginBottom: '4px' }}>{tier.n}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{tier.c}</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{tier.t} pedidos</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  // ─── Tutorial Overlay ───
  const renderTutorial = () => {
    if (!showTutorial) return null;

    const mascotUrl = "https://i.postimg.cc/76cK0DSH/Gemini-Generated-Image-aqk3geaqk3geaqk3-(2).png";

    const steps = [
      {
        title: "¡Bienvenido a Weep!",
        text: "Soy tu guía. En este panel gestionarás todo tu negocio de forma simple.",
        position: "bottom-right"
      },
      {
        title: "Cargar nuevo plato",
        text: "Haz click en '+ Añadir' para crear platos. ¡Las buenas fotos atraen más clientes!",
        target: ".rd-nav-btn:nth-child(3)",
      },
      {
        title: "Gestionar tu Menú",
        text: "Aquí ves tus platos. Puedes pausarlos si no tienes stock. Mira este ejemplo de hamburguesa.",
        target: ".rd-menu-item"
      },
      {
        title: "Logística de Pedidos",
        text: tutorialSampleOrderState === 'Pendiente' ? "¡Mira! Tienes un pedido. Dale a 'Aceptar' para empezar a cocinar." :
              tutorialSampleOrderState === 'Aceptado' ? "¡Muy bien! Ahora está en preparación. Cuando termines, dale a 'Listo'." :
              "¡Perfecto! El pedido está listo para ser entregado.",
        target: ".rd-tabs"
      },
      {
        title: "¡Todo listo!",
        text: "Ya dominas lo básico. Encuéntrame en Mi Perfil > Ver tutorial si me necesitas de nuevo.",
        position: "center"
      }
    ];

    const step = steps[tutorialStep - 1];

    return (
      <div className="tutorial-floating-container" style={{
        position: 'fixed', top: '70px', right: '20px', zIndex: 9999,
        maxWidth: '380px', width: '90%', pointerEvents: 'none'
      }}>
        <div className="tutorial-card card animate-fade-in" style={{
          padding: '20px', border: '5px solid var(--red-500)', 
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)', pointerEvents: 'auto',
          background: 'white', position: 'relative', overflow: 'visible',
          borderRadius: '16px'
        }}>
          {/* Avatar Guía */}
          <div style={{
            position: 'absolute', top: '-50px', left: '20px',
            width: '80px', height: '80px', borderRadius: '50%',
            border: '3px solid var(--red-500)', backgroundColor: 'white',
            overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
          }}>
            <img src={mascotUrl} alt="Guía" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          <div style={{ marginTop: '30px' }}>
            <h3 style={{ color: 'var(--red-600)', marginBottom: '8px', fontSize: '1.2rem' }}>
              {step.title}
            </h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--gray-700)', lineHeight: '1.4', marginBottom: '16px' }}>
              {step.text}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-ghost btn-xs" onClick={finishTutorial} style={{ fontSize: '0.75rem' }}>Saltar tutorial</button>
              <div style={{ display: 'flex', gap: '8px' }}>
                {tutorialStep > 1 && tutorialStep !== 4 && (
                  <button className="btn btn-secondary btn-sm" onClick={handleTutorialPrev}>Atrás</button>
                )}
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={handleTutorialNext}
                  disabled={tutorialStep === 4 && tutorialSampleOrderState !== 'Entregado'}
                >
                  {tutorialStep === steps.length ? '¡Empezar!' : 
                   tutorialStep === 4 ? (tutorialSampleOrderState === 'Entregado' ? 'Continuar' : 'Sigue los pasos...') :
                   'Siguiente'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: '4px', marginTop: '12px', justifyContent: 'center' }}>
            {steps.map((_, i) => (
              <div key={i} style={{ 
                width: '6px', height: '6px', borderRadius: '50%', 
                background: i === tutorialStep - 1 ? 'var(--red-500)' : '#ddd' 
              }} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ─── Dashboard ───
  return (
    <div className="rd-page">
      {renderTutorial()}
      <header className="rd-header">
        <Link to="/">
          <img src="https://i.postimg.cc/Y0Ln7qb3/Digitalizacion-y-logistica-para-Santo-Tome-(1).png" alt="Weep" className="rd-logo" />
        </Link>
        <h1>Panel de Gestión</h1>
      </header>

      <main className="rd-main">
        {restaurant && (!profileLat || !profileLng || !profileAddress) && (
          <div className="address-warning-banner" style={{
            background: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            margin: '0 16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(255, 77, 79, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.5rem' }}>📍</span>
              <div style={{ flex: 1 }}>
                <strong style={{ color: '#cf1322', display: 'block', marginBottom: '4px' }}>Ubicación no configurada</strong>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#820014', lineHeight: '1.4' }}>
                  Tu local no tiene una dirección o ubicación exacta en el mapa. Es necesario configurarla para que los clientes puedan encontrarte.
                </p>
              </div>
            </div>
            <button 
              className="btn btn-primary btn-full" 
              style={{ background: '#ff4d4f', border: 'none', fontWeight: 'bold' }}
              onClick={() => {
                setView('profile');
                setProfileSubView('edit');
                setShowAddressSelector(true);
              }}
            >
              Configurar dirección ahora
            </button>
          </div>
        )}

        {restaurant && !restaurant.emailConfirmado && (
          <div className="unconfirmed-banner" style={{
            background: '#fff7e6',
            border: '1px solid #ffd591',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            margin: '0 16px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.9rem',
            color: '#874d00'
          }}>
            <span>⚠️ <strong>Email no confirmado:</strong> Por favor confirma tu dirección de correo para operar con normalidad.</span>
            <button 
              className="btn btn-sm" 
              style={{ background: '#faad14', color: '#fff', border: 'none' }}
              onClick={handleResendConfirmationService}
            >
              Reenviar enlace
            </button>
          </div>
        )}

        {notificationStatus === 'denied' && (
          <div className="rd-notification-banner banner-danger animate-fade-in">
            <img src="https://i.postimg.cc/mrfJz5P3/buscamos-repartidores-(8).png" alt="Alert" className="banner-icon" />
            <div className="banner-content">
              <strong>Notificaciones Bloqueadas</strong>
              <p>No recibirás avisos de nuevos pedidos. Habilítalas en la configuración de tu navegador para no perder ventas.</p>
            </div>
          </div>
        )}

        {notificationStatus === 'default' && (
          <div className="rd-notification-banner banner-warning animate-fade-in">
            <img src="https://i.postimg.cc/mrfJz5P3/buscamos-repartidores-(8).png" alt="Alert" className="banner-icon" />
            <div className="banner-content">
              <strong>Habilitar Notificaciones</strong>
              <p>Activá las notificaciones para enterarte al instante cuando recibas un nuevo pedido.</p>
              <button 
                className="btn btn-primary btn-xs" 
                style={{ marginTop: '8px', background: 'var(--red-600)', borderColor: 'var(--red-600)' }}
                onClick={async () => {
                  if (window.OneSignalDeferred) {
                    window.OneSignalDeferred.push(async (OneSignal) => {
                      await OneSignal.Notifications.requestPermission();
                    });
                  }
                }}
              >
                Activar Notificaciones
              </button>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="rd-topbar animate-fade-in">
          <div className="rd-topbar-left">
            <label className="toggle" onClick={toggleEstado}>
              <input type="checkbox" checked={localOpen} readOnly />
              <span className="toggle-track" />
              <span className="toggle-thumb" />
            </label>
            <span className={`rd-status ${localOpen ? 'open' : ''}`}>{localOpen ? 'Abierto' : 'Cerrado'}</span>
            
            <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #ddd', paddingLeft: '16px' }}>
               <div style={{ 
                 width: '10px', 
                 height: '10px', 
                 borderRadius: '50%', 
                 backgroundColor: hasRepartidores ? '#00e676' : '#ffa000',
                 boxShadow: hasRepartidores ? '0 0 8px #00e676' : '0 0 8px #ffa000'
               }}></div>
               <span style={{ fontSize: '0.75rem', fontWeight: 700, color: hasRepartidores ? 'var(--green-600)' : 'var(--amber-600)' }}>
                 REPARTIDORES: {hasRepartidores ? 'ACTIVOS' : 'NO DISPONIBLES'}
               </span>
            </div>
          </div>
          <div className="rd-topbar-right">
            {profileData?.foto_url && <img src={profileData.foto_url} alt="" className="rd-avatar" />}
            
            <div className="rd-dropdown-container">
              <button 
                className={`btn btn-ghost btn-sm ${view === 'profile' ? 'active' : ''}`} 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (isUnlocked) {
                    setProfileMenuOpen(!profileMenuOpen);
                  } else {
                    setOnSecuritySuccess(() => () => setProfileMenuOpen(true));
                    setSecurityModalOpen(true);
                  }
                }}
              >
                Mi Perfil ▾
              </button>
              
              {profileMenuOpen && (
                <div className="rd-dropdown-menu animate-fade-in">
                  {localUserRole === 'Admin' && (
                    <>
                      <button className="rd-dropdown-item" onClick={() => { setView('profile'); setProfileSubView('ventas'); loadOrders(); }}>
                        💰 Mis Ventas
                      </button>
                      <button className="rd-dropdown-item" onClick={() => { setView('profile'); setProfileSubView('cobros'); loadCobros(); }}>
                        🏦 Gestión de Pagos
                      </button>
                      <button className="rd-dropdown-item" onClick={() => { setView('profile'); setProfileSubView('edit'); loadProfile(); }}>
                        👤 Editar Perfil
                      </button>
                    </>
                  )}
                  <button className="rd-dropdown-item" onClick={() => { setShowTutorial(true); setTutorialStep(1); setView('orders'); setProfileMenuOpen(false); }} style={{ color: 'var(--blue-600)', fontWeight: 'bold' }}>
                    📖 Ver tutorial
                  </button>
                  <button className="rd-dropdown-item" onClick={() => { setView('profile'); setProfileSubView('printing'); setProfileMenuOpen(false); }} style={{ color: 'var(--green-600)', fontWeight: 'bold' }}>
                    🖨️ Impresión Ticket
                  </button>
                </div>
              )}
            </div>



            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-500)' }} onClick={() => { logoutRestaurant(); window.location.reload(); }}>Salir</button>
          </div>
        </div>

        {/* Persistent Alerts for Missing Configs */}
        {profileData && (
          <div className="rd-alerts" style={{ padding: '0 16px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(!profileData.mp_access_token) && (
              <div style={{ backgroundColor: '#fffbe6', border: '1px solid #ffe58f', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#d48800', fontWeight: '500' }}>⚠️ <strong>Mercado Pago desvinculado:</strong> Vinculá tu cuenta para recibir pagos online.</span>
                <button className="btn btn-sm" style={{ backgroundColor: '#faad14', color: '#fff', border: 'none' }} onClick={() => { setView('profile'); loadProfile(); }}>Vincular</button>
              </div>
            )}
            {(!profileData.horario_apertura || !profileData.horario_cierre) && (
              <div style={{ backgroundColor: '#fff1f0', border: '1px solid #ffa39e', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#cf1322', fontWeight: '500' }}>⏰ <strong>Horarios sin configurar:</strong> Establecé el horario de cierre de cocina para gestionar pedidos automáticos.</span>
                <button className="btn btn-sm" style={{ backgroundColor: '#ff4d4f', color: '#fff', border: 'none' }} onClick={() => { setView('profile'); loadProfile(); }}>Configurar</button>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="rd-nav animate-slide-up" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          <button className={`rd-nav-btn ${view === 'orders' ? 'active' : ''}`} onClick={() => { setView('orders'); loadOrders(); }}>
            📋 Pedidos
            {(pendingCount > 0 || (showTutorial && tutorialSampleOrderState === 'Pendiente')) && (
              <span className="rd-nav-badge">
                {pendingCount + (showTutorial && tutorialSampleOrderState === 'Pendiente' ? 1 : 0)}
              </span>
            )}
          </button>
          
          {localUserRole === 'Admin' && (
            <>
              <button className={`rd-nav-btn ${view === 'menu' ? 'active' : ''}`} 
                onClick={() => { 
                  if (isUnlocked) {
                    setView('menu'); loadMenu(); 
                  } else {
                    setOnSecuritySuccess(() => () => { setView('menu'); loadMenu(); });
                    setSecurityModalOpen(true);
                  }
                }}
              >
                📖 Menú
              </button>
              <button className={`rd-nav-btn ${view === 'plans' ? 'active' : ''}`} onClick={() => { 
                if (isUnlocked) {
                   setView('plans'); loadPlanInfo();
                } else {
                   setOnSecuritySuccess(() => () => { setView('plans'); loadPlanInfo(); });
                   setSecurityModalOpen(true);
                }
              }}>🚀 Planes</button>
              
              <div className="rd-dropdown-container">
                <button 
                  className={`rd-nav-btn ${(view === 'addItem' || view === 'sabores') ? 'active' : ''}`} 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (isUnlocked) {
                      setAddMenuOpen(!addMenuOpen);
                    } else {
                      setOnSecuritySuccess(() => () => setAddMenuOpen(true));
                      setSecurityModalOpen(true);
                    }
                  }}
                >
                  ➕ Añadir ▾
                </button>
                {addMenuOpen && (
                  <div className="rd-dropdown-menu animate-fade-in" style={{ left: 0, right: 'auto' }}>
                    <button className="rd-dropdown-item" onClick={() => { setEditItem(null); setView('addItem'); setItemCategory(''); setAddMenuOpen(false); }}>
                      🍔 Nuevo Plato
                    </button>
                    <button className="rd-dropdown-item" onClick={() => { setView('sabores'); loadSabores(); setAddMenuOpen(false); }}>
                      🍦 Sabores y Adicionales
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </nav>

        {/* ─── Orders View ─── */}
        {view === 'orders' && (
          <section className="animate-fade-in">
            {planInfo && (
              <div className="gamification-pill card" 
                onClick={() => {
                  if (isUnlocked) {
                    setView('plans');
                  } else {
                    setOnSecuritySuccess(() => () => setView('plans'));
                    setSecurityModalOpen(true);
                  }
                }} 
                style={{ 
                cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: '16px', margin: '0 0 16px', 
                background: 'linear-gradient(135deg, #fff 0%, #fffafa 100%)', borderLeft: '4px solid #e63946',
                boxShadow: '0 4px 15px rgba(230, 57, 70, 0.08)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.5rem' }}>💎</span>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>Plan {planInfo?.plan_nombre || 'Visible'}</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--red-600)', fontWeight: 700 }}>Nivel {getLevelName(planInfo?.nivel_actual) || 'Despegue'} • {planInfo?.comision_actual ?? '--'}% comisión</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{planInfo?.metricas_mes?.pedidos ?? 0} pedidos</span>
                    <p style={{ margin: 0, fontSize: '0.65rem', color: '#64748b' }}>últimos 30 d</p>
                  </div>
                </div>

                {/* Barra de Progreso Multi-Nivel */}
                <div style={{ width: '100%', marginTop: '4px' }}>
                  <div style={{ position: 'relative', height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{ 
                      width: `${Math.min(100, ((planInfo?.metricas_mes?.pedidos || 0) / 50) * 100)}%`, 
                      height: '100%', background: 'linear-gradient(90deg, #e63946 0%, #ff4d4f 100%)', 
                      borderRadius: '5px', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' 
                    }}></div>
                    
                    {/* Marcadores de niveles */}
                    <div style={{ position: 'absolute', left: '30%', top: 0, width: '2px', height: '100%', background: 'rgba(255,255,255,0.4)' }}></div>
                    <div style={{ position: 'absolute', left: '60%', top: 0, width: '2px', height: '100%', background: 'rgba(255,255,255,0.4)' }}></div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <span style={{ color: planInfo.nivel_actual >= 1 ? '#e63946' : 'inherit' }}>Despegue</span>
                    <span style={{ color: planInfo.nivel_actual >= 2 ? '#e63946' : 'inherit', marginLeft: '10%' }}>Crecimiento</span>
                    <span style={{ color: planInfo.nivel_actual >= 3 ? '#e63946' : 'inherit', marginLeft: '10%' }}>Experto</span>
                    <span style={{ color: planInfo.nivel_actual >= 4 ? '#e63946' : 'inherit' }}>Nivel Pro</span>
                  </div>
                </div>

                {planInfo?.proximo_nivel ? (
                  <p style={{ margin: '12px 0 0', fontSize: '0.75rem', color: '#475569', textAlign: 'center' }}>
                    Faltan <strong>{planInfo.proximo_nivel.falta_pedidos} pedidos</strong> para llegar a <strong>{planInfo.proximo_nivel.nombre}</strong>. ¡Bajá a <strong>{planInfo.proximo_nivel.comision}%</strong> de comisión!
                  </p>
                ) : (
                  <p style={{ margin: '12px 0 0', fontSize: '0.75rem', color: '#059669', textAlign: 'center', fontWeight: 700 }}>
                    ¡Has alcanzado el máximo nivel! 🏆 Beneficio: {planInfo?.comision_actual ?? '--'}% comisión
                  </p>
                )}
              </div>
            )}
            <div style={{ marginBottom: '16px' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="🔍 Buscar por ID de pedido (#...)" 
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
              />
            </div>
            <div className="rd-tabs" style={{ gap: 8 }}>
              <button className={currentTab === 'pendientes' ? 'active' : ''} onClick={() => setCurrentTab('pendientes')} style={{ position: 'relative' }}>
                Pendientes <span className="badge badge-amber" style={{ marginLeft: 6 }}>{pendientesOrders.length + (showTutorial && tutorialSampleOrderState === 'Pendiente' ? 1 : 0)}</span>
              </button>
              <button className={currentTab === 'preparacion' ? 'active' : ''} onClick={() => setCurrentTab('preparacion')} style={{ position: 'relative' }}>
                En Preparación <span className="badge badge-info" style={{ marginLeft: 6 }}>{preparacionOrders.length + (showTutorial && tutorialSampleOrderState === 'Aceptado' ? 1 : 0)}</span>
              </button>
              <button className={currentTab === 'listos' ? 'active' : ''} onClick={() => setCurrentTab('listos')} style={{ position: 'relative' }}>
                Listos <span className="badge badge-blue" style={{ marginLeft: 6 }}>{listosOrders.length + (showTutorial && tutorialSampleOrderState === 'Listo' ? 1 : 0)}</span>
              </button>
            </div>
            {ordersLoading ? (
              <div className="loading-state"><div className="spinner" /> Cargando...</div>
            ) : finalOrders.length === 0 ? (
              <p className="rd-empty">No hay pedidos en esta sección</p>
            ) : finalOrders.map(o => (
              <OrderCard 
                key={o.idPedidoLocal} 
                order={o} 
                onAction={async (order, action) => {
                  if (action === 'RechazarClick') {
                    setOrderToReject(order);
                    setRejectionModalOpen(true);
                    return;
                  }
                  if (order.idPedidoLocal === 'sample-order-1') {
                    if (action === 'Aceptado') {
                       setTutorialSampleOrderState('Aceptado');
                       setCurrentTab('preparacion');
                       toast.success('¡Pedido aceptado! El pedido se movió a En preparación (Muestra)');
                    } else if (action === 'Listo') {
                       setTutorialSampleOrderState('Listo');
                       setCurrentTab('listos');
                       toast.success('¡Pedido listo! El pedido se movió a Listos (Muestra)');
                    } else if (action === 'Entregado') {
                       setTutorialSampleOrderState('Entregado');
                       toast.success('¡Pedido entregado! El pedido se movió a Ventas (Muestra)');
                       setTutorialStep(5); // Move to next step if in tutorial
                    }
                  } else {
                    await handleOrderAction(order, action);
                  }
                }} 
              />
            ))}
          </section>
        )}
        {view === 'plans' && renderPlansView()}

        {/* ─── Menu View ─── */}
        {view === 'menu' && (
          <section className="animate-fade-in">
            <div className="card card-body" style={{ marginBottom: 24, border: '1px solid #feb2b2', background: '#fff5f5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <h3 style={{ color: 'var(--red-600)', marginBottom: 12, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>🎁 Descuento General del Local</h3>
                  <p style={{ fontSize: '0.85rem', color: '#742a2a', marginBottom: 12 }}>Este descuento se aplica automáticamente a todos tus platos los días seleccionados (excepto a los platos que ya tengan un descuento propio).</p>
                  
                  <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input 
                          name="descuento_general" 
                          type="number" 
                          className="form-input" 
                          style={{ width: '80px', marginBottom: 0 }} 
                          defaultValue={profileData?.descuento_general || 0} 
                        />
                        <span style={{ fontWeight: 700, color: 'var(--red-600)' }}>% OFF</span>
                        <button type="submit" className="btn btn-success btn-sm">Guardar %</button>
                     </div>
                     
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => {
                          const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                          const isSelected = profileData?.dias_descuento?.some(d => normalize(d) === normalize(day));
                          return (
                            <label key={day} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: 'white', padding: '4px 10px', borderRadius: '8px', border: '1px solid #feb2b2', fontSize: '0.8rem', cursor: 'pointer' }}>
                              <input type="checkbox" name={`desc_${day}`} defaultChecked={isSelected} onChange={() => {
                                  // We trigger form submit on checkbox change for convenience
                                  // but keep the hidden inputs for other profile fields
                              }} />
                              {day}
                            </label>
                          );
                        })}
                        <button type="submit" className="btn btn-ghost btn-xs" style={{ color: 'var(--red-600)', textDecoration: 'underline' }}>Guardar Días</button>
                     </div>

                     {/* Hidden profile fields for handleSaveProfile compatibility */}
                     <div style={{ display: 'none' }}>
                        <input name="nombre" defaultValue={profileData?.nombre} />
                        <input name="email" defaultValue={profileData?.email} />
                        <input name="horario_apertura" defaultValue={profileData?.horario_apertura} />
                        <input name="horario_cierre" defaultValue={profileData?.horario_cierre} />
                        <input name="modo_automatico" defaultValue={profileData?.modo_automatico ? 'true' : 'false'} />
                        <input type="checkbox" name="acepta_retiro" defaultChecked={profileData?.acepta_retiro !== false} />
                        <input type="checkbox" name="acepta_envio" defaultChecked={profileData?.acepta_envio !== false} />
                        {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => (
                          <input key={day} type="checkbox" name={`day_${day}`} defaultChecked={profileData?.dias_apertura?.some(d => d.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === day.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())} />
                        ))}
                     </div>
                  </form>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
                   <button className="btn btn-success" onClick={() => { setEditItem(null); setItemCategory(''); setItemName(''); setView('addItem'); }}>+ Nuevo Plato</button>
                   <div style={{ padding: '8px 12px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>
                      Estado hoy: {(() => {
                        const today = new Date().toLocaleString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
                        const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                        const isPromo = profileData?.dias_descuento?.some(d => normalize(d) === normalize(today));
                        return isPromo ? <span style={{ color: 'var(--red-600)' }}>🔥 PROMO {profileData?.descuento_general}% OFF</span> : <span style={{ color: 'var(--gray-500)' }}>Sin promo general</span>;
                      })()}
                   </div>
                </div>
              </div>
            </div>
            <div className="rd-menu-filters">
              <input className="form-input" placeholder="🔍 Buscar plato..." value={menuFilter} onChange={e => setMenuFilter(e.target.value)} />
              <select className="form-select" value={menuCatFilter} onChange={e => setMenuCatFilter(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {menuLoading ? (
              <div className="loading-state"><div className="spinner" /> Cargando menú...</div>
            ) : finalMenu.length === 0 ? (
              <p className="rd-empty">No hay platos. ¡Agregá tu primer plato!</p>
            ) : finalMenu.map(item => (
              <div key={item.id} className="rd-menu-item card">
                {item.imagen_url ? <img src={item.imagen_url} alt={item.nombre} className="rd-menu-img" /> :
                  <div className="rd-menu-img-placeholder">Sin foto</div>}
                <div className="rd-menu-info">
                  <div className="rd-menu-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3>{item.nombre}</h3>
                      <p>{item.descripcion || ''}</p>
                      <span className="badge badge-gray">{item.categoria || 'Sin categoría'}</span>
                    </div>
                    
                    <div style={{ textAlign: 'right', minWidth: '120px' }}>
                      {(() => {
                         const basePrice = Number(item.precio);
                         const itemDiscountPercent = Number(item.descuento || 0);
                         
                         const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                         const today = new Date().toLocaleString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
                         const isPromoDay = profileData?.dias_descuento?.some(d => normalize(d) === normalize(today));
                         const generalDiscountPercent = isPromoDay ? Number(profileData?.descuento_general || 0) : 0;
                         
                         // EXCLUSIVE LOGIC: Item discount OR General discount
                         let finalPrice = basePrice;
                         let hasAnyDiscount = false;

                         if (itemDiscountPercent > 0) {
                           finalPrice = Math.round(basePrice * (1 - itemDiscountPercent / 100));
                           hasAnyDiscount = true;
                         } else if (generalDiscountPercent > 0) {
                           finalPrice = Math.round(basePrice * (1 - generalDiscountPercent / 100));
                           hasAnyDiscount = true;
                         }

                         return (
                           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {hasAnyDiscount && (
                                  <span style={{ textDecoration: 'line-through', color: 'var(--gray-400)', fontSize: '0.8rem' }}>${basePrice}</span>
                                )}
                                <span className="rd-menu-price" style={{ color: hasAnyDiscount ? 'var(--red-600)' : 'inherit', fontSize: '1.2rem', fontWeight: 800 }}>${finalPrice}</span>
                             </div>
                             {itemDiscountPercent > 0 && (
                               <span style={{ fontSize: '0.65rem', color: 'var(--red-500)', fontWeight: 700, marginBottom: 2 }}>PROMO PLATO</span>
                             )}
                             {itemDiscountPercent === 0 && generalDiscountPercent > 0 && (
                               <span style={{ fontSize: '0.65rem', color: 'var(--red-500)', fontWeight: 700, marginBottom: 2 }}>PROMO LOCAL</span>
                             )}
                             <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                               <label style={{ fontSize: '0.7rem', color: 'var(--gray-500)', fontWeight: 600 }}>Dcto %:</label>
                               <input 
                                 type="number" 
                                 defaultValue={item.descuento || 0}
                                 className="form-input"
                                 style={{ width: '60px', padding: '4px', fontSize: '0.75rem', marginBottom: 0, textAlign: 'center' }}
                                 onBlur={async (e) => {
                                   const val = parseFloat(e.target.value) || 0;
                                   try {
                                     await api.updateMenuItemDiscount(item.id, val);
                                     toast.success(`Descuento de ${item.nombre} actualizado`);
                                     loadMenu();
                                   } catch { toast.error('Error al actualizar'); }
                                 }}
                               />
                             </div>
                           </div>
                         );
                      })()}
                    </div>
                  </div>
                  <div className="rd-menu-bottom">
                    <label className="toggle" onClick={() => handleToggleDisp(item.id, item.disponibilidad)}>
                      <input type="checkbox" checked={item.disponibilidad === true} readOnly />
                      <span className="toggle-track" />
                      <span className="toggle-thumb" />
                    </label>
                    <span className="rd-disp-text">{item.disponibilidad ? 'Disponible' : 'No disponible'}</span>
                    <div className="rd-menu-actions">
                      <button className="btn btn-sm" style={{ background: 'var(--amber-500)', color: '#fff' }} onClick={() => { setEditItem(item); setView('addItem'); }}>Editar</button>
                      <button className="btn btn-sm" style={{ background: 'var(--red-500)', color: '#fff' }} onClick={() => handleDeleteItem(item.id)}>Eliminar</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ─── Add/Edit Item ─── */}
        {view === 'addItem' && (
          <section className="animate-fade-in">
            <div className="card card-body">
              <h2 style={{ color: 'var(--red-600)', marginBottom: 16 }}>{editItem ? 'Editar Plato' : 'Nuevo Plato'}</h2>
              <form onSubmit={handleSaveItem} className="rd-item-form">
                <div className="rd-form-row">
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input 
                        name="nombre" 
                        className="form-input" 
                        placeholder="Nombre del plato" 
                        value={editItem ? undefined : itemName}
                        defaultValue={editItem ? editItem.nombre : undefined}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (!editItem && itemCategory === 'Combos') {
                            if (!val.toUpperCase().startsWith('COMBO ')) {
                              val = 'COMBO ' + val.replace(/^COMBO\s*/i, '');
                            }
                            if (val.length < 6) val = 'COMBO ';
                          }
                          if (!editItem) setItemName(val);
                        }}
                        required 
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                  <select 
                    name="categoria" 
                    className="form-select" 
                    defaultValue={editItem?.categoria || ''} 
                    required 
                    onChange={(e) => setItemCategory(e.target.value)}
                  >
                    <option value="">Categoría</option>
                    <option value="Hamburguesas">Hamburguesas</option>
                    <option value="Pizzas">Pizzas</option>
                    <option value="Empanadas">Empanadas</option>
                    <option value="Panchos">Panchos</option>
                    <option value="Cafetería">Cafetería</option>
                    <option value="Carnicería">Carnicería</option>
                    <option value="Helados">Helados</option>
                    <option value="Combos">Combos</option>
                    <option value="Bebidas">Bebidas</option>
                  </select>
                </div>
                <textarea name="descripcion" className="form-textarea" rows={2} placeholder="Descripción" defaultValue={editItem?.descripcion || ''} />
                
                <div className="rd-form-row rd-form-row-3">
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Precio Regular ($)</label>
                    <input name="precio" type="number" className="form-input" placeholder="Precio" step="0.01" defaultValue={editItem?.precio || ''} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Descuento Ítem (%)</label>
                    <input name="descuento" type="number" className="form-input" placeholder="Ej: 15" step="0.1" defaultValue={editItem?.descuento || 0} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Disponibilidad</label>
                    <select name="disponibilidad" className="form-select" defaultValue={editItem ? (editItem.disponibilidad ? 'true' : 'false') : 'true'}>
                      <option value="true">Disponible</option>
                      <option value="false">No disponible</option>
                    </select>
                  </div>
                </div>

                {/* ─── Helados Configuration ─── */}
                {(() => {
                  if (itemCategory !== 'Helados' && editItem?.categoria !== 'Helados') return null;
                  
                  let iceConfig = {};
                  try {
                    iceConfig = typeof editItem?.variantes === 'string' ? JSON.parse(editItem.variantes) : (editItem?.variantes || {});
                  } catch(e) {}
                  const p = iceConfig.precios || {};

                  return (
                    <div className="card" style={{ padding: '16px', marginBottom: '16px', background: '#fff5f5', border: '1px solid #feb2b2' }}>
                      <h3 style={{ fontSize: '1rem', color: 'var(--red-600)', marginBottom: '12px' }}>🍦 Configuración de Helados</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>1/4 kg</label>
                          <input name="p_14" type="number" className="form-input" placeholder="Precio" defaultValue={p['1/4kg']?.precio || ''} />
                          <input name="m_14" type="number" className="form-input" placeholder="Máx sabores" defaultValue={p['1/4kg']?.max || 3} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>1/2 kg</label>
                          <input name="p_12" type="number" className="form-input" placeholder="Precio" defaultValue={p['1/2kg']?.precio || ''} />
                          <input name="m_12" type="number" className="form-input" placeholder="Máx sabores" defaultValue={p['1/2kg']?.max || 3} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>1 kg</label>
                          <input name="p_1" type="number" className="form-input" placeholder="Precio" defaultValue={p['1kg']?.precio || ''} />
                          <input name="m_1" type="number" className="form-input" placeholder="Máx sabores" defaultValue={p['1kg']?.max || 4} />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ─── Advanced Configuration (Variants/Extras) ─── */}
                {(itemCategory !== 'Helados' && itemCategory !== 'Base' && (itemCategory !== '' || editItem)) && (
                  <div className="card" style={{ padding: '16px', marginBottom: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--red-600)', marginBottom: '12px' }}>✨ Configuración de Variantes y Extras</h3>
                    
                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '4px', color: 'var(--gray-700)' }}>Variantes (Simple, Doble, etc.)</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '8px' }}>El cliente debe elegir una sola opción. Cada una tiene su propio precio total.</p>
                      {burgerVariants.map((v, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input placeholder="Nombre" className="form-input" style={{ flex: 2, marginBottom: 0 }} value={v.nombre} onChange={(e) => { const newV = [...burgerVariants]; newV[idx].nombre = e.target.value; setBurgerVariants(newV); }} />
                          <input placeholder="Precio" type="number" className="form-input" style={{ flex: 1, marginBottom: 0 }} value={v.precio} onChange={(e) => { const newV = [...burgerVariants]; newV[idx].precio = e.target.value; setBurgerVariants(newV); }} />
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBurgerVariants(burgerVariants.filter((_, i) => i !== idx))}>✕</button>
                        </div>
                      ))}
                      <button type="button" className="btn btn-secondary btn-xs" onClick={() => setBurgerVariants([...burgerVariants, { nombre: '', precio: '' }])}>+ Añadir Variante</button>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '4px', color: 'var(--gray-700)' }}>Extras (Bacon, Cheddar, etc.)</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '8px' }}>Son adicionales opcionales que se suman al precio de la variante elegida.</p>
                      {burgerExtras.map((ex, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input placeholder="Nombre extra" className="form-input" style={{ flex: 2, marginBottom: 0 }} value={ex.nombre} onChange={(e) => { const newE = [...burgerExtras]; newE[idx].nombre = e.target.value; setBurgerExtras(newE); }} />
                          <input placeholder="Precio" type="number" className="form-input" style={{ flex: 1, marginBottom: 0 }} value={ex.precio} onChange={(e) => { const newE = [...burgerExtras]; newE[idx].precio = e.target.value; setBurgerExtras(newE); }} />
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBurgerExtras(burgerExtras.filter((_, i) => i !== idx))}>✕</button>
                        </div>
                      ))}
                      <button type="button" className="btn btn-secondary btn-xs" onClick={() => setBurgerExtras([...burgerExtras, { nombre: '', precio: '' }])}>+ Añadir Extra</button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', borderTop: '1px solid #edf2f7', paddingTop: '15px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                        <input type="checkbox" name="ofrecer_papas" checked={burgerOfferPapas} onChange={(e) => setBurgerOfferPapas(e.target.checked)} />
                        Ofrecer con papas
                      </label>
                      {burgerOfferPapas && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.8rem' }}>Precio extra papas: $</span>
                          <input name="precio_papas" type="number" className="form-input" style={{ width: '80px', marginBottom: 0 }} value={burgerPrecioPapas} onChange={(e) => setBurgerPrecioPapas(e.target.value)} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <input name="foto" type="file" className="form-input" accept="image/*" />
                <div className="rd-form-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => { setEditItem(null); setView('menu'); loadMenu(); }}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={itemLoading}>
                    {itemLoading ? <span className="spinner spinner-white" /> : (editItem ? 'Guardar Cambios' : 'Guardar Plato')}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* ─── Gestión de Helados (Sabores, Salsas, Adicionales) ─── */}
        {view === 'sabores' && (
          <section className="animate-fade-in">
            <h2 style={{ color: 'var(--red-600)', marginBottom: 24, textAlign: 'center' }}>Gestión de Helados</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Sección Sabores y Salsas */}
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>🍦 Sabores y Salsas</h3>
                <div className="card card-body" style={{ marginBottom: 16 }}>
                  <form onSubmit={handleAddSabor} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input name="nombre" className="form-input" placeholder="Nombre (Ej: Dulce de Leche)" required />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select name="tipo" className="form-select" style={{ flex: 1 }}>
                        <option value="Sabor">Es un Sabor</option>
                        <option value="Salsa">Es una Salsa</option>
                      </select>
                      <button type="submit" className="btn btn-primary">Agregar</button>
                    </div>
                  </form>
                </div>

                {saboresLoading ? (
                  <div className="loading-state"><div className="spinner" /> Cargando...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
                    {sabores.length === 0 ? <p className="rd-empty" style={{ padding: 10 }}>No hay sabores/salsas</p> : 
                     sabores.map(s => (
                      <div key={s.id} className="card" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <label className="toggle">
                            <input type="checkbox" checked={s.disponible} onChange={() => handleToggleSaborDisp(s.id, s.disponible)} />
                            <span className="toggle-track" />
                            <span className="toggle-thumb" />
                          </label>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: s.disponible ? 'inherit' : 'var(--gray-400)' }}>{s.nombre}</span>
                            <span className={`badge ${s.tipo === 'Salsa' ? 'badge-amber' : 'badge-blue'}`} style={{ marginLeft: 8, fontSize: '0.7rem' }}>{s.tipo}</span>
                          </div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteSabor(s.id)} style={{ color: 'var(--red-500)', padding: 4 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sección Adicionales (Pagos) */}
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>📦 Adicionales (Con Precio)</h3>
                <div className="card card-body" style={{ marginBottom: 16 }}>
                  <form onSubmit={handleAddAdicional} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input name="nombre" className="form-input" placeholder="Nombre (Ej: Cucurucho)" required />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input name="precio" type="number" className="form-input" placeholder="Precio $" style={{ flex: 1 }} required />
                      <button type="submit" className="btn btn-success">Agregar</button>
                    </div>
                  </form>
                </div>

                {adicionalesLoading ? (
                  <div className="loading-state"><div className="spinner" /> Cargando...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
                    {adicionales.length === 0 ? <p className="rd-empty" style={{ padding: 10 }}>No hay adicionales</p> : 
                     adicionales.map(a => (
                      <div key={a.id} className="card" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <label className="toggle">
                            <input type="checkbox" checked={a.disponible} onChange={() => handleToggleAdicionalDisp(a.id, a.disponible)} />
                            <span className="toggle-track" />
                            <span className="toggle-thumb" />
                          </label>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: a.disponible ? 'inherit' : 'var(--gray-400)' }}>{a.nombre}</span>
                            <span style={{ marginLeft: 8, color: 'var(--red-600)', fontWeight: 700, fontSize: '0.9rem' }}>${a.precio}</span>
                          </div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteAdicional(a.id)} style={{ color: 'var(--red-500)', padding: 4 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ─── Profile ─── */}
        {view === 'profile' && (
          <section className="animate-fade-in">
            <div className="rd-tabs" style={{ gap: 8, marginBottom: 24 }}>
              <button className={profileSubView === 'ventas' ? 'active' : ''} onClick={() => setProfileSubView('ventas')}>
                💰 Mis Ventas
              </button>
              <button className={profileSubView === 'cobros' ? 'active' : ''} onClick={() => { setProfileSubView('cobros'); loadCobros(); }}>
                🏦 Gestión de Pagos
              </button>
              <button className={profileSubView === 'edit' ? 'active' : ''} onClick={() => setProfileSubView('edit')}>
                👤 Editar Perfil
              </button>
              <button className={profileSubView === 'printing' ? 'active' : ''} onClick={() => setProfileSubView('printing')}>
                🖨️ Impresión Ticket
              </button>
            </div>

            {profileSubView === 'ventas' && (
              <div className="card" style={{ padding: '16px', overflowX: 'auto' }}>
                <h2 style={{ color: 'var(--red-600)', marginBottom: 16 }}>Mis Ventas</h2>
                {finishedOrders.length === 0 ? (
                  <p className="rd-empty">No hay ventas registradas aún.</p>
                ) : (
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                        <th style={{ padding: '12px 8px' }}>Pedido #</th>
                        <th style={{ padding: '12px 8px' }}>Fecha</th>
                        <th style={{ padding: '12px 8px' }}>Cliente</th>
                        <th style={{ padding: '12px 8px' }}>Método</th>
                        <th style={{ padding: '12px 8px' }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finishedOrders.map(o => (
                        <tr key={o.idPedidoLocal} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                          <td style={{ padding: '12px 8px' }}>#{o.idPedido.substring(0, 8)}</td>
                          <td style={{ padding: '12px 8px' }}>{o.fecha ? new Date(o.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit', timeZone: 'America/Argentina/Buenos_Aires' }) : '---'}</td>
                          <td style={{ padding: '12px 8px' }}>{o.nombreCliente}</td>
                          <td style={{ padding: '12px 8px', textTransform: 'capitalize' }}>{o.metodoPago}</td>
                          <td style={{ padding: '12px 8px', fontWeight: '600', color: 'var(--red-600)' }}>
                            ${o.totalLocal.toFixed(0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {profileSubView === 'cobros' && (
              <div className="card card-body">
                <h2 style={{ color: 'var(--red-600)', marginBottom: 16, textAlign: 'center' }}>Gestión de Pagos</h2>
                <p style={{ textAlign: 'center', color: 'var(--gray-500)', marginBottom: 24 }}>Comisión Weep {planInfo?.comision_actual ?? 8}% • Abona tu saldo pendiente por transferencia</p>
                
                {cobrosLoading || !cobrosData ? (
                  <div className="loading-state"><div className="spinner" /> Cargando...</div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                      {/* Total */}
                      <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid var(--gray-400)' }}>
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.85rem' }}>Total ventas</p>
                        <h3 style={{ margin: '8px 0 0', fontSize: '1.5rem' }}>${cobrosData.totalVentas}</h3>
                      </div>
                      <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid var(--amber-500)' }}>
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.85rem' }}>Comisión Total ({planInfo?.comision_actual ?? 8}%)</p>
                        <h3 style={{ margin: '8px 0 0', fontSize: '1.5rem', color: 'var(--amber-600)' }}>${cobrosData.comisionTotal}</h3>
                      </div>

                      {/* Transferencia */}
                      <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid #bae6fd' }}>
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.85rem' }}>Ventas Transferencia</p>
                        <h3 style={{ margin: '8px 0 0', fontSize: '1.5rem' }}>${cobrosData.ventasTransf}</h3>
                      </div>
                      <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid var(--green-500)' }}>
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.85rem' }}>Comisión saldada</p>
                        <h3 style={{ margin: '8px 0 0', fontSize: '1.5rem', color: 'var(--green-600)' }}>${cobrosData.comisionSaldada}</h3>
                      </div>

                      {/* Efectivo */}
                      <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid #fed7aa' }}>
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.85rem' }}>Ventas Efectivo</p>
                        <h3 style={{ margin: '8px 0 0', fontSize: '1.5rem' }}>${cobrosData.ventasEfectivo}</h3>
                      </div>
                      <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid var(--red-600)' }}>
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.85rem' }}>Comisión Pendiente</p>
                        <h3 style={{ margin: '8px 0 0', fontSize: '1.5rem', color: 'var(--red-600)' }}>${cobrosData.comisionPendiente}</h3>
                      </div>
                    </div>

                    {cobrosData.comisionPendiente > 0 && (
                      <div className="animate-fade-in" style={{ backgroundColor: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
                        <h3 style={{ color: '#9a3412', marginBottom: '16px', textAlign: 'center' }}>Pagar Saldo Pendiente</h3>
                        <p style={{ textAlign: 'center', fontSize: '0.95rem', color: '#7c2d12', marginBottom: '20px' }}>
                          Para saldar tu comisión de pedidos en efectivo, realizá una transferencia a la siguiente cuenta y adjuntá el comprobante.
                        </p>
                        
                        <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                            <div>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#9a3412' }}>Nombre de cuenta</p>
                              <p style={{ margin: 0, fontWeight: '600' }}>Axel Damian Martinez</p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                            <div>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#9a3412' }}>Alias</p>
                              <p style={{ margin: 0, fontWeight: '600' }}>weep.ar</p>
                            </div>
                            <button className="btn btn-sm btn-ghost" onClick={() => { navigator.clipboard.writeText('weep.ar'); toast.success('Alias copiado'); }}>Copiar</button>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                            <div>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#9a3412' }}>CVU</p>
                              <p style={{ margin: 0, fontWeight: '600', fontSize: '0.85rem' }}>0000003100022130092564</p>
                            </div>
                            <button className="btn btn-sm btn-ghost" onClick={() => { navigator.clipboard.writeText('0000003100022130092564'); toast.success('CVU copiado'); }}>Copiar</button>
                          </div>
                          
                          <div style={{ marginTop: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', fontWeight: '600' }}>Adjuntar comprobante (imagen)</label>
                            <input type="file" id="comprobante_pago" accept="image/*" className="form-input" style={{ marginBottom: '16px' }} />
                            
                            <button 
                              className="btn btn-success btn-full" 
                              onClick={async () => {
                                const fileInput = document.getElementById('comprobante_pago');
                                const file = fileInput?.files[0];
                                if (!file) { toast.error('Debes adjuntar el comprobante'); return; }
                                
                                setCobrosLoading(true);
                                try {
                                  const imgUrl = await api.uploadImage(file);
                                  const res = await api.solicitarCobro(restaurant.id, cobrosData.comisionPendiente, imgUrl);
                                  if (res.success) {
                                    toast.success('Pago solicitado correctamente');
                                    loadCobros();
                                  } else {
                                    toast.error(res.error || 'Error al enviar');
                                  }
                                } catch (e) {
                                  toast.error('Error al subir comprobante');
                                }
                                setCobrosLoading(false);
                              }}
                            >
                              Confirmar y Pagar Saldo (${cobrosData.comisionPendiente})
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <h3 style={{ color: 'var(--red-600)', marginBottom: 16 }}>Historial de Pago</h3>
                    <div className="card" style={{ padding: '16px', overflowX: 'auto' }}>
                      {cobrosData.historial.length === 0 ? (
                        <p className="rd-empty">No hay solicitudes anteriores.</p>
                      ) : (
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                              <th style={{ padding: '12px 8px' }}>Fecha</th>
                              <th style={{ padding: '12px 8px' }}>Monto</th>
                              <th style={{ padding: '12px 8px' }}>Estado</th>
                              <th style={{ padding: '12px 8px' }}>Comprobante</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cobrosData.historial.map((h, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                <td style={{ padding: '12px 8px' }}>{new Date(h.fechaSolicitud).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</td>
                                <td style={{ padding: '12px 8px', fontWeight: '600' }}>${h.montoNeto}</td>
                                <td style={{ padding: '12px 8px' }}>
                                  <span className={`badge ${h.estado === 'Pendiente' ? 'badge-amber' : h.estado === 'Completado' ? 'badge-green' : 'badge-gray'}`}>
                                    {h.estado === 'Pendiente' ? 'Pago solicitado' : h.estado}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 8px' }}>
                                  {h.comprobanteUrl ? (
                                    <a href={h.comprobanteUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" style={{ fontSize: '0.75rem' }}>Ver</a>
                                  ) : (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Sin adjunto</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}


            {profileSubView === 'edit' && (
              <div className="card card-body">
                <h2 style={{ color: 'var(--red-600)', marginBottom: 16 }}>Editar Perfil del Local</h2>
                {profileData && (
                  <form onSubmit={handleSaveProfile} className="rd-item-form">
                    {profileData.foto_url && <img src={profileData.foto_url} alt="" style={{ width: 120, borderRadius: 12, margin: '0 auto 16px', display: 'block' }} />}
                    <input name="foto" type="file" className="form-input" accept="image/*" />
                    <div className="rd-form-row">
                      <input name="nombre" className="form-input" placeholder="Nombre del local" defaultValue={profileData.nombre || ''} required />
                      <div className="address-display-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px', 
                          background: 'var(--gray-50)', 
                          padding: '10px 14px', 
                          borderRadius: '8px', 
                          border: '1px solid var(--gray-200)',
                          cursor: 'pointer'
                        }} onClick={() => setShowAddressSelector(true)}>
                          <span style={{ fontSize: '1.2rem' }}>📍</span>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>Ubicación en el mapa</p>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--gray-800)', fontWeight: 500 }}>
                              {profileAddress || 'Configurar ubicación...'}
                            </p>
                          </div>
                          <button type="button" className="btn btn-ghost btn-xs" style={{ color: 'var(--blue-600)' }}>Cambiar</button>
                        </div>
                        {(!profileLat || !profileLng) && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--amber-600)', fontStyle: 'italic' }}>
                            ⚠️ Ubicación no configurada en el mapa
                          </span>
                        )}
                      </div>
                    </div>
                    <input name="email" type="email" className="form-input" placeholder="Email" defaultValue={profileData.email || ''} required />
                    <input name="password" type="password" className="form-input" placeholder="Nueva contraseña (dejar vacío para no cambiar)" />
                    
                    <h3 style={{ marginTop: '24px', marginBottom: '12px', fontSize: '1.1rem', color: 'var(--gray-700)' }}>Horarios de Atención</h3>
                    <div className="rd-form-row rd-form-row-3" style={{ marginBottom: 16 }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Apertura</label>
                        <input name="horario_apertura" type="time" className="form-input" defaultValue={profileData.horario_apertura || '09:00'} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Cierre</label>
                        <input name="horario_cierre" type="time" className="form-input" defaultValue={profileData.horario_cierre || '23:00'} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Modo Automático</label>
                        <select name="modo_automatico" className="form-select" defaultValue={profileData.modo_automatico ? 'true' : 'false'}>
                          <option value="true">Sí (Abrir/Cerrar auto)</option>
                          <option value="false">No (Manual)</option>
                        </select>
                      </div>
                    </div>

                    <label style={{ fontSize: '0.8rem', color: 'var(--gray-500)', display: 'block', marginBottom: '8px' }}>Días de Apertura</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                      {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => {
                        const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                        const dayNorm = normalize(day);
                        const isSelected = profileData.dias_apertura?.some(d => normalize(d) === dayNorm);
                        return (
                          <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--gray-100)', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input type="checkbox" name={`day_${day}`} defaultChecked={isSelected || !profileData.dias_apertura} />
                            {day}
                          </label>
                        );
                      })}
                    </div>


                    <h3 style={{ marginTop: '12px', marginBottom: '12px', fontSize: '1.1rem', color: 'var(--gray-700)' }}>Métodos de Entrega Disponibles</h3>
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input type="checkbox" name="acepta_retiro" defaultChecked={profileData.acepta_retiro !== false} />
                        🏪 Ofrecer Retiro en Local
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input type="checkbox" name="acepta_envio" defaultChecked={profileData.acepta_envio !== false} />
                        🛵 Ofrecer Envío a Domicilio
                      </label>
                    </div>


                    <div className="rd-form-actions" style={{ marginTop: '24px' }}>
                      <button type="button" className="btn btn-ghost" onClick={() => setView('orders')}>Cancelar</button>
                      <button type="submit" className="btn btn-success">Guardar Cambios</button>
                    </div>
                  </form>
                )}
                
                <hr style={{ margin: '32px 0', border: 'none', borderTop: '1px solid var(--gray-200)' }} />
                <div style={{ backgroundColor: '#f0f9ff', padding: '20px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ color: '#0369a1', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 700 }}>
                      <img src="https://i.postimg.cc/k47vV4h3/mercadopago.png" alt="MP" style={{ height: 24 }} onError={(e) => e.target.style.display = 'none'} />
                      Cobros con Mercado Pago
                    </h3>
                    {profileData?.mp_access_token ? (
                      <span className="badge badge-green" style={{ padding: '6px 12px', fontSize: '0.85rem', background: '#d1fae5', color: '#065f46', borderRadius: '12px', fontWeight: 600 }}>✓ Cuenta Vinculada</span>
                    ) : (
                      <span className="badge badge-red" style={{ padding: '6px 12px', fontSize: '0.85rem', background: '#fee2e2', color: '#991b1b', borderRadius: '12px', fontWeight: 600 }}>✗ Desvinculada</span>
                    )}
                  </div>

                  <p style={{ color: '#0c4a6e', fontSize: '0.9rem', marginBottom: '16px', lineHeight: 1.5 }}>
                    Conectá tu cuenta de Mercado Pago para que tus clientes puedan abonar sus pedidos por transferencia o tarjeta directamente. El dinero irá a esta cuenta.
                  </p>

                  {profileData?.mp_access_token && (
                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #bae6fd', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#0284c7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        📌 Información de la Cuenta Vinculada
                      </h4>
                      {mpAccountLoading ? (
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>⏳ Cargando datos de Mercado Pago...</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: '#334155' }}>
                          <div>
                            <strong>Usuario de Mercado Pago:</strong>{' '}
                            <span style={{ color: '#0284c7', fontWeight: 700 }}>
                              {mpAccountInfo?.nickname || 
                               (mpAccountInfo?.first_name ? `${mpAccountInfo.first_name} ${mpAccountInfo.last_name || ''}`.trim() : null) ||
                               profileData?.sync_config_data?.mp_user_info?.nickname ||
                               (profileData?.sync_config_data?.mp_user_info?.first_name ? `${profileData.sync_config_data.mp_user_info.first_name} ${profileData.sync_config_data.mp_user_info.last_name || ''}`.trim() : null) ||
                               'Cuenta Vinculada'}
                            </span>
                          </div>
                          {(mpAccountInfo?.email || profileData?.sync_config_data?.mp_user_info?.email) && (
                            <div><strong>Email de Mercado Pago:</strong> <span style={{ color: '#334155', fontWeight: 600 }}>{mpAccountInfo?.email || profileData?.sync_config_data?.mp_user_info?.email}</span></div>
                          )}
                          {(mpAccountInfo?.company?.brand_name || profileData?.sync_config_data?.mp_user_info?.brand_name) && (
                            <div><strong>Marca / Negocio MP:</strong> {mpAccountInfo?.company?.brand_name || profileData?.sync_config_data?.mp_user_info?.brand_name}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-primary" 
                      style={{ backgroundColor: '#009ee3', borderColor: '#009ee3', padding: '10px 20px', fontWeight: 600 }}
                      onClick={() => {
                        const clientId = import.meta.env.VITE_MP_CLIENT_ID || prompt("Por favor, ingresa el CLIENT_ID de tu aplicación de Mercado Pago:");
                        if (!clientId) return;
                        const redirectUri = `${import.meta.env.VITE_SUPABASE_URL || 'https://jskxfescamdjesdrcnkf.supabase.co'}/functions/v1/mp-oauth-callback`;
                        const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${restaurant.id}&redirect_uri=${encodeURIComponent(redirectUri)}`;
                        window.location.href = authUrl;
                      }}
                    >
                      {profileData?.mp_access_token ? '🔄 Cambiar / Re-vincular Cuenta' : '💳 Vincular Cuenta de MercadoPago'}
                    </button>

                    {profileData?.mp_access_token && (
                      <button
                        className="btn btn-danger"
                        disabled={mpUnlinking}
                        onClick={handleDesvincularMP}
                        style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', padding: '10px 18px', fontWeight: 600, border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '0.9rem' }}
                      >
                        {mpUnlinking ? 'Desvinculando...' : '🗑️ Desvincular Cuenta'}
                      </button>
                    )}
                  </div>
                </div>
                
              </div>
            )}

            {profileSubView === 'printing' && (
              <div className="card card-body animate-fade-in" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🖨️</div>
                <h2 style={{ color: 'var(--red-600)', marginBottom: '16px' }}>Impresión Automática de Tickets</h2>
                <p style={{ color: 'var(--gray-600)', maxWidth: '500px', margin: '0 auto 32px', lineHeight: 1.6 }}>
                  Optimizá tu local con nuestra aplicación de escritorio. Imprime tickets automáticamente en tu comandera térmica apenas recibís un pedido.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px', margin: '0 auto' }}>
                  <a 
                    href="/download/weep-printer-latest.exe" 
                    download={`Weep_${restaurant?.localId || restaurant?.id || 'LOCAL'}.exe`}
                    className="btn btn-primary btn-full"
                    style={{ padding: '16px', fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                  >
                    🚀 Descargar instalador para Windows
                  </a>
                  
                  <div className="card" style={{ padding: '24px', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', marginTop: '20px' }}>
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Tu ID de Configuración</h3>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                      <code style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--gray-800)', background: 'white', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--gray-300)' }}>
                        {restaurant?.id}
                      </code>
                      <button 
                        className="btn btn-sm btn-ghost" 
                        onClick={() => { navigator.clipboard.writeText(restaurant?.id); toast.success('ID Copiado'); }}
                        style={{ padding: '8px' }}
                      >
                        📋 Copiar
                      </button>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '16px' }}>
                      Copiá este ID y pegalo en la aplicación de escritorio para vincular tu local.
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: '40px', borderTop: '1px solid var(--gray-100)', paddingTop: '40px', textAlign: 'left', maxWidth: '600px', margin: '40px auto 0' }}>
                  <h4 style={{ marginBottom: '16px' }}>Pasos para configurar:</h4>
                  <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--gray-600)' }}>
                    <li><strong>Descargá e instalá</strong> el programa en la computadora que tiene conectada la impresora.</li>
                    <li><strong>Abrí Weep Desktop</strong> e ingresá tu ID de Local (arriba).</li>
                    <li><strong>Seleccioná tu impresora</strong> térmica en el menú desplegable.</li>
                    <li>¡Listo! La app detectará tus pedidos y los imprimirá automáticamente.</li>
                  </ol>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 20px' }}>
        <img src="https://i.postimg.cc/Y0Ln7qb3/Digitalizacion-y-logistica-para-Santo-Tome-(1).png" alt="Weep" style={{ height: '50px', objectFit: 'contain' }} />
        <p>© 2026 <strong>Weep</strong> — Panel de Locales</p>
        <button 
          onClick={() => setShowTerms(true)} 
          style={{ background: 'none', border: 'none', color: 'var(--red-500)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          Ver Términos y Condiciones
        </button>
        <button 
          onClick={() => setShowRegretModal(true)} 
          style={{ background: 'none', border: 'none', color: 'var(--red-600)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem', marginTop: '4px', fontWeight: 'bold' }}
        >
          Botón de Arrepentimiento
        </button>
      </footer>
      {renderTermsModal()}
      {renderRegretModal()}

      {rejectionModalOpen && (
        <div className="modal-overlay" onClick={() => { setRejectionModalOpen(false); setOrderToReject(null); }} style={{ zIndex: 9999 }}>
          <div className="modal-box animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <button className="modal-close" onClick={() => { setRejectionModalOpen(false); setOrderToReject(null); }}>✕</button>
            <h2 style={{ color: 'var(--red-600)', marginBottom: '10px' }}>Rechazar Pedido</h2>
            <p style={{ color: 'var(--gray-600)', marginBottom: '20px', fontSize: '0.9rem' }}>
              Por favor, selecciona el motivo del rechazo para informar al cliente:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                'Local sin stock / No podemos cumplir el pedido',
                'Local fuera de zona de entrega',
                'Local cerrado o sin repartidor disponible',
                'Pedido incorrecto o datos incompletos',
                'Otro motivo'
              ].map(reason => (
                <button 
                  key={reason}
                  className="btn btn-ghost"
                  style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '12px 16px', border: '1px solid var(--gray-200)', fontSize: '0.9rem' }}
                  onClick={() => {
                    if (orderToReject?.idPedidoLocal === 'sample-order-1') {
                      setTutorialSampleOrderState('Rechazado');
                      toast.success('Pedido de muestra rechazado.');
                    } else {
                      handleOrderAction(orderToReject, 'Rechazado', reason);
                    }
                    setRejectionModalOpen(false);
                    setOrderToReject(null);
                  }}
                >
                  {reason}
                </button>
              ))}
            </div>
            <button 
              className="btn btn-secondary btn-full" 
              style={{ marginTop: '20px' }}
              onClick={() => { setRejectionModalOpen(false); setOrderToReject(null); }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {securityModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => setSecurityModalOpen(false)}>
          <div className="modal-box animate-fade-in" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🔒</div>
            <h3 style={{ marginBottom: '8px' }}>Sección Protegida</h3>
            <p style={{ color: 'var(--gray-600)', marginBottom: '20px', fontSize: '0.9rem' }}>
              Ingresá la contraseña de tu cuenta para acceder a esta sección.
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSecurityLoading(true);
              try {
                const valid = await api.verifyLocalPassword(restaurant.id, securityPassword);
                if (valid) {
                  setIsUnlocked(true);
                  setSecurityModalOpen(false);
                  setSecurityPassword('');
                  if (onSecuritySuccess) onSecuritySuccess();
                } else {
                  toast.error('Contraseña incorrecta');
                }
              } catch (err) {
                toast.error('Error al verificar contraseña');
              } finally {
                setSecurityLoading(false);
              }
            }}>
              <input 
                type="password" 
                className="form-input" 
                placeholder="Contraseña" 
                value={securityPassword}
                onChange={e => setSecurityPassword(e.target.value)}
                autoFocus
                required
                style={{ textAlign: 'center', fontSize: '1.1rem', letterSpacing: '4px' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary btn-full" disabled={securityLoading}>
                  {securityLoading ? 'Verificando...' : 'Desbloquear'}
                </button>
                <button type="button" className="btn btn-ghost btn-full" onClick={() => setSecurityModalOpen(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddressSelector && (
        <AddressSelector 
          isLoaded={isMapLoaded}
          initialAddress={profileAddress}
          initialCoords={profileLat && profileLng ? { lat: profileLat, lng: profileLng } : null}
          onConfirm={handleAddressConfirm}
          onCancel={() => setShowAddressSelector(false)}
          title="Ubicación de tu Local"
          ciudad={profileData?.ciudad || 'Santo Tomé'}
          allowJustCity={true}
        />
      )}
    </div>
  );
}

/* ─── Order Card Component ─── */
function OrderCard({ order: o, onAction, finished }) {
  const [loading, setLoading] = React.useState('');
  const handleAction = async (action) => {
    setLoading(action);
    await onAction(o, action);
    setLoading('');
  };
  const subtotal = o.items.reduce((sum, i) => sum + (i[7] || 0), 0);
  const statusColors = { Pendiente: 'badge-amber', Aceptado: 'badge-info', Listo: 'badge-blue', Entregado: 'badge-green', Rechazado: 'badge-red' };
  return (
    <div className="rd-order-card card">
      <div className="rd-order-header">
        <div>
          <strong>Pedido #{o.idPedido}</strong>

          {o.fecha && <span className="rd-order-sub" style={{ marginLeft: 8 }}>📅 {new Date(new Date(o.fecha).getTime() + 3 * 60 * 60 * 1000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>}
          <span className={`badge ${String(o.tipoEntrega).toLowerCase().includes('env') || o.tipoEntrega === 'Con Envío' ? 'badge-blue' : 'badge-gray'}`} style={{ marginLeft: 8 }}>
            {String(o.tipoEntrega).toLowerCase().includes('env') || o.tipoEntrega === 'Con Envío' ? '🚚 Envío' : '🏪 Retiro'}
          </span>
        </div>
        <span className={`badge ${statusColors[o.estadoActual] || 'badge-gray'}`}>{o.estadoActual}</span>
      </div>
      <div className="rd-order-body">
        <p><strong>Cliente:</strong> {o.nombreCliente}</p>
        <p><strong>Dirección:</strong> {o.direccion}</p>
        <p><strong>Pago:</strong> {o.metodoPago}</p>
        {String(o.metodoPago).toLowerCase().includes('efectivo') && (
          <p style={{ color: 'var(--amber-600)', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '4px', background: '#fffbeb', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fef3c7' }}>
            ⚠️ El pedido no fue pagado aún
          </p>
        )}
        {(String(o.tipoEntrega).toLowerCase().includes('env') || o.tipoEntrega === 'Con Envío') && (
          <p><strong>Repartidor:</strong> <span style={{ color: o.repartidorNombre ? 'var(--blue-600)' : 'var(--gray-500)', fontWeight: 600 }}>{o.repartidorNombre || 'Buscando...'}</span> {o.repartidorTelefono && <span style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>({o.repartidorTelefono})</span>}</p>
        )}
        {o.observaciones !== 'Ninguna' && <p><strong>Obs:</strong> {o.observaciones}</p>}
        <div className="rd-order-items">
          {o.items.map((item, i) => (
            <div key={i} className="rd-order-item" style={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px dashed var(--gray-100)', padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontWeight: 600 }}>
                <span>{item[4]} × {item[6]}</span>
                <span>${item[7].toFixed(2)}</span>
              </div>
              {/* El detalle ahora viene incluido en el nombre del producto (item[4]) */}
            </div>
          ))}
        </div>
        <div className="rd-order-footer">
          <p><strong>Subtotal (Local):</strong> <span style={{ color: 'var(--red-600)', fontSize: '1.2rem' }}>${o.totalLocal.toFixed(2)}</span></p>
        </div>
        {!finished && (
          <div className="rd-order-actions">
            {o.estadoActual === 'Pendiente' ? (
              <>
                <button className="btn btn-success btn-sm" disabled={loading} onClick={() => handleAction('Aceptado')}>
                  {loading === 'Aceptado' ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="spinner spinner-white" style={{ width: 16, height: 16 }} /> Cargando...
                    </span>
                  ) : '✓ Aceptar'}
                </button>
                <button className="btn btn-sm" style={{ background: 'var(--red-500)', color: '#fff' }} disabled={loading} onClick={() => onAction(o, 'RechazarClick')}>
                  {loading === 'Rechazado' ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="spinner spinner-white" style={{ width: 16, height: 16 }} /> Cargando...
                    </span>
                  ) : '✕ Rechazar'}
                </button>
              </>
            ) : ['Aceptado', 'Listo'].includes(o.estadoActual) ? (
              <>
                <button 
                  className={`btn btn-sm ${o.estadoActual === 'Listo' ? '' : 'btn-success'}`} 
                  style={o.estadoActual === 'Listo' ? { background: 'var(--gray-300)', color: 'var(--gray-500)', cursor: 'not-allowed' } : {}}
                  disabled={loading || o.estadoActual === 'Listo'} 
                  onClick={() => handleAction('Listo')}
                >
                  {loading === 'Listo' ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="spinner spinner-white" style={{ width: 16, height: 16 }} /> Cargando...
                    </span>
                  ) : '✓ Listo'}
                </button>
                <button 
                  className="btn btn-sm" 
                  style={o.estadoActual !== 'Listo' ? { background: 'var(--gray-300)', color: 'var(--gray-500)', cursor: 'not-allowed' } : { background: 'var(--blue-500)', color: '#fff' }} 
                  disabled={loading || o.estadoActual !== 'Listo'} 
                  onClick={() => handleAction('Entregado')}
                >
                  {loading === 'Entregado' ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="spinner spinner-white" style={{ width: 16, height: 16 }} /> Cargando...
                    </span>
                  ) : '📦 Entregado'}
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
