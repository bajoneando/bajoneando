import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useJsApiLoader } from '@react-google-maps/api';
import AddressSelector from '../components/AddressSelector';
import * as api from '../services/api';
import * as syncEngine from '../services/syncEngine';
import { isValidEmail } from '../utils/validation';
import { getCitySlug } from '../utils/city';
import toast from 'react-hot-toast';
import './RestaurantDashboard.css';
import { isLocalOpen, getNextStatusChange } from '../utils/businessHours';

const GOOGLE_MAPS_LIBRARIES = ['places'];

// V2.2 - Reset Modals Cache Fix
const getLevelName = (lvl) => {
  if (lvl === 1) return 'Despegue';
  if (lvl === 2) return 'Crecimiento';
  if (lvl === 3) return 'Experto en ventas';
  if (lvl === 4) return 'Nivel pro';
  return 'Despegue';
};

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

export default function RestaurantDashboard() {
  const { restaurant, loginAsRestaurant, logoutRestaurant } = useAuth();

  const [view, setView] = React.useState('orders'); // 'orders','dashboard','menu','addItem','profile'

  React.useEffect(() => {
    if (restaurant?.role === 'Cajero' && view !== 'orders' && view !== 'cierre') {
      setView('orders');
    }
  }, [view, restaurant]);
  const [authView, setAuthView] = React.useState('login');
  const [authEmail, setAuthEmail] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [regTipoServicio, setRegTipoServicio] = React.useState('delivery');
  const [customSlug, setCustomSlug] = React.useState('');
  const [slugSaving, setSlugSaving] = React.useState(false);
  const [localOpen, setLocalOpen] = React.useState(false);
  const [profileData, setProfileData] = React.useState(null);
  const profileDataRef = React.useRef(profileData);
  React.useEffect(() => {
    profileDataRef.current = profileData;
  }, [profileData]);

  const [waStatus, setWaStatus] = React.useState('disconnected'); // 'disconnected', 'loading', 'qr_ready', 'connected'
  const [waQrCode, setWaQrCode] = React.useState('');
  const [waPhoneNumber, setWaPhoneNumber] = React.useState('');

  const serverUrl = import.meta.env.VITE_WHATSAPP_SERVER_URL || 'http://localhost:3001';

  React.useEffect(() => {
    if (!restaurant?.id) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`${serverUrl}/api/status?localId=${restaurant.id}`);
        const data = await res.json();
        
        setWaStatus(data.status);
        setWaQrCode(data.qr || '');
        setWaPhoneNumber(data.phoneNumber || '');

        // Si ya se vinculó en el backend, actualizar estado local
        if (data.status === 'connected' && profileData && !profileData.whatsapp_assistant_enabled) {
          setProfileData(prev => ({
            ...prev,
            whatsapp_assistant_enabled: true,
            whatsapp_phone_number: data.phoneNumber
          }));
        }
      } catch (err) {
        // Ignorar errores silenciosos si el servidor de WhatsApp no está corriendo
      }
    };

    checkStatus();

    // Consultar estado cada 3 segundos si está en proceso de carga o escaneo
    const interval = setInterval(() => {
      if (waStatus === 'loading' || waStatus === 'qr_ready') {
        checkStatus();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [restaurant?.id, waStatus, profileData]);

  const handleConnectWA = async () => {
    setWaStatus('loading');
    setWaQrCode('');
    
    try {
      const res = await fetch(`${serverUrl}/api/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId: restaurant.id })
      });
      const data = await res.json();
      
      setWaStatus(data.status);
      setWaQrCode(data.qr || '');
      toast.info("Iniciando conexión con WhatsApp...");
    } catch (e) {
      toast.error("No se pudo conectar al servidor de WhatsApp. Asegúrate de iniciarlo en la terminal.");
      setWaStatus('disconnected');
    }
  };

  const handleDisconnectWA = async () => {
    if (!window.confirm("¿Estás seguro de que deseas desconectar el Asistente de WhatsApp?")) return;
    
    setWaStatus('loading');
    try {
      await fetch(`${serverUrl}/api/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId: restaurant.id })
      });
      
      setWaStatus('disconnected');
      setWaQrCode('');
      setWaPhoneNumber('');
      
      setProfileData(prev => ({
        ...prev,
        whatsapp_assistant_enabled: false,
        whatsapp_phone_number: null
      }));
      toast.success("Asistente de WhatsApp desconectado");
    } catch (e) {
      toast.error("Error al desconectar");
      setWaStatus('connected');
    }
  };
  const isInventory = React.useMemo(() => {
    if (!profileData) return false;
    return profileData.tipo_servicio === 'shops' || profileData.rubros?.some(r => r === 'Market' || r === 'Farmacia' || r === 'Bebidas' || r === 'Hogar' || r === 'Tecnología' || r === 'Moda' || r === 'Regalería' || r === 'Deportes');
  }, [profileData]);
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
  const [itemSubcategory, setItemSubcategory] = React.useState('Helado por kg');
  const [profileSubView, setProfileSubView] = React.useState('edit'); // 'ventas', 'cobros', 'edit'
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);
  const [addMenuOpen, setAddMenuOpen] = React.useState(false);
  const [adicionales, setAdicionales] = React.useState([]);
  const [adicionalesLoading, setAdicionalesLoading] = React.useState(false);
  const [showRegretModal, setShowRegretModal] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [hasRepartidores, setHasRepartidores] = React.useState(false);
  const [loadingRepartidores, setLoadingRepartidores] = React.useState(false);
  const [cajeros, setCajeros] = React.useState([]);
  const [cajerosLoading, setCajerosLoading] = React.useState(false);
  const [planInfo, setPlanInfo] = React.useState(null);
  const [availablePlans, setAvailablePlans] = React.useState([]);

  // Cierre de Caja State
  const [cierreFecha, setCierreFecha] = React.useState(new Date().toISOString().split('T')[0]);
  const [cierreMode, setCierreMode] = React.useState('pendientes'); // 'dia', 'intervalo', 'pendientes'
  const [cierreFechaInicio, setCierreFechaInicio] = React.useState(new Date().toISOString().split('T')[0]);
  const [cierreFechaFin, setCierreFechaFin] = React.useState(new Date().toISOString().split('T')[0]);
  const [cierreReport, setCierreReport] = React.useState(null);
  const [cierreLoading, setCierreLoading] = React.useState(false);
  const [cierreSubTab, setCierreSubTab] = React.useState('generar'); // generar, historial, estadisticas
  const [hideStatsInCierre, setHideStatsInCierre] = React.useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  const [statsDates, setStatsDates] = React.useState({ 
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [statsData, setStatsData] = React.useState(null);
  const [historialCierres, setHistorialCierres] = React.useState([]);

  
  // Advanced Burger State
  const [burgerVariants, setBurgerVariants] = React.useState([{ nombre: '', precio: '', disponible: true }]);
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
  const [isUnlocked, setIsUnlocked] = React.useState(true);
  const [notificationStatus, setNotificationStatus] = React.useState('loading');
  const [isIOS, setIsIOS] = React.useState(false);
  const [isBaseProductMode, setIsBaseProductMode] = React.useState(false);

  // Stock State (Moved to top level)
  const [itemManejaStock, setItemManejaStock] = React.useState(false);
  const [selectedStockBaseId, setSelectedStockBaseId] = React.useState('');
  const [editingStockItem, setEditingStockItem] = React.useState(null);
  const [needsStockConfirmation, setNeedsStockConfirmation] = React.useState(false);
  const [stockToConfirm, setStockToConfirm] = React.useState([]);
  const [showStockModal, setShowStockModal] = React.useState(false);
  const [showStockSelectorModal, setShowStockSelectorModal] = React.useState(false);
  const [showVariantsConfig, setShowVariantsConfig] = React.useState(false);
  const [showDiscountPanel, setShowDiscountPanel] = React.useState(false);
  const [showStockPanel, setShowStockPanel] = React.useState(false);
  const [quickUploadItemId, setQuickUploadItemId] = React.useState(null);
  const quickImageInputRef = React.useRef(null);
  const [menuAddOpen, setMenuAddOpen] = React.useState(false);

  // ─── Wepi Sync V1 States ───
  const [syncFile, setSyncFile] = React.useState(null);
  const [syncFileType, setSyncFileType] = React.useState('csv'); // 'csv', 'xlsx'
  const [syncHeaders, setSyncHeaders] = React.useState([]);
  const [syncMapeo, setSyncMapeo] = React.useState({ sku: '', nombre: '', descripcion: '', precio: '', stock: '', categoria: '', codigo_barras: '' });
  const [syncCamposActualizables, setSyncCamposActualizables] = React.useState(['precio', 'stock', 'nombre', 'descripcion', 'categoria']);
  const [syncDesactivarFaltantes, setSyncDesactivarFaltantes] = React.useState(false);
  const [syncGoogleSheetsUrl, setSyncGoogleSheetsUrl] = React.useState('');
  const [syncEngineLoading, setSyncEngineLoading] = React.useState(false);
  const [syncEngineResult, setSyncEngineResult] = React.useState(null);
  const [syncPreviewRows, setSyncPreviewRows] = React.useState([]);
  const [syncStep, setSyncStep] = React.useState('upload'); // 'upload', 'mapping', 'result'

  React.useEffect(() => {
    if (profileData?.sync_config_data) {
      const syncConfig = profileData.sync_config_data;
      if (syncConfig.mapeo_columnas) setSyncMapeo(syncConfig.mapeo_columnas);
      if (syncConfig.campos_actualizables) setSyncCamposActualizables(syncConfig.campos_actualizables);
      if (syncConfig.desactivar_faltantes !== undefined) setSyncDesactivarFaltantes(syncConfig.desactivar_faltantes);
      if (syncConfig.url_origen) setSyncGoogleSheetsUrl(syncConfig.url_origen);
      if (syncConfig.metodo) setSyncFileType(syncConfig.metodo);
    }
  }, [profileData]);
  const [showGamification, setShowGamification] = React.useState(false);
  const [configHorarios, setConfigHorarios] = React.useState({});
  const [showHorariosConfig, setShowHorariosConfig] = React.useState(false);
  React.useEffect(() => {
    if (editItem) {
      setItemManejaStock(editItem.maneja_stock || false);
      setSelectedStockBaseId(editItem.stock_base_id || '');
    } else {
      setItemManejaStock(false);
      setSelectedStockBaseId('');
    }
  }, [editItem]);

  // ─── Modal Arrepentimiento ───
  const renderRegretModal = () => (
    showRegretModal && (
      <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowRegretModal(false)}>
        <div className="modal-box animate-fade-in" style={{ maxWidth: '400px', textAlign: 'center', background: 'white', padding: '24px', borderRadius: '12px' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ color: 'var(--red-600)', marginBottom: '16px' }}>Botón de Arrepentimiento</h3>
          <p style={{ marginBottom: '20px', color: 'var(--gray-600)', fontSize: '0.95rem' }}>
            ¿Deseas arrepentirte de tu registro y eliminar tu cuenta de local permanentemente de Wepi? <br/>
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
            <p>El comercio utiliza Wepi como plataforma de visibilidad y gestión de pedidos. No existe relación societaria ni laboral.</p>
            <p><strong>2. Calidad</strong></p>
            <p>El local es el único responsable por el estado, higiene y veracidad de los productos entregados.</p>
            <p><strong>3. Gestión de Pedidos</strong></p>
            <p>El comercio debe mantener su menú actualizado y responder a los pedidos en tiempo y forma.</p>
            <p><strong>4. Comisiones</strong></p>
            <p>Wepi percibirá una comisión acordada sobre las ventas realizadas a través de la plataforma.</p>
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

  const loadCajeros = React.useCallback(async () => {
    if (!restaurant?.id) return;
    setCajerosLoading(true);
    try {
      const data = await api.getLocalUsuarios(restaurant.id);
      setCajeros(data);
    } catch (err) {
      toast.error('Error al cargar cajas');
    } finally {
      setCajerosLoading(false);
    }
  }, [restaurant]);

  const handleAddCajero = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nombre = fd.get('nombre')?.trim();
    const username = fd.get('username')?.trim();
    const password = fd.get('password')?.trim();

    if (!nombre || !username || !password) {
      toast.error('Completá todos los campos');
      return;
    }

    try {
      await api.addLocalUsuario({
        localId: restaurant.id,
        nombre,
        username,
        password,
        rol: 'Cajero'
      });
      toast.success('Caja agregada con éxito');
      e.target.reset();
      loadCajeros();
    } catch (err) {
      toast.error(err.message || 'Error al agregar caja');
    }
  };

  const handleDeleteCajero = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta caja?')) return;
    try {
      await api.deleteLocalUsuario(id);
      toast.success('Caja eliminada');
      loadCajeros();
    } catch (err) {
      toast.error('Error al eliminar caja');
    }
  };

  React.useEffect(() => {
    if (view === 'settings' && profileSubView === 'cajas' && restaurant?.id) {
      loadCajeros();
    }
  }, [view, profileSubView, restaurant?.id, loadCajeros]);

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

        // Initialize Flexible Hours Config
        if (d.config_horarios && Object.keys(d.config_horarios).length > 0) {
          setConfigHorarios(d.config_horarios);
        } else {
          const initialConfig = {};
          ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach(day => {
            const dayNorm = day.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const isSelected = d.dias_apertura?.some(da => da.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === dayNorm);
            if (isSelected || !d.dias_apertura) {
              const intervalos = [];
              if (d.horario_apertura && d.horario_cierre) intervalos.push({ inicio: d.horario_apertura, fin: d.horario_cierre });
              if (d.horario_apertura2 && d.horario_cierre2) intervalos.push({ inicio: d.horario_apertura2, fin: d.horario_cierre2 });
              initialConfig[day] = { tipo: 'especifico', intervalos };
            } else {
              initialConfig[day] = { tipo: 'cerrado', intervalos: [] };
            }
          });
          setConfigHorarios(initialConfig);
        }
      }
    } catch {}
  }, [restaurant]);

  React.useEffect(() => {
    if (profileData?.slug) {
      setCustomSlug(profileData.slug);
    }
  }, [profileData?.slug]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mpoauth = params.get('mpoauth');
    if (mpoauth === 'success') {
      toast.success('¡Mercado Pago vinculado con éxito!', { icon: '💳', duration: 5000 });
      // Limpiar URL
      window.history.replaceState({}, document.title, window.location.pathname);
      loadProfile(); // Refrescar datos para mostrar el badge
    } else if (mpoauth === 'error') {
      const msg = params.get('message');
      toast.error(`Error al vincular Mercado Pago: ${msg || 'Error desconocido'}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [loadProfile]);

  /* ─── Modo Automático ─── */
  // Deprecated: Use isLocalOpen from utils/businessHours
  const estaDentroDeHorario = React.useCallback((apertura, cierre, diasApertura, apertura2, cierre2) => {
    return isLocalOpen({ horario_apertura: apertura, horario_cierre: cierre, dias_apertura: diasApertura, horario_apertura2: apertura2, horario_cierre2: cierre2, modo_automatico: true });
  }, []);

  const verificarEstadoAutomatico = React.useCallback(() => {
    if (!profileData) return;
    const shouldBeOpen = isLocalOpen(profileData);
    
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
  }, [profileData, restaurant]);

  const loadMenu = React.useCallback(async () => {
    if (!restaurant) return;
    setMenuLoading(true);
    try {
      const items = await api.getMenuByLocalId(restaurant.id);
      const menuArray = Array.isArray(items) ? items : [];
      setMenuItems(menuArray);

      // Check for stock confirmation (Generalized)
      const baseItems = menuArray.filter(i => i.maneja_stock && !i.stock_base_id);
      if (baseItems.length > 0) {
        const today = new Date().toLocaleDateString('es-AR');
        
        const pending = baseItems.filter(i => {
          if (!i.ultima_confirmacion_stock) return true;
          const lastDate = new Date(i.ultima_confirmacion_stock).toLocaleDateString('es-AR');
          return lastDate !== today;
        });

        if (pending.length > 0) {
          setStockToConfirm(pending);
          setNeedsStockConfirmation(true);
        } else {
          setNeedsStockConfirmation(false);
        }
      }
    } catch (err) { 
      console.error(err);
      toast.error('Error al cargar menú'); 
    }
    setMenuLoading(false);
  }, [restaurant, profileData?.rubros]);

  const handleConfirmDailyStock = async (updates) => {
    try {
      setItemLoading(true);
      const today = new Date().toISOString();
      
      const promises = Object.entries(updates).map(([id, stock]) => 
        api.updateMenuItem({ itemId: id, stock_actual: parseInt(stock), ultima_confirmacion_stock: today })
      );

      await Promise.all(promises);
      toast.success('¡Stock confirmado para hoy!');
      setNeedsStockConfirmation(false);
      loadMenu();
    } catch {
      toast.error('Error al confirmar stock');
    } finally {
      setItemLoading(false);
    }
  };

  const loadOrders = React.useCallback(async (silent = false) => {
    if (!restaurant) return;
    if (!silent) setOrdersLoading(true);
    try {
      const processed = await api.getPedidosLocalesCompletosByLocal(restaurant.id);

      const isShopLocal = profileDataRef.current?.tipo_servicio === 'shops';
      // Check new pending/confirmed orders for alerts
      if (silent && previousOrdersRef.current.length > 0) {
        const previousIds = previousOrdersRef.current.map(o => o.idPedidoLocal);
        const newAlerts = processed.filter(o => 
          (isShopLocal ? ['Pendiente', 'Confirmado'] : ['Confirmado']).includes(o.estadoActual) && 
          !previousIds.includes(o.idPedidoLocal)
        );
        if (newAlerts.length > 0) {
          playAlertSound();
          toast.success(`Tenés ${newAlerts.length} pedido(s) nuevo(s)!`, { icon: '🔔' });
        }
      }
      previousOrdersRef.current = processed;

      setOrders(processed);
      setPendingCount(processed.filter(o => (isShopLocal ? ['Pendiente', 'Confirmado'] : ['Confirmado']).includes(o.estadoActual)).length);
    } catch (err) { 
      console.error("Error in loadOrders:", err);
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
      const sub = editItem.tamano || '';
      setItemSubcategory(cat === 'Helados' ? (sub || 'Helado por kg') : '');

      if (cat !== 'Base' && (cat !== 'Helados' || (cat === 'Helados' && sub !== 'Helado por kg'))) {
        try {
          const cfg = typeof editItem.variantes === 'string' ? JSON.parse(editItem.variantes) : (editItem.variantes || {});
          const hasVariants = cfg.variants?.length > 0 || cfg.extras?.length > 0 || !!cfg.con_papas;
          setBurgerVariants(cfg.variants?.length > 0 ? cfg.variants.map(v => ({ ...v, disponible: v.disponible !== false })) : [{ nombre: '', precio: '', disponible: true }]);
          setBurgerExtras(cfg.extras?.length > 0 ? cfg.extras : [{ nombre: '', precio: '' }]);
          setBurgerOfferPapas(!!cfg.con_papas);
          setBurgerPrecioPapas(cfg.precio_papas || '');
          setShowVariantsConfig(hasVariants);
        } catch (e) {
          setBurgerVariants([{ nombre: '', precio: '', disponible: true }]);
          setBurgerExtras([{ nombre: '', precio: '' }]);
          setBurgerOfferPapas(false);
          setBurgerPrecioPapas('');
          setShowVariantsConfig(false);
        }
      } else {
        setBurgerVariants([{ nombre: '', precio: '', disponible: true }]);
        setBurgerExtras([{ nombre: '', precio: '' }]);
        setBurgerOfferPapas(false);
        setBurgerPrecioPapas('');
        setShowVariantsConfig(false);
      }
    } else if (view === 'addItem' && !editItem) {
        setItemCategory('');
        setBurgerVariants([{ nombre: '', precio: '', disponible: true }]);
        setBurgerExtras([{ nombre: '', precio: '' }]);
        setBurgerOfferPapas(false);
        setBurgerPrecioPapas('');
        setShowVariantsConfig(false);
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

  // Realtime & Fallback Polling
  React.useEffect(() => {
    if (!restaurant) return;
    
    // Load immediately
    loadOrders(false);
    loadRepartidoresStatus();

    // Subscribe to realtime changes in pedidos_locales for this local
    console.log("📡 Subscribing to realtime updates for local orders:", restaurant.id);
    const channel = api.supabase
      .channel(`pedidos_locales_changes_${restaurant.id}`)
      .on('postgres_changes', {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'pedidos_locales',
        filter: `local_id=eq.${restaurant.id}`
      }, (payload) => {
        console.log("🔔 Realtime update on pedidos_locales received:", payload);
        loadOrders(true); // silent refresh
      })
      .subscribe();

    // Fallback polling (every 45s) to guarantee updates if WebSocket is interrupted
    pollingRef.current = setInterval(() => {
      console.log("🔄 Fallback polling refresh...");
      loadOrders(true);
      loadRepartidoresStatus();
    }, 45000);

    return () => {
      console.log("🔌 Unsubscribing from realtime local orders:", restaurant.id);
      api.supabase.removeChannel(channel);
      clearInterval(pollingRef.current);
    };
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
  
  const loadPlanInfo = async () => {
    if (!restaurant) return;
    try {
      const info = await api.getPlanInfo(restaurant.id);
      if (info.success) {
        console.log("Plan Info Loaded:", info);
        setPlanInfo(info);
      }
      const allPlanes = await api.getDisponibilidadPlanes();
      setAvailablePlans(allPlanes);
    } catch (e) {
      console.error("Error loading plan info:", e);
    }
  };

  const handleSuscripPlan = async (plan) => {
    // Si el plan no es el básico, redirigir a WhatsApp
    if (plan.nombre !== 'Básico') {
      const message = `Hola! Me gustaría solicitar el cambio al plan ${plan.nombre} para mi local: ${restaurant?.nombre || 'Mi Local'}`;
      const waUrl = `https://wa.me/5493756543610?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
      return;
    }

    try {
      setAuthLoading(true);
      await api.suscribirAPlan(restaurant.id, plan.id);
      toast.success('¡Plan actualizado! Los cambios se verán reflejados en breve.');
      loadPlanInfo();
    } catch (err) {
      toast.error('Error al cambiar de plan: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const loadCobros = async () => {
    if (!restaurant) return;
    setCobrosLoading(true);
    try {
      const d = await api.getCobrosByLocal(restaurant.id);
      if (d.success) setCobrosData(d);
    } catch { toast.error('Error al cargar cobros'); }
    setCobrosLoading(false);
  };

  const loadCierreReport = async () => {
    if (!restaurant) return;
    setCierreLoading(true);
    try {
      let options = {};
      if (cierreMode === 'dia') options = { fecha: cierreFecha };
      else if (cierreMode === 'intervalo') options = { inicio: cierreFechaInicio, fin: cierreFechaFin };
      else options = { pendientes: true };

      const res = await api.getLocalCierreReport(restaurant.id, options);
      if (res.success) {
        setCierreReport(res);
      }
    } catch (e) {
      toast.error('Error al generar informe: ' + e.message);
    } finally {
      setCierreLoading(false);
    }
  };


  const handleSaveCierre = async () => {
    try {
      setCierreLoading(true);
      await api.saveLocalCierre({ ...cierreReport, localId: restaurant.id });
      toast.success('Cierre de caja guardado con éxito');
    } catch (e) {
      toast.error('Error al guardar: ' + e.message);
    } finally {
      setCierreLoading(false);
    }
  };

  const loadHistorialCierres = async () => {
    if (!restaurant) return;
    setCierreLoading(true);
    try {
      const data = await api.getHistorialCierresLocales(restaurant.id);
      setHistorialCierres(data);
    } catch (e) {
      toast.error('Error al cargar historial');
    } finally {
      setCierreLoading(false);
    }
  };

  const loadStats = async () => {
    if (!restaurant) return;
    setCierreLoading(true);
    try {
      const data = await api.getLocalAnalytics(restaurant.id, statsDates.start, statsDates.end);
      setStatsData(data);
    } catch (e) {
      toast.error('Error al cargar estadísticas');
    } finally {
      setCierreLoading(false);
    }
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
      if (d.success && d.localId) { loginAsRestaurant({ localId: d.localId, emailConfirmado: d.emailConfirmado, role: d.role }); toast.success('¡Bienvenido!'); }
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
    
    const selectedRubros = fd.getAll('reg_rubros');
    if (selectedRubros.length === 0) {
      toast.error('Selecciona al menos un rubro para tu local');
      return;
    }

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
        'Emprendedor', // Default plan
        null,
        null,
        contactoFull,
        fd.get('ciudad') || 'Santo Tomé',
        fd.get('tipo_servicio') || 'delivery',
        selectedRubros
      );
      toast.success('¡Local registrado! Iniciá sesión.');
      setAuthEmail(email);
      setAuthView('login');
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

  const handleSaveSlug = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanSlug = customSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!cleanSlug) {
      toast.error('El enlace personalizado no puede estar vacío');
      return;
    }
    
    setSlugSaving(true);
    const loading = toast.loading('Guardando enlace personalizado...');
    try {
      const isAvailable = await api.isSlugAvailable(cleanSlug, restaurant.id);
      if (!isAvailable) {
        toast.error('Este enlace personalizado ya está en uso por otro local. Elige uno diferente.', { id: loading });
        setSlugSaving(false);
        return;
      }
      
      const success = await api.updatePerfilLocal({ localId: restaurant.id, slug: cleanSlug });
      if (success) {
        setProfileData(prev => ({ ...prev, slug: cleanSlug }));
        setCustomSlug(cleanSlug);
        toast.success('¡Enlace personalizado actualizado con éxito!', { id: loading, icon: '🔗' });
      } else {
        toast.error('Error al guardar el enlace', { id: loading });
      }
    } catch (err) {
      toast.error('Error al verificar o guardar el enlace: ' + (err.message || err), { id: loading });
    }
    setSlugSaving(false);
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
      
      const cat = fd.get('categoria');
      const subcat = fd.get('subcategoria');

      const isBase = cat === 'Base';
      const isAvailable = fd.get('disponibilidad') === 'true';
      const hasImage = (imgUrl && imgUrl.trim() !== '') || (editItem && editItem.imagen_url && editItem.imagen_url.trim() !== '');

      if (!isBase && isAvailable && !hasImage) {
        toast.error('No puedes guardar un producto disponible sin foto. Sube una foto o cámbialo a "Oculto/No disponible".');
        setItemLoading(false);
        return;
      }

      if (cat === 'Helados') {
        if (subcat === 'Helado por kg') {
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
        } else {
          // Paletas or Envasados - standard variant config
          const filteredVariants = burgerVariants.filter(v => v.nombre.trim() !== '');
          const filteredExtras = burgerExtras.filter(e => e.nombre.trim() !== '');
          
          if (filteredVariants.length > 0 || filteredExtras.length > 0) {
            const advancedConfig = {
              variants: filteredVariants,
              extras: filteredExtras
            };
            variantesVal = JSON.stringify(advancedConfig);
            if (!precioVal && filteredVariants.length > 0) {
              precioVal = filteredVariants[0].precio;
            }
          } else {
            variantesVal = null;
          }
        }
      } else if (cat !== 'Base') {
        const filteredVariants = burgerVariants.filter(v => v.nombre.trim() !== '');
        const filteredExtras = burgerExtras.filter(e => e.nombre.trim() !== '');
        
        if (filteredVariants.length > 0 || filteredExtras.length > 0 || burgerOfferPapas) {
          const advancedConfig = {
            es_hamburguesa: cat === 'Hamburguesas',
            es_combo: cat === 'Combos',
            es_pancho: cat === 'Panchos',
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
          variantesVal = null; // Clear if no variants/extras/papas
        }
      }

      const data = {
        localId: restaurant.id,
        nombre: fd.get('nombre'), categoria: fd.get('categoria'),
        descripcion: fd.get('descripcion'), precio: precioVal,
        descuento: fd.get('descuento') ? parseFloat(fd.get('descuento')) : 0,
        disponibilidad: fd.get('disponibilidad') === 'true',
        tamano_porcion: cat === 'Helados' ? subcat : fd.get('tamano_porcion'), variantes: variantesVal,
        tiempo_preparacion: fd.get('tiempo_preparacion'),
        imagen_url: imgUrl,
        // Stock management fields
        maneja_stock: fd.has('maneja_stock') ? (fd.get('maneja_stock') === 'on') : (editItem?.maneja_stock || false),
        stock_actual: fd.has('stock_actual') ? (parseInt(fd.get('stock_actual')) || 0) : (editItem?.stock_actual || 0),
        stock_minimo: fd.has('stock_minimo') ? (parseInt(fd.get('stock_minimo')) || 10) : (editItem?.stock_minimo || 10),
        unidades_por_venta: fd.has('unidades_por_venta') ? (parseInt(fd.get('unidades_por_venta')) || 1) : (editItem?.unidades_por_venta || 1),
        stock_base_id: fd.has('stock_base_id') ? (fd.get('stock_base_id') || null) : (editItem?.stock_base_id || null),
        sku: fd.get('sku') || null,
        codigo_barras: fd.get('codigo_barras') || null,
      };
      if (editItem) {
        data.itemId = editItem.id;
        await api.updateMenuItem(data);
      } else {
        await api.addMenuItem(data);
      }
      const itemTerm = isInventory ? 'Artículo' : 'Plato';
      toast.success(editItem ? `${itemTerm} actualizado` : `${itemTerm} agregado`);
      setEditItem(null);
      setIsBaseProductMode(false);
      setView('menu');
      loadMenu();
    } catch (err) { toast.error(err.message || 'Error al guardar'); }
    setItemLoading(false);
  };

  const handleDeleteItem = async (id) => {
    if (!confirm(`¿Eliminar este ${isInventory ? 'artículo' : 'plato'} permanentemente?`)) return;
    try {
      await api.deleteMenuItem(id);
      toast.success(isInventory ? 'Artículo eliminado' : 'Plato eliminado');
      loadMenu();
    } catch { toast.error('Error al eliminar'); }
  };

  const handleToggleDisp = async (id, current) => {
    const item = menuItems.find(m => m.id === id);
    if (!current) {
      if (item && item.categoria !== 'Base' && (!item.imagen_url || item.imagen_url.trim() === '')) {
        toast.error('No puedes activar la disponibilidad de un producto sin foto');
        return;
      }
    }
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

  const handleQuickStockSave = async (itemId, newStock) => {
    try {
      await api.updateMenuItem({ itemId, stock_actual: newStock });
      setMenuItems(prev => prev.map(m => m.id === itemId ? { ...m, stock_actual: newStock } : m));
      toast.success('Stock actualizado');
    } catch (err) {
      toast.error('Error al actualizar stock');
    } finally {
      setEditingStockItem(null);
    }
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
    const email = fd.get('email');
    if (email && !isValidEmail(email)) { toast.error('Ingresá un email válido'); return; }
    
    try {
      let fotoUrl = '';
      if (file && file.size > 0) fotoUrl = await api.uploadImage(file);
      
      const params = { localId: restaurant.id };
      if (fd.has('nombre')) params.nombre = fd.get('nombre');
      if (fd.has('email')) params.email = email;
      
      // Manejo de Dirección
      if (fd.has('direccion') || fd.has('update_address')) {
        params.direccion = profileAddress;
        params.lat = profileLat;
        params.lng = profileLng;
      }

      // Manejo de Descuentos
      if (fd.has('descuento_general')) {
        params.descuento_general = parseFloat(fd.get('descuento_general')) || 0;
        params.categoria_descuento = fd.get('categoria_descuento') || '';
        const discountDays = [];
        ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach(day => {
          if (fd.get(`desc_${day}`) === 'on') discountDays.push(day);
        });
        params.dias_descuento = discountDays;
      }
      
      const pass = fd.get('password');
      if (pass) params.password = pass;
      if (fotoUrl) params.foto_url = fotoUrl;

      // Compatibilidad con campos heredados
      if (fd.has('horario_apertura')) params.horario_apertura = fd.get('horario_apertura');
      if (fd.has('horario_cierre')) params.horario_cierre = fd.get('horario_cierre');
      if (fd.has('horario_apertura2')) params.horario_apertura2 = fd.get('horario_apertura2');
      if (fd.has('horario_cierre2')) params.horario_cierre2 = fd.get('horario_cierre2');
      if (fd.has('modo_automatico')) params.modo_automatico = fd.get('modo_automatico') === 'true';

      const success = await api.updatePerfilLocal(params);
      if (success) {
        toast.success('Perfil actualizado correctamente');
        setProfileData(prev => ({ ...prev, ...params }));
        if (fd.has('descuento_general')) loadMenu();
      }
    } catch { toast.error('Error al guardar perfil'); }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const selectedDays = [];
    
    ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach(day => {
      if (fd.get(`day_${day}`) === 'on') selectedDays.push(day);
    });

    try {
      const params = {
        localId: restaurant.id, 
        horario_apertura: fd.get('horario_apertura'),
        horario_cierre: fd.get('horario_cierre'),
        horario_apertura2: fd.get('horario_apertura2'),
        horario_cierre2: fd.get('horario_cierre2'),
        modo_automatico: fd.get('modo_automatico') === 'true',
        dias_apertura: selectedDays,
        acepta_retiro: fd.get('acepta_retiro') === 'on',
        acepta_envio: fd.get('acepta_envio') === 'on',
        config_horarios: configHorarios
      };

      const success = await api.updatePerfilLocal(params);
      if (success) {
        toast.success('Configuración actualizada correctamente');
        setProfileData(prev => ({ ...prev, ...params }));
      }
    } catch { toast.error('Error al guardar configuración'); }
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

  const handleToggleDay = (day) => {
    setConfigHorarios(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        tipo: prev[day]?.tipo === 'cerrado' ? 'especifico' : 'cerrado',
        intervalos: (prev[day]?.tipo === 'cerrado' && (!prev[day]?.intervalos || prev[day].intervalos.length === 0))
          ? [{ inicio: '09:00', fin: '14:00' }]
          : (prev[day]?.intervalos || [])
      }
    }));
  };

  const handleChangeTipo = (day, tipo) => {
    setConfigHorarios(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        tipo,
        intervalos: tipo === 'especifico' && (!prev[day]?.intervalos || prev[day].intervalos.length === 0) 
          ? [{ inicio: '09:00', fin: '14:00' }] 
          : (prev[day]?.intervalos || [])
      }
    }));
  };

  const handleAddInterval = (day) => {
    setConfigHorarios(prev => {
      const current = prev[day]?.intervalos || [];
      if (current.length >= 2) return prev;
      return {
        ...prev,
        [day]: {
          ...prev[day],
          intervalos: [...current, { inicio: '19:00', fin: '23:00' }]
        }
      };
    });
  };

  const handleRemoveInterval = (day, index) => {
    setConfigHorarios(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        intervalos: (prev[day].intervalos || []).filter((_, i) => i !== index)
      }
    }));
  };

  const handleUpdateInterval = (day, index, field, value) => {
    setConfigHorarios(prev => {
      const newIntervals = [...(prev[day].intervalos || [])];
      newIntervals[index] = { ...newIntervals[index], [field]: value };
      return {
        ...prev,
        [day]: {
          ...prev[day],
          intervalos: newIntervals
        }
      };
    });
  };

  const renderHorariosConfig = () => {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return (
      <div className="rd-horarios-config" style={{ marginTop: '0px' }}>
        {days.map(day => {
          const config = configHorarios[day] || { tipo: 'cerrado', intervalos: [] };
          const isOpen = config.tipo !== 'cerrado';
          
          return (
            <div key={day} style={{ 
              padding: '16px', 
              background: isOpen ? 'white' : 'var(--gray-50)', 
              borderRadius: '12px', 
              border: '1px solid var(--gray-200)',
              marginBottom: '12px',
              transition: 'all 0.2s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isOpen ? '12px' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div 
                    onClick={() => handleToggleDay(day)}
                    style={{ 
                      width: '40px', 
                      height: '22px', 
                      background: isOpen ? 'var(--red-600)' : 'var(--gray-300)', 
                      borderRadius: '11px', 
                      position: 'relative', 
                      cursor: 'pointer',
                      transition: 'background 0.3s'
                    }}
                  >
                    <div style={{ 
                      width: '18px', 
                      height: '18px', 
                      background: 'white', 
                      borderRadius: '50%', 
                      position: 'absolute', 
                      top: '2px', 
                      left: isOpen ? '20px' : '2px',
                      transition: 'left 0.3s'
                    }} />
                  </div>
                  <span style={{ fontWeight: 600, color: isOpen ? 'var(--gray-800)' : 'var(--gray-500)' }}>{day}</span>
                </div>
                
                {isOpen && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button"
                      onClick={() => handleChangeTipo(day, 'especifico')}
                      className="btn"
                      style={{ 
                        padding: '4px 10px', 
                        fontSize: '0.75rem', 
                        borderRadius: '6px',
                        border: '1px solid ' + (config.tipo === 'especifico' ? 'var(--red-600)' : 'var(--gray-300)'),
                        background: config.tipo === 'especifico' ? 'var(--red-50)' : 'white',
                        color: config.tipo === 'especifico' ? 'var(--red-600)' : 'var(--gray-600)',
                        fontWeight: config.tipo === 'especifico' ? 600 : 400,
                        height: 'auto',
                        minHeight: 'unset'
                      }}
                    >
                      Horario
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleChangeTipo(day, '24hs')}
                      className="btn"
                      style={{ 
                        padding: '4px 10px', 
                        fontSize: '0.75rem', 
                        borderRadius: '6px',
                        border: '1px solid ' + (config.tipo === '24hs' ? 'var(--red-600)' : 'var(--gray-300)'),
                        background: config.tipo === '24hs' ? 'var(--red-50)' : 'white',
                        color: config.tipo === '24hs' ? 'var(--red-600)' : 'var(--gray-600)',
                        fontWeight: config.tipo === '24hs' ? 600 : 400,
                        height: 'auto',
                        minHeight: 'unset'
                      }}
                    >
                      24hs
                    </button>
                  </div>
                )}
                {!isOpen && <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontStyle: 'italic' }}>Cerrado</span>}
              </div>

              {isOpen && config.tipo === 'especifico' && (
                <div style={{ paddingLeft: '52px' }}>
                  {(config.intervalos || []).map((intervalo, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <input 
                        type="time" 
                        value={intervalo.inicio} 
                        onChange={(e) => handleUpdateInterval(day, idx, 'inicio', e.target.value)}
                        className="form-input" 
                        style={{ padding: '4px 8px', width: '100px', fontSize: '0.85rem', marginBottom: 0 }} 
                      />
                      <span style={{ color: 'var(--gray-400)' }}>a</span>
                      <input 
                        type="time" 
                        value={intervalo.fin} 
                        onChange={(e) => handleUpdateInterval(day, idx, 'fin', e.target.value)}
                        className="form-input" 
                        style={{ padding: '4px 8px', width: '100px', fontSize: '0.85rem', marginBottom: 0 }} 
                      />
                      {idx > 0 && (
                        <button 
                          type="button" 
                          onClick={() => handleRemoveInterval(day, idx)}
                          style={{ background: 'none', border: 'none', color: 'var(--red-600)', cursor: 'pointer', fontSize: '1.1rem' }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {(config.intervalos || []).length < 2 && (
                    <button 
                      type="button"
                      onClick={() => handleAddInterval(day)}
                      style={{ 
                        background: 'none', 
                        border: '1px dashed var(--gray-300)', 
                        color: 'var(--gray-500)', 
                        padding: '4px 12px', 
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        marginTop: '4px'
                      }}
                    >
                      + Agregar Turno
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };
  // ─── Tutorial Mock Data logic ───
  const tutorialSampleDish = {
    id: 'sample-dish-1',
    nombre: 'Hamburguesa Wepi (Muestra)',
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
    items: [[null, null, 'sample-dish-1', 1, 'Hamburguesa Wepi (Muestra)', '', 1, 4500]],
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
    if (i.categoria === 'Base') return false; // No mostrar productos base en la lista de menú pública
    const nameOk = !menuFilter || i.nombre.toLowerCase().includes(menuFilter.toLowerCase());
    const catOk = !menuCatFilter || i.categoria === menuCatFilter;
    return nameOk && catOk;
  });

  const finalMenu = showTutorial && view === 'menu' ? [tutorialSampleDish, ...filteredMenu] : filteredMenu;

  // processOrders moved below isShop definition for correct scope
  // ─── Renderizado de Planes y Niveles ───
  const renderPlansView = () => {
    if (!planInfo) return <div className="loading-state"><div className="spinner" /> Cargando info de planes...</div>;
    const { plan_nombre, nivel_actual, comision_actual, metricas_mes, proximo_nivel } = planInfo;

    return (
      <section className="animate-fade-in" style={{ paddingBottom: '40px' }}>
        <div className="plans-hero card" style={{ 
          background: 'linear-gradient(135deg, #c62828 0%, #b71c1c 100%)', 
          color: 'white', padding: '32px', borderRadius: '24px', marginBottom: '32px',
          boxShadow: '0 10px 25px rgba(198, 40, 40, 0.2)', position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: '2.2rem', marginBottom: '8px', fontWeight: 800 }}>Tu Crecimiento</h2>
            <p style={{ opacity: 0.9, fontSize: '1.1rem' }}>Gestioná tu visibilidad y niveles de comisión</p>
            
            <div className="plans-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginTop: '32px' }}>
              <div className="plan-stat-card" style={{ background: 'rgba(255,255,255,0.15)', padding: '20px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                <span className="stat-label" style={{ display: 'block', fontSize: '0.8rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Nivel Actual</span>
                <span className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 800 }}>🚀 {getLevelName(nivel_actual)}</span>
              </div>
              <div className="plan-stat-card" style={{ background: 'rgba(255,255,255,0.15)', padding: '20px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                <span className="stat-label" style={{ display: 'block', fontSize: '0.8rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Comisión</span>
                <span className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{comision_actual}%</span>
              </div>
              <div className="plan-stat-card" style={{ background: 'rgba(255,255,255,0.15)', padding: '20px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                <span className="stat-label" style={{ display: 'block', fontSize: '0.8rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Ventas (30d)</span>
                <span className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{metricas_mes.pedidos}</span>
              </div>
            </div>
          </div>
          {/* Círculos decorativos */}
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: '-30px', left: '10%', width: '100px', height: '100px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
        </div>

        <div className="card" style={{ padding: '32px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.8rem' }}>🌟</span> Planes de Visibilidad
          </h3>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginBottom: '20px' }}>
            Tu plan de visibilidad determina qué tan arriba apareces en la aplicación y qué beneficios publicitarios tienes.
          </p>
          <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '32px' }}>
            {availablePlans.map(plan => (
              <div key={plan.id} className={`plan-select-card card ${plan.nombre === plan_nombre ? 'current' : ''}`} style={{ 
                padding: '24px 16px', borderRadius: '20px', border: plan.nombre === plan_nombre ? '2px solid #c62828' : '1px solid #e2e8f0',
                position: 'relative', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease',
                background: '#fff', minHeight: '100%'
              }}>
                {plan.nombre === plan_nombre && (
                  <div className="current-label" style={{ 
                    position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                    background: '#c62828', color: 'white', padding: '4px 16px', borderRadius: '20px',
                    fontSize: '0.75rem', fontWeight: 800, letterSpacing: '1px'
                  }}>ACTUAL</div>
                )}
                
                {plan.nombre === 'Destacado' && (
                  <img src="https://i.postimg.cc/50W06p4z/descarga-(31).png" alt="Icono Destacado" style={{ height: '40px', marginBottom: '12px', objectFit: 'contain' }} />
                )}
                {plan.nombre === 'Recomendado' && (
                  <img src="https://i.postimg.cc/K8dcHQg5/descarga-(31)-(4).png" alt="Icono Recomendado" style={{ height: '40px', marginBottom: '12px', objectFit: 'contain' }} />
                )}

                <h4 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>{plan.nombre}</h4>
                <p className="plan-price" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginBottom: '24px' }}>
                  ${plan.precio_mensual.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: '#64748b' }}>/ mes</span>
                </p>
                
                <ul className="plan-advantages" style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', textAlign: 'left', flex: 1 }}>
                  {(planBenefits[plan.nombre] || []).map((benefit, i) => (
                    <li key={i} style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '12px', display: 'flex', gap: '10px' }}>
                      <span style={{ color: '#059669', fontWeight: 'bold' }}>✓</span> {benefit}
                    </li>
                  ))}
                </ul>

                {plan.nombre !== plan_nombre ? (
                  <button className="btn btn-primary btn-full" onClick={() => handleSuscripPlan(plan)} style={{ padding: '12px', borderRadius: '12px', fontWeight: 700 }}>Elegir {plan.nombre}</button>
                ) : (
                  <button className="btn btn-secondary btn-full" disabled style={{ padding: '12px', borderRadius: '12px', opacity: 0.7, background: '#f1f5f9', color: '#64748b' }}>Plan Activo</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tabla de Referencia de Comisiones */}
        <div style={{ marginTop: '48px', padding: '32px', background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: '1.2rem' }}>Escala de Comisiones por Ventas</h4>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '24px' }}>
            Las comisiones se ajustan dinámicamente según tu volumen de ventas en los últimos 30 días.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {[
              { n: 'Despegue', c: '15%', t: '0+' },
              { n: 'Crecimiento', c: '12%', t: '15+' },
              { n: 'Experto', c: '10%', t: '30+' },
              { n: 'Nivel Pro', c: '8%', t: '50+' },
            ].map((tier, i) => (
              <div key={i} style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{tier.n}</p>
                <p style={{ margin: '8px 0', fontSize: '1.5rem', fontWeight: 800, color: '#c62828' }}>{tier.c}</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>{tier.t} ventas / 30d</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const finishedOrders = orders.filter(o => o.estadoActual === 'Entregado');
  
  const isShop = profileData?.tipo_servicio === 'shops';
  const processOrders = orders.filter(o => {
    if (isShop) {
      return ['Pendiente', 'Confirmado', 'Aceptado', 'Listo', 'Buscando Repartidor'].includes(o.estadoActual);
    } else {
      return ['Confirmado', 'Aceptado', 'Listo'].includes(o.estadoActual);
    }
  });

  const pendientesOrders = processOrders.filter(o => isShop ? (o.estadoActual === 'Pendiente' || o.estadoActual === 'Confirmado') : o.estadoActual === 'Confirmado').sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const preparacionOrders = processOrders.filter(o => o.estadoActual === 'Aceptado');
  const listosOrders = processOrders.filter(o => o.estadoActual === 'Listo' || (isShop && o.estadoActual === 'Buscando Repartidor'));

  const currentTabOrders = (isShop ? [...processOrders].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)) : 
                            (currentTab === 'pendientes' ? pendientesOrders :
                             currentTab === 'preparacion' ? preparacionOrders :
                             listosOrders)).filter(o => 
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
          <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" className="rd-logo" />
        </Link>
        <h1>Panel de Gestión</h1>
      </header>
      <main className="rd-main">
        <div className="rd-auth-card card animate-fade-in" key={authView}>
          <div className="card-body">
            <h2>Acceso Local</h2>
            <div className="rd-auth-tabs">
              <button className={`btn ${authView === 'login' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => { setAuthView('login'); setShowPassword(false); }}>Iniciar Sesión</button>
              <button className={`btn ${authView === 'register' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => { setAuthView('register'); setShowPassword(false); }}>Registrar Local</button>
            </div>
            {authView === 'login' ? (
              <form onSubmit={handleLogin} className="rd-auth-form">
                <input name="email" type="text" className="form-input" placeholder="Email o Usuario" defaultValue={authEmail} required autoComplete="username" />
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

                <div style={{ marginBottom: '16px' }}>
                  <select 
                    name="ciudad" 
                    className="form-input" 
                    required
                    defaultValue="Santo Tomé"
                    style={{ width: '100%', margin: 0, padding: '0 12px', height: '42px', minHeight: '42px' }}
                  >
                    <option value="" disabled>Seleccioná tu Ciudad</option>
                    <option value="Santo Tomé">Santo Tomé</option>
                    <option value="Oberá">Oberá</option>
                  </select>
                </div>

                <div style={{ marginBottom: '16px', textAlign: 'left' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--gray-700)' }}>Rama de Servicio</label>
                  <select 
                    name="tipo_servicio" 
                    className="form-input" 
                    value={regTipoServicio} 
                    onChange={(e) => setRegTipoServicio(e.target.value)} 
                    style={{ width: '100%', margin: 0, padding: '0 12px', height: '42px', minHeight: '42px' }}
                  >
                    <option value="delivery">🛵 Wepi Delivery (Gastronomía, Heladería, Farmacia...)</option>
                    <option value="shops">🛍️ Wepi Shops (Hogar, Tecnología, Moda, Regalería, Deportes...)</option>
                  </select>
                </div>

                <div style={{ marginBottom: '16px', textAlign: 'left' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--gray-700)' }}>Rubros del Negocio</label>
                  <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', 
                      gap: '8px', 
                      background: '#f8fafc', 
                      padding: '12px', 
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0'
                  }}>
                      {(regTipoServicio === 'shops' 
                          ? ['Hogar', 'Tecnología', 'Moda', 'Regalería', 'Deportes', 'Bebidas'] 
                          : ['Restaurante', 'Cafetería', 'Heladería', 'Market', 'Farmacia', 'Bebidas', 'Carnicería']
                      ).map(r => (
                          <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer', margin: 0, color: 'var(--gray-700)' }}>
                              <input 
                                  type="checkbox" 
                                  name="reg_rubros" 
                                  value={r} 
                              />
                              {r}
                          </label>
                      ))}
                  </div>
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
        <div style={{ maxWidth: '450px', margin: '24px auto 0' }}>
          <img src="https://i.postimg.cc/bYKLG203/Tarde-de-superclasico-(4).png" alt="Banner" style={{ width: '100%', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
        </div>
      </main>
      <footer className="footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 20px' }}>
        <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" style={{ height: '50px', objectFit: 'contain' }} />
        <p>© 2026 <strong>Wepi</strong> — Panel de Locales</p>
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

  // ─── Tutorial Overlay ───
  const renderTutorial = () => {
    if (!showTutorial) return null;

    const mascotUrl = "https://i.postimg.cc/76cK0DSH/Gemini-Generated-Image-aqk3geaqk3geaqk3-(2).png";

    const steps = [
      {
        title: "¡Bienvenido a Wepi!",
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

  const renderStockModal = () => {
    if (!showStockModal) return null;

    return (
      <div className="modal-overlay animate-fade-in" style={{ zIndex: 10001 }}>
        <div className="modal-content animate-slide-up" style={{ maxWidth: '500px', width: '95%' }}>
          <h2 style={{ color: '#c2410c', marginBottom: 12 }}>🥖 Confirmar Stock del Día</h2>
          <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem', marginBottom: 20 }}>
            Ingresá las unidades frescas disponibles para hoy. Esto evitará que vendas productos que ya no tenés.
          </p>

          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const updates = {};
            stockToConfirm.forEach(item => {
              updates[item.id] = fd.get(`stock_${item.id}`);
            });
            handleConfirmDailyStock(updates);
            setShowStockModal(false);
          }}>
            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {stockToConfirm.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {item.imagen_url && <img src={item.imagen_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />}
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.nombre}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input 
                      name={`stock_${item.id}`} 
                      type="number" 
                      className="form-input" 
                      style={{ width: 80, marginBottom: 0, textAlign: 'center' }} 
                      defaultValue={item.stock_actual}
                      required 
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>u.</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowStockModal(false)}>Más tarde</button>
              <button type="submit" className="btn btn-primary" style={{ background: '#f97316', borderColor: '#f97316' }} disabled={itemLoading}>
               {itemLoading ? <span className="spinner spinner-white" /> : 'Confirmar Todo'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderStockSelectorModal = () => {
    if (!showStockSelectorModal) return null;

    return (
      <div className="modal-overlay animate-fade-in" style={{ zIndex: 10001 }}>
        <div className="modal-content animate-slide-up" style={{ maxWidth: '500px', width: '95%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ color: '#c2410c', margin: 0, fontSize: '1.2rem' }}>⚙️ Habilitar Stock de Productos</h2>
            <button className="close-btn" style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }} onClick={() => setShowStockSelectorModal(false)}>✕</button>
          </div>
          <p style={{ color: 'var(--gray-600)', fontSize: '0.85rem', marginBottom: 20 }}>
            Activá el control de stock para los productos que quieras gestionar desde el panel de Stock Rápido.
          </p>

          <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {menuItems.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  {item.imagen_url ? <img src={item.imagen_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} /> :
                    <div style={{ width: 36, height: 36, borderRadius: 6, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#94a3b8' }}>Sin foto</div>}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nombre}</p>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--gray-500)' }}>{item.categoria}</p>
                  </div>
                </div>
                <div>
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={item.maneja_stock || false} 
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        // Optimistic update
                        setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, maneja_stock: checked } : m));
                        try {
                          await api.updateMenuItem({ itemId: item.id, maneja_stock: checked });
                          toast.success(checked ? `Control de stock activado para ${item.nombre}` : `Control de stock desactivado para ${item.nombre}`, { id: `toggle-stock-${item.id}` });
                        } catch (err) {
                          toast.error('Error al actualizar control de stock');
                          loadMenu();
                        }
                      }}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary" style={{ background: '#f97316', borderColor: '#f97316' }} onClick={() => setShowStockSelectorModal(false)}>Listo</button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Wepi Sync V1 Handlers & Views ───
  const handleExecuteSync = async () => {
    if (!profileData?.id) {
      toast.error('No se ha podido identificar el local actual.');
      return;
    }
    setSyncEngineLoading(true);
    setSyncEngineResult(null);

    try {
      let syncResult;

      if (syncFileType === 'sheets') {
        if (!syncGoogleSheetsUrl) {
          toast.error('Por favor, ingresa una URL pública de Google Sheets.');
          setSyncEngineLoading(false);
          return;
        }
        syncResult = await syncEngine.syncCatalog({
          localId: profileData.id,
          metodo: 'sheets',
          urlOrigen: syncGoogleSheetsUrl,
          mapeoColumnas: syncMapeo,
          camposActualizables: syncCamposActualizables,
          desactivarFaltantes: syncDesactivarFaltantes,
          supabaseInstance: api.supabase
        });
      } else {
        if (!syncFile) {
          toast.error('Por favor, selecciona un archivo CSV o Excel.');
          setSyncEngineLoading(false);
          return;
        }
        syncResult = await syncEngine.syncCatalog({
          localId: profileData.id,
          metodo: syncFileType,
          archivo: syncFile,
          mapeoColumnas: syncMapeo,
          camposActualizables: syncCamposActualizables,
          desactivarFaltantes: syncDesactivarFaltantes,
          supabaseInstance: api.supabase
        });
      }

      setSyncEngineResult(syncResult);
      setSyncStep('result');

      // Guardar configuración e historial en locales
      const nuevoHistorialLog = {
        fecha: new Date().toISOString(),
        origen: syncFileType === 'sheets' ? 'sheets' : syncFile.name,
        estado: syncResult.errores > 0 ? (syncResult.creados + syncResult.actualizados > 0 ? 'parcial' : 'fallido') : 'exitoso',
        creados: syncResult.creados,
        actualizados: syncResult.actualizados,
        errores: syncResult.errores,
        totalFilas: syncResult.totalFilas || 0,
        filasSalteadas: syncResult.filasSalteadas || 0
      };

      const historialActual = profileData.sync_config_data?.historial || [];
      const nuevoHistorial = [nuevoHistorialLog, ...historialActual].slice(0, 10); // Conservar últimos 10

      const nuevaConfigData = {
        ...profileData.sync_config_data,
        url_origen: syncGoogleSheetsUrl,
        metodo: syncFileType,
        mapeo_columnas: syncMapeo,
        campos_actualizables: syncCamposActualizables,
        desactivar_faltantes: syncDesactivarFaltantes,
        historial: nuevoHistorial
      };

      await api.updateLocalSyncConfig(profileData.id, nuevaConfigData);
      
      // Recargar perfil del dashboard para reflejar el historial e info nueva
      if (typeof loadProfile === 'function') {
        await loadProfile();
      } else {
        // Fallback si no está definido en este dashboard
        const { data: refreshedProfile } = await api.supabase
          .from('locales')
          .select('*')
          .eq('id', profileData.id)
          .single();
        if (refreshedProfile) {
          setProfileData(refreshedProfile);
        }
      }

      await loadMenu(); // Recargar los platos del menú locales

      if (syncResult.errores > 0) {
        toast.error(`Sincronización completada con ${syncResult.errores} errores.`);
      } else {
        toast.success(`Sincronización exitosa: +${syncResult.creados} nuevos, ${syncResult.actualizados} actualizados.`);
      }

    } catch (error) {
      console.error('Error ejecutando sincronización:', error);
      toast.error('Error ejecutando sincronización: ' + (error.message || error));
    } finally {
      setSyncEngineLoading(false);
    }
  };

  const renderSyncView = () => {
    const historial = profileData?.sync_config_data?.historial || [];

    return (
      <div className="animate-fade-in" style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
        <div className="card card-body" style={{ marginBottom: '24px' }}>
          <h2 style={{ color: 'var(--red-600)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🔄 Wepi Sync
          </h2>
          <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem', marginBottom: '20px' }}>
            Sincroniza el catálogo de productos de tu sistema de gestión (ERP, Excel o CSV) con Wepi. Wepi actualizará automáticamente precios, stock e incorporará los nuevos productos mapeados por su SKU.
          </p>

          {syncStep === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--gray-200)', paddingBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: syncFileType === 'csv' ? 'bold' : 'normal', color: syncFileType === 'csv' ? 'var(--red-600)' : 'inherit' }}>
                  <input type="radio" name="syncType" checked={syncFileType === 'csv'} onChange={() => { setSyncFileType('csv'); setSyncFile(null); }} />
                  Archivo CSV (.csv)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: syncFileType === 'xlsx' ? 'bold' : 'normal', color: syncFileType === 'xlsx' ? 'var(--red-600)' : 'inherit' }}>
                  <input type="radio" name="syncType" checked={syncFileType === 'xlsx'} onChange={() => { setSyncFileType('xlsx'); setSyncFile(null); }} />
                  Archivo Excel (.xlsx)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: syncFileType === 'sheets' ? 'bold' : 'normal', color: syncFileType === 'sheets' ? 'var(--red-600)' : 'inherit' }}>
                  <input type="radio" name="syncType" checked={syncFileType === 'sheets'} onChange={() => { setSyncFileType('sheets'); setSyncFile(null); }} />
                  Google Sheets público
                </label>
              </div>

              {syncFileType === 'sheets' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Enlace público de Google Sheets</label>
                  <input 
                    type="url" 
                    className="form-input" 
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                    value={syncGoogleSheetsUrl}
                    onChange={(e) => setSyncGoogleSheetsUrl(e.target.value)}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                    Asegúrate de que el documento esté configurado como "Cualquier persona con el enlace puede leer".
                  </span>
                </div>
              ) : (
                <div style={{ border: '2px dashed var(--gray-300)', padding: '30px', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }} onClick={() => document.getElementById('syncFileInput').click()}>
                  <input 
                    id="syncFileInput"
                    type="file" 
                    accept={syncFileType === 'csv' ? '.csv' : '.xlsx'} 
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setSyncFile(file);
                      
                      try {
                        const parsedHeaders = await syncEngine.parseFile(file, syncFileType);
                        setSyncHeaders(parsedHeaders);
                        // Auto-mapeo inteligente inicial
                        const nuevoMapeo = { ...syncMapeo };
                        parsedHeaders.forEach(header => {
                          const lower = header.toLowerCase().trim();
                          if (lower === 'sku' || lower === 'código' || lower === 'codigo' || lower === 'id') nuevoMapeo.sku = header;
                          if (lower === 'nombre' || lower === 'producto' || lower === 'item' || lower === 'titulo' || lower === 'plato') nuevoMapeo.nombre = header;
                          if (lower === 'descripción' || lower === 'descripcion' || lower === 'detalle') nuevoMapeo.descripcion = header;
                          if (lower === 'precio' || lower === 'valor' || lower === 'precio_venta' || lower === 'monto') nuevoMapeo.precio = header;
                          if (lower === 'stock' || lower === 'cantidad' || lower === 'unidades' || lower === 'inventario') nuevoMapeo.stock = header;
                          if (lower === 'categoría' || lower === 'categoria' || lower === 'rubro' || lower === 'grupo') nuevoMapeo.categoria = header;
                          if (lower === 'codigo_barras' || lower === 'codigo de barras' || lower === 'barras' || lower === 'upc' || lower === 'ean') nuevoMapeo.codigo_barras = header;
                        });
                        setSyncMapeo(nuevoMapeo);
                        setSyncStep('mapping');
                      } catch (err) {
                        toast.error('Error al leer el archivo: ' + err.message);
                      }
                    }}
                  />
                  <p style={{ fontSize: '1rem', color: 'var(--gray-600)', margin: '0 0 8px 0' }}>
                    Drag & drop o haz clic para subir tu archivo <strong>{syncFileType === 'csv' ? 'CSV' : 'Excel'}</strong>
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray-400)', margin: 0 }}>
                    {syncFileType === 'csv' ? 'Formato CSV delimitado por comas o punto y coma' : 'Formato de hoja de cálculo estándar (.xlsx)'}
                  </p>
                </div>
              )}

              {syncFileType === 'sheets' && (
                <button type="button" className="btn btn-primary" style={{ background: 'var(--red-600)', borderColor: 'var(--red-600)' }} onClick={async () => {
                  if (!syncGoogleSheetsUrl) {
                    toast.error('Por favor ingresa la URL de Google Sheets.');
                    return;
                  }
                  setSyncEngineLoading(true);
                  try {
                    const parsedHeaders = await syncEngine.parseFile(null, 'sheets', syncGoogleSheetsUrl);
                    setSyncHeaders(parsedHeaders);
                    const nuevoMapeo = { ...syncMapeo };
                    parsedHeaders.forEach(header => {
                      const lower = header.toLowerCase().trim();
                      if (lower === 'sku' || lower === 'código' || lower === 'codigo' || lower === 'id') nuevoMapeo.sku = header;
                      if (lower === 'nombre' || lower === 'producto' || lower === 'item' || lower === 'titulo' || lower === 'plato') nuevoMapeo.nombre = header;
                      if (lower === 'descripción' || lower === 'descripcion' || lower === 'detalle') nuevoMapeo.descripcion = header;
                      if (lower === 'precio' || lower === 'valor' || lower === 'precio_venta' || lower === 'monto') nuevoMapeo.precio = header;
                      if (lower === 'stock' || lower === 'cantidad' || lower === 'unidades' || lower === 'inventario') nuevoMapeo.stock = header;
                      if (lower === 'categoría' || lower === 'categoria' || lower === 'rubro' || lower === 'grupo') nuevoMapeo.categoria = header;
                      if (lower === 'codigo_barras' || lower === 'codigo de barras' || lower === 'barras' || lower === 'upc' || lower === 'ean') nuevoMapeo.codigo_barras = header;
                    });
                    setSyncMapeo(nuevoMapeo);
                    setSyncStep('mapping');
                  } catch (err) {
                    toast.error('Error al conectarse a Google Sheets: ' + err.message);
                  } finally {
                    setSyncEngineLoading(false);
                  }
                }} disabled={syncEngineLoading}>
                  {syncEngineLoading ? <span className="spinner spinner-white" /> : 'Siguiente: Mapear Columnas ➔'}
                </button>
              )}
            </div>
          )}

          {syncStep === 'mapping' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '8px' }}>Archivo cargado:</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                  {syncFileType === 'sheets' ? `Google Sheet: ${syncGoogleSheetsUrl}` : `Archivo local: ${syncFile?.name} (${(syncFile?.size / 1024).toFixed(1)} KB)`}
                </p>
              </div>

              {/* Mapeo de Columnas */}
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '12px' }}>
                  🗺️ Mapeo de Columnas
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '16px' }}>
                  Elige a qué columna de tu archivo corresponde cada dato requerido en Wepi. El <strong>SKU</strong> es el campo clave para asociar y buscar tus productos.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                  {Object.keys(syncMapeo).map(campo => {
                    const esRequerido = campo === 'sku' || campo === 'nombre' || campo === 'precio';
                    return (
                      <div key={campo} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.8.5rem', fontWeight: 'bold', color: esRequerido ? 'var(--red-600)' : 'var(--gray-700)' }}>
                          {campo.toUpperCase()} {esRequerido && '*'}
                        </label>
                        <select 
                          className="form-select"
                          style={{ marginBottom: 0 }}
                          value={syncMapeo[campo] || ''}
                          onChange={(e) => setSyncMapeo({ ...syncMapeo, [campo]: e.target.value })}
                        >
                          <option value="">-- No mapeado --</option>
                          {syncHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--gray-200)', margin: '10px 0' }} />

              {/* Configuración de Sincronización */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flexWrap: 'wrap' }}>
                {/* Campos a Actualizar */}
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px' }}>
                    Sobrescribir los siguientes campos de productos existentes:
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {['precio', 'stock', 'nombre', 'descripcion', 'categoria'].map(campo => {
                      const mapped = campo === 'nombre' || campo === 'descripcion' || syncMapeo[campo];
                      return (
                        <label key={campo} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: mapped ? 'pointer' : 'not-allowed', opacity: mapped ? 1 : 0.5 }}>
                          <input 
                            type="checkbox" 
                            disabled={!mapped}
                            checked={mapped && syncCamposActualizables.includes(campo)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSyncCamposActualizables([...syncCamposActualizables, campo]);
                              } else {
                                setSyncCamposActualizables(syncCamposActualizables.filter(c => c !== campo));
                              }
                            }}
                          />
                          {campo.charAt(0).toUpperCase() + campo.slice(1)}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Desactivar faltantes */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox"
                      checked={syncDesactivarFaltantes}
                      onChange={(e) => setSyncDesactivarFaltantes(e.target.checked)}
                    />
                    <span>⚠️ Desactivar automáticamente productos en Wepi que no estén en este archivo.</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setSyncStep('upload')} disabled={syncEngineLoading}>
                  Atrás
                </button>
                <button type="button" className="btn btn-primary" style={{ flex: 2, background: 'var(--red-600)', borderColor: 'var(--red-600)' }} onClick={handleExecuteSync} disabled={syncEngineLoading}>
                  {syncEngineLoading ? <span className="spinner spinner-white" /> : 'Ejecutar Sincronización ⚡'}
                </button>
              </div>
            </div>
          )}

          {syncStep === 'result' && syncEngineResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                <h3 style={{ color: '#16a34a', margin: '0 0 4px 0', fontSize: '1.2rem' }}>Sincronización Procesada</h3>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#15803d' }}>
                  El proceso ha terminado. Se han procesado los registros del catálogo con los siguientes resultados:
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '0.85rem', color: '#14532d', fontWeight: 'bold' }}>
                  <span>Total filas en archivo: {syncEngineResult.totalFilas || 0}</span>
                  <span>•</span>
                  <span style={{ color: syncEngineResult.filasSalteadas > 0 ? '#991b1b' : '#14532d' }}>
                    Filas salteadas: {syncEngineResult.filasSalteadas || 0}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                  <p style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 'bold' }}>Nuevos</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#16a34a' }}>+{syncEngineResult.creados}</p>
                </div>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                  <p style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 'bold' }}>Actualizados</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2563eb' }}>{syncEngineResult.actualizados}</p>
                </div>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                  <p style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 'bold' }}>Errores</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#b91c1c' }}>{syncEngineResult.errores}</p>
                </div>
              </div>

              <button type="button" className="btn btn-primary" style={{ background: 'var(--red-600)', borderColor: 'var(--red-600)', width: '100%' }} onClick={() => { setSyncStep('upload'); setSyncFile(null); setSyncEngineResult(null); }}>
                Volver a Sincronizar
              </button>
            </div>
          )}
        </div>

        {/* Historial de Sincronizaciones */}
        <div className="card card-body">
          <h3 style={{ fontSize: '1rem', color: 'var(--gray-800)', marginBottom: '16px', fontWeight: 'bold' }}>
            📋 Historial de Sincronizaciones
          </h3>
          {historial.length === 0 ? (
            <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', textAlign: 'center', padding: '16px' }}>
              Aún no se han realizado sincronizaciones en este local.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--gray-200)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 4px', color: 'var(--gray-600)' }}>Fecha</th>
                    <th style={{ padding: '8px 4px', color: 'var(--gray-600)' }}>Origen</th>
                    <th style={{ padding: '8px 4px', color: 'var(--gray-600)' }}>Estado</th>
                    <th style={{ padding: '8px 4px', color: 'var(--gray-600)', textAlign: 'center' }}>Nuevos</th>
                    <th style={{ padding: '8px 4px', color: 'var(--gray-600)', textAlign: 'center' }}>Modificados</th>
                    <th style={{ padding: '8px 4px', color: 'var(--gray-600)', textAlign: 'center' }}>Errores</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((log, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                      <td style={{ padding: '8px 4px' }}>{new Date(log.fecha).toLocaleString()}</td>
                      <td style={{ padding: '8px 4px' }}>
                        <div style={{ textTransform: 'uppercase', fontWeight: 'bold', fontSize: '0.75rem' }}>{log.origen}</div>
                        {log.totalFilas !== undefined && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginTop: '2px', fontWeight: 'normal' }}>
                            {log.totalFilas} filas {log.filasSalteadas > 0 && <span style={{ color: '#b91c1c' }}>({log.filasSalteadas} salt.)</span>}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          background: log.estado === 'exitoso' ? '#dcfce7' : (log.estado === 'parcial' ? '#fef3c7' : '#fee2e2'),
                          color: log.estado === 'exitoso' ? '#15803d' : (log.estado === 'parcial' ? '#b45309' : '#b91c1c')
                        }}>
                          {log.estado}
                        </span>
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'center', color: '#15803d', fontWeight: 'bold' }}>+{log.creados}</td>
                      <td style={{ padding: '8px 4px', textAlign: 'center', color: '#1d4ed8', fontWeight: 'bold' }}>{log.actualizados}</td>
                      <td style={{ padding: '8px 4px', textAlign: 'center', color: '#b91c1c', fontWeight: log.errores > 0 ? 'bold' : 'normal' }}>{log.errores}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Dashboard ───
  const renderDashboardView = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const ordersToday = orders.filter(o => o.creado_a?.startsWith(todayStr));
    const ventasHoy = ordersToday.filter(o => o.estadoActual !== 'Cancelado').reduce((acc, o) => acc + (o.total || 0), 0);
    const pedidosHoy = ordersToday.length;
    const pedidosActivos = orders.filter(o => ['Pendiente', 'Confirmado', 'En Preparacion', 'Despachado', 'En Camino'].includes(o.estadoActual)).length;
    const stockBajoCount = menuItems.filter(i => i.maneja_stock && !i.stock_base_id && i.stock_actual <= i.stock_minimo).length;
    const mercadopagoVinculado = !!profileData?.mp_access_token;
    const horariosConfigurados = (profileData?.horario_apertura && profileData?.horario_cierre) || (profileData?.config_horarios && Object.keys(profileData.config_horarios).length > 0);

    return (
      <div className="animate-fade-in" style={{ padding: '8px 0' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--gray-900)', margin: '0 0 4px 0' }}>
            ¡Hola, {profileData?.nombre || 'Socio'}! 👋
          </h2>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.95rem', margin: 0, fontWeight: 500 }}>
            Recomendaciones y avisos de tu Aliado comercial Wepi para potenciar tu negocio.
          </p>
        </div>

        {/* Sección de Mensajes de Aliado Comercial */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px', background: 'linear-gradient(135deg, #fff 0%, #fef2f2 100%)', borderLeft: '4px solid var(--red-500)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--red-700)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🤝 Recomendaciones de tu Aliado Wepi
          </h3>
          <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: 'var(--gray-700)' }}>
            {stockBajoCount > 0 && (
              <li>
                <strong>Stock Crítico:</strong> Tenés <span style={{ color: '#dc2626', fontWeight: 'bold' }}>{stockBajoCount} productos</span> con stock bajo su límite mínimo. <a href="#" style={{ color: 'var(--red-600)', textDecoration: 'underline', fontWeight: 600 }} onClick={(e) => { e.preventDefault(); setView('menu'); loadMenu(); }}>Gestionar stock</a>.
              </li>
            )}
            {!mercadopagoVinculado && (
              <li>
                <strong>Ventas Digitales:</strong> Tu cuenta de Mercado Pago no está vinculada. Conéctala para aceptar pagos online. <a href="#" style={{ color: 'var(--red-600)', textDecoration: 'underline', fontWeight: 600 }} onClick={(e) => { e.preventDefault(); setView('settings'); setProfileSubView('edit'); }}>Vincular cuenta</a>.
              </li>
            )}
            {!horariosConfigurados && (
              <li>
                <strong>Atención Automática:</strong> No has configurado tus horarios de apertura de cocina. <a href="#" style={{ color: 'var(--red-600)', textDecoration: 'underline', fontWeight: 600 }} onClick={(e) => { e.preventDefault(); setView('settings'); setProfileSubView('edit'); }}>Configurar horarios</a>.
              </li>
            )}
            {waStatus !== 'connected' && (
              <li>
                <strong>Automatiza Pedidos:</strong> Conectá el asistente de WhatsApp para que el bot tome pedidos de tus clientes de forma automática y aumente tu conversión. <a href="#" style={{ color: 'var(--red-600)', textDecoration: 'underline', fontWeight: 600 }} onClick={(e) => { e.preventDefault(); setView('settings'); setProfileSubView('whatsapp'); }}>Vincular WhatsApp</a>.
              </li>
            )}
            {stockBajoCount === 0 && mercadopagoVinculado && horariosConfigurados && waStatus === 'connected' && (
              <li>
                ¡Excelente! Tu local está perfectamente configurado y optimizado para vender. Sigamos creciendo juntos. 🚀
              </li>
            )}
          </ul>
        </div>

        {/* Acciones Rápidas */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--gray-800)', margin: '0 0 12px 0' }}>
            🔗 Acciones Rápidas
          </h3>
          <div className="rd-quick-actions">
            <button className="rd-quick-action-btn" onClick={() => { setView('orders'); loadOrders(); }}>
              <span>📋</span> Ver Pedidos
            </button>
            <button className="rd-quick-action-btn" onClick={() => { setEditItem(null); setItemCategory(''); setItemSubcategory('Helado por kg'); setItemName(''); setView('addItem'); setIsBaseProductMode(false); }}>
              <span>➕</span> Agregar Producto
            </button>
            <button className="rd-quick-action-btn" onClick={() => { setView('cierre'); setCierreSubTab('generar'); setHideStatsInCierre(true); }}>
              <span>💰</span> Cerrar Caja
            </button>
            <button className="rd-quick-action-btn" onClick={() => { setView('sync'); }}>
              <span>🔄</span> Wepi Sync
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Dashboard ───
  const stockBajoCount = menuItems.filter(i => i.maneja_stock && !i.stock_base_id && i.stock_actual <= i.stock_minimo).length;
  const mercadopagoVinculado = !!profileData?.mp_access_token;
  const horariosConfigurados = (profileData?.horario_apertura && profileData?.horario_cierre) || (profileData?.config_horarios && Object.keys(profileData.config_horarios).length > 0);

  let recommendationsCount = 0;
  if (stockBajoCount > 0) recommendationsCount++;
  if (!mercadopagoVinculado) recommendationsCount++;
  if (!horariosConfigurados) recommendationsCount++;
  if (waStatus !== 'connected') recommendationsCount++;

  const totalMobileBadgeCount = pendingCount + recommendationsCount;

  return (
    <div className="rd-page">
      {renderTutorial()}
      {renderStockModal()}
      {renderStockSelectorModal()}
      <header className="rd-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/">
            <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" className="rd-logo" />
          </Link>
        </div>
        
        <h1 className="rd-header-title">
          Panel de Gestión
        </h1>

        <div className="rd-topbar-right" style={{ border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          {profileData?.foto_url && <img src={profileData.foto_url} alt="" className="rd-avatar" />}
          <button 
            className="rd-hamburger-btn" 
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            style={{ position: 'relative' }}
          >
            ☰
            {totalMobileBadgeCount > 0 && (
              <span className="rd-hamburger-badge">
                {totalMobileBadgeCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="rd-workspace">
        {mobileSidebarOpen && <div className="rd-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />}
        <aside className={`rd-sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
          <ul className="rd-sidebar-menu">
            <li className="rd-sidebar-title">Principal</li>
            <li>
              <button className={`rd-sidebar-btn ${view === 'dashboard' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setMobileSidebarOpen(false); }}>
                <span>🤝</span> Recomendaciones
                {recommendationsCount > 0 && (
                  <span className="rd-sidebar-badge amber">{recommendationsCount}</span>
                )}
              </button>
            </li>
            <li>
              <button 
                className={`rd-sidebar-btn ${view === 'orders' ? 'active' : ''}`} 
                onClick={() => { setView('orders'); loadOrders(); setMobileSidebarOpen(false); }}
              >
                <span>📋</span> Pedidos
                {pendingCount > 0 && (
                  <span className="rd-sidebar-badge">{pendingCount}</span>
                )}
              </button>
            </li>

            <li className="rd-sidebar-title">Catálogo</li>
            {restaurant?.role !== 'Cajero' && (
              <>
                <li>
                  <button 
                    className={`rd-sidebar-btn ${view === 'menu' || view === 'addItem' || view === 'sabores' ? 'active' : ''}`} 
                    onClick={() => {
                      setView('menu'); loadMenu(); setMobileSidebarOpen(false);
                    }}
                  >
                    <span>📖</span> Productos
                  </button>
                </li>
                <li>
                  <button className={`rd-sidebar-btn ${view === 'sync' ? 'active' : ''}`} onClick={() => { setView('sync'); setMobileSidebarOpen(false); }}>
                    <span>🔄</span> Wepi Sync
                  </button>
                </li>
              </>
            )}

            <li className="rd-sidebar-title">Finanzas</li>
            {restaurant?.role !== 'Cajero' && (
              <>
                <li>
                  <button 
                    className={`rd-sidebar-btn ${(view === 'profile' && profileSubView === 'ventas') ? 'active' : ''}`} 
                    onClick={() => {
                      setView('profile'); setProfileSubView('ventas'); loadOrders(); setMobileSidebarOpen(false);
                    }}
                  >
                    <span>📊</span> Mis Ventas
                  </button>
                </li>

                <li>
                  <button 
                    className={`rd-sidebar-btn ${view === 'plans' ? 'active' : ''}`} 
                    onClick={() => {
                      setView('plans'); loadPlanInfo(); setMobileSidebarOpen(false);
                    }}
                  >
                    <span>🎟️</span> Mi Plan
                  </button>
                </li>
              </>
            )}
            <li>
              <button 
                className={`rd-sidebar-btn ${view === 'cierre' ? 'active' : ''}`} 
                onClick={() => { setView('cierre'); setCierreSubTab('generar'); setHideStatsInCierre(true); setMobileSidebarOpen(false); }}
              >
                <span>💰</span> Arqueo / Cierre
              </button>
            </li>

            <li className="rd-sidebar-title">Herramientas</li>
            {restaurant?.role !== 'Cajero' && (
              <>
                <li>
                  <button 
                    className={`rd-sidebar-btn ${(view === 'settings' && profileSubView === 'printing') ? 'active' : ''}`} 
                    onClick={() => {
                      setView('settings'); setProfileSubView('printing'); setMobileSidebarOpen(false);
                    }}
                  >
                    <span>🖨️</span> Impresión Tickets
                  </button>
                </li>
                <li>
                  <button 
                    className={`rd-sidebar-btn ${(view === 'settings' && profileSubView === 'notifications') ? 'active' : ''}`} 
                    onClick={() => {
                      setView('settings'); setProfileSubView('notifications'); setMobileSidebarOpen(false);
                    }}
                  >
                    <span>🔔</span> Notificaciones
                  </button>
                </li>
                <li>
                  <button 
                    className={`rd-sidebar-btn ${(view === 'settings' && profileSubView === 'whatsapp') ? 'active' : ''}`} 
                    onClick={() => {
                      setView('settings'); setProfileSubView('whatsapp'); setMobileSidebarOpen(false);
                    }}
                  >
                    <span>💬</span> WhatsApp Assistant
                  </button>
                </li>
                <li>
                  <button 
                    className={`rd-sidebar-btn ${(view === 'settings' && profileSubView === 'cajas') ? 'active' : ''}`} 
                    onClick={() => {
                      setView('settings'); setProfileSubView('cajas'); setMobileSidebarOpen(false);
                    }}
                  >
                    <span>🔑</span> Cajeros
                  </button>
                </li>
              </>
            )}

            <li className="rd-sidebar-title">Configuración</li>
            {restaurant?.role !== 'Cajero' && (
              <>
                <li>
                  <button 
                    className={`rd-sidebar-btn ${(view === 'settings' && profileSubView === 'edit') ? 'active' : ''}`} 
                    onClick={() => {
                      setView('settings'); setProfileSubView('edit'); setMobileSidebarOpen(false);
                    }}
                  >
                    <span>⚙️</span> Ajustes Local
                  </button>
                </li>
                <li>
                  <button 
                    className={`rd-sidebar-btn ${(view === 'profile' && profileSubView === 'edit') ? 'active' : ''}`} 
                    onClick={() => {
                      setView('profile'); setProfileSubView('edit'); loadProfile(); setMobileSidebarOpen(false);
                    }}
                  >
                    <span>👤</span> Editar Perfil
                  </button>
                </li>
              </>
            )}

            <li className="rd-sidebar-title">Cuenta</li>
            <li>
              <button 
                className="rd-sidebar-btn" 
                onClick={() => { 
                  setShowTutorial(true); 
                  setTutorialStep(1); 
                  setView('orders'); 
                  setMobileSidebarOpen(false); 
                }}
              >
                <span>📖</span> Ver tutorial
              </button>
            </li>
            <li>
              <button 
                className="rd-sidebar-btn" 
                style={{ color: 'var(--red-500)' }} 
                onClick={() => { 
                  logoutRestaurant(); 
                  window.location.reload(); 
                }}
              >
                <span>🚪</span> Cerrar Sesión
              </button>
            </li>
          </ul>
        </aside>

        <main className="rd-main-content">
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
        <div className="rd-topbar animate-fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="rd-topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label className="toggle" onClick={toggleEstado}>
              <input type="checkbox" checked={localOpen} readOnly />
              <span className="toggle-track" />
              <span className="toggle-thumb" />
            </label>
            <span className={`rd-status ${localOpen ? 'open' : ''}`}>{localOpen ? 'Abierto' : 'Cerrado'}</span>
            
          </div>

          {planInfo && (
            <div 
              style={{ 
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #ddd', 
                paddingLeft: '16px', cursor: 'pointer' 
              }}
              onClick={() => {
                if (isUnlocked) {
                  setShowGamification(!showGamification);
                } else {
                  setOnSecuritySuccess(() => () => setShowGamification(true));
                  setSecurityModalOpen(true);
                }
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '80px' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b' }}>VENTAS</span>
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--red-600)' }}>{planInfo?.metricas_mes?.pedidos ?? 0}/50</span>
                </div>
                <div style={{ width: '80px', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${Math.min(100, ((planInfo?.metricas_mes?.pedidos || 0) / 50) * 100)}%`, 
                    height: '100%', background: 'var(--red-600)' 
                  }}></div>
                </div>
              </div>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{showGamification ? '▲' : '▼'}</span>
            </div>
          )}
        </div>


        {/* Persistent Alerts for Missing Configs */}
        {profileData && (
          <div className="rd-alerts" style={{ padding: '0 16px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>


            {/* Alert of low stock items */}
            {menuItems.filter(i => i.maneja_stock && !i.stock_base_id && i.stock_actual <= i.stock_minimo).length > 0 && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#991b1b', fontWeight: '500' }}>⚠️ <strong>Stock Bajo:</strong> Hay productos que están alcanzando el límite mínimo.</span>
                <button className="btn btn-sm" style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none' }} 
                  onClick={() => {
                    if (isUnlocked) {
                      setView('menu');
                    } else {
                      setOnSecuritySuccess(() => () => setView('menu'));
                      setSecurityModalOpen(true);
                    }
                  }}
                >
                  Ver ítems
                </button>
              </div>
            )}

            {(!profileData.mp_access_token) && (
              <div style={{ backgroundColor: '#fffbe6', border: '1px solid #ffe58f', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#d48800', fontWeight: '500' }}>⚠️ <strong>Mercado Pago desvinculado:</strong> Vinculá tu cuenta para recibir pagos online.</span>
                <button className="btn btn-sm" style={{ backgroundColor: '#faad14', color: '#fff', border: 'none' }} onClick={() => { setView('settings'); setProfileSubView('edit'); }}>Vincular</button>
              </div>
            )}
            {(!profileData.horario_apertura || !profileData.horario_cierre) && (!profileData.config_horarios || Object.keys(profileData.config_horarios).length === 0) && (
              <div style={{ backgroundColor: '#fff1f0', border: '1px solid #ffa39e', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#cf1322', fontWeight: '500' }}>⏰ <strong>Horarios sin configurar:</strong> Establecé el horario de cierre de cocina para gestionar pedidos automáticos.</span>
                <button className="btn btn-sm" style={{ backgroundColor: '#ff4d4f', color: '#fff', border: 'none' }} onClick={() => { setView('settings'); setProfileSubView('edit'); }}>Configurar</button>
              </div>
            )}
          </div>
        )}

        {planInfo && showGamification && (
          <div className="gamification-pill card animate-slide-up" 
            onClick={() => {
              if (isUnlocked) {
                setView('plans');
              } else {
                setOnSecuritySuccess(() => () => setView('plans'));
                setSecurityModalOpen(true);
              }
            }} 
            style={{ 
            cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: '16px', margin: '0 16px 16px', 
            background: 'linear-gradient(135deg, #fff 0%, #fffafa 100%)', borderLeft: '4px solid #e63946',
            boxShadow: '0 4px 15px rgba(230, 57, 70, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.5rem' }}>💎</span>
                <div>
                  <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Plan {planInfo?.plan_nombre || 'Visible'}
                    <button className="btn btn-xs" style={{ background: 'var(--red-600)', color: 'white', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '20px', border: 'none', fontWeight: 600 }}>Aumentar Visibilidad</button>
                  </p>
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

        {/* Dashboard View */}
        {view === 'dashboard' && renderDashboardView()}

        {/* ─── Wepi Sync View ─── */}
        {view === 'sync' && renderSyncView()}

        {/* ─── Orders View ─── */}
        {view === 'orders' && (
          <section className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: 12, flexWrap: 'wrap' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="🔍 Buscar pedido..." 
                style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
              />
              <button 
                className="btn btn-primary" 
                style={{ background: 'var(--gray-800)', borderColor: 'var(--gray-800)', gap: '8px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}
                onClick={() => { setView('cierre'); setCierreSubTab('generar'); setHideStatsInCierre(true); }}
              >
                🧾 Cerrar Turno / Caja
              </button>
            </div>

            {!isShop ? (
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
            ) : (
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--gray-700)', padding: '8px 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📋 Pedidos Activos <span className="badge badge-amber" style={{ fontSize: '0.85rem' }}>{finalOrders.length}</span>
              </div>
            )}
            {ordersLoading ? (
              <div className="loading-state"><div className="spinner" /> Cargando...</div>
            ) : finalOrders.length === 0 ? (
              <p className="rd-empty">No hay pedidos en esta sección</p>
            ) : finalOrders.map(o => (
              <OrderCard 
                key={o.idPedidoLocal} 
                order={o}
                isShop={profileData?.tipo_servicio === 'shops'} 
                localNombre={profileData?.nombre} 
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

        {/* ─── Menu View ─── */}
        {view === 'menu' && (
          <section className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                   {/* Dropdown Añadir */}
                   <div style={{ position: 'relative' }}>
                      <button className="btn btn-success" onClick={() => {
                        const needsDropdown = profileData?.rubros?.includes('Cafetería') || profileData?.rubros?.includes('Heladería');
                        if (needsDropdown) {
                          setMenuAddOpen(!menuAddOpen);
                        } else {
                          setEditItem(null); setItemCategory(''); setItemSubcategory('Helado por kg'); setItemName(''); setView('addItem'); setIsBaseProductMode(false);
                        }
                      }}>
                        + Añadir { (profileData?.rubros?.includes('Cafetería') || profileData?.rubros?.includes('Heladería')) && '▾' }
                      </button>
                      
                      {menuAddOpen && (
                        <div className="rd-dropdown-menu animate-fade-in" style={{ left: 0, top: '100%', display: 'block', zIndex: 100 }}>
                           <button className="rd-dropdown-item" onClick={() => { setEditItem(null); setItemCategory(''); setItemSubcategory('Helado por kg'); setItemName(''); setView('addItem'); setIsBaseProductMode(false); setMenuAddOpen(false); }}>
                             {isInventory ? '📦 Nuevo Artículo' : '🍔 Nuevo Plato'}
                           </button>

                           {(profileData?.rubros?.includes('Heladería')) && (
                             <button className="rd-dropdown-item" onClick={() => { setView('sabores'); loadSabores(); setMenuAddOpen(false); }}>
                               🍦 Sabores y Adicionales
                             </button>
                           )}
                        </div>
                      )}
                   </div>

                   <button className={`btn ${showStockPanel ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setShowStockPanel(!showStockPanel); setShowDiscountPanel(false); }} style={showStockPanel ? { background: '#f97316', borderColor: '#f97316' } : {}}>
                     📦 Stock
                   </button>

                   <button className={`btn ${showDiscountPanel ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setShowDiscountPanel(!showDiscountPanel); setShowStockPanel(false); }}>
                     🎁 Descuentos
                   </button>

                   <button className="btn btn-outline" onClick={() => setView('sync')}>
                     🔄 Wepi Sync
                   </button>
                </div>

                <div style={{ padding: '8px 12px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>
                   Estado hoy: {(() => {
                     const today = new Date().toLocaleString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
                     const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                     const isPromo = profileData?.dias_descuento?.some(d => normalize(d) === normalize(today));
                     return isPromo ? <span style={{ color: 'var(--red-600)' }}>🔥 PROMO {profileData?.descuento_general}% OFF {profileData?.categoria_descuento ? `en ${profileData.categoria_descuento}` : 'en todo el catálogo'}</span> : <span style={{ color: 'var(--gray-500)' }}>Sin promo general</span>;
                   })()}
                </div>
            </div>

            {showDiscountPanel && (
              <div className="card card-body animate-slide-up" style={{ marginBottom: 24, border: '1px solid #feb2b2', background: '#fff5f5' }}>
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
                          <span style={{ fontSize: '0.85rem', color: '#742a2a', marginLeft: '10px' }}>en</span>
                          <select 
                            name="categoria_descuento" 
                            className="form-select" 
                            style={{ width: '180px', marginBottom: 0, marginLeft: '6px' }}
                            defaultValue={profileData?.categoria_descuento || ''}
                          >
                            <option value="">Todo el catálogo</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <button type="submit" className="btn btn-success btn-sm" style={{ marginLeft: '10px' }}>Guardar Configuración</button>
                       </div>
                       
                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => {
                            const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                            const isSelected = profileData?.dias_descuento?.some(d => normalize(d) === normalize(day));
                            return (
                              <label key={day} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: 'white', padding: '4px 10px', borderRadius: '8px', border: '1px solid #feb2b2', fontSize: '0.8rem', cursor: 'pointer' }}>
                                <input type="checkbox" name={`desc_${day}`} defaultChecked={isSelected} />
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
                </div>
              </div>
            )}
            
            {/* ─── Panel de Stock Rápido ─── */}
            {showStockPanel && (
              <div className="card animate-fade-in" style={{ marginBottom: 24, padding: '16px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <h3 style={{ color: '#c2410c', margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    📦 Gestión de Stock Rápida
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     <button className="btn btn-sm btn-success" style={{ fontSize: '0.8rem', background: '#22c55e', border: 'none' }} onClick={() => setShowStockSelectorModal(true)}>
                       + Nuevo producto
                     </button>
                     <span style={{ fontSize: '0.75rem', background: '#fff7ed', color: '#c2410c', padding: '4px 8px', borderRadius: '12px', border: '1px solid #ffedd5', fontWeight: 600 }}>
                       Sólo ítems que manejan stock
                     </span>
                  </div>
                </div>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                  gap: '12px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  paddingRight: '4px'
                }}>
                  {menuItems.filter(i => i.maneja_stock).length === 0 ? (
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', textAlign: 'center', gridColumn: '1/-1', padding: '20px' }}>
                      No tenés platos con stock habilitado. Habilitá stock presionando "+ Nuevo producto".
                    </p>
                  ) : (
                    menuItems.filter(i => i.maneja_stock).map(item => (
                      <div key={item.id} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '10px 14px', 
                        background: '#f8fafc', 
                        borderRadius: '10px', 
                        border: '1px solid #e2e8f0' 
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                           {item.imagen_url && <img src={item.imagen_url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />}
                           <div style={{ minWidth: 0 }}>
                             <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nombre}</p>
                             <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--gray-500)' }}>
                               {item.stock_base_id ? `Pack (${item.unidades_por_venta} u.)` : 'Producto Base'}
                             </p>
                           </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                           <input 
                             type="number" 
                             className="form-input" 
                             style={{ width: '70px', padding: '6px', fontSize: '0.85rem', marginBottom: 0, textAlign: 'center', background: 'white' }}
                             value={item.stock_actual}
                             onChange={async (e) => {
                               const val = parseInt(e.target.value) || 0;
                               // Optimistic Update
                               setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, stock_actual: val } : m));
                             }}
                             onBlur={async (e) => {
                               const val = parseInt(e.target.value) || 0;
                               try {
                                 await api.updateMenuItem({ itemId: item.id, stock_actual: val });
                                 toast.success(`Stock de ${item.nombre} actualizado`, { id: `stock-upd-${item.id}` });
                               } catch { 
                                 toast.error('Error al actualizar stock'); 
                                 loadMenu(); // Rollback
                               }
                             }}
                           />
                           <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontWeight: 600 }}>u.</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="rd-menu-filters">
              <input className="form-input" placeholder="🔍 Buscar artículo o plato..." value={menuFilter} onChange={e => setMenuFilter(e.target.value)} />
              <select className="form-select" value={menuCatFilter} onChange={e => setMenuCatFilter(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {menuLoading ? (
              <div className="loading-state"><div className="spinner" /> Cargando catálogo...</div>
            ) : finalMenu.length === 0 ? (
              <p className="rd-empty">No hay {isInventory ? 'artículos' : 'platos'}. ¡Agregá tu primer {isInventory ? 'artículo' : 'plato'}!</p>
            ) : finalMenu.map(item => (
              <div key={item.id} className="rd-menu-item card">
                {item.imagen_url ? <img src={item.imagen_url} alt={item.nombre} className="rd-menu-img" /> :
                  <div className="rd-menu-img-placeholder">Sin foto</div>}
                <div className="rd-menu-info">
                  <div className="rd-menu-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3>{item.nombre}</h3>
                      <p>{item.descripcion || ''}</p>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <span className="badge badge-gray">{item.categoria || 'Sin categoría'}</span>
                        {item.maneja_stock && (
                          (() => {
                            const baseItem = item.stock_base_id ? menuItems.find(mi => mi.id === item.stock_base_id) : null;
                            const displayStock = baseItem 
                              ? Math.floor((baseItem.stock_actual || 0) / (item.unidades_por_venta || 1)) 
                              : (item.stock_actual || 0);
                            const displayMin = baseItem 
                              ? Math.floor((baseItem.stock_minimo || 10) / (item.unidades_por_venta || 1)) 
                              : (item.stock_minimo || 10);
                            const isLowStock = displayStock <= displayMin;

                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                {editingStockItem === (baseItem ? baseItem.id : item.id) ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>
                                      {baseItem ? `Stock de ${baseItem.nombre}:` : 'Stock:'}
                                    </span>
                                    <input 
                                      type="number"
                                      defaultValue={baseItem ? baseItem.stock_actual : item.stock_actual}
                                      className="form-input"
                                      style={{ width: '70px', padding: '4px', fontSize: '0.75rem', marginBottom: 0, textAlign: 'center' }}
                                      autoFocus
                                      onKeyDown={async (e) => {
                                        if (e.key === 'Enter') {
                                          const val = parseInt(e.target.value) || 0;
                                          await handleQuickStockSave(baseItem ? baseItem.id : item.id, val);
                                        } else if (e.key === 'Escape') {
                                          setEditingStockItem(null);
                                        }
                                      }}
                                      id={`quick-stock-input-${baseItem ? baseItem.id : item.id}`}
                                    />
                                    <button 
                                      className="btn btn-xs btn-success" 
                                      style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                      onClick={async () => {
                                        const input = document.getElementById(`quick-stock-input-${baseItem ? baseItem.id : item.id}`);
                                        const val = parseInt(input?.value) || 0;
                                        await handleQuickStockSave(baseItem ? baseItem.id : item.id, val);
                                      }}
                                    >
                                      ✓
                                    </button>
                                    <button 
                                      className="btn btn-xs btn-secondary" 
                                      style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                      onClick={() => setEditingStockItem(null)}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <span className={`badge ${isLowStock ? 'badge-red' : 'badge-amber'}`} style={{ fontSize: '0.7rem' }}>
                                      Stock: {displayStock} {baseItem && `(${baseItem.nombre})`}
                                    </span>
                                    <button 
                                      className="btn btn-xs btn-outline" 
                                      style={{ padding: '2px 6px', fontSize: '0.65rem', color: '#c2410c', borderColor: '#ffedd5', background: '#fff7ed', borderRadius: '4px', cursor: 'pointer' }}
                                      onClick={() => setEditingStockItem(baseItem ? baseItem.id : item.id)}
                                    >
                                      ⚙️ Gestionar Stock
                                    </button>
                                  </>
                                )}
                              </div>
                            );
                          })()
                        )}
                        {item.stock_base_id && (
                          <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>
                            Pack ({item.unidades_por_venta} u.)
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'right', minWidth: '120px' }}>
                      {(() => {
                         const basePrice = Number(item.precio);
                         const itemDiscountPercent = Number(item.descuento || 0);
                         
                         const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                         const today = new Date().toLocaleString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
                         const isPromoDay = profileData?.dias_descuento?.some(d => normalize(d) === normalize(today));
                         const categoryMatch = !profileData?.categoria_descuento || profileData?.categoria_descuento === item.categoria;
                         const generalDiscountPercent = (isPromoDay && categoryMatch) ? Number(profileData?.descuento_general || 0) : 0;
                         
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
                    <label className="toggle" onClick={() => {
                      if (item.categoria === 'Base') {
                        toast.error('Los productos base no pueden marcarse como disponibles/fuera de servicio. Su visibilidad depende del stock real.');
                        return;
                      }
                      handleToggleDisp(item.id, item.disponibilidad);
                    }}>
                      <input type="checkbox" checked={item.disponibilidad === true} readOnly disabled={item.categoria === 'Base'} />
                      <span className="toggle-track" />
                      <span className="toggle-thumb" />
                    </label>
                    <span className="rd-disp-text">{item.disponibilidad ? 'Disponible' : 'No disponible'}</span>
                    <div className="rd-menu-actions" style={{ display: 'flex', gap: '6px' }}>
                      {!item.imagen_url && (
                        <button 
                          className="btn btn-sm btn-outline" 
                          style={{ borderColor: 'var(--amber-500)', color: 'var(--amber-600)', background: 'white' }} 
                          onClick={() => {
                            setQuickUploadItemId(item.id);
                            if (quickImageInputRef.current) {
                              quickImageInputRef.current.click();
                            }
                          }}
                        >
                          Cargar Imagen
                        </button>
                      )}
                      <button className="btn btn-sm" style={{ background: 'var(--amber-500)', color: '#fff' }} onClick={() => { 
                        setEditItem(item); 
                        setItemCategory(item.categoria);
                        setItemSubcategory(item.tamano || '');
                        setView('addItem'); 
                      }}>Editar</button>
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
              <h2 style={{ color: 'var(--red-600)', marginBottom: 16 }}>
                {isBaseProductMode ? '🍞 Nuevo Producto Base' : (editItem ? (isInventory ? 'Editar Artículo' : 'Editar Plato') : (isInventory ? 'Nuevo Artículo' : 'Nuevo Plato'))}
              </h2>
              <form onSubmit={handleSaveItem} className="rd-item-form">
                <div className="rd-form-row">
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input 
                        name="nombre" 
                        className="form-input" 
                        placeholder={isInventory ? 'Nombre del artículo' : 'Nombre del plato'} 
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
                    value={itemCategory || editItem?.categoria || ''} 
                    required 
                    readOnly={isBaseProductMode || editItem?.categoria === 'Base'}
                    disabled={isBaseProductMode || editItem?.categoria === 'Base'}
                    onChange={(e) => setItemCategory(e.target.value)}
                  >
                    <option value="">Categoría</option>
                    {isBaseProductMode || editItem?.categoria === 'Base' ? (
                      <option value="Base">Base (Inventario Interno)</option>
                    ) : (
                      (function() {
                        const rubros = profileData?.rubros || [];
                        const rubroConfigs = [
                          { name: 'Restaurante', cats: ['Hamburguesas', 'Pizzas', 'Empanadas', 'Panchos', 'Cafetería', 'Combos', 'Bebidas'] },
                          { name: 'Cafetería', cats: ['Café', 'Licuados', 'Facturas', 'Pastelería', 'Galletas', 'Tostados', 'Promos'] },
                          { name: 'Heladería', cats: ['Helados'] },
                          { name: 'Carnicería', cats: ['Carne Vacuna', 'Pollo', 'Cerdo', 'Embutidos', 'Achuras', 'Promos'] },
                          { name: 'Market', cats: ['Snacks', 'Bebidas', 'Golosinas', 'Almacén', 'Congelados', 'Higiene', 'Promos'] },
                          { name: 'Farmacia', cats: ['Medicamentos (venta libre)', 'Higiene', 'Cuidado personal/Belleza', 'Bebés/Maternidad', 'Primeros Auxilios', 'Salud Sexual', 'Promos'] },
                          { name: 'Bebidas', cats: ['Gaseosas', 'Sin gas', 'Cervezas', 'Vinos/Espumantes', 'Aperitivos', 'Otros'] },
                          { name: 'Hogar', cats: ['Muebles', 'Decoración', 'Blanquería', 'Cocina', 'Bazar', 'Iluminación', 'Otros'] },
                          { name: 'Tecnología', cats: ['Celulares', 'Computación', 'Audio y Video', 'Accesorios', 'Gaming', 'Smart Home', 'Otros'] },
                          { name: 'Moda', cats: ['Ropa de Hombre', 'Ropa de Mujer', 'Ropa Infantil', 'Calzado', 'Accesorios', 'Marroquinería', 'Otros'] },
                          { name: 'Regalería', cats: ['Juguetes', 'Peluches', 'Librería', 'Artesanías', 'Gifts', 'Otros'] },
                          { name: 'Deportes', cats: ['Indumentaria Deportiva', 'Calzado Deportivo', 'Accesorios', 'Equipamiento', 'Suplementos', 'Otros'] }
                        ];

                        const activeConfigs = rubros.length > 0 
                          ? rubroConfigs.filter(rc => rubros.includes(rc.name))
                          : [rubroConfigs[0]]; // Default Restaurante if empty

                        return activeConfigs.map(config => (
                          <optgroup key={config.name} label={config.name}>
                            {config.cats.map(cat => (
                              <option key={`${config.name}-${cat}`} value={cat}>{cat}</option>
                            ))}
                          </optgroup>
                        ));
                      })()
                    )}
                  </select>
                  {(isBaseProductMode || editItem?.categoria === 'Base') && <input type="hidden" name="categoria" value="Base" />}
                </div>
                <textarea name="descripcion" className="form-textarea" rows={2} placeholder="Descripción" defaultValue={editItem?.descripcion || ''} />
                
                <div className="rd-form-row rd-form-row-3" style={ (isBaseProductMode || editItem?.categoria === 'Base') ? { opacity: 0.5, pointerEvents: 'none' } : {} }>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Precio Regular ($)</label>
                    <input name="precio" type="number" className="form-input" placeholder="Precio" step="0.01" defaultValue={(isBaseProductMode || editItem?.categoria === 'Base') ? 0 : (editItem?.precio || '')} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Descuento (%)</label>
                    <input name="descuento" type="number" className="form-input" placeholder="Ej: 15" step="0.1" defaultValue={(isBaseProductMode || editItem?.categoria === 'Base') ? 0 : (editItem?.descuento || 0)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Disponibilidad</label>
                    <select name="disponibilidad" className="form-select" defaultValue={(isBaseProductMode || editItem?.categoria === 'Base') ? 'true' : (editItem ? (editItem.disponibilidad ? 'true' : 'false') : 'true')}>
                      <option value="true">Disponible/Visible</option>
                      <option value="false">Oculto/No disponible</option>
                    </select>
                  </div>
                </div>

                <div className="rd-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>SKU (Código de Sincronización)</label>
                    <input name="sku" type="text" className="form-input" placeholder="Ej: SKU-12345" defaultValue={editItem?.sku || ''} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Código de Barras</label>
                    <input name="codigo_barras" type="text" className="form-input" placeholder="Ej: 7791234567890" defaultValue={editItem?.codigo_barras || ''} />
                  </div>
                </div>
                
                {/* ─── Helados Subcategory Selector ─── */}
                {(itemCategory === 'Helados' || editItem?.categoria === 'Helados') && (
                  <div className="rd-form-row" style={{ marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--red-600)' }}>Subcategoría de Helado</label>
                      <select 
                        name="subcategoria" 
                        className="form-select" 
                        value={itemSubcategory} 
                        onChange={(e) => setItemSubcategory(e.target.value)}
                        required
                      >
                        <option value="Helado por kg">Helado por kg (con pesos y sabores)</option>
                        <option value="Paletas">Paletas (producto simple/con variantes)</option>
                        <option value="Envasados">Envasados (producto simple/con variantes)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* ─── Helados Configuration (Only for 'Helado por kg') ─── */}
                {(() => {
                  if (itemCategory !== 'Helados' && editItem?.categoria !== 'Helados') return null;
                  if (itemSubcategory !== 'Helado por kg') return null;
                  
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
                {(itemCategory !== 'Base' && (itemCategory !== '' || editItem) && (itemCategory !== 'Helados' || (itemCategory === 'Helados' && itemSubcategory !== 'Helado por kg'))) && (
                  <div className="card" style={{ padding: '16px', marginBottom: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div 
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      onClick={() => setShowVariantsConfig(!showVariantsConfig)}
                    >
                      <h3 style={{ fontSize: '1rem', color: 'var(--red-600)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        ✨ Configuración de Variantes y Extras
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'bold' }}>{showVariantsConfig ? '▲ Ocultar' : '▼ Configurar'}</span>
                    </div>
                    
                    <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '8px', marginBottom: showVariantsConfig ? '16px' : 0 }}>
                      Son adicionales opcionales que se suman al precio de la variante elegida. El cliente debe elegir una sola opción. Cada una tiene su propio precio total.
                    </p>

                    {showVariantsConfig && (
                      <div className="animate-fade-in" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '8px' }}>
                        <div style={{ marginBottom: '20px' }}>
                          <p style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '4px', color: 'var(--gray-700)' }}>Variantes (Simple, Doble, etc.)</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '8px' }}>El cliente debe elegir una sola opción. Cada una tiene su propio precio total.</p>
                          {burgerVariants.map((v, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <input placeholder="Nombre" className="form-input" style={{ flex: 2, marginBottom: 0 }} value={v.nombre} onChange={(e) => { const newV = [...burgerVariants]; newV[idx].nombre = e.target.value; setBurgerVariants(newV); }} />
                              <input placeholder="Precio" type="number" className="form-input" style={{ flex: 1, marginBottom: 0 }} value={v.precio} onChange={(e) => { const newV = [...burgerVariants]; newV[idx].precio = e.target.value; setBurgerVariants(newV); }} />
                              <label className="toggle" style={{ transform: 'scale(0.8)', flexShrink: 0, margin: 0 }} title="Variante disponible">
                                <input 
                                  type="checkbox" 
                                  checked={v.disponible !== false} 
                                  onChange={(e) => {
                                    const newV = [...burgerVariants];
                                    newV[idx].disponible = e.target.checked;
                                    setBurgerVariants(newV);
                                  }} 
                                />
                                <span className="toggle-track" />
                                <span className="toggle-thumb" />
                              </label>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBurgerVariants(burgerVariants.filter((_, i) => i !== idx))}>✕</button>
                            </div>
                          ))}
                          <button type="button" className="btn btn-secondary btn-xs" onClick={() => setBurgerVariants([...burgerVariants, { nombre: '', precio: '', disponible: true }])}>+ Añadir Variante</button>
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
                  </div>
                )}

                <input name="foto" type="file" className="form-input" accept="image/*" />
                {/* Ocultar control de stock del formulario de añadir/editar, manejar vía Stock Rápido */}
                <input type="hidden" name="maneja_stock" value={editItem?.maneja_stock ? 'on' : 'off'} />

                <div className="rd-form-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => { setEditItem(null); setView('menu'); loadMenu(); setIsBaseProductMode(false); }}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={itemLoading}>
                    {itemLoading ? <span className="spinner spinner-white" /> : (editItem ? 'Guardar Cambios' : (isInventory ? 'Guardar Artículo' : 'Guardar Plato'))}
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

        {/* ─── Cierre View ─── */}
        {view === 'cierre' && (
          <section className="animate-fade-in" style={{ padding: '0 20px 40px' }}>
            <div className="card card-body" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                <h2 style={{ color: 'var(--red-600)', margin: 0 }}>🧾 Cierre de Caja</h2>
                
                <div className="rd-tabs" style={{ background: '#f1f5f9', padding: '4px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
                  <button 
                    className={`btn btn-sm ${cierreSubTab === 'generar' ? 'btn-primary' : 'btn-ghost'}`} 
                    onClick={() => setCierreSubTab('generar')}
                    style={{ fontSize: '0.75rem' }}
                  >
                    Generar Nuevo
                  </button>
                  <button 
                    className={`btn btn-sm ${cierreSubTab === 'historial' ? 'btn-primary' : 'btn-ghost'}`} 
                    onClick={() => { setCierreSubTab('historial'); loadHistorialCierres(); }}
                    style={{ fontSize: '0.75rem' }}
                  >
                    Historial
                  </button>
                  {!hideStatsInCierre && (
                    <button 
                      className={`btn btn-sm ${cierreSubTab === 'estadisticas' ? 'btn-primary' : 'btn-ghost'}`} 
                      onClick={() => { setCierreSubTab('estadisticas'); loadStats(); }}
                      style={{ fontSize: '0.75rem' }}
                    >
                      Estadísticas
                    </button>
                  )}


                </div>

                {cierreSubTab === 'generar' && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <style>
                      {`
                        @media print {
                          body * { visibility: hidden; }
                          #printable-cierre, #printable-cierre * { visibility: visible; }
                          #printable-cierre { 
                            position: absolute; 
                            left: 0; 
                            top: 0; 
                            width: 100%;
                            padding: 20px;
                          }
                          .no-print { display: none !important; }
                        }
                      `}
                    </style>
                    
                    <select 
                      className="form-input" 
                      style={{ width: 'auto', marginBottom: 0 }}
                      value={cierreMode}
                      onChange={(e) => setCierreMode(e.target.value)}
                    >
                      <option value="pendientes">⏳ Últimos Pedidos (Sin Cerrar)</option>
                      <option value="dia">📅 Por Día Específico</option>
                      <option value="intervalo">🗓️ Por Intervalo de Fechas</option>
                    </select>

                    {cierreMode === 'dia' && (
                      <input 
                        type="date" 
                        className="form-input" 
                        style={{ width: 'auto', marginBottom: 0 }} 
                        value={cierreFecha} 
                        onChange={(e) => setCierreFecha(e.target.value)} 
                      />
                    )}

                    {cierreMode === 'intervalo' && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input 
                          type="date" 
                          className="form-input" 
                          style={{ width: 'auto', marginBottom: 0 }} 
                          value={cierreFechaInicio} 
                          onChange={(e) => setCierreFechaInicio(e.target.value)} 
                        />
                        <span>al</span>
                        <input 
                          type="date" 
                          className="form-input" 
                          style={{ width: 'auto', marginBottom: 0 }} 
                          value={cierreFechaFin} 
                          onChange={(e) => setCierreFechaFin(e.target.value)} 
                        />
                      </div>
                    )}

                    <button className="btn btn-primary" onClick={loadCierreReport} disabled={cierreLoading}>
                      {cierreLoading ? <span className="spinner spinner-white" /> : '🔍 Generar Informe'}
                    </button>
                  </div>
                )}


              </div>

              {cierreSubTab === 'generar' ? (
                !cierreReport ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-400)' }}>
                    Seleccioná una fecha y hacé clic en "Generar Informe" para ver las ventas.
                  </div>
                ) : (
                  <div id="printable-cierre" style={{ background: 'white' }}>
                    {/* Header solo para impresión */}
                    <div className="only-print" style={{ display: 'none', marginBottom: 20, borderBottom: '2px solid #000', paddingBottom: 15 }}>

                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <img src="https://i.postimg.cc/RhctJq4F/buscamos-repartidores-(40)-(4).png" alt="Wepi" style={{ height: 50 }} />
                          <div style={{ textAlign: 'right' }}>

                             <h1 style={{ margin: 0, fontSize: '1.5rem' }}>CIERRE DE CAJA</h1>
                             <p style={{ margin: 0 }}><strong>Local:</strong> {restaurant?.nombre}</p>
                             <p style={{ margin: 0 }}><strong>Fecha:</strong> {new Date(cierreFecha + 'T12:00:00').toLocaleDateString('es-AR')}</p>
                          </div>
                       </div>
                    </div>

                    <style>
                      {`
                        @media print {
                          @page { margin: 10mm; }
                          html, body { margin: 0 !important; padding: 0 !important; height: auto !important; }
                          .rd-page, .rd-main, .card-body, section { padding: 0 !important; margin: 0 !important; }
                          .only-print { display: block !important; }
                          #printable-cierre { 
                            display: block !important;
                            position: absolute !important;
                            top: 0 !important;
                            left: 0 !important;
                            width: 100% !important;
                            padding: 0 !important; 
                            background: white !important;
                            margin: 0 !important;
                          }
                          #printable-cierre table {
                            font-size: 0.75rem !important;
                          }
                          #printable-cierre th, #printable-cierre td {
                            padding: 6px 4px !important;
                          }
                          .stat-card { border: 1px solid #ddd !important; }
                          .no-print, .rd-header, .rd-topbar, .rd-alerts, .footer, .rd-nav { display: none !important; }
                        }
                      `}
                    </style>



                  <h3 style={{ fontSize: '1.2rem', marginBottom: 16, color: 'var(--gray-800)', borderBottom: '2px solid var(--gray-100)', paddingBottom: 8 }}>
                    📋 Detalle de Pedidos ({cierreReport.pedidos.length})
                  </h3>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--gray-100)' }}>
                          <th style={{ padding: '8px 4px' }}>Pedido</th>
                          <th style={{ padding: '8px 4px' }}>Fecha/Hora</th>
                          <th style={{ padding: '8px 4px' }}>Método</th>
                          <th style={{ padding: '8px 4px', textAlign: 'right' }}>Total</th>
                          <th style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--blue-600)' }}>Financiación</th>
                          <th style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--red-600)' }}>Monto Com.</th>
                          <th style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700 }}>Neto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cierreReport.pedidos.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                            <td style={{ padding: '8px 4px', fontWeight: 600 }}>#{p.id.slice(0, 8)}</td>
                            <td style={{ padding: '8px 4px', fontSize: '0.7rem' }}>
                              {new Date(new Date(p.hora).getTime() + 3 * 60 * 60 * 1000).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                            </td>


                            <td style={{ padding: '8px 4px' }}>
                              <div>{p.metodo}</div>
                              {p.metodo?.toLowerCase().includes('transferencia') && p.nro_operacion && p.nro_operacion !== 'N/A' && (
                                <div style={{ fontSize: '0.65rem', color: 'var(--gray-800)', marginTop: '2px', fontWeight: 'bold' }}>
                                  Op: {p.nro_operacion}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'right' }}>${p.total}</td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--blue-600)', fontSize: '0.72rem', lineHeight: '1.2' }}>
                              {Number(p.credito_wallet) > 0 && <div style={{ fontWeight: 600 }}>Wallet: -${p.credito_wallet}</div>}
                              {Number(p.descuento_wepi) > 0 && <div style={{ fontWeight: 600, color: 'var(--purple-600)' }}>Promo Wepi: -${p.descuento_wepi}</div>}
                              {Number(p.credito_usado) === 0 && '-'}
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--red-600)' }}>
                              -${p.comision_monto}
                              <br />
                              <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: p.metodo?.toLowerCase().includes('transferencia') ? 'var(--green-600)' : 'var(--red-500)' }}>
                                {p.metodo?.toLowerCase().includes('transferencia') ? '(saldado)' : '(sin saldar)'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700 }}>
                              ${(p.metodo?.toLowerCase().includes('transferencia') 
                                ? (Number(p.total) - Number(p.credito_usado || 0) - Number(p.comision_monto)) 
                                : (Number(p.total) - Number(p.credito_usado || 0))
                              ).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        {cierreReport.pedidos.length === 0 ? (
                          <tr>
                            <td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: 'var(--gray-400)' }}>Sin pedidos para esta fecha.</td>
                          </tr>
                        ) : (
                          <>
                            <tr style={{ borderTop: '2px solid var(--gray-200)', background: 'var(--gray-50)' }}>
                               <td colSpan="3" style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'right' }}>TOTAL VENTA (BRUTO)</td>
                               <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700 }}>${cierreReport.subtotal}</td>
                               <td colSpan="3"></td>
                            </tr>
                            
                             <tr style={{ background: '#f0f9ff' }}>
                               <td colSpan="3" style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'right', color: 'var(--blue-600)' }}>FINANCIACIÓN WEPI A LIQUIDAR</td>
                               <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--blue-600)' }}>${cierreReport.totalCreditoWepi}</td>
                               <td colSpan="3" style={{ fontSize: '0.75rem', color: 'var(--gray-600)', paddingLeft: '15px', verticalAlign: 'middle', textAlign: 'left' }}>
                                 <div style={{ fontWeight: 700, marginBottom: '2px' }}>Detalle de liquidación financiada por Wepi:</div>
                                 {Number(cierreReport.totalCreditoWallet) > 0 && <div>• Crédito Wallet: ${cierreReport.totalCreditoWallet}</div>}
                                 {Number(cierreReport.totalDescuentoWepi) > 0 && <div>• Descuento Promos Wepi: ${cierreReport.totalDescuentoWepi}</div>}
                                 <div style={{ color: 'var(--gray-400)', marginTop: '4px', fontSize: '0.7rem' }}>Wepi liquidará este total al local.</div>
                               </td>
                             </tr>
                             <tr style={{ background: 'var(--gray-50)' }}>
                               <td colSpan="3" style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'right', color: 'var(--red-600)' }}>COMISIÓN WEPI</td>
                               <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--red-600)' }}>-${cierreReport.comisiones}</td>
                               <td colSpan="3" style={{ fontSize: '0.75rem', color: 'var(--gray-500)', verticalAlign: 'middle', paddingLeft: '15px' }}>
                                  <div style={{ display: 'flex', gap: '15px' }}>
                                     <span>Saldada (Transf.): -${(Number(cierreReport.comisiones) - Number(cierreReport.comisionEfectivo)).toFixed(2)}</span>
                                     <span style={{ color: 'var(--red-600)', fontWeight: 600 }}>Pendiente (Efectivo): -${cierreReport.comisionEfectivo}</span>
                                  </div>
                               </td>
                            </tr>
                            <tr style={{ background: '#f0fdf4', borderTop: '2px solid #bbf7d0' }}>
                               <td colSpan="3" style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right', color: '#166534', fontSize: '1rem' }}>TOTAL NETO (sin comisión Wepi)</td>
                               <td colSpan="3"></td>
                               <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, color: '#166534', fontSize: '1rem' }}>${cierreReport.neto}</td>
                            </tr>
                            <tr style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                               <td colSpan="8" style={{ padding: '16px 8px', textAlign: 'right' }}>
                                  <div style={{ marginBottom: 4 }}>
                                    <span style={{ marginRight: 20 }}>💳 Transferencia: ${cierreReport.transferencia}</span>
                                    <span>💵 Efectivo: ${cierreReport.efectivo}</span>
                                  </div>
                                  <div style={{ fontStyle: 'italic', color: 'var(--gray-400)', fontSize: '0.65rem' }}>
                                    * Este informe contempla únicamente la comisión de servicio de Wepi. No incluye retenciones de pasarelas de pago (Mercado Pago) ni impuestos externos.
                                  </div>
                                </td>
                            </tr>

                          </>
                        )}
                      </tbody>

                    </table>
                  </div>

                  <div className="no-print" style={{ marginTop: 30, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                     <button className="btn btn-outline" onClick={() => window.print()}>🖨️ Imprimir Informe</button>
                     <button className="btn btn-success" onClick={handleSaveCierre} disabled={cierreLoading || cierreReport.pedidos.length === 0}>
                       {cierreLoading ? <span className="spinner spinner-white" /> : '💾 Guardar Cierre'}
                     </button>
                  </div>
                  </div>
                )) : cierreSubTab === 'historial' ? (
                <div className="historial-cierres">
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--gray-100)' }}>
                          <th style={{ padding: '12px 8px' }}>Fecha</th>
                          <th style={{ padding: '12px 8px' }}>Subtotal</th>
                          <th style={{ padding: '12px 8px' }}>Comisión</th>
                          <th style={{ padding: '12px 8px' }}>Neto</th>
                          <th style={{ padding: '12px 8px', textAlign: 'right' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historialCierres.map(c => (
                          <tr key={c.id} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                            <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                              {new Date(new Date(c.created_at).getTime() + 3 * 60 * 60 * 1000).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                            </td>



                            <td style={{ padding: '12px 8px' }}>${c.total_subtotal}</td>
                            <td style={{ padding: '12px 8px', color: 'var(--red-600)' }}>-${c.total_comisiones}</td>
                            <td style={{ padding: '12px 8px', fontWeight: 700, color: '#166534' }}>${c.total_neto_local}</td>
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              <button className="btn btn-ghost btn-xs" onClick={() => { 
                                setCierreReport({
                                  subtotal: c.total_subtotal,
                                  comisiones: c.total_comisiones,
                                  neto: c.total_neto_local,
                                  transferencia: c.total_transferencia,
                                  efectivo: c.total_efectivo,
                                  pedidos: c.datos_detallados,
                                  comisionPct: (c.total_comisiones / c.total_subtotal * 100).toFixed(1)
                                });
                                setCierreSubTab('generar');
                              }}>Ver Detalle</button>
                            </td>
                          </tr>
                        ))}
                        {historialCierres.length === 0 && !cierreLoading && (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--gray-400)' }}>No hay cierres guardados aún.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                ) : (
                <div className="estadisticas-cierres animate-fade-in">
                  <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Desde:</span>
                      <input type="date" className="form-input" style={{ marginBottom: 0, width: '150px' }} value={statsDates.start} onChange={e => setStatsDates(s => ({...s, start: e.target.value}))} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hasta:</span>
                      <input type="date" className="form-input" style={{ marginBottom: 0, width: '150px' }} value={statsDates.end} onChange={e => setStatsDates(s => ({...s, end: e.target.value}))} />
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={loadStats}>Filtrar</button>
                  </div>

                  {statsData && (
                    <div className="animate-fade-in">
                      <div className="cierre-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                        <div className="stat-card" style={{ padding: 12, background: 'var(--gray-50)', borderRadius: 10, border: '1px solid var(--gray-100)' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--gray-500)', fontWeight: 600 }}>PEDIDOS TOTALES</span>
                          <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>{statsData.totals.totalPedidos}</p>
                        </div>
                        <div className="stat-card" style={{ padding: 12, background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                          <span style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 600 }}>VENTAS BRUTAS</span>
                          <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#166534' }}>${statsData.totals.totalVentas.toLocaleString()}</p>
                        </div>
                        <div className="stat-card" style={{ padding: 12, background: '#fff5f5', borderRadius: 10, border: '1px solid #feb2b2' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--red-600)', fontWeight: 600 }}>COMISIONES</span>
                          <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--red-600)' }}>-${statsData.totals.totalComisiones.toLocaleString()}</p>
                        </div>
                        <div className="stat-card" style={{ padding: 12, background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe' }}>
                          <span style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 600 }}>NETO A RECIBIR</span>
                          <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1e40af' }}>${statsData.totals.totalNeto.toLocaleString()}</p>
                        </div>
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--gray-100)' }}>
                              <th style={{ padding: '8px' }}>Fecha</th>
                              <th style={{ padding: '8px' }}>Pedidos</th>
                              <th style={{ padding: '8px' }}>Venta</th>
                              <th style={{ padding: '8px' }}>Comisión</th>
                              <th style={{ padding: '8px' }}>Neto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statsData.history.map(h => (
                              <tr key={h.id} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                                <td style={{ padding: '8px' }}>{new Date(h.fecha).toLocaleDateString('es-AR')}</td>
                                <td style={{ padding: '8px' }}>{h.num_pedidos}</td>
                                <td style={{ padding: '8px' }}>${h.total_subtotal}</td>
                                <td style={{ padding: '8px', color: 'var(--red-600)' }}>-${h.total_comisiones}</td>
                                <td style={{ padding: '8px', fontWeight: 600 }}>${h.total_neto_local}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
                )}

            </div>
            <style>{`
              @media print {
                .no-print, .rd-header, .rd-topbar, .rd-alerts, .footer, .rd-nav { display: none !important; }
                #printable-cierre { padding: 0 !important; }
                .card { border: none !important; box-shadow: none !important; margin: 0 !important; }
              }
            `}</style>

          </section>
        )}

        {/* ─── Settings View ─── */}
        {view === 'settings' && (
          <section className="animate-fade-in">
            <div className="rd-tabs" style={{ gap: 8, marginBottom: 24 }}>
              <button className={profileSubView === 'edit' ? 'active' : ''} onClick={() => setProfileSubView('edit')}>
                ⚙️ Configuración
              </button>
              <button className={profileSubView === 'printing' ? 'active' : ''} onClick={() => setProfileSubView('printing')}>
                🖨️ Impresión Ticket
              </button>
              <button className={profileSubView === 'notifications' ? 'active' : ''} onClick={() => setProfileSubView('notifications')}>
                📳 Notificaciones
              </button>
              <button className={profileSubView === 'cajas' ? 'active' : ''} onClick={() => setProfileSubView('cajas')}>
                🔑 Cajas / Dispositivos
              </button>
              <button className={profileSubView === 'whatsapp' ? 'active' : ''} onClick={() => setProfileSubView('whatsapp')}>
                🤖 Wepi Assistant (Beta)
              </button>
            </div>

            {profileSubView === 'edit' && (
              <div className="card card-body" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <h2 style={{ color: 'var(--red-600)', marginBottom: 20, textAlign: 'center' }}>⚙️ Configuración del Local</h2>
                
                <form onSubmit={handleSaveSettings}>
                  {/* Rubro Selection (Keep instant update logic but inside form UI) */}
                  <div style={{ marginBottom: 24, padding: 16, background: 'var(--gray-50)', borderRadius: 12, border: '1px solid var(--gray-200)' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: 12, color: 'var(--gray-700)' }}>Rama de Servicio</h3>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 8, 
                        padding: '10px 16px', 
                        background: (profileData?.tipo_servicio !== 'shops') ? 'var(--red-50)' : 'white',
                        border: `1px solid ${(profileData?.tipo_servicio !== 'shops') ? 'var(--red-200)' : 'var(--gray-200)'}`,
                        borderRadius: 8, 
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.9rem'
                      }}>
                        <input 
                          type="radio" 
                          name="tipo_servicio_selector" 
                          checked={profileData?.tipo_servicio !== 'shops'} 
                          onChange={async () => {
                            try {
                              const success = await api.updatePerfilLocal({ localId: restaurant.id, tipo_servicio: 'delivery', rubros: [] });
                              if (success) {
                                setProfileData({ ...profileData, tipo_servicio: 'delivery', rubros: [] });
                                toast.success('Cambiado a Wepi Delivery. Seleccioná tus nuevos rubros.');
                              }
                            } catch { toast.error('Error al cambiar de rama'); }
                          }}
                        />
                        🛵 Wepi Delivery
                      </label>
                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 8, 
                        padding: '10px 16px', 
                        background: (profileData?.tipo_servicio === 'shops') ? 'var(--red-50)' : 'white',
                        border: `1px solid ${(profileData?.tipo_servicio === 'shops') ? 'var(--red-200)' : 'var(--gray-200)'}`,
                        borderRadius: 8, 
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.9rem'
                      }}>
                        <input 
                          type="radio" 
                          name="tipo_servicio_selector" 
                          checked={profileData?.tipo_servicio === 'shops'} 
                          onChange={async () => {
                            try {
                              const success = await api.updatePerfilLocal({ localId: restaurant.id, tipo_servicio: 'shops', rubros: [] });
                              if (success) {
                                setProfileData({ ...profileData, tipo_servicio: 'shops', rubros: [] });
                                toast.success('Cambiado a Wepi Shops. Seleccioná tus nuevos rubros.');
                              }
                            } catch { toast.error('Error al cambiar de rama'); }
                          }}
                        />
                        🛍️ Wepi Shops
                      </label>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', marginBottom: 12, color: 'var(--gray-700)' }}>Rubros del Negocio</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: 20 }}>
                      Seleccioná el rubro de tu local para adaptar las opciones del panel.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                      {(profileData?.tipo_servicio === 'shops'
                        ? ['Hogar', 'Tecnología', 'Moda', 'Regalería', 'Deportes', 'Bebidas']
                        : ['Restaurante', 'Cafetería', 'Heladería', 'Market', 'Farmacia', 'Bebidas', 'Carnicería']
                      ).map(r => {
                        const isSelected = profileData?.rubros?.includes(r);
                        return (
                          <label key={r} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 10, 
                            padding: '12px', 
                            background: isSelected ? 'var(--red-50)' : 'white',
                            border: `1px solid ${isSelected ? 'var(--red-200)' : 'var(--gray-200)'}`,
                            borderRadius: 10,
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            transition: 'all 0.2s'
                          }}>
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={async (e) => {
                                const checked = e.target.checked;
                                let newRubros = profileData?.rubros || [];
                                if (checked) {
                                  newRubros = [...newRubros, r];
                                } else {
                                  newRubros = newRubros.filter(item => item !== r);
                                }
                                
                                try {
                                  const success = await api.updatePerfilLocal({ 
                                    localId: restaurant.id, 
                                    rubros: newRubros,
                                    rubro: newRubros.length > 0 ? newRubros[0] : null
                                  });
                                  if (success) {
                                    setProfileData({ ...profileData, rubros: newRubros, rubro: newRubros.length > 0 ? newRubros[0] : null });
                                    toast.success(checked ? `Rubro ${r} añadido` : `Rubro ${r} removido`);
                                  }
                                } catch (e) { toast.error('Error al cambiar rubros'); }
                              }}
                            />
                            {r}
                          </label>
                        );
                      })}
                    </div>
                  </div>


                  {/* Enlace Compartible */}
                  <div style={{ marginBottom: 24, padding: 16, background: '#f0f9ff', borderRadius: 12, border: '1px solid #bae6fd' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: 12, color: '#0369a1' }}>🔗 Enlace Compartible</h3>
                    <p style={{ fontSize: '0.85rem', color: '#0c4a6e', marginBottom: 16 }}>
                      Personalizá y compartí este enlace con tus clientes para que accedan directamente a tu local en Wepi.
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px', 
                          background: '#fff', 
                          border: '1px solid #bae6fd', 
                          borderRadius: '8px', 
                          padding: '0 12px', 
                          flex: 1,
                          minWidth: '200px'
                        }}>
                          <span style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap', userSelect: 'none' }}>
                            {profileData?.tipo_servicio === 'shops' 
                              ? `https://wepi.com.ar/shops/${getCitySlug(profileData?.ciudad)}/` 
                              : `https://wepi.com.ar/pedir/${getCitySlug(profileData?.ciudad)}/`}
                          </span>
                          <input 
                            type="text"
                            value={customSlug}
                            onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!slugSaving && customSlug.trim() !== '' && customSlug !== profileData?.slug) {
                                  handleSaveSlug(e);
                                }
                              }
                            }}
                            placeholder="mi-local"
                            className="form-input"
                            style={{ border: 'none', padding: '10px 0', margin: 0, fontSize: '0.85rem', boxShadow: 'none', flex: 1, minWidth: '80px', background: 'transparent' }}
                            required
                          />
                        </div>
                        
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button 
                            type="button" 
                            className="btn btn-success" 
                            disabled={slugSaving || customSlug.trim() === '' || customSlug === profileData?.slug}
                            onClick={handleSaveSlug}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {slugSaving ? 'Guardando...' : 'Guardar'}
                          </button>
                          
                          <button 
                            type="button" 
                            className="btn btn-primary"
                            style={{ background: '#0284c7', whiteSpace: 'nowrap' }}
                            disabled={!profileData?.slug}
                            onClick={() => {
                              const citySlug = getCitySlug(profileData?.ciudad);
                              const prefix = profileData?.tipo_servicio === 'shops' 
                                ? `https://wepi.com.ar/shops/${citySlug}/` 
                                : `https://wepi.com.ar/pedir/${citySlug}/`;
                              const link = `${prefix}${profileData?.slug || ''}`;
                              navigator.clipboard.writeText(link);
                              toast.success('¡Enlace copiado!', { icon: '📋' });
                            }}
                          >
                            Copiar
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {!profileData?.slug && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--red-600)', marginTop: 8, fontWeight: 600 }}>
                        ⚠️ Tu local aún no tiene un identificador único asignado. Asignale uno para poder compartir tu local.
                      </p>
                    )}
                  </div>

                  {/* Configuración de Horarios Flexible */}
                  {/* Configuración de Horarios Flexible */}
                  <div style={{ marginBottom: 24, padding: 0, background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
                    <div 
                      onClick={() => setShowHorariosConfig(!showHorariosConfig)}
                      style={{ 
                        padding: '16px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        cursor: 'pointer',
                        background: showHorariosConfig ? 'var(--gray-50)' : 'white',
                        borderBottom: showHorariosConfig ? '1px solid var(--gray-200)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.2rem' }}>🕒</span>
                        <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--gray-700)' }}>Horarios de Atención</h3>
                      </div>
                      <span style={{ 
                        transform: showHorariosConfig ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease',
                        fontSize: '1.2rem',
                        color: 'var(--gray-400)'
                      }}>
                        ▼
                      </span>
                    </div>

                    {showHorariosConfig && (
                      <div className="animate-fade-in" style={{ padding: '16px' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: 20 }}>
                          Configurá los horarios específicos para cada día de la semana.
                        </p>
                        
                        {renderHorariosConfig()}

                        <div style={{ marginTop: 24, padding: '16px', background: 'var(--gray-50)', borderRadius: '12px', border: '1px solid var(--gray-200)' }}>
                          <label style={{ fontSize: '0.85rem', color: 'var(--gray-600)', display: 'block', marginBottom: 8, fontWeight: 600 }}>Gestión de Estado</label>
                          <select name="modo_automatico" className="form-select" defaultValue={profileData?.modo_automatico ? 'true' : 'false'}>
                            <option value="true">Modo Automático (Abrir/Cerrar según horario)</option>
                            <option value="false">Modo Manual (Yo controlo el botón de Abrir/Cerrar)</option>
                          </select>
                          <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: 8 }}>
                            En modo automático, el local cambiará su estado a "Abierto" o "Cerrado" siguiendo la configuración de arriba.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Entrega */}
                  <div style={{ marginBottom: 24, padding: 16, background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: 16, color: 'var(--gray-700)' }}>🛵 Métodos de Entrega</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '0.95rem' }}>
                        <input type="checkbox" name="acepta_retiro" defaultChecked={profileData?.acepta_retiro !== false} />
                        🏪 Ofrecer Retiro en Local
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '0.95rem' }}>
                        <input type="checkbox" name="acepta_envio" defaultChecked={profileData?.acepta_envio !== false} />
                        🛵 Ofrecer Envío a Domicilio
                      </label>
                    </div>
                  </div>

                  <div className="rd-form-actions" style={{ marginBottom: 32 }}>
                    <button type="submit" className="btn btn-success btn-full">Guardar Configuración</button>
                  </div>
                </form>

                {/* Mercado Pago connection (External to the main settings form) */}
                <hr style={{ margin: '32px 0', border: 'none', borderTop: '1px solid var(--gray-200)' }} />
                <div style={{ backgroundColor: '#f0f9ff', padding: '20px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                  <h3 style={{ color: '#0369a1', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src="https://i.postimg.cc/k47vV4h3/mercadopago.png" alt="MP" style={{ height: 24 }} onError={(e) => e.target.style.display = 'none'} />
                    Cobros con Mercado Pago
                  </h3>
                  <p style={{ color: '#0c4a6e', fontSize: '0.9rem', marginBottom: '16px', lineHeight: 1.5 }}>
                    Conectá tu cuenta de Mercado Pago para recibir pagos online directamente en tu cuenta.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-primary" 
                      style={{ backgroundColor: '#009ee3', borderColor: '#009ee3', padding: '10px 24px', fontWeight: 600 }}
                      onClick={() => {
                        const clientId = import.meta.env.VITE_MP_CLIENT_ID || prompt("Por favor, ingresa el CLIENT_ID de tu aplicación de Mercado Pago:");
                        if (!clientId) return;
                        const redirectUri = `${import.meta.env.VITE_SUPABASE_URL || 'https://jskxfescamdjesdrcnkf.supabase.co'}/functions/v1/mp-oauth-callback`;
                        const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${restaurant.id}&redirect_uri=${encodeURIComponent(redirectUri)}`;
                        window.location.href = authUrl;
                      }}
                    >
                      Vincular MercadoPago
                    </button>
                    {profileData?.mp_access_token && (
                      <span className="badge badge-green" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>✓ Vinculada</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {profileSubView === 'printing' && (
              <div className="card card-body animate-fade-in" style={{ textAlign: 'center', padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🖨️</div>
                <h2 style={{ color: 'var(--red-600)', marginBottom: '16px' }}>Impresión Automática de Tickets</h2>
                <p style={{ color: 'var(--gray-600)', maxWidth: '500px', margin: '0 auto 32px', lineHeight: 1.6 }}>
                  Optimizá tu local con nuestra aplicación de escritorio. Imprime tickets automáticamente en tu comandera térmica apenas recibís un pedido.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px', margin: '0 auto' }}>
                  <a 
                    href="/download/weep-printer-latest.exe" 
                    download={`Wepi_${restaurant?.localId || restaurant?.id || 'LOCAL'}.exe`}
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
                    <li><strong>Abrí Wepi Desktop</strong> e ingresá tu ID de Local (arriba).</li>
                    <li><strong>Seleccioná tu impresora</strong> térmica en el menú desplegable.</li>
                    <li>¡Listo! La app detectará tus pedidos y los imprimirá automáticamente.</li>
                  </ol>
                </div>
              </div>
            )}

            {profileSubView === 'notifications' && (
              <div className="card card-body animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
                <h2 style={{ color: 'var(--red-600)', marginBottom: 12, textAlign: 'center' }}>📳 Notificaciones de Pedidos</h2>
                <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem', marginBottom: 24, textAlign: 'center' }}>
                  Configurá múltiples dispositivos (computadora, celulares) para recibir alertas al instante cuando entre un nuevo pedido.
                </p>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Estado en este dispositivo:</span>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      padding: '4px 8px', 
                      borderRadius: 12, 
                      fontWeight: 'bold',
                      background: notificationStatus === 'granted' ? '#dcfce7' : (notificationStatus === 'denied' ? '#fee2e2' : '#fef9c3'),
                      color: notificationStatus === 'granted' ? '#15803d' : (notificationStatus === 'denied' ? '#b91c1c' : '#a16207')
                    }}>
                      {notificationStatus === 'granted' ? 'Habilitado' : (notificationStatus === 'denied' ? 'Bloqueado' : 'Sin activar')}
                    </span>
                  </div>

                  {notificationStatus !== 'granted' && (
                    <button 
                      type="button" 
                      className="btn btn-primary btn-sm" 
                      style={{ width: '100%', background: 'var(--red-600)', borderColor: 'var(--red-600)' }}
                      onClick={async () => {
                        if (window.OneSignalDeferred) {
                          window.OneSignalDeferred.push(async (OneSignal) => {
                            await OneSignal.Notifications.requestPermission();
                          });
                        }
                      }}
                    >
                      Activar en esta Computadora
                    </button>
                  )}
                </div>

                <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <h3 style={{ fontSize: '0.95rem', color: '#c2410c', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    📱 Vincular Celular u Otro Dispositivo
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#9a3412', margin: '0 0 16px 0' }}>
                    Escaneá este código QR con tu celular para abrir tu panel y habilitar las notificaciones. Se sumarán a las de tu computadora.
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(window.location.origin + '/locales')}`} 
                      alt="QR Vinculación Celular" 
                      style={{ border: '4px solid white', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#c2410c', wordBreak: 'break-all', display: 'block', background: 'white', padding: '8px', borderRadius: 6, border: '1px solid #ffedd5' }}>
                      {window.location.origin + '/locales'}
                    </span>
                  </div>
                </div>

                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem', display: 'block' }}>Dispositivos Activos:</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                        Hay {profileData?.onesignal_id ? profileData.onesignal_id.split(',').length : 0} dispositivo(s) registrado(s).
                      </span>
                    </div>

                    <button 
                      type="button" 
                      className="btn btn-sm btn-ghost" 
                      style={{ color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5' }}
                      onClick={async () => {
                        if (window.confirm("¿Seguro que querés restablecer todos los dispositivos vinculados? Deberás volver a habilitar las notificaciones en cada uno.")) {
                          try {
                            if (window.OneSignalDeferred) {
                              window.OneSignalDeferred.push(async (OneSignal) => {
                                const subId = OneSignal.User.PushSubscription.id;
                                if (subId) {
                                  await api.localResetOneSignalId(restaurant.id, subId);
                                  setProfileData(prev => ({ ...prev, onesignal_id: subId }));
                                  toast.success("Dispositivos restablecidos. Solo este dispositivo está activo.");
                                } else {
                                  await api.localResetOneSignalId(restaurant.id, "");
                                  setProfileData(prev => ({ ...prev, onesignal_id: "" }));
                                  toast.success("Dispositivos restablecidos.");
                                }
                              });
                            }
                          } catch (err) {
                            toast.error("Error al restablecer dispositivos.");
                          }
                        }
                      }}
                    >
                      Limpiar y Restablecer
                    </button>
                  </div>
                </div>
              </div>
            )}

            {profileSubView === 'cajas' && (
              <div className="card card-body animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
                <h2 style={{ color: 'var(--red-600)', marginBottom: 8, textAlign: 'center' }}>🔑 Gestión de Cajas / Dispositivos</h2>
                <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem', marginBottom: 24, textAlign: 'center' }}>
                  Creá usuarios secundarios con nombre de usuario y contraseña para que tus sucursales o cajas inicien sesión de forma segura con permisos limitados.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                  {/* Formulario */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Nueva Caja</h3>
                    <form onSubmit={handleAddCajero} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nombre de la Caja</label>
                        <input name="nombre" type="text" className="form-input" placeholder="Ej: Caja Central / Caja Sucursal" required style={{ marginBottom: 0 }} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nombre de Usuario (Login)</label>
                        <input name="username" type="text" className="form-input" placeholder="Ej: caja_central" required style={{ marginBottom: 0 }} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Contraseña</label>
                        <input name="password" type="text" className="form-input" placeholder="••••••••" required style={{ marginBottom: 0 }} />
                      </div>
                      <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px', background: 'var(--red-600)', borderColor: 'var(--red-600)' }}>
                        Agregar Caja
                      </button>
                    </form>
                  </div>

                  {/* Listado */}
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Cajas Activas ({cajeros.length})</h3>
                    {cajerosLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                        <span className="spinner" />
                      </div>
                    ) : cajeros.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--gray-500)', fontSize: '0.9rem', border: '1px dashed var(--gray-300)', borderRadius: 12 }}>
                        No hay cajas registradas todavía.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {cajeros.map(c => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{c.nombre}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Usuario: <strong>{c.username}</strong></div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Contraseña: <strong>{c.password}</strong></div>
                            </div>
                            <button 
                              type="button" 
                              className="btn btn-sm btn-ghost" 
                              style={{ color: '#ef4444', background: '#fee2e2', border: 'none', padding: '6px 12px' }}
                              onClick={() => handleDeleteCajero(c.id)}
                            >
                              Eliminar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {profileSubView === 'whatsapp' && (
              <div className="card card-body" style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🤖</div>
                <h2 style={{ color: 'var(--red-600)', marginBottom: 8 }}>Wepi Assistant (Beta)</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: 24 }}>
                  Vincular tu cuenta es muy simple. Escaneá el código QR desde la sección de Dispositivos Vinculados en tu app de WhatsApp.
                </p>

                <div style={{ 
                  background: 'var(--gray-50)', 
                  border: '1px solid var(--gray-200)', 
                  borderRadius: '16px', 
                  padding: '24px', 
                  marginBottom: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '220px'
                }}>
                  {waStatus === 'disconnected' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span className="badge badge-gray" style={{ marginBottom: '16px', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>
                        🔴 Estado: Desconectado
                      </span>
                      <button 
                        className="btn btn-primary" 
                        style={{ background: 'var(--red-600)', borderColor: 'var(--red-600)', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}
                        onClick={handleConnectWA}
                      >
                        🔗 Vincular Código QR
                      </button>
                    </div>
                  )}

                  {waStatus === 'loading' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <style>{`
                        @keyframes spin {
                          0% { transform: rotate(0deg); }
                          100% { transform: rotate(360deg); }
                        }
                      `}</style>
                      <div className="wa-spinner" style={{ 
                        width: '40px', 
                        height: '40px', 
                        border: '3px solid var(--gray-200)', 
                        borderTop: '3px solid var(--red-600)', 
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--gray-600)', fontWeight: 500 }}>
                        Generando código QR...
                      </span>
                    </div>
                  )}

                  {waStatus === 'qr_ready' && waQrCode && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                      <span className="badge badge-amber" style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>
                        ⏳ Esperando escaneo...
                      </span>
                      <div style={{ background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid var(--gray-300)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                        <img src={waQrCode} alt="WhatsApp QR Code" style={{ width: '180px', height: '180px', display: 'block' }} />
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', maxWidth: '280px', margin: 0, lineHeight: '1.4' }}>
                        Abrí <strong>WhatsApp</strong> en tu celular ➜ <strong>Dispositivos vinculados</strong> ➜ <strong>Vincular un dispositivo</strong> y escaneá este código QR.
                      </p>
                    </div>
                  )}

                  {waStatus === 'connected' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                      <span className="badge badge-green" style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, background: '#d1fae5', color: '#065f46' }}>
                        🟢 Asistente Activo
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '12px 18px', borderRadius: '10px', border: '1px solid #d1fae5' }}>
                        <span style={{ fontSize: '1.2rem' }}>📞</span>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--gray-800)' }}>{waPhoneNumber}</strong>
                      </div>
                      <button 
                        className="btn" 
                        style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                        onClick={handleDisconnectWA}
                      >
                        🛑 Desconectar Asistente
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'left', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--gray-800)', marginBottom: '8px', fontWeight: 700 }}>💡 ¿Cómo funciona el Asistente?</h4>
                  <ul style={{ fontSize: '0.8rem', color: 'var(--gray-600)', paddingLeft: '20px', margin: 0, lineHeight: '1.4' }}>
                    <li style={{ marginBottom: '4px' }}><strong>Sigue usando tu celular</strong>: El bot responde en segundo plano de forma automática, sin que pierdas tu chat móvil.</li>
                    <li style={{ marginBottom: '4px' }}><strong>Toma Pedidos</strong>: Responde a saludos, muestra categorías principales de tu menú y provee enlaces a tu catálogo.</li>
                    <li><strong>Estado de pedidos</strong>: Tus clientes pueden consultar el estado de su envío directamente desde WhatsApp.</li>
                  </ul>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ─── Planes y Comisiones View ─── */}
        {view === 'plans' && renderPlansView()}

        {/* ─── Profile ─── */}
        {view === 'profile' && (
          <section className="animate-fade-in">
            <div className="rd-tabs" style={{ gap: 8, marginBottom: 24 }}>
              <button className={profileSubView === 'ventas' ? 'active' : ''} onClick={() => setProfileSubView('ventas')}>
                💰 Mis Ventas
              </button>

              <button className={profileSubView === 'edit' ? 'active' : ''} onClick={() => setProfileSubView('edit')}>
                👤 Editar Perfil
              </button>
            </div>

            {profileSubView === 'ventas' && (
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                   <h2 style={{ color: 'var(--red-600)', margin: 0 }}>📊 Estadísticas de Ventas</h2>
                   <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Desde:</span>
                      <input type="date" className="form-input" style={{ marginBottom: 0, width: '150px' }} value={statsDates.start} onChange={e => setStatsDates(s => ({...s, start: e.target.value}))} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hasta:</span>
                      <input type="date" className="form-input" style={{ marginBottom: 0, width: '150px' }} value={statsDates.end} onChange={e => setStatsDates(s => ({...s, end: e.target.value}))} />
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={loadStats}>🔍 Filtrar</button>
                  </div>
                </div>
                
                {statsData ? (
                  <div className="animate-fade-in">
                    <div className="cierre-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
                      <div className="stat-card" style={{ padding: 20, background: 'var(--gray-50)', borderRadius: 12, border: '1px solid var(--gray-100)', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 700, textTransform: 'uppercase' }}>Pedidos Totales</span>
                        <p style={{ margin: '8px 0 0', fontSize: '1.8rem', fontWeight: 800 }}>{statsData.totals.totalPedidos}</p>
                      </div>
                      <div className="stat-card" style={{ padding: 20, background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>Ventas Brutas</span>
                        <p style={{ margin: '8px 0 0', fontSize: '1.8rem', fontWeight: 800, color: '#166534' }}>${statsData.totals.totalVentas.toLocaleString()}</p>
                      </div>
                      <div className="stat-card" style={{ padding: 20, background: '#fff5f5', borderRadius: 12, border: '1px solid #feb2b2', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--red-600)', fontWeight: 700, textTransform: 'uppercase' }}>Comisiones</span>
                        <p style={{ margin: '8px 0 0', fontSize: '1.8rem', fontWeight: 800, color: 'var(--red-600)' }}>-${statsData.totals.totalComisiones.toLocaleString()}</p>
                      </div>
                      <div className="stat-card" style={{ padding: 20, background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase' }}>Neto Wepi</span>
                        <p style={{ margin: '8px 0 0', fontSize: '1.8rem', fontWeight: 800, color: '#1e40af' }}>${statsData.totals.totalNeto.toLocaleString()}</p>
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--gray-100)' }}>
                            <th style={{ padding: '12px 8px' }}>Fecha</th>
                            <th style={{ padding: '12px 8px' }}>Pedidos</th>
                            <th style={{ padding: '12px 8px' }}>Venta Bruta</th>
                            <th style={{ padding: '12px 8px' }}>Comisión</th>
                            <th style={{ padding: '12px 8px' }}>Neto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statsData.history.map(h => (
                            <tr key={h.id} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                              <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                                {new Date(new Date(h.created_at).getTime() + 3 * 60 * 60 * 1000).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                              </td>



                              <td style={{ padding: '12px 8px' }}>{h.num_pedidos}</td>
                              <td style={{ padding: '12px 8px' }}>${h.total_subtotal}</td>
                              <td style={{ padding: '12px 8px', color: 'var(--red-600)' }}>-${h.total_comisiones}</td>
                              <td style={{ padding: '12px 8px', fontWeight: 700, color: '#166534' }}>${h.total_neto_local}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-400)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>📈</div>
                    <p>Haz clic en "Filtrar" para ver las estadísticas de tus ventas cerradas.</p>
                  </div>
                )}
              </div>
            )}





            {profileSubView === 'edit' && (
              <div className="card card-body">
                <h2 style={{ color: 'var(--red-600)', marginBottom: 16 }}>Editar Perfil del Local</h2>
                {profileData && (
                  <form onSubmit={handleSaveProfile} className="rd-item-form">
                    <input type="hidden" name="update_address" value="true" />
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
                        <input 
                          name="direccion" 
                          className="form-input" 
                          placeholder="Dirección manual (opcional)" 
                          value={profileAddress} 
                          onChange={(e) => setProfileAddress(e.target.value)} 
                        />
                        {(!profileLat || !profileLng) && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--amber-600)', fontStyle: 'italic' }}>
                            ⚠️ Ubicación no configurada en el mapa
                          </span>
                        )}
                      </div>
                    </div>
                    <input name="email" type="email" className="form-input" placeholder="Email" defaultValue={profileData.email || ''} required />
                    <input name="password" type="password" className="form-input" placeholder="Nueva contraseña (dejar vacío para no cambiar)" />
                    

                    
                    <div className="rd-form-actions" style={{ marginTop: '24px' }}>
                      <button type="button" className="btn btn-ghost" onClick={() => setView('orders')}>Cancelar</button>
                      <button type="submit" className="btn btn-success">Guardar Perfil</button>
                    </div>
                  </form>
                )}
                
              </div>
            )}
          </section>
        )}
      </main>
      </div>



      <footer className="footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '60px 20px', background: 'var(--red-800)', color: 'white' }}>
        <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" style={{ height: '50px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        <p>© 2026 <strong>Wepi</strong> — Panel de Locales</p>
        <button 
          onClick={() => setShowTerms(true)} 
          style={{ background: 'none', border: 'none', color: 'white', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          Ver Términos y Condiciones
        </button>
        <button 
          onClick={() => setShowRegretModal(true)} 
          style={{ background: 'none', border: 'none', color: 'white', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem', marginTop: '4px', fontWeight: 'bold' }}
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
                    handleOrderAction(orderToReject, 'Rechazado', reason);
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

      <input
        ref={quickImageInputRef}
        type="file"
        accept="image/*"
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, zIndex: -1 }}
        onChange={async (e) => {
          const file = e.target.files[0];
          if (!file || !quickUploadItemId) return;
          const loadingId = toast.loading('Subiendo imagen de producto...');
          try {
            const imgUrl = await api.uploadImage(file);
            if (!imgUrl) throw new Error('No se pudo obtener la URL de la imagen.');
            
            await api.updateMenuItem({ itemId: quickUploadItemId, imagen_url: imgUrl });
            toast.success('¡Imagen subida y guardada exitosamente!', { id: loadingId });
            await loadMenu();
          } catch (err) {
            toast.error('Error al subir la imagen: ' + (err.message || err), { id: loadingId });
          } finally {
            setQuickUploadItemId(null);
            e.target.value = ''; // Limpiar el input
          }
        }}
      />
    </div>
  );
}

/* ─── Order Card Component ─── */
function OrderCard({ order: o, onAction, finished, isShop, localNombre }) {
  const [loading, setLoading] = React.useState('');
  const [showScheduler, setShowScheduler] = React.useState(false);
  const [scheduleDate, setScheduleDate] = React.useState('');
  const [scheduleTime, setScheduleTime] = React.useState('');

  const isOnlinePayment = String(o.metodoPago).toLowerCase().includes('transfer') || 
                          String(o.metodoPago).toLowerCase().includes('mercado') || 
                          String(o.metodoPago).toLowerCase().includes('online') || 
                          String(o.metodoPago).toLowerCase().includes('tarjeta') || 
                          String(o.metodoPago).toLowerCase() === 'mp';

  const handleConfirmRequestDriver = () => {
    if (!scheduleDate || !scheduleTime) {
      toast.error('Por favor, selecciona fecha y hora para el envío');
      return;
    }
    
    // Format items
    const itemsText = o.items.map(item => `• ${item[4]} x${item[6]}`).join('\n');
    
    // Maps link
    const mapsLink = o.lat && o.lng ? `https://www.google.com/maps?q=${o.lat},${o.lng}` : '';
    
    const msg = `🛵 *SOLICITUD DE REPARTIDOR WEPI (SHOPS)* 🛵\n\n` +
      `*Local:* ${localNombre || 'Tienda Shops'}\n` +
      `*Pedido:* #${o.idPedido}\n` +
      `*Cliente:* ${o.nombreCliente}\n` +
      `*Teléfono Cliente:* ${o.clienteTelefono || 'No especificado'}\n` +
      `*Dirección de Entrega:* ${o.direccion}\n` +
      (mapsLink ? `*Ubicación GPS:* ${mapsLink}\n` : '') +
      `*Fecha Programada:* ${scheduleDate}\n` +
      `*Horario Programado:* ${scheduleTime}\n\n` +
      `*Productos:*\n${itemsText}\n\n` +
      `*Total a Cobrar/Entregar:* $${o.totalLocal.toFixed(2)} (${o.metodoPago})\n\n` +
      `Por favor, confirmar disponibilidad para realizar esta entrega. ¡Gracias!`;
      
    window.open(`https://wa.me/3756543610?text=${encodeURIComponent(msg)}`, '_blank');
    setShowScheduler(false);
  };

  const handleAction = async (action) => {
    setLoading(action);
    await onAction(o, action);
    setLoading('');
  };
  const subtotal = o.items.reduce((sum, i) => sum + (i[7] || 0), 0);
  const statusColors = { Pendiente: 'badge-amber', Confirmado: 'badge-amber', Aceptado: 'badge-info', Listo: 'badge-blue', Entregado: 'badge-green', Rechazado: 'badge-red' };
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
        <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong>PIN de Retiro/Entrega:</strong> 
          <span style={{ color: 'var(--red-600)', fontWeight: 'bold', fontSize: '1.1rem', background: '#fff1f2', padding: '2px 8px', borderRadius: '4px' }}>
            {o.numConfirmacion || 'N/A'}
          </span>
        </p>
        <p><strong>Dirección:</strong> {o.direccion}</p>
        <p><strong>Pago:</strong> {o.metodoPago}</p>
        {String(o.metodoPago).toLowerCase().includes('efectivo') && (
          <p style={{ color: 'var(--amber-600)', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '4px', background: '#fffbeb', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fef3c7' }}>
            ⚠️ El pedido no fue pagado aún
          </p>
        )}
        {(String(o.tipoEntrega).toLowerCase().includes('env') || o.tipoEntrega === 'Con Envío') && (
          <p><strong>Repartidor:</strong> <span style={{ color: 'var(--blue-600)', fontWeight: 'bold' }}>{o.repartidorNombre || 'Buscando...'}</span> {o.repartidorTelefono && <span style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginLeft: 8 }}>({o.repartidorTelefono})</span>}</p>
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
            {isShop ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button 
                    className="btn btn-primary btn-sm"
                    style={{ background: '#25D366', borderColor: '#25D366', color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => {
                      if (o.clienteTelefono) {
                        const cleanedPhone = o.clienteTelefono.replace(/\D/g, '');
                        const text = encodeURIComponent(`Hola ${o.nombreCliente}, nos comunicamos por tu pedido #${o.idPedido}.`);
                        window.open(`https://wa.me/${cleanedPhone}?text=${text}`, '_blank');
                      } else {
                        toast.error('El usuario no tiene un teléfono de contacto registrado');
                      }
                    }}
                  >
                    💬 Coordinar Entrega
                  </button>

                  <button 
                    className="btn btn-success btn-sm" 
                    disabled={loading} 
                    onClick={() => handleAction('Entregado')}
                  >
                    {loading === 'Entregado' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="spinner spinner-white" style={{ width: 16, height: 16 }} /> Cargando...
                      </span>
                  ) : '✓ Entregado'}
                  </button>

                  <button 
                    className="btn btn-sm" 
                    style={{ background: 'var(--red-500)', color: '#fff' }} 
                    disabled={loading} 
                    onClick={() => onAction(o, 'RechazarClick')}
                  >
                    {isOnlinePayment ? '💸 Gestionar Devolución' : '✕ Rechazar Pedido'}
                  </button>
                </div>

                {(String(o.tipoEntrega).toLowerCase().includes('env') || o.tipoEntrega === 'Con Envío') && (
                  <div style={{ display: 'flex', width: '100%' }}>
                    <button 
                      className="btn btn-primary btn-sm"
                      style={{ background: '#0284c7', borderColor: '#0284c7', color: 'white', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onClick={() => setShowScheduler(!showScheduler)}
                    >
                      🛵 Solicitar Repartidor Wepi
                    </button>
                  </div>
                )}

                {showScheduler && (
                  <div style={{ 
                    marginTop: 4, 
                    padding: 12, 
                    background: '#f8fafc', 
                    borderRadius: 8, 
                    border: '1px solid #cbd5e1',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    width: '100%'
                  }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155' }}>
                      📅 Programar Entrega (repartidor Wepi)
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Fecha</label>
                        <input 
                          type="date" 
                          className="form-input" 
                          style={{ padding: '6px 10px', fontSize: '0.85rem', width: '100%', margin: 0 }}
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Horario / Rango</label>
                        <input 
                          type="text" 
                          placeholder="Ej: 14:00 o 18:00 a 20:00" 
                          className="form-input" 
                          style={{ padding: '6px 10px', fontSize: '0.85rem', width: '100%', margin: 0 }}
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                      <button 
                        type="button"
                        className="btn btn-sm btn-secondary" 
                        style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                        onClick={() => setShowScheduler(false)}
                      >
                        Cancelar
                      </button>
                      <button 
                        type="button"
                        className="btn btn-sm btn-success" 
                        style={{ padding: '4px 12px', fontSize: '0.8rem', background: '#0284c7', borderColor: '#0284c7' }}
                        onClick={handleConfirmRequestDriver}
                      >
                        Confirmar y Solicitar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {(isShop ? ['Pendiente', 'Confirmado'] : ['Confirmado']).includes(o.estadoActual) ? (
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
