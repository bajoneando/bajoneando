import * as React from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useJsApiLoader } from '@react-google-maps/api';
import * as api from '../services/api';
import { iniciarPagoMercadoPago } from '../services/mercadopago';
import { isValidEmail } from '../utils/validation';
import toast from 'react-hot-toast';
import AddressSelector from '../components/AddressSelector';
import HelpChatbot from '../components/HelpChatbot';
import CountdownTimer from '../components/CountdownTimer';
import { isLocalOpen as isLocalOpenFlexible, getNextStatusChange } from '../utils/businessHours';
import { evaluatePromotions } from '../utils/promoEngine';
import { getCitySlug, citiesMatch } from '../utils/city';
import { Capacitor } from '@capacitor/core';
import './PruebasWalletApp.css';

const GOOGLE_MAPS_LIBRARIES = ['places'];

const getCityFromSlug = (str) => {
  if (!str) return null;
  try {
    const decoded = decodeURIComponent(str);
    const norm = decoded.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (norm === 'obera') return 'Oberá';
    if (norm === 'santo tome' || norm === 'santo-tome') return 'Santo Tomé';
  } catch (e) {
    console.error(e);
  }
  return null;
};

const getInactiveCityFromSlug = (str) => {
  if (!str) return null;
  try {
    const decoded = decodeURIComponent(str);
    const norm = decoded.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (norm === 'alem' || norm === 'leandro-n-alem' || norm === 'leandro n alem' || norm === 'l-n-alem') return 'Alem (Misiones)';
    if (norm === 'apostoles' || norm === 'apóstoles') return 'Apóstoles (Misiones)';
    if (norm === 'goya') return 'Goya (Corrientes)';
  } catch (e) {
    console.error(e);
  }
  return null;
};

export default function PruebasWalletApp() {
  const { ciudad, slug } = useParams();
  const location = useLocation();
  const isShopsMode = location.pathname.startsWith('/shops');
  console.log("🚀 PruebasWalletApp: Initialization started, isShopsMode:", isShopsMode);
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
  
  const { user, loginAsUser, loginWithGoogle, logoutUser: doLogout, updateUserAddress } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();

  const [activeCity, setActiveCity] = React.useState(() => {
    try {
      const decodedPath = decodeURIComponent(window.location.pathname);
      const path = decodedPath.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const segments = path.split('/').filter(Boolean);
      if (segments.length >= 2) {
        const maybeCitySegment = segments[1];
        const matchedCity = getCityFromSlug(maybeCitySegment);
        if (matchedCity) {
          sessionStorage.setItem('sessionCity', matchedCity);
          localStorage.setItem('guestCiudad', matchedCity);
          return matchedCity;
        }
      }
    } catch (e) {
      console.error(e);
    }
    const sessionCity = sessionStorage.getItem('sessionCity');
    return sessionCity || null;
  });

  React.useEffect(() => {
    const getOtaVersion = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const { OtaKit } = await import('@otakit/capacitor-updater');
          const state = await OtaKit.getState();
          if (state?.current?.version) setOtaVersion('v' + state.current.version);
        }
      } catch (e) { console.error('Error fetching ota version', e); }
    };
    getOtaVersion();


    try {
      const decodedPath = decodeURIComponent(location.pathname);
      const path = decodedPath.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const segments = path.split('/').filter(Boolean);
      let targetSegment = null;
      if (segments.length >= 2) {
        targetSegment = segments[1];
      } else if (segments.length === 1 && (segments[0] !== 'pedir' && segments[0] !== 'shops' && segments[0] !== 'p')) {
        targetSegment = segments[0];
      }

      if (targetSegment) {
        const matchedCity = getCityFromSlug(targetSegment);
        if (matchedCity && activeCity !== matchedCity) {
          setActiveCity(matchedCity);
          sessionStorage.setItem('sessionCity', matchedCity);
          localStorage.setItem('guestCiudad', matchedCity);
        } else if (!matchedCity) {
          const inactiveMatched = getInactiveCityFromSlug(targetSegment);
          if (inactiveMatched) {
            setInactiveCityModal(inactiveMatched);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [location.pathname, activeCity]);

  // ── DETECTOR CRM: VISITA_SIN_COMPRA ──
  React.useEffect(() => {
    if (!user?.id) return;
    // Si el usuario ya realizó pedidos en la plataforma, no es una visita sin compra
    if (user.ya_realizo_pedidos) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const lastVisitLogged = localStorage.getItem(`wepi_last_crm_visit_logged_${user.id}`);
    if (lastVisitLogged === todayStr) return;

    const timer = setTimeout(async () => {
      const hasCompletedOrder = sessionStorage.getItem('wepi_order_completed_time');
      if (hasCompletedOrder) return;
      if (cart.items && cart.items.length > 0) return;

      try {
        // Verificar en la DB si el usuario tiene pedidos en su historial
        const { data: userOrders } = await api.supabase
          .from('pedidos_general')
          .select('id')
          .eq('usuario_id', user.id)
          .limit(1);

        if (userOrders && userOrders.length > 0) return;

        localStorage.setItem(`wepi_last_crm_visit_logged_${user.id}`, todayStr);
        api.adminLogCRMEvent(user.id, 'VISITA_SIN_COMPRA', { path: location.pathname }).catch(e => console.error("Error CRM visita sin compra:", e));
      } catch (e) {
        console.warn("Visita sin compra check skipped:", e.message);
      }
    }, 45000);

    return () => clearTimeout(timer);
  }, [user?.id, user?.ya_realizo_pedidos, location.pathname, cart.items]);

  const selectCity = React.useCallback((city) => {
    setActiveCity(city);
    sessionStorage.setItem('sessionCity', city);
    localStorage.setItem('guestCiudad', city);
    toast.success(`Ciudad seleccionada: ${city}`, { icon: '📍' });
  }, []);

  React.useEffect(() => {
    const sessionCity = sessionStorage.getItem('sessionCity');
    if (!sessionCity) {
      setActiveCity(null);
    }
  }, [user?.ciudad]);

  // Detección y Registro de Métricas de Clic desde Emails
  React.useEffect(() => {
    try {
      const searchParams = new URLSearchParams(location.search);
      const isEmailRef = searchParams.get('ref') === 'email' || 
                         searchParams.get('utm_source') === 'email' || 
                         searchParams.get('email_ref') === 'true';
      if (isEmailRef) {
        const campaign = searchParams.get('campaign') || searchParams.get('utm_campaign') || 'Campaña General';
        const cityParam = searchParams.get('city') || activeCity || 'Todas';
        const sessionKey = `logged_email_click_${campaign}_${cityParam}`;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, 'true');
          api.logEmailClickMetric({ campaign, ciudad: cityParam, path: location.pathname });
        }
      }
    } catch (e) {
      console.error("Error logging email click metric:", e);
    }
  }, [location.search, location.pathname, activeCity]);

  const getAbbreviatedCity = (city) => {
    if (!city) return 'Seleccionar';
    const norm = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (norm.includes('santo tome')) return 'ST';
    if (norm.includes('obera')) return 'OBE';
    return city;
  };

  const handleBadgeClick = () => {
    sessionStorage.removeItem('sessionCity');
    setActiveCity(null);
    navigate('/pedir');
  };

  // PWA states and deferred prompt
  const [deferredPrompt, setDeferredPrompt] = React.useState(null);
  const [showConfirmedModal, setShowConfirmedModal] = React.useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = React.useState('');
  const [hasAnsweredSurvey, setHasAnsweredSurvey] = React.useState(false);
  const [surveyStepActive, setSurveyStepActive] = React.useState(false);
  const [surveyQuiereApp, setSurveyQuiereApp] = React.useState(null);
  const [surveyMotivo, setSurveyMotivo] = React.useState('');
  const [surveyDispositivo, setSurveyDispositivo] = React.useState('');
  const [surveySubmitting, setSurveySubmitting] = React.useState(false);
  const [showPwaSteps, setShowPwaSteps] = React.useState(false);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [notificationPermission, setNotificationPermission] = React.useState(
    window.Notification ? Notification.permission : 'default'
  );
  const [showNotificationBanner, setShowNotificationBanner] = React.useState(false);

  // Inactive cities popup states
  const [inactiveCityModal, setInactiveCityModal] = React.useState(null);
  const [leadForm, setLeadForm] = React.useState({ nombre: '', whatsapp: '', email: '' });
  const [leadSubmitting, setLeadSubmitting] = React.useState(false);
  const [leadSubmitted, setLeadSubmitted] = React.useState(false);

  const openInactiveCityModal = (cityName) => {
    setInactiveCityModal(cityName);
    setLeadForm({ nombre: '', whatsapp: '', email: '' });
    setLeadSubmitted(false);
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    if (!leadForm.nombre.trim() || !leadForm.whatsapp.trim()) {
      toast.error('Por favor ingresa tu nombre y WhatsApp');
      return;
    }
    setLeadSubmitting(true);
    try {
      const res = await api.registrarInteresExpansion({
        nombre: leadForm.nombre.trim(),
        whatsapp: leadForm.whatsapp.trim(),
        email: leadForm.email.trim(),
        ciudad: inactiveCityModal
      });
      if (res.success) {
        setLeadSubmitted(true);
        toast.success(`¡Te anotamos con éxito para ${inactiveCityModal}!`, { icon: '🎉' });
      } else {
        toast.error('Ocurrió un error al registrarte');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error de conexión');
    } finally {
      setLeadSubmitting(false);
    }
  };



  React.useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  React.useEffect(() => {
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone || (navigator && navigator['standalone']);
    setIsStandalone(!!checkStandalone);

    const hasPermission = window.Notification && Notification.permission === 'granted';
    if (checkStandalone && !hasPermission) {
      setShowNotificationBanner(true);
    } else {
      setShowNotificationBanner(false);
    }
  }, [notificationPermission]);

  const handleRequestNotificationPermission = () => {
    if (window.Notification) {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
        if (permission === 'granted') {
          toast.success('¡Notificaciones activadas! 🔔');
          if (window.OneSignal) {
            window.OneSignal.Notifications.requestPermission();
          }
        } else {
          toast.error('Permiso de notificaciones denegado.');
        }
      });
    } else {
      toast.error('Tu navegador no soporta notificaciones.');
    }
  };

  const [locals, setLocals] = React.useState([]);
  const [menus, setMenus] = React.useState([]);
  const [menuTitle, setMenuTitle] = React.useState('');
  const [showMenus, setShowMenus] = React.useState(false);
  const [orderOrigin, setOrderOrigin] = React.useState('enlace_local');
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
  const getIsCashOrder = () => {
    if (metodoPago === 'efectivo') return true;
    try {
      const pendingRaw = localStorage.getItem('pendingOrderDataPruebas');
      if (pendingRaw) {
        const pendingData = JSON.parse(pendingRaw);
        return pendingData.metodoPago === 'efectivo';
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };
  const [hasActiveOrder, setHasActiveOrder] = React.useState(false);
  const [orderCount, setOrderCount] = React.useState(null);
  const [showRegretModal, setShowRegretModal] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [banners, setBanners] = React.useState([]);
  const [bannersLoading, setBannersLoading] = React.useState(true);
  const [currentBannerIndex, setCurrentBannerIndex] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);

  React.useEffect(() => {
    if (banners.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex(prev => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length, isPaused]);

  React.useEffect(() => {
    if (currentBannerIndex >= banners.length) {
      setCurrentBannerIndex(0);
    }
  }, [banners.length, currentBannerIndex]);
  const [promoItems, setPromoItems] = React.useState([]);
  const [allPromotions, setAllPromotions] = React.useState([]);
  const [loadingPromos, setLoadingPromos] = React.useState(false);
  const [walletDetailsOpen, setWalletDetailsOpen] = React.useState(false);

  // Home Optimization States
  const [homeLayout, setHomeLayout] = React.useState(() => ({
    dynamicTitle: '',
    dynamicLocales: [],
    promosOfDay: [],
    mostOrdered: [],
    newLocales: [],
    allLocales: [],
    categories: isShopsMode ? [
      { label: 'Hogar', type: 'Hogar', img: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=200&auto=format&fit=crop&q=80' },
      { label: 'Tecnología', type: 'Tecnología', img: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=200&auto=format&fit=crop&q=80' },
      { label: 'Moda', type: 'Moda', img: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=200&auto=format&fit=crop&q=80' },
      { label: 'Regalería', type: 'Regalería', img: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=200&auto=format&fit=crop&q=80' },
      { label: 'Deportes', type: 'Deportes', img: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=200&auto=format&fit=crop&q=80' },
      { label: 'Bebidas', type: 'Bebidas', img: 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=200&auto=format&fit=crop&q=80' }
    ] : [
      { label: 'Restaurante', type: 'Restaurante', img: 'https://i.postimg.cc/VLtZ23Km/descarga-(1)-(8).jpg' },
      { label: 'Helados', type: 'Heladería', img: 'https://i.postimg.cc/VLPKFCY9/buscamos-repartidores-(18).png' },
      { label: 'Cafetería', type: 'Cafetería', img: 'https://i.postimg.cc/HnYWFwgm/descarga-(1)-(13).jpg' },
      { label: 'Market', type: 'Market', img: 'https://i.postimg.cc/FFByJ1Gq/buscamos-repartidores-(38).png' },
      { label: 'Farmacia', type: 'Farmacia', img: 'https://i.postimg.cc/vBmn4dnT/buscamos-repartidores-(37).png' },
      { label: 'Bebidas', type: 'Bebidas', img: 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=200&auto=format&fit=crop&q=80' },
      { label: 'Carnicería', type: 'Carnicería', img: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=200&auto=format&fit=crop&q=80' },
      { label: 'SHOPS', type: 'SHOPS', img: 'https://i.postimg.cc/YqMqFDzf/wepi-(2).png' }
    ],
    dynamicBanner: '',
    dynamicRubros: [],
    exploreItems: [],
    featuredProLocales: [],
    recommendedPlusLocales: [],
    newFreemiumLocales: []
  }));

  // Wallet States
  const [walletBalance, setWalletBalance] = React.useState(null);
  const [walletBreakdown, setWalletBreakdown] = React.useState([]);
  const [useWallet, setUseWallet] = React.useState(false);
  const [walletConfig, setWalletConfig] = React.useState(null);
  const [allWalletConfigs, setAllWalletConfigs] = React.useState({});
  const [loadingConfig, setLoadingConfig] = React.useState(false);
  const [localCommission, setLocalCommission] = React.useState(0.15); // Default 15% (Despegue)
  const [userPromoUsage, setUserPromoUsage] = React.useState({});
  const [refreshingWallet, setRefreshingWallet] = React.useState(false);
  const [couponInput, setCouponInput] = React.useState('');
  const [appliedCoupon, setAppliedCoupon] = React.useState('');
  const [citiesList, setCitiesList] = React.useState([]);
  const [mpRedirectUrl, setMpRedirectUrl] = React.useState(null);
  const [acceptedOrder, setAcceptedOrder] = React.useState(null);
  
  const refreshWallet = async () => {
    if (user?.id) {
      const localId = selectedLocal?.id || (cart.items.length > 0 ? cart.items[0].local_id : null);
      try {
        const [bal, bdown] = await Promise.all([
          api.getUserWalletBalance(user.id, localId),
          api.getUserWalletBreakdown(user.id)
        ]);
        setWalletBalance(bal);
        setWalletBreakdown(bdown);
      } catch (err) {
        console.error("Error refreshing wallet:", err);
      }
    }
  };
  
  // States for Address Selector
  const [showAddressSelector, setShowAddressSelector] = React.useState(false);
  const [showProfileAddressSelector, setShowProfileAddressSelector] = React.useState(false);
  
  const [addressData, setAddressData] = React.useState({
    address: user?.address || '',
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
    let sid = sessionStorage.getItem('wepi_demand_session');
    if (!sid) {
      sid = 'SESS-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      sessionStorage.setItem('wepi_demand_session', sid);
    }
    return sid;
  }, []);

  const searchTimeout = React.useRef(null);
  const [exploreRubroFilter, setExploreRubroFilter] = React.useState('');
  const [exploreCatFilter, setExploreCatFilter] = React.useState('');
  const [targetMenuCategory, setTargetMenuCategory] = React.useState(null);
  const [discoveryItems, setDiscoveryItems] = React.useState([]);
  const [loadingDiscovery, setLoadingDiscovery] = React.useState(false);

  // States for Searching Driver
  const [searchingDriver, setSearchingDriver] = React.useState(false);
  const [foundDriver, setFoundDriver] = React.useState(null);
  const [driverSearchTimeout, setDriverSearchTimeout] = React.useState(false);
  const [showEsperaPanel, setShowEsperaPanel] = React.useState(false);
  const [enEsperaExtra, setEnEsperaExtra] = React.useState(false);
  const [showCancelOptIn, setShowCancelOptIn] = React.useState(false);
  const [searchSeconds, setSearchSeconds] = React.useState(0);
  const [pendingOrderId, setPendingOrderId] = React.useState(null);
  const [whatsappCheckoutOptIn, setWhatsappCheckoutOptIn] = React.useState(true);
  const [estimatedTime, setEstimatedTime] = React.useState(null);
  const [optInRegistered, setOptInRegistered] = React.useState(false);
  const [optInLoading, setOptInLoading] = React.useState(false);

  const handleRegisterWhatsappOptin = async () => {
    let phone = (user && user.telefono) || '';
    if (!phone) {
      phone = prompt("Ingresá tu número de WhatsApp con código de área (ej: 5493756543610):");
      if (!phone) return;
    }
    setOptInLoading(true);
    try {
      const res = await api.registerWhatsappOptin({
        phoneNumber: phone,
        ciudad: activeCity || 'Santo Tomé',
        pedidoId: pendingOrderId,
        userId: user?.id || null
      });

      if (res && res.error) {
        toast.error(res.error || 'Por favor ingresá un número de teléfono válido');
      } else {
        setOptInRegistered(true);
        toast.success('¡Listo! Te avisaremos por WhatsApp apenas haya repartidores disponibles. 🛵');
        
        // Enviar plantilla "sin_repartidores" como confirmación por WhatsApp
        api.sendWhatsappTemplateMessage({
          to: phone,
          templateName: 'sin_repartidores',
          languageCode: 'es_AR'
        }).catch(err => console.error("Error enviando plantilla sin_repartidores en opt-in:", err));
      }
    } catch (e) {
      console.error("Opt-in error:", e);
      toast.error('Error al registrar aviso por WhatsApp');
    } finally {
      setOptInLoading(false);
    }
  };


  // Mundial 2026: States and checking logic for points earned (Commented out/Deleted)
  // const [oldMundialPoints, setOldMundialPoints] = React.useState(0);
  // const [oldMundialSobres, setOldMundialSobres] = React.useState(0);
  // const [isNewMundialUser, setIsNewMundialUser] = React.useState(false);
  // const [mundialAward, setMundialAward] = React.useState(null);
  // const [showMundialPopup, setShowMundialPopup] = React.useState(false);

  // ─── Estado y Efectos para Tarifas de Envío Multi-ciudad ───
  const [ciudadesConfig, setCiudadesConfig] = React.useState([]);
  const [isOutofCoverage, setIsOutofCoverage] = React.useState(false);

  React.useEffect(() => {
    const loadCities = async () => {
      try {
        const data = await api.getCiudadesConfig();
        setCiudadesConfig(data);
      } catch (err) {
        console.error("Error loading cities config for checkout:", err);
      }
    };
    loadCities();
  }, []);

  React.useEffect(() => {
    if (!cart) return;

    const currentLocal = selectedLocal || (cart.items.length > 0 ? locals.find(l => l.id === cart.items[0].local_id) : null);
    if (!currentLocal) {
      cart.setCustomShippingCost(null);
      setIsOutofCoverage(false);
      return;
    }

    const calculateFee = async () => {
      try {
        const city = currentLocal.ciudad || 'Santo Tomé';
        const slugify = (text) => 
          String(text)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');

        const citySlug = slugify(city);
        
        let destination = null;
        if (addressData?.lat && addressData?.lng) {
          destination = { lat: Number(addressData.lat), lng: Number(addressData.lng) };
        } else if (addressData?.address) {
          destination = addressData.address;
        }

        if (cart.deliveryType === 'retiro') {
          cart.setCustomShippingCost(null);
          setIsOutofCoverage(false);
          return;
        }

        if (destination) {
          const res = await api.calculateDeliveryFeeByCity(citySlug, destination);
          if (res.unavailable) {
            setIsOutofCoverage(true);
            cart.setCustomShippingCost(res.deliveryFee);
          } else {
            setIsOutofCoverage(false);
            cart.setCustomShippingCost(res.deliveryFee);
          }
        } else {
          const config = ciudadesConfig.find(c => slugify(c.ciudad) === citySlug);
          const defaultMin = config ? Number(config.min_delivery_fee) : 2000;
          cart.setCustomShippingCost(defaultMin);
          setIsOutofCoverage(false);
        }
      } catch (err) {
        console.error("Error calculating dynamic shipping fee:", err);
        cart.setCustomShippingCost(2000);
        setIsOutofCoverage(false);
      }
    };

    calculateFee();
  }, [ciudadesConfig, selectedLocal, locals, cart.items, addressData?.lat, addressData?.lng, addressData?.address, cart.deliveryType]);

  const getTimeBasedTitle = React.useCallback(() => {
    if (isShopsMode) {
      return { 
          title: "Vidriera Digital — Tiendas Locales", 
          banner: "https://i.postimg.cc/mZ8ZgHZt/Gemini-Generated-Image-6hv0ff6hv0ff6hv0.png",
          rubros: ['Hogar', 'Tecnología', 'Moda', 'Regalería', 'Deportes', 'Bebidas'],
          marketCats: []
      };
    }
    const hour = new Date().getHours();
    
    // 00 a 06 hs (antojo nocturno)
    if (hour >= 0 && hour < 6) return { 
        title: "Antojo nocturno... ¿Sale algo?", 
        banner: "https://i.postimg.cc/q7vSVXZn/Gemini-Generated-Image-n0aom0n0aom0n0ao.png",
        rubros: ['Restaurante', 'Heladería', 'Market', 'Bebidas'],
        marketCats: ['Golosinas', 'Snacks', 'Bebidas']
    };
    // 06 a 11 hs (desayuno)
    if (hour >= 6 && hour < 11) return { 
        title: "¡Buenos días! Un rico desayuno", 
        banner: "https://i.postimg.cc/LsDCxY9K/Gemini-Generated-Image-muhz58muhz58muhz.png",
        rubros: ['Cafetería', 'Market', 'Bebidas'],
        marketCats: ['Snacks', 'Bebidas']
    };
    // 11 hs a 13 hs (almuerzo)
    if (hour >= 11 && hour < 13) return { 
        title: "Hora del almuerzo: Pedí algo rico", 
        banner: "https://i.postimg.cc/d1Dbdm8W/Gemini-Generated-Image-py0z0lpy0z0lpy0z.png",
        rubros: ['Restaurante', 'Market', 'Bebidas'],
        marketCats: ['Bebidas']
    };
    // 13 hs a 16 hs (helado y postre)
    if (hour >= 13 && hour < 16) return { 
        title: "Postres y Tentaciones", 
        banner: "https://i.postimg.cc/853qbJ4k/Gemini-Generated-Image-wcc6vbwcc6vbwcc6.png",
        rubros: ['Heladería', 'Market', 'Bebidas'],
        marketCats: ['Golosinas']
    };
    // 16 a 20 hs (merienda)
    if (hour >= 16 && hour < 20) return { 
        title: "Merienda: Un break para vos", 
        banner: "https://i.postimg.cc/JzgG4Bqb/Gemini-Generated-Image-nut1r8nut1r8nut1.png",
        rubros: ['Cafetería', 'Heladería', 'Market', 'Bebidas'],
        marketCats: ['Snacks', 'Bebidas']
    };
    // 20 a 00 hs (cena)
    if (hour >= 20 || hour < 0) return { 
        title: "¿Qué pedimos para cenar?", 
        banner: "https://i.postimg.cc/d1Dbdm8W/Gemini-Generated-Image-py0z0lpy0z0lpy0z.png",
        rubros: ['Restaurante', 'Market', 'Bebidas'],
        marketCats: ['Bebidas']
    };
    
    // Default
    return { 
        title: "¿Qué se te antoja hoy?", 
        banner: "https://i.postimg.cc/d1Dbdm8W/Gemini-Generated-Image-py0z0lpy0z0lpy0z.png",
        rubros: ['Restaurante', 'Bebidas'],
        marketCats: []
    };
  }, [isShopsMode]);

  const getBoostedLocales = React.useCallback((locs) => {
    const PLAN_PRO = '87bdad7f-51cf-4c9c-ae64-ebab8b07b105';
    const PLAN_PLUS = 'ab9be1bd-f535-476e-90f4-f03ba074ba7d';
    return [...locs].sort((a, b) => {
      const isProA = a.plan_id === PLAN_PRO || a.plan_id?.includes('PRO');
      const isProB = b.plan_id === PLAN_PRO || b.plan_id?.includes('PRO');
      const isPlusA = a.plan_id === PLAN_PLUS || a.plan_id?.includes('PLUS');
      const isPlusB = b.plan_id === PLAN_PLUS || b.plan_id?.includes('PLUS');

      const weightA = isProA ? 3 : (isPlusA ? 2 : 1);
      const weightB = isProB ? 3 : (isPlusB ? 2 : 1);
      
      if (weightA !== weightB) return weightB - weightA;
      // Deterministic "performance" (pseudo-random based on id)
      const perfA = (parseInt(a.id?.split('-')[1]) || 0) % 100;
      const perfB = (parseInt(b.id?.split('-')[1]) || 0) % 100;
      return perfB - perfA;
    });
  }, []);

  const getBadgeForLocal = React.useCallback((local, index) => {
    // Máximo 30-40% (1 de cada 3)
    if (index % 3 !== 0) return null;
    
    const PLAN_PRO = '87bdad7f-51cf-4c9c-ae64-ebab8b07b105';
    const PLAN_PLUS = 'ab9be1bd-f535-476e-90f4-f03ba074ba7d';
    const isPro = local.plan_id === PLAN_PRO || local.plan_id?.includes('PRO');
    const isPlus = local.plan_id === PLAN_PLUS || local.plan_id?.includes('PLUS');
    
    if (isPro) {
      // Alternar entre Top y Destacado
      return (index % 6 === 0) ? { label: 'Top', type: 'top' } : { label: 'Destacado', type: 'destacado' };
    }
    if (isPlus) {
      return { label: 'Recomendado', type: 'recomendado' };
    }
    return null;
  }, []);
  
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

  console.log("🚀 PruebasWalletApp: Logic functions defined");

  const calculateDiscountedPrice = React.useCallback((item) => {
    if (!item) return 0;
    let basePrice = Number(item.precio);
    let finalPrice = basePrice;
    
    // 1. Evaluar Promociones Unificadas (Engine)
    // Filtramos promos de tipo 'diario', 'cupon', 'combo' que apliquen directamente al precio
    const promoResults = evaluatePromotions({
      cart: { 
        totalPrice: basePrice, 
        items: [{ ...item, cantidad: 1, qty: 1 }],
        metodoPago: metodoPago // Inyectar método actual
      },
      user,
      userPromoUsage,
      promotions: allPromotions,
      currentLocalId: item.local_id
    });

    if (promoResults.discountTotal > 0) {
      finalPrice = basePrice - promoResults.discountTotal;
    } else {
      // 2. Fallback: Lógica Antigua (Descuento estático en tabla menu o local)
      if (item.descuento > 0) {
        finalPrice = basePrice * (1 - Number(item.descuento) / 100);
      } else {
        const loc = locals.find(l => l.id === item.local_id);
        const discountDays = item.local_dias_descuento || item.dias_descuento || loc?.dias_descuento || [];
        const generalDiscount = Number(item.local_descuento_general || item.descuento_general || loc?.descuento_general || 0);
        const categoryDiscount = item.local_categoria_descuento || item.categoria_descuento || loc?.categoria_descuento || '';
        
        if (generalDiscount > 0 && discountDays.length > 0) {
          const today = new Date().toLocaleString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
          const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          const todayNorm = normalize(today);
          
          const isCorrectDay = discountDays.some(d => normalize(d) === todayNorm);
          const isCorrectCategory = !categoryDiscount || categoryDiscount === item.categoria;

          if (isCorrectDay && isCorrectCategory) {
            finalPrice = basePrice * (1 - generalDiscount / 100);
          }
        }
      }
    }
    
    return Math.round(finalPrice);
  }, [allPromotions, user, userPromoUsage, locals, metodoPago]);

  const renderCreditBadge = React.useCallback((item, isPremium = false) => {
    if (!item) return null;
    const localId = item.local_id || item.id || selectedLocal?.id;
    
    const promoResults = evaluatePromotions({
      cart: { 
        totalPrice: calculateDiscountedPrice(item),
        metodoPago: metodoPago 
      },
      user,
      orderCount,
      userPromoUsage,
      promotions: allPromotions,
      currentLocalId: localId
    });

    if (promoResults.potentialCashback <= 0) return null;

    const earned = promoResults.potentialCashback;
    const promoCredito = promoResults.appliedPromos.find(p => p.tipo === 'credito');
    const isFirstOrderPromo = promoCredito?.triggers?.primera_compra === true;
    
    if (isPremium) {
      const isLocalRestricted = promoCredito?.requisitos?.uso_local_exclusivo === true;
      const localName = item.local_nombre || selectedLocal?.nombre || '';
      const locationText = isLocalRestricted ? ` en ${localName}` : '';
      const orderText = isFirstOrderPromo ? 'en tu 1er pedido' : 'para tu proxima compra';
      
      return (
        <div className="credit-earn-label animate-fade-in" style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: '-2px', marginBottom: '4px' }}>
          Ganás ${earned.toLocaleString()} de credito {orderText}{locationText}
        </div>
      );
    }

    // Texto simplificado para Home
    const homeLabel = isFirstOrderPromo 
      ? `+$${earned.toLocaleString()} en 1er pedido` 
      : `Ganás $${earned.toLocaleString()}`;

    return (
      <div className="credit-earn-label animate-fade-in">
        {homeLabel}
      </div>
    );
  }, [allPromotions, calculateDiscountedPrice, selectedLocal, user, userPromoUsage]);
  
  const doesItemEarnCredit = React.useCallback((item) => {
    if (!item) return false;
    const localId = item.local_id || item.id || selectedLocal?.id;
    const promoResults = evaluatePromotions({
      cart: { 
        totalPrice: calculateDiscountedPrice(item),
        metodoPago: metodoPago 
      },
      user,
      orderCount,
      userPromoUsage,
      promotions: allPromotions,
      currentLocalId: localId
    });
    return promoResults.potentialCashback > 0;
  }, [allPromotions, calculateDiscountedPrice, selectedLocal, user, userPromoUsage]);


  const calculateCheckoutTotals = React.useCallback((P, E, method, appliedFeeEnvio = 0) => {
    // 1. Evaluar Promociones Unificadas
    const localId = cart.items.length > 0 ? cart.items[0].local_id : null;
    
    // IMPORTANTE: Crear una versión del carrito con precios ORIGINALES (pero incluyendo el descuento del comercio) para el motor
    const grossItems = cart.items.map(i => {
      const basePrice = Number(i.precioOriginal || i.precio);
      let merchantPrice = basePrice;
      
      if (i.descuento > 0) {
        merchantPrice = basePrice * (1 - Number(i.descuento) / 100);
      } else {
        const loc = locals.find(l => l.id === i.local_id);
        const discountDays = i.local_dias_descuento || i.dias_descuento || loc?.dias_descuento || [];
        const generalDiscount = Number(i.local_descuento_general || i.descuento_general || loc?.descuento_general || 0);
        const categoryDiscount = i.local_categoria_descuento || i.categoria_descuento || loc?.categoria_descuento || '';
        
        if (generalDiscount > 0 && discountDays.length > 0) {
          const today = new Date().toLocaleString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
          const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          const todayNorm = normalize(today);
          
          const isCorrectDay = discountDays.some(d => normalize(d) === todayNorm);
          const isCorrectCategory = !categoryDiscount || categoryDiscount === i.categoria;

          if (isCorrectDay && isCorrectCategory) {
            merchantPrice = basePrice * (1 - generalDiscount / 100);
          }
        }
      }
      
      return {
        ...i,
        precio: Math.round(merchantPrice)
      };
    });
    
    const grossP = grossItems.reduce((sum, i) => sum + (i.precio * i.qty), 0);

    const promoResults = evaluatePromotions({
      cart: { 
        totalPrice: grossP, // Base bruta
        deliveryFee: E, 
        items: grossItems, // Items con precios originales
        metodoPago: method, // El método elegido en el selector
        couponCode: appliedCoupon
      },
      user,
      orderCount,
      userPromoUsage,
      promotions: allPromotions,
      currentLocalId: localId
    });

    // Aplicar descuentos de promos al subtotal bruto y envío
    const discountedP = Math.max(0, grossP - (promoResults.discountTotal || 0));
    const discountedE = promoResults.freeShipping ? 0 : Math.max(0, E - (promoResults.shippingDiscount || 0));

    // Si es Shops, no se cobra comisión por venta de productos, solo el valor de envío queda para la plataforma
    const net_commission = isShopsMode ? 0 : (discountedP * localCommission);
    const net_local = isShopsMode ? discountedP : (discountedP - net_commission);
    const total_net = discountedP + discountedE;
    
    const cuponPromo = promoResults.appliedPromos.find(p => p.tipo === 'cupon');
    const appliedCuponId = cuponPromo ? cuponPromo.id : null;
    const descuentoCupon = cuponPromo ? ((promoResults.discountTotal || 0) + (promoResults.shippingDiscount || 0)) : 0;
    
    let result;
    // Apply fee by default (no selection or Mercado Pago). Remove only if explicitly 'efectivo'.
    if (method !== 'efectivo') {
      const total_con_fee = total_net + appliedFeeEnvio;
      const marketplace_fee = isShopsMode ? (discountedE + appliedFeeEnvio) : (discountedE + net_commission + appliedFeeEnvio);
      result = {
        total: Math.round(total_con_fee),
        product_total: P,
        discounted_product_total: discountedP,
        delivery_fee: E,
        fee_envio: appliedFeeEnvio,
        discounted_delivery_fee: discountedE,
        commission: Math.round(net_commission),
        mp_fee: 0,
        merchant_payout: Math.round(total_con_fee - marketplace_fee),
        platform_gross: Math.round(marketplace_fee),
        platform_net: Math.round(marketplace_fee),
        appliedPromos: promoResults.appliedPromos,
        appliedCuponId,
        descuentoCupon
      };
    } else {
      // (Efectivo)
      result = {
        total: Math.round(discountedP + discountedE),
        product_total: P,
        discounted_product_total: discountedP,
        delivery_fee: E,
        fee_envio: 0,
        discounted_delivery_fee: discountedE,
        commission: Math.round(net_commission),
        mp_fee: 0,
        merchant_payout: Math.round(net_local),
        platform_gross: 0,
        platform_net: isShopsMode ? Math.round(discountedE) : Math.round(net_commission + discountedE),
        appliedPromos: promoResults.appliedPromos,
        appliedCuponId,
        descuentoCupon
      };
    }

    // 2. Validación de uso de Billetera (Soberanía de Promo Admin)
    let walletValidation = { canUse: true, reason: null };
    let maxDiscount = 0;

    if (walletBalance > 0) {
      // Determinar si es primer pedido para el filtrado de promo de uso
      const hasOrdered = user?.ya_realizo_pedidos === true || user?.ya_realizo_pedidos === 'true' || user?.ya_realizo_pedidos === 1 || user?.ya_realizo_pedidos === '1' || user?.ya_realizo_pedidos === 'TRUE' || (orderCount > 0);
      const isFirstOrder = !user || !user.id || !hasOrdered;

      // Buscar la configuración maestra (Promo Activa de Crédito que aplique al usuario)
      const creditPromo = allPromotions.find(p => {
        if (p.tipo !== 'credito' || !p.activo) return false;
        const triggers = p.triggers || {};
        const requisitos = p.requisitos || {};
        
        // Validar Primera Compra
        if (triggers.primera_compra === true && !isFirstOrder) return false;
        
        // Validar Método de Pago (Triggers)
        if (triggers.metodo_pago && triggers.metodo_pago !== 'todos' && method && method !== triggers.metodo_pago) return false;
        
        // Validar Método de Pago (Requisitos)
        if (requisitos.metodo_pago && requisitos.metodo_pago !== 'todos' && method && method !== requisitos.metodo_pago) return false;
        
        return true;
      });
      
      // Combinar requisitos: Prioridad Promo > Local Config > Global Config
      const currentLocalId = cart.items.length > 0 ? cart.items[0].local_id : null;
      const localConfig = allWalletConfigs[currentLocalId] || allWalletConfigs['global'] || {};
      
      const config = creditPromo 
        ? { ...localConfig, ...creditPromo.requisitos } // La promo sobreescribe al config
        : localConfig;

      // 1. Compra Mínima
      const minUso = Number(config.min_compra_uso || config.compra_minima_uso || 0);
      if (discountedP < minUso) {
        walletValidation = {
          canUse: false,
          reason: `Compra mínima de $${minUso.toLocaleString()} para usar crédito`
        };
        maxDiscount = 0;
      } else {
        // 2. Si califica, aplicamos los topes de sostenibilidad
        maxDiscount = walletBalance;

        // Tope % (max_porcentaje_uso o max_porcentaje_pedido)
        const perc = Number(config.max_porcentaje_uso || config.max_porcentaje_pedido || 100);
        if (perc < 100) {
          maxDiscount = Math.min(maxDiscount, Math.round(discountedP * (perc / 100)));
        }

        // Tope Monto ($)
        const topeValue = Number(config.tope_max_descuento || 999999);
        if (topeValue < 999999) {
          maxDiscount = Math.min(maxDiscount, topeValue);
        }
      }
    }

    result.walletValidation = walletValidation;
    result.maxAvailableDiscount = maxDiscount;
    result.potentialCredit = promoResults.potentialCashback;

    if (useWallet && walletValidation.canUse) {
      const discount = Math.min(discountedP, maxDiscount);
      if (discount > 0) {
        result.total -= discount;
        result.walletDiscount = discount;
      }
    }
    
    return result;
  }, [walletBalance, walletBreakdown, walletConfig, allWalletConfigs, useWallet, cart.items, allPromotions, user, userPromoUsage, localCommission, appliedCoupon, locals]);


  const checkIsComingSoon = React.useCallback((local) => {
    if (!local) return false;
    const disp = local.disponible_desde || local.local_disponible_desde;
    if (disp) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parts = disp.split('-');
      const availableDate = new Date(parts[0], parts[1] - 1, parts[2]);
      if (today < availableDate) return true;
    }
    return false;
  }, []);

  const isLocalOpen = React.useCallback((local) => {
    if (!local) return false;

    const localId = local.local_id || local.id;
    // Si el objeto recibido ya cuenta con información de horarios, lo usamos directamente.
    // De lo contrario (ej: ítem de menú), buscamos el local en la lista de locales del estado.
    const hasHours = local.config_horarios || local.horario_apertura;
    const realLocal = hasHours ? local : ((locals.find(l => l.id === localId)) || local);
    
    // Mapeo de compatibilidad para items que vienen de api.getPromos() u otros joins
    const localToPass = {
      ...realLocal,
      disponible_desde: realLocal.disponible_desde || realLocal.local_disponible_desde
    };

    if (checkIsComingSoon(localToPass)) return false;

    // 2. Usar utilidad flexible
    return isLocalOpenFlexible(localToPass);
  }, [locals, checkIsComingSoon]);

  const getLocalStatusText = React.useCallback((local) => {
    if (!local) return null;
    if (checkIsComingSoon(local)) {
      return (
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.2' }}>
          <span style={{ fontWeight: '800', textTransform: 'uppercase', fontSize: '0.62rem', color: '#f59e0b' }}>Próximamente</span>
        </span>
      );
    }
    const isOpen = isLocalOpen(local);
    const statusStr = getNextStatusChange(local) || '';

    let mainText = isOpen ? 'Abierto' : 'Cerrado';
    let subText = null;

    if (isOpen) {
      if (statusStr.includes('cierra')) {
        const time = statusStr.replace('cierra', '').trim();
        subText = `HASTA ${time}`;
      } else if (statusStr.toLowerCase().includes('24hs')) {
        subText = '24 HS';
      }
    } else {
      if (statusStr.includes('abre')) {
        const time = statusStr.replace('abre', '').trim();
        subText = `ABRE ${time}`;
      }
    }

    return (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.2' }}>
        <span style={{ fontWeight: '800', textTransform: 'uppercase', fontSize: '0.62rem', color: isOpen ? '#2ecc71' : '#ef4444' }}>{mainText}</span>
        {subText && <span style={{ fontSize: '0.52rem', color: '#888', marginTop: '1px', fontWeight: '600' }}>{subText}</span>}
      </span>
    );
  }, [isLocalOpen, checkIsComingSoon]);

  React.useEffect(() => {
    console.log("🚀 PruebasWalletApp: Main data useEffect running, activeCity:", activeCity);
    api.trackDemandSignal('page_view', sessionId).catch(() => {});

    const loadHomeData = async () => {
      try {
        // 1. Cargar promociones activas, locales y configs de wallet primero para saber qué buscar
        const [allPrms, locsRaw, wcfgsRaw, citiesRaw] = await Promise.all([
          api.getActivePromotions(),
          api.getLocales(),
          api.getAllWalletConfigs(),
          api.getCiudadesConfig()
        ]);
        setAllPromotions(allPrms || []);
        setCitiesList(citiesRaw || []);

        // Filtrar locales por la ciudad activa y por tipo de servicio (Shops o Delivery)
        const currentCity = activeCity || 'Santo Tomé';
        const locs = (locsRaw || []).filter(l => 
          (l.ciudad || 'Santo Tomé') === currentCity && 
          (isShopsMode ? l.tipo_servicio === 'shops' : (l.tipo_servicio === 'delivery' || !l.tipo_servicio))
        );
        setLocals(locs || []);
        
        // Mapear configs de wallet por local_id para uso rápido
        const configMap = {};
        if (Array.isArray(wcfgsRaw)) {
          wcfgsRaw.forEach(c => {
            if (c.local_id) configMap[c.local_id] = c;
            else configMap['global'] = c;
          });
        }
        setAllWalletConfigs(configMap);
        
        // Extraer categorías que tienen promos específicas
        const targetCats = allPrms.flatMap(p => p.triggers?.categorias || []);
        
        // Extraer si hay promociones globales activas
        const hasGlobalPromo = allPrms.some(p => p.activo && p.triggers?.global);
        
        // Extraer locales que tienen:
        // a) Alguna promoción global activa (aplica a todos)
        // b) Descuento general activo
        // c) Configuración de Wallet activa (genera crédito)
        const targetLocalIds = (locs || []).filter(l => {
          if (hasGlobalPromo) return true;
          const hasGenDiscount = Number(l.descuento_general) > 0;
          const wcfg = configMap[l.id] || configMap['global'];
          const generatesCredit = wcfg && wcfg.activo && Number(wcfg.porcentaje_ganancia) > 0;
          return hasGenDiscount || generatesCredit;
        }).map(l => l.id);

        // 2. Cargar el resto de datos
        const [deks, bans, prms, most, expl] = await Promise.all([
          api.getBebidas(),
          api.getBanners(),
          api.getPromos(targetCats, targetLocalIds),
          api.getMostOrderedItems(),
          api.getExploreItems()
        ]);

        const allLocs = locs || [];
        const boosted = getBoostedLocales(allLocs);
        const timeInfo = getTimeBasedTitle();
        
        // El configMap ya se seteó arriba
 
        setDrinks(deks || []);
        const filteredBanners = (bans || []).filter(b => 
          !b.ciudad || b.ciudad === 'Todas' || b.ciudad === currentCity
        );
        setBanners(filteredBanners);
        setPromoItems(prms || []);
        setBannersLoading(false);
        setLoadingPromos(false);

        setHomeLayout(prev => {
          const PLAN_PRO = '87bdad7f-51cf-4c9c-ae64-ebab8b07b105';
          const PLAN_PLUS = 'ab9be1bd-f535-476e-90f4-f03ba074ba7d';
          const PLAN_FREEMIUM = 'b404e2f7-6716-499b-8ebf-200ce417e4cb';

          const proFound = boosted.filter(l => l.plan_id === PLAN_PRO).sort((a, b) => (isLocalOpen(b) ? 1 : 0) - (isLocalOpen(a) ? 1 : 0));
          const plusFound = boosted.filter(l => l.plan_id === PLAN_PLUS).sort((a, b) => (isLocalOpen(b) ? 1 : 0) - (isLocalOpen(a) ? 1 : 0));
          const freeFound = boosted.filter(l => l.plan_id === PLAN_FREEMIUM).sort((a, b) => (isLocalOpen(b) ? 1 : 0) - (isLocalOpen(a) ? 1 : 0));

          // Helper to format carousels: featured first + non-adjacent locals
          const formatCarouselItems = (sortedItems) => {
            if (!sortedItems || sortedItems.length === 0) return [];
            
            const PLAN_PRO = '87bdad7f-51cf-4c9c-ae64-ebab8b07b105';
            const result = [];
            let remaining = [...sortedItems];

            const featuredIndex = remaining.findIndex(item => {
              const loc = allLocs.find(l => l.id === item.local_id);
              return loc && loc.plan_id === PLAN_PRO;
            });

            if (featuredIndex !== -1) {
              result.push(remaining[featuredIndex]);
              remaining.splice(featuredIndex, 1);
            } else if (remaining.length > 0) {
              result.push(remaining[0]);
              remaining.splice(0, 1);
            }

            while (remaining.length > 0) {
              const lastLocalId = result[result.length - 1]?.local_id;
              const nextIndex = remaining.findIndex(item => item.local_id !== lastLocalId);
              
              if (nextIndex !== -1) {
                result.push(remaining[nextIndex]);
                remaining.splice(nextIndex, 1);
              } else {
                break; // strictly enforce no adjacent locales
              }
            }
            return result;
          };

          // Combinar candidatos: Promos específicas + Lo más pedido + Explorar
          const allCandidates = [
            ...(prms || []),
            ...(most || []),
            ...(expl || [])
          ];

          // Eliminar duplicados por ID
          const uniqueCandidates = Array.from(new Map(allCandidates.map(item => [item.id, item])).values());

          let rawPromos = uniqueCandidates.filter(p => {
            if (!p.imagen_url) return false;
            const l = allLocs.find(loc => loc.id === p.local_id);
            if (!l || !isLocalOpen(l)) return false;

            // Evaluar con el motor para detectar beneficios dinámicos
            const promoResults = evaluatePromotions({
              cart: { totalPrice: Number(p.precio), items: [{ ...p, qty: 1, cantidad: 1 }], deliveryFee: 500 },
              user,
              orderCount,
              userPromoUsage,
              promotions: allPrms,
              currentLocalId: p.local_id
            });

            const earnsCredit = promoResults.potentialCashback > 0;
            const hasFreeShipping = promoResults.freeShipping;
            const hasDynamicDiscount = promoResults.discountTotal > 0;
            const hasBaseDiscount = p.descuento > 0;
            const isCombo = p.categoria?.toLowerCase().includes('combo');
            const hasDayDiscount = calculateDiscountedPrice(p) < Number(p.precio);

            // Excluir COMBOS por pedido explícito
            if (isCombo) return false;

            return hasBaseDiscount || hasDayDiscount || earnsCredit || hasFreeShipping || hasDynamicDiscount;
          }).sort((a, b) => {
            const locA = allLocs.find(l => l.id === a.local_id);
            const locB = allLocs.find(l => l.id === b.local_id);
            const openA = isLocalOpen(locA) ? 1 : 0;
            const openB = isLocalOpen(locB) ? 1 : 0;
            if (openA !== openB) return openB - openA;
            const discA = Number(a.precio) - calculateDiscountedPrice(a);
            const discB = Number(b.precio) - calculateDiscountedPrice(b);
            return discB - discA;
          });

          let rawMostOrdered = (most || []).filter(item => {
            if (!item.imagen_url) return false;
            const l = allLocs.find(loc => loc.id === item.local_id);
            return !!l;
          }).sort((a, b) => {
            const locA = allLocs.find(l => l.id === a.local_id);
            const locB = allLocs.find(l => l.id === b.local_id);
            const openA = isLocalOpen(locA) ? 1 : 0;
            const openB = isLocalOpen(locB) ? 1 : 0;
            return openB - openA;
          });

          return {
            ...prev,
            dynamicTitle: timeInfo.title,
            dynamicBanner: timeInfo.banner,
            dynamicRubros: timeInfo.rubros,
            categories: (() => {
              const defaultCats = isShopsMode ? [
                { label: 'Hogar', type: 'Hogar', img: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=200&auto=format&fit=crop&q=80' },
                { label: 'Tecnología', type: 'Tecnología', img: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=200&auto=format&fit=crop&q=80' },
                { label: 'Moda', type: 'Moda', img: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=200&auto=format&fit=crop&q=80' },
                { label: 'Regalería', type: 'Regalería', img: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=200&auto=format&fit=crop&q=80' },
                { label: 'Deportes', type: 'Deportes', img: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=200&auto=format&fit=crop&q=80' },
                { label: 'Bebidas', type: 'Bebidas', img: 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=200&auto=format&fit=crop&q=80' }
              ] : [
                { label: 'Restaurante', type: 'Restaurante', img: 'https://i.postimg.cc/VLtZ23Km/descarga-(1)-(8).jpg' },
                { label: 'Helados', type: 'Heladería', img: 'https://i.postimg.cc/VLPKFCY9/buscamos-repartidores-(18).png' },
                { label: 'Cafetería', type: 'Cafetería', img: 'https://i.postimg.cc/HnYWFwgm/descarga-(1)-(13).jpg' },
                { label: 'Market', type: 'Market', img: 'https://i.postimg.cc/FFByJ1Gq/buscamos-repartidores-(38).png' },
                { label: 'Farmacia', type: 'Farmacia', img: 'https://i.postimg.cc/vBmn4dnT/buscamos-repartidores-(37).png' },
                { label: 'Bebidas', type: 'Bebidas', img: 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=200&auto=format&fit=crop&q=80' },
                { label: 'Carnicería', type: 'Carnicería', img: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=200&auto=format&fit=crop&q=80' },
                { label: 'SHOPS', type: 'SHOPS', img: 'https://i.postimg.cc/YqMqFDzf/wepi-(2).png' }
              ];

              const cityConf = (citiesRaw || []).find(c => c.ciudad === currentCity);
              if (cityConf && Array.isArray(cityConf.rubros_habilitados) && cityConf.rubros_habilitados.length > 0) {
                return defaultCats.filter(cat => 
                  cityConf.rubros_habilitados.includes(cat.type) || 
                  cityConf.rubros_habilitados.includes(cat.label)
                );
              }
              return defaultCats;
            })(),
            allLocales: boosted,
            dynamicLocales: boosted.filter(l => timeInfo.rubros.some(r => l.rubros?.includes(r) || l.rubro === r)).slice(0, 15),
            promosOfDay: formatCarouselItems(rawPromos).slice(0, 40),
            mostOrdered: formatCarouselItems(rawMostOrdered),
            newLocales: [...allLocs].filter(l => l.admin_status === 'Aceptado').sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 10),
            exploreItems: (expl || []).filter(item => {
              const l = allLocs.find(loc => loc.id === item.local_id);
              return !!l;
            }),
            featuredProLocales: proFound,
            recommendedPlusLocales: plusFound,
            newFreemiumLocales: freeFound.slice(0, 12)
          };
        });
      } catch (err) {
        console.error("Error loading home data:", err);
      }
    };

    loadHomeData();

    if (user) {
      api.getFavoritos(user.id).then(d => {
        if (Array.isArray(d)) setFavorites(d);
      }).catch(() => {});
      
      api.getMisPedidos(user.id).then(res => {
        setHasActiveOrder(!!(res.enCurso && res.enCurso.length > 0));
      }).catch(() => {});

      // Order Count & Promo Usage & Breakdown
      if (user?.id) {
        api.getUserOrderCount(user.id).then(res => setOrderCount(res.count)).catch(() => {});
        api.getUserPromoUsage(user.id).then(setUserPromoUsage).catch(() => {});
        api.getUserWalletBreakdown(user.id).then(setWalletBreakdown).catch(() => {});
      }
    } else {
      setOrderCount(null);
      setWalletBalance(0);
    }
  }, [user, sessionId, getBoostedLocales, getTimeBasedTitle, activeCity, isShopsMode]);
  React.useEffect(() => {
    const localId = selectedLocal?.id || (cart.items.length > 0 ? cart.items[0].local_id : null);
    
    // Reset config when local changes to avoid stale data
    setWalletConfig(null);

    if (localId && user?.id) {
      setLoadingConfig(true);
      api.getWalletConfigForLocal(localId)
        .then(setWalletConfig)
        .catch(console.error)
        .finally(() => setLoadingConfig(false));
      
      // Update balance respecting potential local restriction
      api.getUserWalletBalance(user.id, localId)
        .then(setWalletBalance)
        .catch(console.error);

      // Fetch history for the panel
      api.getUserWalletBreakdown(user.id)
        .then(setWalletBreakdown)
        .catch(() => {});
        
      // Fetch dynamic commission for the local
      api.getPlanInfo(localId)
        .then(res => {
          if (res.success && typeof res.comision_actual === 'number') {
            console.log(`📊 PruebasWalletApp: Comisión para local ${localId}: ${res.comision_actual}%`);
            setLocalCommission(res.comision_actual / 100);
          } else {
            setLocalCommission(0.15); // Fallback to 15%
          }
        })
        .catch(() => setLocalCommission(0.15));
    } else {
      setWalletConfig(null);
      setLocalCommission(0.15);
      if (user?.id) {
        api.getUserWalletBalance(user.id).then(setWalletBalance).catch(console.error);
        api.getUserWalletBreakdown(user.id).then(setWalletBreakdown).catch(() => {});
      }
    }
  }, [selectedLocal, cart.items, user?.id]);

  // Check if user has answered the App survey when confirmation modal is shown
  React.useEffect(() => {
    if (showConfirmedModal && user?.id) {
      api.getHasAnsweredSurvey(user.id).then(answered => {
        setHasAnsweredSurvey(answered);
        setSurveyStepActive(!answered);
      }).catch(err => {
        console.error("Error checking app survey answer status:", err);
        setSurveyStepActive(false);
      });
    } else if (!showConfirmedModal) {
      // Reset survey inputs when modal is closed
      setSurveyQuiereApp(null);
      setSurveyMotivo('');
      setSurveyDispositivo('');
    }
  }, [showConfirmedModal, user?.id]);

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
            setConfirmedOrderId(pendingData.pedidoId);
            setShowConfirmedModal(true);
            setSearchingDriver(false);
            setFoundDriver(null);
            setPendingOrderId(null);
            localStorage.removeItem('pendingOrderData');
            
            // Actualizar estado del pedido en la base de datos
            api.markOrderAsPaid(
              pendingData.pedidoId, 
              payment_id, 
              preference_id, 
              pendingData.externalReference
            ).then(async (res) => {
              if (res.success && user?.id) {
                // Refrescar balance de wallet tras pago exitoso
                api.getUserWalletBalance(user.id).then(setWalletBalance).catch(() => {});
                
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
    setTargetMenuCategory(null);
  }, [search]);

  const fetchMenusByLocal = React.useCallback((localId, catId = null, fromDirectLink = false) => {
    const local = (filteredLocals || locals).find(l => l.id === localId) || locals.find(l => l.id === localId);
    if (local && checkIsComingSoon(local)) {
      toast.error(`${local.nombre} estará disponible próximamente.`);
      return;
    }
    setLoadingMenus(true);
    setSelectedLocal(local);
    setOrderOrigin(fromDirectLink ? 'enlace_propio' : 'wepi');

    // Tracking: Local View
    api.trackDemandSignal('local_view', sessionId).catch(() => {});
    
    if (!fromDirectLink) {
      api.incrementarUsoMetrica(localId, 'visitas_totales').catch(() => {});
      api.incrementarUsoMetrica(localId, 'visitas_wepi').catch(() => {});
    }
    
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
  }, [locals, filteredLocals, checkIsComingSoon]);
  
  // Auto-scroll to category if coming from rubro click
  React.useEffect(() => {
    if (showMenus && menus.length > 0 && targetMenuCategory) {
      const timer = setTimeout(() => {
        const normalizedTarget = targetMenuCategory.toLowerCase().trim();
        const categories = Array.from(new Set(menus.map(m => m.categoria))).filter(Boolean);
        
        // Match logic: exact, partial, or special cases
        let match = categories.find(c => c.toLowerCase().trim() === normalizedTarget);
        if (!match) {
          match = categories.find(c => 
            c.toLowerCase().includes(normalizedTarget) || 
            normalizedTarget.includes(c.toLowerCase())
          );
        }
        if (!match && normalizedTarget.includes('helado')) {
          match = categories.find(c => c.toLowerCase().includes('helado'));
        }

        if (match) {
          console.log(`🎯 Auto-scrolling to category: ${match}`);
          const el = document.getElementById(`cat-${match}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [showMenus, menus, targetMenuCategory]);

  // Carga automática por slug (Landing Page de Local)
  React.useEffect(() => {
    if (slug) {
      // Si el slug es en realidad el nombre de una ciudad, no intentar cargarlo como local
      if (getCityFromSlug(slug)) {
        return;
      }
      console.log("🔗 PruebasWalletApp: Slug detectado en URL:", slug);
      api.getLocalBySlug(slug).then(local => {
        if (local && local.admin_status === 'Aceptado') {
          console.log("✅ PruebasWalletApp: Local encontrado y aceptado:", local.nombre);
          
          // Redirección y compatibilidad multiciudad
          const citySlug = getCitySlug(local.ciudad);
          const hasIncorrectCity = !ciudad || !citiesMatch(ciudad, local.ciudad);
          
          if (hasIncorrectCity) {
            const prefix = location.pathname.startsWith('/shops') 
              ? '/shops' 
              : location.pathname.startsWith('/p/') 
                ? '/p' 
                : '/pedir';
            navigate(`${prefix}/${citySlug}/${local.slug}`, { replace: true });
          }

          // Sincronizar ciudad activa de la sesión
          if (local.ciudad && activeCity !== local.ciudad) {
            selectCity(local.ciudad);
          }

          // Registrar métricas de uso de plataforma
          const searchParams = new URLSearchParams(location.search);
          const isWhatsApp = searchParams.get('utm_source') === 'wa_bot';
          
          api.incrementarUsoMetrica(local.id, 'visitas_totales').catch(() => {});
          if (isWhatsApp) {
            api.incrementarUsoMetrica(local.id, 'visitas_whatsapp').catch(() => {});
          } else {
            api.incrementarUsoMetrica(local.id, 'visitas_enlace_propio').catch(() => {});
          }

          fetchMenusByLocal(local.id, null, true);
        } else if (local && local.admin_status !== 'Aceptado') {
          console.warn("⚠️ PruebasWalletApp: Local no aceptado:", local.nombre);
          toast.error("Este local aún no está habilitado.");
          navigate('/pruebas');
        } else {
          console.warn("⚠️ PruebasWalletApp: Local no encontrado para el slug:", slug);
          toast.error("El local solicitado no existe.");
          navigate('/pruebas');
        }
      }).catch(err => {
        console.error("❌ PruebasWalletApp: Error cargando local por slug:", err);
        toast.error("Error al cargar el menú del local.");
      });
    } else {
      setShowMenus(false);
      setSelectedLocal(null);
    }
  }, [slug, ciudad, activeCity, selectCity, navigate, fetchMenusByLocal, location.pathname]);

  const handleBannerClick = React.useCallback(async () => {
    const info = getTimeBasedTitle();
    if (!info.rubros || info.rubros.length === 0) return;

    setLoadingLocals(true);
    setLoadingDiscovery(true);
    setDiscoveryItems([]);
    setExploreRubroFilter('');
    setExploreCatFilter('');
    setTargetMenuCategory(null);

    try {
      // 1. Fetch locales for all rubros in parallel
      const rubroPromises = info.rubros.map(r => api.getLocalesByRubro(r).catch(() => []));
      const results = await Promise.all(rubroPromises);
      
      const allLocales = results.flat().map(l => ({
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
        rubro: l.rubro_local || l.rubro,
        plan_id: l.plan_id
      }));

      // Sort and Deduplicate
      const mapped = allLocales.sort((a, b) => {
        const openA = isLocalOpen(a) ? 1 : 0;
        const openB = isLocalOpen(b) ? 1 : 0;
        if (openA !== openB) return openB - openA;
        
        const PLAN_PRO = '87bdad7f-51cf-4c9c-ae64-ebab8b07b105';
        const isFeaturedA = a.plan_id === PLAN_PRO ? 1 : 0;
        const isFeaturedB = b.plan_id === PLAN_PRO ? 1 : 0;
        if (isFeaturedA !== isFeaturedB) return isFeaturedB - isFeaturedA;
        
        return 0;
      });

      const unique = [];
      const seen = new Set();
      mapped.forEach(l => {
        if (!seen.has(l.id)) {
          unique.push(l);
          seen.add(l.id);
        }
      });

      setFilteredLocals(unique);
      setSelectedCategory(info.title);
      setTimeout(() => {
        document.querySelector('.locals-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      // 2. Fetch menu items for discovery (Market cats + top from locales)
      const allItems = await api.getMenuCompleto();
      const filteredItems = (allItems || []).filter(item => {
        const matchesMarket = info.marketCats?.includes(item.categoria);
        const matchesRubro = info.rubros?.includes(item.local_rubro);
        return (matchesMarket || matchesRubro) && item.disponibilidad;
      });
      
      // Only keep items from open locales
      const finalDiscovery = filteredItems.filter(item => {
        const local = allLocales.find(l => l.id === item.local_id);
        return local && isLocalOpen(local);
      }).slice(0, 30);

      setDiscoveryItems(finalDiscovery);
      setShowMenus(false); 
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar recomendaciones');
    } finally {
      setLoadingLocals(false);
      setLoadingDiscovery(false);
    }
  }, [getTimeBasedTitle, isLocalOpen]);

  const fetchByCategory = React.useCallback((cat, label = null) => {
    if (cat === 'SHOPS') {
      navigate('/shops');
      return;
    }
    setDiscoveryItems([]); // Clear discovery when entering specific category
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
    api.getLocalesByRubro(cat).then(d => {
      const currentCity = activeCity || 'Santo Tomé';
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
        rubro: l.rubro,
        plan_id: l.plan_id,
        tipo_servicio: l.tipo_servicio || 'delivery',
        ciudad: l.ciudad
      }))
      .filter(l => isShopsMode ? l.tipo_servicio === 'shops' : (l.tipo_servicio === 'delivery' || !l.tipo_servicio))
      .filter(l => (l.ciudad || 'Santo Tomé') === currentCity)
      .sort((a, b) => {
        const openA = isLocalOpen(a) ? 1 : 0;
        const openB = isLocalOpen(b) ? 1 : 0;
        
        if (openA !== openB) return openB - openA;
        
        // Entre locales abiertos, priorizar los destacados
        const PLAN_PRO = '87bdad7f-51cf-4c9c-ae64-ebab8b07b105';
        const isFeaturedA = a.plan_id === PLAN_PRO ? 1 : 0;
        const isFeaturedB = b.plan_id === PLAN_PRO ? 1 : 0;
        
        if (isFeaturedA !== isFeaturedB) return isFeaturedB - isFeaturedA;
        
        return 0;
      });
      setFilteredLocals(mapped);
      setSelectedCategory(cat);
      setTargetMenuCategory(label);
      setShowMenus(false);
      setTimeout(() => {
        document.querySelector('.locals-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }).catch(() => toast.error('Error al cargar locales')).finally(() => setLoadingLocals(false));
  }, [user, favorites, navigate, isShopsMode, activeCity]);

  const toggleFav = React.useCallback(async (menuId) => {
    if (!user) { setModal('login'); return; }
    try {
      const r = await api.toggleFavorito(user.id, menuId);
      if (r.added) {
        setFavorites(prev => [...prev, menuId]);
        toast.success('❤️ Agregado a favoritos');
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

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    const res = await loginWithGoogle();
    if (res.success) {
      setModal(null);
      if (res.isNew) {
        toast.success('¡Bienvenido! Recordá completar tu teléfono en el perfil para pedir.');
      } else {
        toast.success('¡Bienvenido!');
      }
    } else {
      toast.error(res.error || 'Error al iniciar sesión con Google');
    }
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
    const direccion = ''; // Removido del form
    const prefix = fd.get('prefix');
    const localNumber = fd.get('telefono');
    const telefono = `${prefix}${localNumber}`;
    const ciudad = fd.get('ciudad') || 'Santo Tomé';

    if (!isValidEmail(email)) { toast.error('Ingresá un email válido'); return; }
    if (password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
    if (!localNumber) { toast.error('El teléfono es obligatorio'); return; }
    
    setAuthLoading(true);
    try {
      const d = await api.registerUsuario(
        nombre, email, password, direccion, telefono,
        fd.get('terms_accepted') === 'on' || !!fd.get('terms_accepted'),
        fd.get('terms_accepted') === 'on' || !!fd.get('terms_accepted'),
        ciudad
      );
      if (d.success) {
        if (fd.get('whatsapp_optin') === 'on' || !!fd.get('whatsapp_optin')) {
          api.registerWhatsappOptin({ phoneNumber: telefono, ciudad, userId: d.userId, tipo: 'promociones_novedades' }).catch(() => {});
        }
        loginAsUser({ 
          userId: d.userId, 
          name: nombre, 
          email: email, 
          address: direccion,
          telefono: telefono,
          ciudad: ciudad
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

  const safeFeeEnvio = cart.feeEnvio !== undefined ? Number(cart.feeEnvio) : 250;
  const safeFeeActivo = cart.feeEnvioActivo !== false;
  const actualFeeEnvio = (safeFeeActivo && cart.deliveryType === 'envio') ? safeFeeEnvio : 0;

  const checkoutTotals = React.useMemo(() => {
    return calculateCheckoutTotals(cart.subtotal, cart.shippingCost, metodoPago, actualFeeEnvio);
  }, [calculateCheckoutTotals, cart.subtotal, cart.shippingCost, metodoPago, actualFeeEnvio]);

  const totalConComision = checkoutTotals.total;
  const visibleMpFee = checkoutTotals.mp_fee;
  
  const potentialCredit = checkoutTotals.potentialCredit || 0;
  const walletDiscountUI = checkoutTotals.walletDiscount || 0;
  const visibleShipping = cart.deliveryType === 'envio' ? (cart.shippingCost + (checkoutTotals.fee_envio || 0)) : 0;



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

    // Registrar métrica de Carrito Creado (único por sesión de usuario)
    try {
      const cartTrackedKey = `wepi_cart_tracked_${menu.local_id}`;
      if (!sessionStorage.getItem(cartTrackedKey)) {
        api.incrementarUsoMetrica(menu.local_id, 'carritos_creados').catch(() => {});
        sessionStorage.setItem(cartTrackedKey, 'true');
      }
    } catch (e) {
      console.error("[Metrics] Error registrando creación de carrito:", e);
    }

    // Detect category and configuration
    let cfg = null;
    try {
      if (typeof menu.variantes === 'string') cfg = JSON.parse(menu.variantes);
      else if (typeof menu.variantes === 'object') cfg = menu.variantes;
    } catch (e) {}

    const isIceCream = cfg?.es_helado;
    const isBurgerOrCombo = cfg?.es_hamburguesa || cfg?.es_combo || cfg?.es_pancho || cfg?.con_papas || (cfg?.variants?.length > 0) || (cfg?.extras?.length > 0);

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

    // Calculate final price once here
    const discountedPrice = calculateDiscountedPrice(menu);
    console.log("🛒 handleAddToCart: Price calculation", { 
      name: menu.nombre, 
      original: menu.precio, 
      final: discountedPrice 
    });
    
    const itemToAdd = {
      ...menu,
      precio: discountedPrice,
      precioOriginal: menu.precioOriginal || menu.precio
    };

    // Default addition for other items
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

  const renderMenuItem = React.useCallback((item) => {
    const itemCfg = typeof item.variantes === 'string' ? JSON.parse(item.variantes || '{}') : (item.variantes || {});
    const needsCustomization = itemCfg.es_helado || itemCfg.es_hamburguesa || itemCfg.es_combo || itemCfg.con_papas || (itemCfg.variants?.length > 0) || (itemCfg.extras?.length > 0);
    
    return (
      <div 
        key={item.id} 
        className="menu-card card card-hover" 
        style={{ cursor: 'pointer' }}
        onClick={() => handleAddToCart(item)}
      >
        <div className="menu-card-img-container">
          <img src={item.imagen_url || 'https://placehold.co/120x120?text=Sin+Imagen'} alt={item.nombre} className="menu-card-img" />
          {(() => {
            const discountedPrice = calculateDiscountedPrice(item);
            if (discountedPrice < Number(item.precio)) {
              const percent = Math.round((1 - discountedPrice / Number(item.precio)) * 100);
              return <div className="menu-discount-badge">{percent}% OFF</div>;
            }
            return null;
          })()}
          </div>
        <div className="menu-card-body">
          <div className="menu-card-local" style={{ marginBottom: '2px' }}>
             <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)' }}>{item.categoria}</span>
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '4px' }}>{item.nombre}</h3>
          {renderCreditBadge(item, true)}
          <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '8px', lineHeight: '1.2' }}>{item.descripcion}</p>
          <div className="menu-card-footer">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="menu-card-price">${calculateDiscountedPrice(item).toLocaleString()}</span>
              {calculateDiscountedPrice(item) < Number(item.precio) && (
                <span style={{ fontSize: '0.75rem', textDecoration: 'line-through', color: 'var(--gray-400)' }}>
                  ${Number(item.precio).toLocaleString()}
                </span>
              )}
            </div>
            <div className="menu-card-actions">
              {isLocalOpen(selectedLocal) ? (
                <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleAddToCart(item); }}>
                  {needsCustomization ? 'Elegir' : 'Agregar'}
                </button>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--red-600)', fontWeight: 'bold' }}>
                  CERRADO
                </span>
              )}
              <button 
                 className={`fav-btn ${favorites.includes(item.id) ? 'active' : ''}`}
                 onClick={(e) => { e.stopPropagation(); toggleFav(item.id); }}
              >
                 <img 
                   src={favorites.includes(item.id) ? "https://i.postimg.cc/BZYZmSz1/Instagram-Heart-Png-Love-Heart-Transparent-Png(1000x1000)-Png-Find.png" : "https://i.postimg.cc/W4Gb8MRV/Instagram-Heart-Png-Love-Heart-Transparent-Png(1000x1000)-Png-Find(1).png"} 
                   style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                   alt="Favorito" 
                 />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }, [calculateDiscountedPrice, handleAddToCart, renderCreditBadge, selectedLocal, isLocalOpen, favorites, toggleFav]);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!user) { setModal('login'); return; }
    if (!user.telefono) {
      toast.error('Por favor, configurá tu teléfono en el perfil antes de realizar un pedido.');
      setModal('editProfile');
      return;
    }
    if (cart.items.length === 0) { toast.error('Tu carrito está vacío'); return; }
    const fd = new FormData(e.target);
    const mp = metodoPago; // Use state instead of FormData
    const dir = addressData.address;
    if (cart.deliveryType === 'envio' && !dir) { toast.error('Ingresá tu dirección de entrega'); return; }
    if (cart.deliveryType === 'envio' && isOutofCoverage) {
      toast.error('Esta dirección está fuera del área de cobertura por el momento.');
      return;
    }

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
      // Capture pre-checkout stats for Mundial 2026 points check (Commented out)
      /*
      let prePts = 0;
      let preSobres = 0;
      let isNew = false;
      try {
        const { data: statsBefore } = await api.supabase
          .from('mundial_usuario_stats')
          .select('*')
          .eq('usuario_id', user.id)
          .maybeSingle();
          
        if (!statsBefore) {
          isNew = true;
          prePts = 100;
          preSobres = 2;
        } else {
          isNew = false;
          prePts = statsBefore.puntos_totales || 0;
          preSobres = statsBefore.sobres_disponibles || 0;
        }
        
        setOldMundialPoints(prePts);
        setOldMundialSobres(preSobres);
        setIsNewMundialUser(isNew);
        
        // Save to localStorage immediately as helper for MP or refresh
        localStorage.setItem('checkMundialPointsAfterMP', 'true');
        localStorage.setItem('oldMundialPointsMP', String(prePts));
        localStorage.setItem('oldMundialSobresMP', String(preSobres));
        localStorage.setItem('isNewMundialUserMP', String(isNew));
      } catch (err) {
        console.error("Error capturing pre-checkout stats:", err);
      }
      */

      // --- NUEVA VALIDACIÃ“N DE DISPONIBILIDAD EN TIEMPO REAL ---
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
      // --- FIN VALIDACIÃ“N ---

      // 7. Calculate exact prices using new logic
      const calcSubtotal = cart.items.reduce((sum, i) => sum + (Number(i.precio) * i.qty), 0);
      const shipping = cart.deliveryType === 'envio' ? cart.COSTO_ENVIO : 0;
      
      const finalTotals = calculateCheckoutTotals(calcSubtotal, shipping, mp, actualFeeEnvio);
      const exactTotal = finalTotals.total;

      const orderItems = cart.items.map(i => ({
        id: i.menuId || i.id, 
        nombre: i.descripcion ? `${i.nombre} (${i.descripcion})` : i.nombre,
        precio: Number(i.precio),
        cantidad: i.qty, 
        local_id: i.local_id || '',
        subtotal: Number(i.precio) * i.qty
      }));

      const orderInfo = {
        direccion: cart.deliveryType === 'envio' ? dir : 'Retiro en local',
        tipoEntrega: cart.deliveryType === 'envio' ? 'Con Envío' : 'Para Retirar',
        metodoPago: mp, 
        observaciones: (fd.get('observaciones') || '') + (addressData.reference ? ` | Ref: ${addressData.reference}` : ''),
        emailCliente: user.email, 
        nombreCliente: user.name,
        totalCalculado: exactTotal,
        lat: addressData.lat,
        lng: addressData.lng,
        precioEnvio: shipping,
        walletDiscount: finalTotals.walletDiscount || 0,
        platform_gross: finalTotals.platform_gross || 0,
        platform_net: finalTotals.platform_net || 0,
        merchant_payout: finalTotals.merchant_payout || 0,
        promociones_aplicadas: finalTotals.appliedPromos?.map(p => p.id) || [],
        ganancia_credito: finalTotals.potentialCredit || 0
      };

      // 3. Handle Flow
      const pregeneratedId = 'ORD-' + Math.random().toString(36).substring(2, 12).toUpperCase();
      
      // Unificamos el estado inicial: si es envío y no es Shops, buscamos repartidor broadcast
      const initialState = (cart.deliveryType === 'envio' && !isShopsMode) ? 'Buscando Repartidor' : (mp === 'efectivo' ? 'Confirmado' : 'Pendiente de Pago');

      const orderDataForCreation = {
        userId: user.id,
        pedidoId: pregeneratedId,
        direccion: cart.deliveryType === 'envio' ? dir : 'Retiro en local',
        tipoEntrega: cart.deliveryType === 'envio' ? 'Con Envío' : 'Para Retirar',
        metodoPago: mp, 
        observaciones: (fd.get('observaciones') || '') + (addressData.reference ? ` | Ref: ${addressData.reference}` : ''),
        items: orderItems,
        emailCliente: user.email, 
        nombreCliente: user.name,
        estadoInicial: initialState,
        totalCalculado: exactTotal,
        lat: addressData.lat,
        lng: addressData.lng,
        precioEnvio: shipping,
        creditoWallet: useWallet ? (checkoutTotals.walletDiscount || 0) : 0,
        promociones_aplicadas: finalTotals.appliedPromos?.map(p => p.id) || [],
        ganancia_credito: finalTotals.potentialCredit || 0,
        cuponId: finalTotals.appliedCuponId || null,
        descuentoCupon: finalTotals.descuentoCupon || 0,
        feeEnvio: finalTotals.fee_envio || 0
      };

      if (cart.deliveryType === 'envio' || mp === 'efectivo' || mp === 'transferencia') {
         // Creamos el pedido base
         const response = await api.crearPedido(orderDataForCreation);

         if (!response.success) throw new Error("No se pudo crear el pedido base.");
         cart.markOrderCompleted?.();

         // Registrar WhatsApp Opt-in silenciosamente si está marcado
         if (!optInRegistered && whatsappCheckoutOptIn && user && user.telefono) {
           api.registerWhatsappOptin({
             phoneNumber: user.telefono,
             ciudad: activeCity || 'Santo Tomé',
             pedidoId: pregeneratedId,
             userId: user.id,
             tipo: 'delivery_update'
           }).then(res => {
             if (!res.error) setOptInRegistered(true);
           }).catch(err => console.error("Error auto-optin whatsapp:", err));
         }

         // Registrar métrica de Pedido Creado (Entrega o Efectivo/Transferencia)
         const localIdForMetric = cart.items[0]?.local_id;
         if (localIdForMetric) {
           api.incrementarUsoMetrica(localIdForMetric, 'pedidos_creados').catch(() => {});
         }

         const pendingOrderInfo = {
            pedidoId: pregeneratedId,
            cart: cart.items,
            total: exactTotal,
            localId: cart.items[0]?.local_id,
            origen_pedido: orderOrigin,
            metodoPago: mp,
            orderItems: orderItems,
            direccion: orderDataForCreation.direccion,
            tipoEntrega: orderDataForCreation.tipoEntrega,
            observaciones: orderDataForCreation.observaciones,
            platform_gross: finalTotals.platform_gross || 0
         };

         localStorage.setItem('pendingOrderDataPruebas', JSON.stringify(pendingOrderInfo));

         if (cart.deliveryType === 'envio' && !isShopsMode) {
            setPendingOrderId(pregeneratedId);
            setSearchingDriver(true);
            setSearchSeconds(0);
            setFoundDriver(null);
            setDriverSearchTimeout(false);
            setCartOpen(false);
            setCheckoutLoading(false);

            // Iniciamos el broadcast centralizado
            await api.broadcastOrderToDrivers(pregeneratedId, exactTotal, cart.items[0]?.local_id, shipping).catch(console.error);
            return;
         } else {
            // RETIRO O ENVIO DE SHOPS + EFECTIVO
            if (mp === 'efectivo') {
              setCheckoutLoading(false);
              toast.success(`¡Pedido #${pregeneratedId} registrado exitosamente!`);
              setConfirmedOrderId(pregeneratedId);
              setShowConfirmedModal(true);
              // Refrescar balance y estado tras pedido exitoso
              api.getUserWalletBalance(user.id).then(setWalletBalance).catch(() => {});
              api.getUserOrderCount(user.id).then(cnt => {
                setOrderCount(cnt.count);
                if (cnt.count > 0 && !user.ya_realizo_pedidos) {
                  loginAsUser({ ...user, userId: user.id, ya_realizo_pedidos: true });
                }
              }).catch(() => {});
              
              const deliveryTypeLabel = cart.deliveryType === 'envio' ? 'Con Envío' : 'Para Retirar';
              const addressLabel = cart.deliveryType === 'envio' ? dir : 'Retiro en local';
              api.notifyLocalsAboutNewOrder(pregeneratedId, cart.items, addressLabel, deliveryTypeLabel, orderDataForCreation.observaciones, mp).catch(e => console.error(e));
              cart.clearCart();
              setCartOpen(false);

              // Verify points earned
              // checkMundialPointsEarned(prePts, preSobres, isNew);
            } else {
              // RETIRO O ENVIO DE SHOPS + TRANSFERENCIA: Redirigir a MP
              setCartOpen(false);
              triggerMPCheckout(pendingOrderInfo);
            }
            return;
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
    if (user?.id) {
      try {
        // Sincronizar estado de pedidos en tiempo real para evitar discrepancias en promos
        const res = await api.getUserOrderCount(user.id);
        api.getUserPromoUsage(user.id).then(setUserPromoUsage).catch(() => {});
        const hasOrdered = res.count > 0;
        if (hasOrdered !== user.ya_realizo_pedidos) {
          console.log("🔄 Syncing user order status:", hasOrdered);
          loginAsUser({ ...user, userId: user.id, ya_realizo_pedidos: hasOrdered });
          // Pequeña espera para asegurar propagación de estado
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (err) {
        console.error("Error syncing order status:", err);
      }
    }
    
    try {
      const r = await api.checkActiveRepartidores();
      setHasRepartidores(r.hasActive);
    } catch (err) { 
      console.error("Error in openCart check:", err);
    }
    setCartOpen(true);
  };

  // Effect to handle search timer
  React.useEffect(() => {
    let timer;
    if (searchingDriver && !foundDriver && !driverSearchTimeout) {
      timer = setInterval(() => {
        setSearchSeconds(prev => {
          if (prev >= 60) { // After 1 min of UNACCEPTED search
            setDriverSearchTimeout(true);
            return 60; 
          }
          
          // Re-enviar Push cada 15 segundos para incentivar
          if (prev > 0 && prev % 15 === 0 && pendingOrderId) {
            console.log("📢 Re-enviando push de incentivo...");
            const currentShipping = cart.deliveryType === 'envio' ? (cart.shippingCost || 0) : 0;
            api.broadcastOrderToDrivers(pendingOrderId, cart.total, cart.items[0]?.local_id, currentShipping).catch(console.error);
          }
          
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [searchingDriver, foundDriver, driverSearchTimeout, pendingOrderId, cart.total, user]);

  // Effect to listen for driver acceptance via Realtime + Polling Fallback
  React.useEffect(() => {
    if (!pendingOrderId || !searchingDriver || foundDriver) return;

    console.log("📡 Subscribing to order updates for:", pendingOrderId);

    const checkStatus = async () => {
      try {
        const { data } = await api.supabase
          .from('pedidos_general')
          .select('id, estado, repartidor_id, payment_id')
          .eq('id', pendingOrderId)
          .single();
          
        if (data) {
          if (data.estado === 'Confirmado' && data.payment_id) {
            console.log("✅ Order confirmed via webhook (Detected via Polling/Initial Check)!");
            toast.success(`¡Pago confirmado! Tu pedido #${data.id} está siendo procesado.`);
            setConfirmedOrderId(data.id);
            setShowConfirmedModal(true);
            setSearchingDriver(false);
            setFoundDriver(null);
            setPendingOrderId(null);
            localStorage.removeItem('pendingOrderData');
            return true;
          }

          if (['Cancelado', 'Rechazado'].includes(data.estado)) {
            console.log("❌ Order canceled or rejected (Detected via Polling/Initial Check)!");
            if (user?.id) {
              const isNoDriver = !data.repartidor_id || (data.motivo_cancelacion && data.motivo_cancelacion.toLowerCase().includes('repartidor'));
              const targetEvent = isNoDriver ? 'sin_repartidores' : 'PEDIDO_RECHAZADO_FALTA_PAGO';
              api.adminLogCRMEvent(user.id, targetEvent, { order_id: data.id, total: data.total })
                .catch(e => console.error(`Error CRM ${targetEvent}:`, e));
            }
            setSearchingDriver(false);
            setDriverSearchTimeout(false);
            setPendingOrderId(null);
            setMpRedirectUrl(null);
            setCheckoutLoading(false);
            setFoundDriver(null);
            localStorage.removeItem('pendingOrderDataPruebas');
            localStorage.removeItem('pendingOrderData');
            toast.error(data.repartidor_id ? 'El pedido fue cancelado o rechazado.' : 'No encontramos repartidores disponibles para tu pedido.');
            return true;
          }

          // Si ya se asignó repartidor o estamos en el modal de repartidor encontrado, no cancelar
          if (data.repartidor_id || foundDriver) {
            if (!foundDriver) handleDriverFound(data);
            return true;
          }

          if ((data.estado === 'Pendiente de Pago' || data.estado === 'Aceptado') && data.repartidor_id && !foundDriver) {
            console.log("✅ Order accepted with driver (Detected via Polling/Initial Check)!");
            handleDriverFound(data);
            return true;
          }
        }
      } catch (err) {
        console.error("Error checking order status:", err);
      }
      return false;
    };

    // 1. Initial Check
    checkStatus();

    // 2. Realtime Listener
    const channel = api.supabase
      .channel(`order_status_${pendingOrderId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'pedidos_general',
        filter: `id=eq.${pendingOrderId}`
      }, (payload) => {
        const newOrder = payload.new;
        console.log("🔄 Realtime update:", newOrder.id, newOrder.estado, "Driver ID:", newOrder.repartidor_id);
        
        if (newOrder.estado === 'Confirmado' && newOrder.payment_id) {
          console.log("✅ Order confirmed via webhook (Realtime Update)!");
          toast.success(`¡Pago confirmado! Tu pedido #${newOrder.id} está siendo procesado.`);
          setConfirmedOrderId(newOrder.id);
          setShowConfirmedModal(true);
          setSearchingDriver(false);
          setFoundDriver(null);
          setPendingOrderId(null);
          localStorage.removeItem('pendingOrderData');
          return;
        }

        if (['Cancelado', 'Rechazado'].includes(newOrder.estado)) {
          console.log("❌ Order canceled or rejected (Realtime Update)!");
          if (user?.id) {
            const isNoDriver = !newOrder.repartidor_id || (newOrder.motivo_cancelacion && newOrder.motivo_cancelacion.toLowerCase().includes('repartidor'));
            const targetEvent = isNoDriver ? 'sin_repartidores' : 'PEDIDO_RECHAZADO_FALTA_PAGO';
            api.adminLogCRMEvent(user.id, targetEvent, { order_id: newOrder.id, total: newOrder.total })
              .catch(e => console.error(`Error CRM ${targetEvent}:`, e));
          }
          setSearchingDriver(false);
          setDriverSearchTimeout(false);
          setPendingOrderId(null);
          setMpRedirectUrl(null);
          setCheckoutLoading(false);
          setFoundDriver(null); // Added this to clear modal
          localStorage.removeItem('pendingOrderDataPruebas');
          localStorage.removeItem('pendingOrderData');
          toast.error(newOrder.repartidor_id ? 'El pedido fue cancelado o rechazado.' : 'No encontramos repartidores disponibles para tu pedido.');
          return;
        }

        if (newOrder.repartidor_id || foundDriver) {
          if (!foundDriver) handleDriverFound(newOrder);
          return;
        }

        if ((newOrder.estado === 'Pendiente de Pago' || newOrder.estado === 'Aceptado') && newOrder.repartidor_id && !foundDriver) {
          handleDriverFound(newOrder);
        }
      })
      .subscribe();

    // 3. Polling Fallback (Every 8 seconds) to reduce load during high demand
    const pollInterval = setInterval(() => {
      if (!foundDriver) checkStatus();
      else clearInterval(pollInterval);
    }, 8000);

    return () => {
      clearInterval(pollInterval);
      api.supabase.removeChannel(channel);
    };
  }, [pendingOrderId, searchingDriver, foundDriver]);

  const handleDriverFound = async (orderData) => {
    if (!orderData || !orderData.repartidor_id) {
      console.warn("⚠️ handleDriverFound called but no repartidor_id is present.");
      return;
    }
    try {
      const { data: rep } = await api.supabase
        .from('repartidores')
        .select('nombre, foto_url')
        .eq('id', orderData.repartidor_id)
        .single();
      
      setFoundDriver(rep || { nombre: 'Repartidor' });
      setAcceptedOrder(orderData);
      setEstimatedTime('15-30 min');
      toast.success('¡Repartidor encontrado! 🚀');
      
      // Clear flags and close modal after a short delay
      setTimeout(async () => {
        const pendingRaw = localStorage.getItem('pendingOrderDataPruebas');
        if (pendingRaw) {
          const pendingData = JSON.parse(pendingRaw);
          if (pendingData.metodoPago === 'efectivo') {
            try {
              toast.success('¡Pedido confirmado!');
              setConfirmedOrderId(pendingData.pedidoId);
              setShowConfirmedModal(true);
              setSearchingDriver(false);
              setFoundDriver(null);
              setPendingOrderId(null);
              localStorage.removeItem('pendingOrderDataPruebas');
              // checkMundialPointsEarned(oldMundialPoints, oldMundialSobres, isNewMundialUser);
            } catch (err) {
              console.error("Error confirming cash order UI:", err);
            }
          } else {
            triggerMPCheckout(orderData);
          }
        }
      }, 1000);

    } catch (e) {
      console.error("Error fetching driver info:", e);
    }
  };

  const handleCancelPendingOrder = async () => {
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
        ]);

        // Registrar evento CRM "sin_repartidores" (dispara WhatsApp/Push y programa el refuerzo de 5 min)
        if (currentUser?.id || user?.id) {
          api.adminLogCRMEvent(currentUser?.id || user?.id, 'sin_repartidores', {
            order_id: orderIdToCancel,
            phone: recipientPhone
          }).catch(err => console.error("Error registrando evento CRM sin_repartidores:", err));
        }

        toast.success('Búsqueda cancelada');
      } catch (e) {
        console.error("Error cancelling order:", e);
      }
    }
  };
  const triggerMPCheckout = async (originalOrder) => {
    try {
      const pendingRaw = localStorage.getItem('pendingOrderDataPruebas');
      if (!pendingRaw) throw new Error('No se encontró la información del pedido');
      
      const pendingData = JSON.parse(pendingRaw);

      // Registrar métrica de Pedido Creado (Pago Online Mercado Pago)
      if (pendingData.localId) {
        api.incrementarUsoMetrica(pendingData.localId, 'pedidos_creados').catch(() => {});
      }

      const orderData = {
        pedidoId: pendingData.pedidoId,
        cart: pendingData.cart,
        total: pendingData.total,
        localId: pendingData.localId,
        origen_pedido: pendingData.origen_pedido || 'enlace_local',
      };

      const successUrl = "https://wepi.com.ar/pedir";
      
      const paymentData = {
        external_reference: pendingData.pedidoId,
        back_urls: { success: successUrl, failure: successUrl, pending: successUrl },
        auto_return: "approved",
        items: [{
          title: `Pedido Wepi #${pendingData.pedidoId}`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: Number(pendingData.total)
        }],
        local_id: cart.items[0]?.local_id,
        marketplace_fee: pendingData.platform_gross
      };

      const paymentResponse = await iniciarPagoMercadoPago(paymentData);

      if (paymentResponse?.init_point) {
        // Registrar evento CRM PEDIDO_NO_PAGADO (si el usuario no completa el pago en MP)
        if (user?.id) {
          api.adminLogCRMEvent(user.id, 'PEDIDO_NO_PAGADO', { order_id: pendingData.pedidoId, total: pendingData.total })
            .catch(e => console.error("Error CRM PEDIDO_NO_PAGADO:", e));
        }

        // Use standard key for return handling
        localStorage.setItem('pendingOrderData', JSON.stringify({
           ...pendingData,
           preferenceId: paymentResponse.id,
           externalReference: pendingData.pedidoId
        })); 
        localStorage.removeItem('pendingOrderDataPruebas');
        
        setMpRedirectUrl(paymentResponse.init_point);
        setCheckoutLoading(false);
      } else {
        throw new Error(paymentResponse?.error || 'No se pudo generar el link de pago');
      }
    } catch (err) {
      toast.error('Error al iniciar Mercado Pago: ' + err.message);
      setCheckoutLoading(false);
    }
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
        <div className="header-left-brand">
          <Link to="/" className="app-logo-link">
            <img src="https://i.postimg.cc/W1qfzj0L/wepi-(1)-(1).png" alt="Wepi" className="app-logo" />
          </Link>
          <div className="city-selector-dropdown" onClick={handleBadgeClick}>
            <span className="city-selector-name">{activeCity || 'Santo Tomé'}</span>
            <span className="city-selector-arrow">▼</span>
          </div>
        </div>
        <div className="search-wrapper">
          <img src="https://i.postimg.cc/TPXmybcH/18611-(1)-(2).png" alt="Buscar" className="search-icon" style={{ width: 34, height: 34, objectFit: 'contain' }} />
          <input type="text" placeholder="Buscar menús o locales..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
        </div>
        <div className="header-actions">
          {user && (
            <div className="wallet-header-badge" onClick={() => setWalletDetailsOpen(true)}>
               <img src="https://i.postimg.cc/wj0SPCb4/descarga-(31)-(7).png" alt="Wallet" className="wallet-icon-img" />
               <span className="wallet-val">
                 {walletBalance === null ? '...' : `$${(walletBalance || 0).toLocaleString()}`}
               </span>
               <button 
                 onClick={async (e) => {
                   e.stopPropagation();
                   if (user?.id && !refreshingWallet) {
                     setRefreshingWallet(true);
                     setWalletBalance(null);
                     try {
                       const newBalance = await api.getUserWalletBalance(user.id);
                       setWalletBalance(newBalance);
                       const res = await api.getUserOrderCount(user.id);
                       setOrderCount(res.count);
                       api.getUserPromoUsage(user.id).then(setUserPromoUsage).catch(() => {});
                     } catch (err) {
                       console.error(err);
                     } finally {
                       setTimeout(() => setRefreshingWallet(false), 800);
                     }
                   }
                 }}
                 className={`wallet-refresh-btn ${refreshingWallet ? 'refresh-spinning' : ''}`}
                 disabled={refreshingWallet}
                 title="Actualizar saldo"
               >
                 🔄
               </button>
            </div>
          )}
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
          {showNotificationBanner && (
            <div className="notification-permission-banner animate-fade-in" style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              padding: '12px 20px',
              borderRadius: '12px',
              textAlign: 'center',
              color: '#991b1b',
              fontSize: '0.85rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '12px',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
                <span style={{ fontSize: '1.25rem' }}>🔔</span>
                <span><strong>Activar Notificaciones:</strong> Necesitamos tu permiso para avisarte cuando tu pedido esté en camino.</span>
              </div>
              <button 
                className="btn btn-primary" 
                style={{ background: '#dc2626', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
                onClick={handleRequestNotificationPermission}
              >
                Activar
              </button>
            </div>
          )}
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
        </div>

        {/* ─── HOME SCREEN ─── */}
        {!showMenus && !filteredLocals && (
          <div className="home-screen animate-fade-in">
                          {/* Banners Grid Container */}
             <div className="home-banners-grid">
               {/* 1. BLOQUE DINÁMICO PRINCIPAL (Banner) */}
             <section className="home-section dynamic-banner-section">
               <div 
                 className="dynamic-banner animate-fade-in" 
                 onClick={handleBannerClick}
               >
                 <img src={homeLayout.dynamicBanner} alt={homeLayout.dynamicTitle} />
                 <div className="banner-overlay">
                   <h2>{homeLayout.dynamicTitle}</h2>
                   <button className="banner-btn">Ver locales ➔</button>
                 </div>
               </div>
             </section>

               {/* ——— Banners Carousel ——— */}
        {!bannersLoading && banners.length > 0 && (
          <div className="wallet-banners-carousel-wrapper animate-fade-in">
            <div 
              className="wallet-banners-carousel-container"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              <div 
                className="wallet-banners-carousel"
                style={{ transform: `translateX(-${currentBannerIndex * 100}%)` }}
              >
                {banners.map(b => (
                  <div 
                    key={b.id} 
                    className={`wallet-banner-slide ${b.link ? 'clickable' : ''}`}
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
            {banners.length > 1 && (
              <div className="wallet-carousel-dots">
                {banners.map((_, idx) => (
                  <span 
                    key={idx} 
                    className={`wallet-carousel-dot ${idx === currentBannerIndex ? 'active' : ''}`}
                    onClick={() => setCurrentBannerIndex(idx)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
             </div>
              <div className="home-brand-message-box" style={{ padding: '0 20px', margin: '24px 0 12px', textAlign: 'center' }}>
                <p className="home-brand-quote" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--gray-900)', margin: 0, letterSpacing: '-0.5px' }}>
                  Todo lo que buscás, <span style={{ color: 'var(--red-600)' }}>está en Wepi.</span>
                </p>
              </div>
             {/* 2. RUBROS PRINCIPALES (Imágenes circulares) */}
             <section className="home-section rubros-categories">

               <div className="categories-grid-home">
                 {homeLayout.categories.map(cat => (
                   <div key={cat.label} className="home-category-card-square" onClick={() => fetchByCategory(cat.type, cat.label)}>
                     <img src={cat.img} alt={cat.label} />
                     <div className="category-overlay">
                       <span>{cat.label}</span>
                     </div>
                   </div>
                 ))}
               </div>
             </section>
             {/* 3. LOCALES DESTACADOS (PRO) */}
             {homeLayout.featuredProLocales.length > 0 && (
               <section className="home-section pro-locales">
                  <div className="section-header-simple">
                    <h2>Locales destacados <img src="https://i.postimg.cc/50W06p4z/descarga-(31).png" style={{ height: '26px', marginLeft: '10px', verticalAlign: 'middle' }} alt="" /></h2>
                  </div>
                  <div className="horizontal-scroll-premium">
                    {homeLayout.featuredProLocales.map((local) => {
                      const open = isLocalOpen(local);
                      const isComingSoon = checkIsComingSoon(local);
                      return (
                        <div 
                          key={local.id} 
                          className={`suggestion-circle-home ${open ? '' : 'is-closed'}`} 
                          onClick={() => fetchMenusByLocal(local.id)}
                          style={isComingSoon ? { filter: 'none', opacity: 1 } : {}}
                        >
                          <div 
                            className={`logo-box ${open ? 'online' : 'offline'}`} 
                            style={{ 
                              border: open ? '2px solid #a855f7' : (isComingSoon ? '2px solid #f59e0b' : ''),
                              filter: isComingSoon ? 'none' : '',
                              opacity: isComingSoon ? 1 : ''
                            }}
                          >
                            <img src={local.logo} alt={local.nombre} style={isComingSoon ? { filter: 'none', opacity: 1 } : {}} />
                            {open && <span className="online-dot-mini" />}
                          </div>
                          <span className="local-status-label" style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', height: 'auto' }}>
                            {getLocalStatusText(local)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
               </section>
             )}

             
             {/* 4. PROMOS DEL DÍA */}
             {!isShopsMode && homeLayout.promosOfDay.length > 0 && (
               <section className="home-section promos-imperdibles">
                 <div className="section-header-with-link">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      PROMOS IMPERDIBLES
                      <img src="https://i.postimg.cc/c4T1cbZf/descarga-(31)-(6).png" alt="" style={{ height: '28px', width: '28px', objectFit: 'contain' }} />
                    </h2>
                   <button className="view-all-btn">Ver más</button>
                 </div>
                 <div className="horizontal-scroll-items" style={{ gap: '12px', padding: '10px 4px' }}>
                     {homeLayout.promosOfDay.map((item) => {
                        const loc = locals.find(l => l.id === item.local_id);
                        const open = isLocalOpen(loc);
                        const isPremium = loc?.plan_id === '87bdad7f-51cf-4c9c-ae64-ebab8b07b105';

                        return (
                          <div 
                            key={item.id} 
                            className={`item-promo-card-vertical animate-fade-in ${open ? '' : 'is-closed'} ${isPremium ? 'is-premium' : ''}`}
                            onClick={() => open && handleAddToCart(item)}
                          >
                            <div className="promo-vertical-img">
                              <img src={item.imagen_url} alt={item.nombre} />
                              {(() => {
                                const discountedPrice = calculateDiscountedPrice(item);
                                if (discountedPrice < Number(item.precio)) {
                                  const percent = Math.round((1 - discountedPrice / Number(item.precio)) * 100);
                                  return <div className="menu-discount-badge">{percent}% OFF</div>;
                                }
                                return null;
                              })()}

                            </div>
                            <div className="promo-vertical-info">
                              <span className="promo-item-name">{item.nombre}</span>
                              {renderCreditBadge(item)}
                              <div className="promo-price-row">
                                <span className="price-now">${calculateDiscountedPrice(item).toLocaleString()}</span>
                                {calculateDiscountedPrice(item) < Number(item.precio) && <span className="price-was">${Number(item.precio).toLocaleString()}</span>}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="promo-local-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {item.local_nombre}
                                  {isPremium && <img src="https://i.postimg.cc/50W06p4z/descarga-(31).png" alt="Featured" style={{ height: '12px', width: 'auto' }} />}
                                </span>
                                {open ? (
                                  <button className="promo-mini-add-btn" onClick={(e) => { e.stopPropagation(); handleAddToCart(item); }}>+</button>
                                ) : (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--red-600)', fontWeight: '700' }}>
                                    Cerrado
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                </section>
              )}
{/* 5. LOCALES RECOMENDADOS (PLUS) */}
             {homeLayout.recommendedPlusLocales.length > 0 && (
               <section className="home-section plus-locales">
                  <div className="section-header-simple">
                    <h2>Locales recomendados <img src="https://i.postimg.cc/K8dcHQg5/descarga-(31)-(4).png" style={{ height: '26px', marginLeft: '10px', verticalAlign: 'middle' }} alt="" /></h2>
                  </div>
                  <div className="horizontal-scroll-premium">
                    {homeLayout.recommendedPlusLocales.map((local) => {
                      const open = isLocalOpen(local);
                      const isComingSoon = checkIsComingSoon(local);
                      return (
                        <div 
                          key={local.id} 
                          className={`suggestion-circle-home ${open ? '' : 'is-closed'}`} 
                          onClick={() => fetchMenusByLocal(local.id)}
                          style={isComingSoon ? { filter: 'none', opacity: 1 } : {}}
                        >
                          <div 
                            className={`logo-box ${open ? 'online' : 'offline'}`} 
                            style={{ 
                              border: open ? '2px solid #f59e0b' : (isComingSoon ? '2px solid #f59e0b' : ''),
                              filter: isComingSoon ? 'none' : '',
                              opacity: isComingSoon ? 1 : ''
                            }}
                          >
                            <img src={local.logo} alt={local.nombre} style={isComingSoon ? { filter: 'none', opacity: 1 } : {}} />
                            {open && <span className="online-dot-mini" />}
                          </div>
                          <span className="local-status-label" style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', height: 'auto' }}>
                            {getLocalStatusText(local)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
               </section>
             )}

             
                           {/* 5.5 LO MÁS PEDIDO (Igual a Promos, sin Corazón) */}
              {!isShopsMode && homeLayout.mostOrdered && homeLayout.mostOrdered.length > 0 && (
               <section className="home-section top-ordered">
                  <div className="section-header-simple">
                    <h2>Lo más pedido 🔥</h2>
                  </div>
                  <div className="horizontal-scroll-items" style={{ gap: '12px', padding: '10px 4px' }}>
                    {homeLayout.mostOrdered.map((item) => {
                      const loc = locals.find(l => l.id === item.local_id);
                      const open = isLocalOpen(loc);
                      const isPremium = loc?.plan_id === '87bdad7f-51cf-4c9c-ae64-ebab8b07b105';

                      return (
                        <div 
                          key={item.id} 
                          className={`item-promo-card-vertical animate-fade-in ${open ? '' : 'is-closed'} ${isPremium ? 'is-premium' : ''}`} 
                          onClick={() => open && handleAddToCart(item)}
                        >
                           <div className="promo-vertical-img">
                              <img src={item.imagen_url} alt={item.nombre} />
                              {(() => {
                                const discountedPrice = calculateDiscountedPrice(item);
                                if (discountedPrice < Number(item.precio)) {
                                  const percent = Math.round((1 - discountedPrice / Number(item.precio)) * 100);
                                  return <div className="menu-discount-badge">{percent}% OFF</div>;
                                }
                                return null;
                              })()}

                              
                           </div>
                           <div className="promo-vertical-info">
                              <span className="promo-item-name">{item.nombre}</span>
                              {renderCreditBadge(item)}
                              <div className="promo-price-row">
                                 <span className="price-now">${calculateDiscountedPrice(item).toLocaleString()}</span>
                                  {calculateDiscountedPrice(item) < Number(item.precio) && (
                                    <span style={{ fontSize: '0.75rem', textDecoration: 'line-through', color: 'var(--gray-400)', marginLeft: '8px' }}>
                                      ${Number(item.precio).toLocaleString()}
                                    </span>
                                  )}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                 <span className="promo-local-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                   {item.local_nombre}
                                   {isPremium && <img src="https://i.postimg.cc/50W06p4z/descarga-(31).png" alt="Featured" style={{ height: '12px', width: 'auto' }} />}
                                 </span>
                                 {open ? (
                                   <button className="promo-mini-add-btn" onClick={(e) => { e.stopPropagation(); handleAddToCart(item); }}>+</button>
                                 ) : (
                                   <span style={{ fontSize: '0.65rem', color: 'var(--red-600)', fontWeight: '700' }}>
                                     Cerrado
                                   </span>
                                 )}
                              </div>
                           </div>
                        </div>
                      );
                    })}
                  </div>
               </section>
             )}
{/* 6. NUEVOS LOCALES (FREEMIUM) */}
             {homeLayout.newFreemiumLocales.length > 0 && (
               <section className="home-section new-locales-home">
                  <div className="section-header-simple">
                    <h2>Otros locales <img src="https://i.postimg.cc/0249zZZy/descarga-(31)-(5).png" style={{ height: '26px', marginLeft: '10px', verticalAlign: 'middle' }} alt="" /></h2>
                  </div>
                  <div className="horizontal-scroll-premium">
                    {homeLayout.newFreemiumLocales.map((local) => {
                      const open = isLocalOpen(local);
                      const isComingSoon = checkIsComingSoon(local);
                      return (
                        <div 
                          key={local.id} 
                          className={`suggestion-circle-home ${open ? '' : 'is-closed'}`} 
                          onClick={() => fetchMenusByLocal(local.id)}
                          style={isComingSoon ? { filter: 'none', opacity: 1 } : {}}
                        >
                          <div 
                            className={`logo-box ${open ? 'online' : 'offline'}`} 
                            style={{ 
                              border: isComingSoon ? '2px solid #f59e0b' : '',
                              filter: isComingSoon ? 'none' : '',
                              opacity: isComingSoon ? 1 : ''
                            }}
                          >
                            <img src={local.logo} alt={local.nombre} style={isComingSoon ? { filter: 'none', opacity: 1 } : {}} />
                            {open && <span className="online-dot-mini" />}
                          </div>
                          <span className="local-status-label" style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', height: 'auto' }}>
                            {getLocalStatusText(local)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
               </section>
             )}
{/* 7. EXPLORAR (Grid de Items) */}
             <section className="home-section explore-items">
                <div className="section-header-simple">
                  <h2>Explorar más productos 🛵</h2>
                </div>

                {/* FILTROS EXPLORAR */}
                <div className="explore-filters" style={{ padding: '0 16px', marginBottom: '24px' }}>
                  <div className="filter-group" style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--gray-700)', marginBottom: '8px', display: 'block' }}>Rubros</label>
                    <div className="horizontal-scroll-chips" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                      <button 
                        className={`filter-chip ${exploreRubroFilter === '' ? 'active' : ''}`}
                        onClick={() => { setExploreRubroFilter(''); }}
                      >
                        Todo
                      </button>
                      {[...new Set(homeLayout.exploreItems.map(i => i.local_rubro).filter(Boolean))].map(rubro => (
                        <button 
                          key={rubro}
                          className={`filter-chip ${exploreRubroFilter === rubro ? 'active' : ''}`}
                          onClick={() => { setExploreRubroFilter(rubro); }}
                        >
                          {rubro}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="filter-group" style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--gray-700)', marginBottom: '8px', display: 'block' }}>Categorías</label>
                    <div className="horizontal-scroll-chips" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                      <button 
                        className={`filter-chip ${exploreCatFilter === '' ? 'active' : ''}`}
                        onClick={() => setExploreCatFilter('')}
                      >
                        Todas
                      </button>
                      {[...new Set(homeLayout.exploreItems.map(i => i.categoria).filter(Boolean))].sort().map(cat => (
                        <button 
                          key={cat}
                          className={`filter-chip ${exploreCatFilter === cat ? 'active' : ''}`}
                          onClick={() => setExploreCatFilter(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="explore-items-list">
                   {exploreRubroFilter || exploreCatFilter ? (
                     homeLayout.exploreItems
                      .filter(item => {
                        const rubroOk = !exploreRubroFilter || item.local_rubro === exploreRubroFilter;
                        const catOk = !exploreCatFilter || item.categoria === exploreCatFilter;
                        return rubroOk && catOk;
                      })
                      .map((item) => (
                      <div 
                        key={item.id} 
                        className="menu-card card card-hover" 
                        style={{ cursor: 'pointer' }}
                        onClick={() => fetchMenusByLocal(item.local_id)}
                      >
                        <div className="menu-card-img-container">
                          <img src={item.imagen_url} alt={item.nombre} className="menu-card-img" />
                          {(() => {
                            const discountedPrice = calculateDiscountedPrice(item);
                            if (discountedPrice < Number(item.precio)) {
                              const percent = Math.round((1 - discountedPrice / Number(item.precio)) * 100);
                              return <div className="menu-discount-badge">{percent}% OFF</div>;
                            }
                            return null;
                          })()}
                          </div>
                        <div className="menu-card-body">
                          <div className="menu-card-local">
                            {item.local_logo && <img src={item.local_logo} alt="" className="menu-local-logo" />}
                            <span>{item.local_nombre}</span>
                          </div>
                          <h3>{item.nombre}</h3>
                          {renderCreditBadge(item)}
                          {item.descripcion && <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', margin: '4px 0', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.descripcion}</p>}
                          <div className="menu-card-footer">
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="menu-card-price" style={{ color: 'inherit' }}>${calculateDiscountedPrice(item).toLocaleString()}</span>
                              {calculateDiscountedPrice(item) < Number(item.precio) && (
                                <span style={{ fontSize: '0.75rem', textDecoration: 'line-through', color: 'var(--gray-400)' }}>
                                  ${Number(item.precio).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <div className="menu-card-actions">
                              {(() => {
                                const loc = locals.find(l => l.id === item.local_id);
                                if (loc && isLocalOpen(loc)) {
                                  return (
                                    <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleAddToCart(item); }}>
                                      Agregar
                                    </button>
                                  );
                                }
                                return (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--red-600)', fontWeight: 'bold' }}>
                                    CERRADO
                                  </span>
                                );
                              })()}
                              <button 
                                className={`fav-btn ${favorites.includes(item.id) ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); toggleFav(item.id); }}
                              >
                                <img 
                                  src={favorites.includes(item.id) ? "https://i.postimg.cc/BZYZmSz1/Instagram-Heart-Png-Love-Heart-Transparent-Png(1000x1000)-Png-Find.png" : "https://i.postimg.cc/W4Gb8MRV/Instagram-Heart-Png-Love-Heart-Transparent-Png(1000x1000)-Png-Find(1).png"} 
                                  style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                                  alt="Favorito" 
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                   ) : (
                     <div style={{ height: '40px' }}></div>
                   )}
                </div>
             </section>
          </div>
        )}

        {/* ─── RUBRO EXPLORER (Explorer View) ─── */}
        {filteredLocals && !showMenus && (
          <div className="explorer-view animate-fade-in">
             <div className="category-chips-sticky">
                <button className={`chip ${!selectedCategory ? 'active' : ''}`} onClick={() => { 
                  setFilteredLocals(null); 
                  setSelectedCategory(null); 
                  setTargetMenuCategory(null);
                  setSelectedLocal(null);
                }}>
                  Inicio
               </button>
               {homeLayout.categories.map(cat => (
                 <button 
                  key={cat.label} 
                  className={`chip ${selectedCategory === cat.type ? 'active' : ''}`} 
                  onClick={() => fetchByCategory(cat.type, cat.label)}
                >
                   {cat.label}
                 </button>
               ))}
             </div>

              <section className="locals-section">
                <div className="section-header-premium" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 className="locals-title">Locales con {selectedCategory || 'Explorar'}</h2>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '6px 12px' }} onClick={() => { setFilteredLocals(null); setSelectedCategory(null); }}>✕ Ver todos</button>
                </div>
                
                {loadingLocals ? (
                  <div className="loading-state-premium">Buscando los mejores locales...</div>
                ) : filteredLocals.length === 0 ? (
                  <div className="empty-state-premium">Próximamente en Wepi</div>
                ) : (
                  <div className="locals-scroll" style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '16px 16px', margin: '0 -16px' }}>
                    {filteredLocals.map((local) => {
                      const open = isLocalOpen(local);
                      const isPremium = local.plan_id === '87bdad7f-51cf-4c9c-ae64-ebab8b07b105';

                      return (
                        <button 
                          key={local.id} 
                          className={`suggestion-categoria ${open ? 'open' : 'closed'} ${isPremium ? 'is-premium' : ''}`} 
                          onClick={() => fetchMenusByLocal(local.id)}
                          style={{ 
                            flex: '0 0 auto', 
                            border: 'none', 
                            outline: 'none',
                            filter: checkIsComingSoon(local) ? 'none' : '',
                            opacity: checkIsComingSoon(local) ? 1 : ''
                          }}
                        >
                          {isPremium && <div className="premium-badge-mini">DESTACADO</div>}
                          <img src={local.logo} alt={local.nombre} style={checkIsComingSoon(local) ? { filter: 'none', opacity: 1 } : {}} />
                          <div className="suggestion-info">
                            <div className="local-name">{local.nombre}</div>
                            {open ? (
                              <div className="categoria-precio">
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                  <span className="cat">{local.rubro}</span>
                                </div>
                                <span className="precio-min">desde ${Number(local.precio_min || 0).toLocaleString('es-AR')}</span>
                              </div>
                            ) : (
                              <div className="availability-badge" style={{ color: checkIsComingSoon(local) ? '#f59e0b' : 'var(--red-600)', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                {checkIsComingSoon(local) ? 'PRÓXIMAMENTE' : 'CERRADO'}
                              </div>
                            )}
                          </div>
                          {open && <span className="open-dot" style={{ position: 'absolute', top: '5px', right: '5px', width: '12px', height: '12px', borderRadius: '50%', background: '#00c853', border: '2px solid white' }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Discovery Items (Menu Cards in Explorer View) */}
              {(loadingDiscovery || discoveryItems.length > 0) && (
                <section className="locals-section items-discovery-section animate-fade-in" style={{ marginTop: '32px', borderTop: '1px solid var(--gray-100)', paddingTop: '24px' }}>
                  <div className="section-header-premium" style={{ marginBottom: '16px' }}>
                    <h2 className="locals-title">Productos Sugeridos ✨</h2>
                  </div>
                  
                  {loadingDiscovery ? (
                    <div className="loading-state-premium">Buscando productos...</div>
                  ) : (
                    <div className="explore-items-list">
                      {discoveryItems.map((item) => (
                        <div 
                          key={item.id} 
                          className="menu-card card card-hover" 
                          style={{ cursor: 'pointer' }}
                          onClick={() => fetchMenusByLocal(item.local_id)}
                        >
                          <div className="menu-card-img-container">
                            <img src={item.imagen_url} alt={item.nombre} className="menu-card-img" />
                            {(() => {
                              const discountedPrice = calculateDiscountedPrice(item);
                              if (discountedPrice < Number(item.precio)) {
                                const percent = Math.round((1 - discountedPrice / Number(item.precio)) * 100);
                                return <div className="menu-discount-badge">{percent}% OFF</div>;
                              }
                              return null;
                            })()}
                            </div>
                          <div className="menu-card-body">
                            <div className="menu-card-local">
                              {item.local_logo && <img src={item.local_logo} alt="" className="menu-local-logo" />}
                              <span>{item.local_nombre}</span>
                            </div>
                            <h3>{item.nombre}</h3>
                            {renderCreditBadge(item)}
                            <div className="menu-card-footer">
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="menu-card-price">${calculateDiscountedPrice(item).toLocaleString()}</span>
                                {calculateDiscountedPrice(item) < Number(item.precio) && (
                                  <span style={{ fontSize: '0.75rem', textDecoration: 'line-through', color: 'var(--gray-400)' }}>
                                    ${Number(item.precio).toLocaleString()}
                                  </span>
                                )}
                              </div>
                              {(() => {
                                const loc = locals.find(l => l.id === item.local_id);
                                if (loc && isLocalOpen(loc)) {
                                  return (
                                    <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleAddToCart(item); }}>
                                      Agregar
                                    </button>
                                  );
                                }
                                return (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--red-600)', fontWeight: 'bold' }}>
                                    CERRADO
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
          </div>
        )}

        {/* ─── LOCAL MENU (Menu View) ─── */}
        {showMenus && (
          <div className="menu-view animate-fade-in">
             <div className="menu-header-sticky">
                <button className="back-btn-premium" onClick={() => { setShowMenus(false); setSelectedLocal(null); }}>← Volver</button>
                <h2 className="menu-local-title">{selectedLocal?.nombre}</h2>
             </div>

             <div className="menu-content-premium">
               {loadingMenus ? (
                 <div className="loading-state-premium">Cargando el menú...</div>
               ) : (
                 <>
                   {/* Categorías del Local */}
                   <div className="local-categories-nav">
                                           {menus.some(m => doesItemEarnCredit(m)) && (
                        <button className="local-cat-chip" style={{ background: 'var(--sky-50)', color: 'var(--sky-700)', borderColor: 'var(--sky-200)', fontWeight: 'bold' }} onClick={() => {
                          document.getElementById(`cat-credito`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}>
                          Ganá créditos 💰
                        </button>
                      )}
                      {Array.from(new Set(menus.map(m => m.categoria))).filter(c => c && c !== 'Base').map(cat => (

                       <button key={cat} className="local-cat-chip" onClick={() => {
                         document.getElementById(`cat-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                       }}>
                         {cat}
                       </button>
                     ))}
                   </div>

                   {/* Listado de Productos Agrupados */}
                                       {/* Sección Especial: Ganá Créditos */}
                    {menus.some(m => doesItemEarnCredit(m)) && (
                      <section id="cat-credito" className="menu-category-section">
                         <h3 className="category-group-title" style={{ color: 'var(--sky-700)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                           Ganá créditos 💰
                         </h3>
                         <div className="menu-list-wallet" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {menus
                              .filter(m => doesItemEarnCredit(m))
                              .map((item) => renderMenuItem(item))}
                         </div>
                      </section>
                    )}

                    {/* Listado de Productos Agrupados */}
                    {Array.from(new Set(menus.map(m => m.categoria))).filter(c => c && c !== 'Base').map(cat => (
                      <section key={cat} id={`cat-${cat}`} className="menu-category-section">
                         <h3 className="category-group-title">{cat}</h3>
                         <div className="menu-list-wallet" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {menus
                              .filter(m => m.categoria === cat)
                              .sort((a, b) => (doesItemEarnCredit(b) ? 1 : 0) - (doesItemEarnCredit(a) ? 1 : 0))
                              .map((item) => renderMenuItem(item))}
                         </div>
                      </section>
                    ))}
                 </>
               )}
             </div>
          </div>
        )}      </main>
      {/* ─── Cart Sidebar ─── */}
      <div className={`cart-backdrop ${cartOpen ? 'active' : ''}`} onClick={() => setCartOpen(false)} />
      <aside className={`cart-sidebar ${cartOpen ? 'active' : ''}`}>
        <div className="cart-header-bar">
          <h2>Tu Carrito</h2>
          <button className="cart-close-btn" onClick={() => setCartOpen(false)}>✕</button>
        </div>
        <div className="cart-body-content">

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Tipo de entrega</label>
            <select 
              className="form-select" 
              value={cart.deliveryType} 
              onChange={e => cart.setDeliveryType(e.target.value)}
            >
              {(() => {
                const currentLocal = selectedLocal || (cart.items.length > 0 ? locals.find(l => l.id === cart.items[0].local_id) : null);
                return (
                  <>
                    {(currentLocal?.acepta_envio !== false) && (
                      <option value="envio">Con envío a domicilio</option>
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
                    <button className="remove-btn-small" onClick={() => cart.removeItem(item.id)}>🗑️</button>
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
                  <option value="transferencia">Mercado Pago</option>
                  <option 
                    value="efectivo" 
                    disabled={!user || user.ya_realizo_pedidos === false || user.ya_realizo_pedidos === 'false' || orderCount === 0 || orderCount === null}
                    style={{ color: (!user || user.ya_realizo_pedidos === false || user.ya_realizo_pedidos === 'false' || orderCount === 0 || orderCount === null) ? '#999' : 'inherit' }}
                  >
                    { (!user || user.ya_realizo_pedidos === false || user.ya_realizo_pedidos === 'false' || orderCount === 0 || orderCount === null) ? 'Efectivo (Inhabilitado 1er pedido)' : 'Efectivo' }
                  </option>
                </select>
                
                {walletBalance > 0 && (
                  <div className="wallet-usage-cart animate-slide-up" style={{
                    padding: '12px',
                    background: '#f0f9ff',
                    borderRadius: '12px',
                    border: '1px solid #bae6fd',
                    marginTop: '15px'
                  }}>
                    <label className="wallet-cb-label" style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      cursor: checkoutTotals.walletValidation?.canUse ? 'pointer' : 'not-allowed',
                      opacity: checkoutTotals.walletValidation?.canUse ? 1 : 0.7
                    }}>
                      <input 
                        type="checkbox" 
                        checked={useWallet && checkoutTotals.walletValidation?.canUse} 
                        onChange={e => checkoutTotals.walletValidation?.canUse && setUseWallet(e.target.checked)} 
                        disabled={!checkoutTotals.walletValidation?.canUse}
                      />
                      <div className="wallet-cb-info">
                        <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#0369a1' }}>Utilizar crédito Wepi Wallet</span>
                        <span style={{ fontSize: '0.75rem', color: '#0ea5e9' }}>
                          Saldo disponible: <strong>{walletBalance === null ? 'Cargando...' : `$${(walletBalance || 0).toLocaleString()}`}</strong>
                        </span>
                        
                        {!checkoutTotals.walletValidation?.canUse && checkoutTotals.walletValidation?.reason && (
                          <div className="wallet-usage-warning" style={{
                            marginTop: '4px',
                            color: '#b91c1c',
                            fontSize: '0.7rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span>⚠️</span> {checkoutTotals.walletValidation.reason}
                          </div>
                        )}

                        {checkoutTotals.walletValidation?.canUse && checkoutTotals.maxAvailableDiscount < walletBalance && checkoutTotals.maxAvailableDiscount > 0 && (
                           <div style={{ fontSize: '0.68rem', color: '#0369a1', marginTop: '2px', fontStyle: 'italic' }}>
                             * Podés usar hasta ${checkoutTotals.maxAvailableDiscount.toLocaleString()} en este pedido.
                           </div>
                        )}
                      </div>
                    </label>
                  </div>
                )}

                {(orderCount === 0 || orderCount === null) && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--red-500)', marginTop: '4px', fontStyle: 'italic' }}>
                    * Por seguridad, tu primer pedido debe ser con Transferencia.
                  </p>
                )}
              </div>

              <div className="coupon-section" style={{ marginTop: '15px', marginBottom: '20px' }}>
                <label className="form-label">¿Tenés un cupón?</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ingresá tu código" 
                    value={couponInput}
                    onChange={e => setCouponInput(e.target.value.toUpperCase())}
                    style={{ textTransform: 'uppercase' }}
                  />
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    onClick={() => {
                      setAppliedCoupon(couponInput);
                      if(couponInput) toast.success("Cupón validado");
                    }}
                  >
                    Aplicar
                  </button>
                </div>
                {appliedCoupon && checkoutTotals?.appliedCuponId && (
                  <small style={{ color: 'var(--green-600)', fontWeight: 'bold' }}>¡Cupón "{appliedCoupon}" aceptado!</small>
                )}
                {appliedCoupon && !checkoutTotals?.appliedCuponId && (
                  <small style={{ color: 'var(--red-600)', fontWeight: 'bold' }}>El cupón no es válido o no aplica a este pedido.</small>
                )}
              </div>

              <div className="cart-summary">
                <div className="cart-line">
                  <span>{cart.deliveryType === 'retiro' ? 'Subtotal valor pedido' : 'Subtotal'}</span>
                  <span>
                    {checkoutTotals?.product_total > checkoutTotals?.discounted_product_total ? (
                      <>
                        <span style={{ textDecoration: 'line-through', color: 'var(--gray-400)', marginRight: '8px', fontSize: '0.85rem' }}>
                          ${(checkoutTotals?.product_total || 0).toLocaleString('es-AR')}
                        </span>
                        <span style={{ color: 'var(--green-600)', fontWeight: '600' }}>
                          ${(checkoutTotals?.discounted_product_total || 0).toLocaleString('es-AR')}
                        </span>
                      </>
                    ) : (
                      `$${(cart.subtotal || 0).toLocaleString('es-AR')}`
                    )}
                  </span>
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
                    <span>
                      {checkoutTotals?.delivery_fee > checkoutTotals?.discounted_delivery_fee ? (
                        <>
                          <span style={{ textDecoration: 'line-through', color: 'var(--gray-400)', marginRight: '8px', fontSize: '0.85rem' }}>
                            ${(checkoutTotals?.delivery_fee || 0).toLocaleString('es-AR')}
                          </span>
                          <span style={{ color: 'var(--green-600)', fontWeight: '600' }}>
                            {checkoutTotals?.discounted_delivery_fee === 0 ? '¡GRATIS!' : `$${(checkoutTotals?.discounted_delivery_fee || 0).toLocaleString('es-AR')}`}
                          </span>
                        </>
                      ) : (
                        visibleShipping === 0 ? '¡GRATIS!' : `$${visibleShipping.toLocaleString('es-AR')}`
                      )}
                    </span>
                  </div>
                )}
                {visibleMpFee > 0 && (
                  <div className="cart-line comision-line">
                    <span>Gestión de pago</span>
                    <span>+${visibleMpFee.toLocaleString('es-AR')}</span>
                  </div>
                )}
                {useWallet && walletDiscountUI > 0 && (
                  <div className="cart-line wallet-discount-line" style={{ color: '#0369a1', fontWeight: '700' }}>
                    <span>Descuento Wepi Wallet</span>
                    <span>−${walletDiscountUI.toLocaleString()}</span>
                  </div>
                )}
                <div className="cart-line total-line">
                  <span>Total</span>
                  <span>${totalConComision.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                {potentialCredit > 0 && (
                  <div className="potential-credit-banner animate-pulse" style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    background: 'linear-gradient(90deg, #f0f9ff, #e0f2fe)',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    color: '#0284c7',
                    fontWeight: '800',
                    textAlign: 'center',
                    border: '1px solid #bae6fd'
                  }}>
                    {(() => {
                      const promoCredito = checkoutTotals.appliedPromos?.find(p => p.tipo === 'credito');
                      const isFirstOrderPromo = promoCredito?.triggers?.primera_compra === true;
                      return (
                        <>
                          ✨ ¡Sumarás <strong>${potentialCredit.toLocaleString()}</strong> de crédito {isFirstOrderPromo ? 'por tu 1er pedido' : 'con esta compra'}!
                        </>
                      );
                    })()}
                  </div>
                )}
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
                {isOutofCoverage && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: '#dc2626',
                    padding: '12px',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    marginBottom: '12px',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    textAlign: 'center'
                  }}>
                    Esta dirección está fuera del área de cobertura por el momento.
                  </div>
                )}
                {!optInRegistered && (
                  <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#f0fdf4', padding: '12px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                    <input 
                      type="checkbox" 
                      id="wa-optin-checkout"
                      checked={whatsappCheckoutOptIn}
                      onChange={e => setWhatsappCheckoutOptIn(e.target.checked)}
                      style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#25D366' }}
                    />
                    <label htmlFor="wa-optin-checkout" style={{ fontSize: '0.85rem', color: '#166534', lineHeight: '1.4', cursor: 'pointer', margin: 0, marginTop: '2px', fontWeight: '500' }}>
                      Recibir avisos sobre el estado de mi pedido en WhatsApp
                    </label>
                  </div>
                )}
                <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={checkoutLoading || isOutofCoverage}>
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

                <div className="auth-separator">
                  <span>O</span>
                </div>

                <button type="button" className="btn btn-google btn-full" onClick={handleGoogleLogin} disabled={authLoading}>
                  <img src="https://i.postimg.cc/4yg7FY6B/channels4-profile.jpg" alt="Google" className="google-icon" />
                  Continuar con Google
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
                <div className="phone-input-group">
                  <select name="prefix" className="phone-prefix-select">
                    <option value="+549">🇦🇷 +549</option>
                    <option value="+55">🇧🇷 +55</option>
                  </select>
                  <input name="telefono" type="tel" className="form-input phone-number-input" placeholder="Número (ej: 1123456789)" required autoComplete="tel-national" />
                </div>
                
                <div className="city-input-group" style={{ marginBottom: '15px', textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px', fontWeight: '600' }}>Ciudad</label>
                  <select name="ciudad" className="form-input" required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.15)', background: 'var(--slate-800, #1e293b)', color: '#f8fafc' }}>
                    <option value="Santo Tomé">Santo Tomé (Corrientes)</option>
                    <option value="Oberá">Oberá (Misiones)</option>
                    <option value="Alem (Misiones)">Alem (Misiones)</option>
                    <option value="Apóstoles (Misiones)">Apóstoles (Misiones)</option>
                    <option value="Goya (Corrientes)">Goya (Corrientes)</option>
                  </select>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '16px', textAlign: 'left' }}>
                  <input type="checkbox" id="terms_accepted" name="terms_accepted" required style={{ width: 'auto', marginTop: '4px' }} />
                  <label htmlFor="terms_accepted" style={{ fontSize: '0.85rem', color: 'var(--gray-600)', lineHeight: '1.4' }}>
                    Acepto los <button type="button" style={{ background: 'none', border: 'none', color: 'var(--red-500)', padding: 0, textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }} onClick={() => setModal('terms')}>Términos y Condiciones y Política de Privacidad</button> para Usuarios.
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '16px', textAlign: 'left' }}>
                  <input type="checkbox" id="whatsapp_optin" name="whatsapp_optin" defaultChecked style={{ width: 'auto', marginTop: '4px' }} />
                  <label htmlFor="whatsapp_optin" style={{ fontSize: '0.85rem', color: 'var(--gray-600)', lineHeight: '1.4' }}>
                    Acepto recibir novedades y seguimiento de pedidos por WhatsApp
                  </label>
                </div>

                <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Registrarme'}
                </button>

                <div className="auth-separator">
                  <span>O</span>
                </div>

                <button type="button" className="btn btn-google btn-full" onClick={handleGoogleLogin} disabled={authLoading}>
                  <img src="https://i.postimg.cc/4yg7FY6B/channels4-profile.jpg" alt="Google" className="google-icon" />
                  Registrarme con Google
                </button>

                <p className="modal-switch">¿Ya tenés cuenta? <button type="button" onClick={() => { setModal('login'); setShowPassword(false); }}>Iniciar sesión</button></p>
              </form>
            )}

            {modal === 'profile' && user && (
              <div>
                <h2>Mi perfil</h2>
                <div className="profile-info" style={{ marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <p style={{ fontSize: '1rem', color: '#1e293b' }}>
                    <strong>Usuario:</strong> {user.name}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn btn-primary btn-full" onClick={() => setModal('editProfile')}>✍️  Editar perfil</button>
                  <button className="btn btn-secondary btn-full" onClick={() => { setModal(null); navigate('/mis-pedidos'); }}>📦 Mis pedidos</button>
                  <button className="btn btn-secondary btn-full" onClick={() => { fetchByCategory('favoritos', 'Mis favoritos'); setModal(null); }}>❤️ Mis favoritos</button>
                  <button className="btn btn-secondary btn-full" onClick={() => setModal('configuracion')}>⚙️ Configuración</button>
                  <button className="btn btn-ghost btn-full" style={{ marginTop: '12px' }} onClick={async () => { await doLogout(); setModal(null); toast.success('Sesión cerrada'); window.location.reload(); }}>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}

            {modal === 'configuracion' && user && (
              <div>
                <h2>Configuración</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0', padding: '16px', background: '#262626', borderRadius: '12px' }}>
                  <span style={{ color: 'white', fontSize: '14px' }}>Notificaciones push</span>
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
                            setTimeout(() => {
                              if (user) user.onesignal_id = 'activado'; // Actualizar visualmente
                              toast.success("¡Notificaciones activadas correctamente!", { id: 'push-toast' });
                              setModal('configuracion_refresh'); // Forzar render
                              setTimeout(() => setModal('configuracion'), 10);
                            }, 2000);
                          } catch (err) {
                            toast.error("Error al activar: " + err.message);
                          }
                        } else {
                           toast.loading("Desactivando...", { id: 'push-toast' });
                           import('../services/api').then(api => {
                             api.usuarioUpdateOneSignalId(user.id, null).then(() => {
                               if (user) user.onesignal_id = null; // Actualizar visualmente
                               toast.success("Notificaciones desactivadas", { id: 'push-toast' });
                               setModal('configuracion_refresh');
                               setTimeout(() => setModal('configuracion'), 10);
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
                <label className="form-label">Dirección de entrega</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={user?.address || 'No configurada'} 
                    disabled 
                    style={{ background: '#f1f5f9', flex: 1, cursor: 'not-allowed' }} 
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ minHeight: '44px', padding: '8px 16px' }}
                    onClick={() => {
                      setShowProfileAddressSelector(true);
                      setModal(null);
                    }}
                  >
                    📍 Mapa
                  </button>
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
                  <p><strong>Datos recolectados:</strong></p>
                  <ul style={{ paddingLeft: '18px', marginBottom: '10px' }}>
                    <li>Nombre, teléfono, email</li>
                    <li>Dirección</li>
                    <li>Ubicación en tiempo real</li>
                    <li>Historial de pedidos</li>
                  </ul>
                </div>
                <button className="btn btn-secondary btn-full" onClick={() => setModal('register')} style={{ marginTop: 16 }}>Volver al Registro</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Modal de Selección de Ciudad Obligatorio ─── */}
      {!activeCity && (
        <div className="modal-overlay" style={{ zIndex: 10000, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, padding: '12px' }}>
          <div className="modal-box animate-fade-in" style={{ maxWidth: '370px', width: '100%', padding: '22px 20px', textAlign: 'center', borderRadius: '18px', boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.15)', background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a' }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: '10px' }}>
              <img src="https://i.postimg.cc/d1myDmBb/wepi.png" alt="Wepi Logo" style={{ width: '48px', height: '48px', borderRadius: '12px', marginBottom: '6px' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 3px 0', fontFamily: "'Outfit', sans-serif" }}>¡Bienvenido a Wepi!</h2>
              <p style={{ color: '#64748b', fontSize: '0.8rem', lineHeight: '1.3', margin: 0 }}>Para mostrarte los locales de tu zona, selecciona tu ciudad:</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
              <div style={{ textAlign: 'left', fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#e63946', marginBottom: '1px' }}>
                Ciudades Disponibles
              </div>
              <button 
                onClick={() => selectCity('Santo Tomé')} 
                className="btn btn-full"
                style={{ 
                  background: '#ffffff', 
                  color: '#0f172a', 
                  padding: '8px 12px', 
                  borderRadius: '9px', 
                  fontWeight: '600', 
                  fontSize: '0.84rem',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center'
                }}
              >
                Santo Tomé (Corrientes)
              </button>
              
              <button 
                onClick={() => selectCity('Oberá')} 
                className="btn btn-full"
                style={{ 
                  background: '#ffffff', 
                  color: '#0f172a', 
                  padding: '8px 12px', 
                  borderRadius: '9px', 
                  fontWeight: '600', 
                  fontSize: '0.84rem',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center'
                }}
              >
                Oberá (Misiones)
              </button>

              <div style={{ textAlign: 'left', fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#d97706', marginTop: '6px', marginBottom: '1px' }}>
                Próximos Lanzamientos
              </div>

              <button 
                onClick={() => openInactiveCityModal('Alem (Misiones)')} 
                className="btn btn-full"
                style={{ 
                  background: '#f8fafc', 
                  color: '#334155', 
                  padding: '7px 11px', 
                  borderRadius: '9px', 
                  fontWeight: '500', 
                  fontSize: '0.82rem',
                  border: '1px dashed #cbd5e1',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center'
                }}
              >
                Alem (Misiones)
              </button>

              <button 
                onClick={() => openInactiveCityModal('Apóstoles (Misiones)')} 
                className="btn btn-full"
                style={{ 
                  background: '#f8fafc', 
                  color: '#334155', 
                  padding: '7px 11px', 
                  borderRadius: '9px', 
                  fontWeight: '500', 
                  fontSize: '0.82rem',
                  border: '1px dashed #cbd5e1',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center'
                }}
              >
                Apóstoles (Misiones)
              </button>

              <button 
                onClick={() => openInactiveCityModal('Goya (Corrientes)')} 
                className="btn btn-full"
                style={{ 
                  background: '#f8fafc', 
                  color: '#334155', 
                  padding: '7px 11px', 
                  borderRadius: '9px', 
                  fontWeight: '500', 
                  fontSize: '0.82rem',
                  border: '1px dashed #cbd5e1',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center'
                }}
              >
                Goya (Corrientes)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Pop-up para Registrarse para Novedades (Ciudades Inactivas) ─── */}
      {inactiveCityModal && (
        <div className="modal-overlay" style={{ zIndex: 10050, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, padding: '12px' }}>
          <div className="modal-box animate-fade-in" style={{ maxWidth: '370px', width: '100%', padding: '22px 20px', textAlign: 'center', borderRadius: '18px', boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.15)', background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a', position: 'relative' }} onClick={e => e.stopPropagation()}>
            
            <button 
              onClick={() => { setInactiveCityModal(null); setLeadSubmitted(false); }}
              style={{ position: 'absolute', top: '12px', right: '12px', background: '#f1f5f9', border: 'none', color: '#64748b', width: '26px', height: '26px', borderRadius: '50%', cursor: 'pointer', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ✕
            </button>

            {!leadSubmitted ? (
              <>
                <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.68rem', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-block', marginBottom: '6px' }}>
                  Próximamente
                </span>
                
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0', fontFamily: "'Outfit', sans-serif" }}>
                  Wepi llega a {inactiveCityModal}
                </h2>
                
                <p style={{ color: '#64748b', fontSize: '0.8rem', lineHeight: '1.3', margin: '0 0 12px 0' }}>
                  Registrate para recibir novedades y promociones exclusivas el día del lanzamiento.
                </p>

                <form onSubmit={handleLeadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>Nombre completo *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Ej: Juan Pérez" 
                      value={leadForm.nombre}
                      onChange={e => setLeadForm({ ...leadForm, nombre: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.82rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>WhatsApp *</label>
                    <input 
                      type="tel" 
                      required 
                      placeholder="Ej: 3755 123456" 
                      value={leadForm.whatsapp}
                      onChange={e => setLeadForm({ ...leadForm, whatsapp: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.82rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>Email (opcional)</label>
                    <input 
                      type="email" 
                      placeholder="tu@email.com" 
                      value={leadForm.email}
                      onChange={e => setLeadForm({ ...leadForm, email: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.82rem', outline: 'none' }}
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={leadSubmitting}
                    style={{ 
                      marginTop: '4px',
                      background: 'linear-gradient(135deg, #e63946 0%, #b5179e 100%)', 
                      color: '#fff', 
                      padding: '9px 14px', 
                      borderRadius: '8px', 
                      fontWeight: '600', 
                      fontSize: '0.84rem',
                      border: 'none',
                      cursor: leadSubmitting ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 6px rgba(230, 57, 70, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'center'
                    }}
                  >
                    {leadSubmitting ? 'Registrando...' : 'Registrarme para recibir novedades'}
                  </button>
                </form>
              </>
            ) : (
              <div style={{ padding: '6px 0' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px', fontFamily: "'Outfit', sans-serif" }}>
                  ¡Gracias por sumarte!
                </h3>
                <p style={{ color: '#475569', fontSize: '0.82rem', lineHeight: '1.3', marginBottom: '14px' }}>
                  Registramos tus datos para <strong style={{ color: '#e63946' }}>{inactiveCityModal}</strong>. Te avisaremos apenas iniciemos operaciones.
                </p>
                <button 
                  onClick={() => { setInactiveCityModal(null); setLeadSubmitted(false); }}
                  style={{ 
                    background: '#f1f5f9', 
                    color: '#0f172a', 
                    padding: '7px 14px', 
                    borderRadius: '8px', 
                    fontWeight: '600', 
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                    fontSize: '0.82rem'
                  }}
                >
                  Entendido
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Modal de Pedido Confirmado y Encuesta / Notificaciones ─── */}
      {showConfirmedModal && (
        <div className="modal-overlay" style={{ zIndex: 11000 }} onClick={() => setShowConfirmedModal(false)}>
          <div className="modal-box animate-fade-in" style={{ maxWidth: '450px', textAlign: 'center', padding: '30px', background: 'white', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
            <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#16a34a', marginBottom: '8px', fontFamily: "'Outfit', sans-serif" }}>¡Pedido Confirmado!</h3>
            <p style={{ color: '#475569', fontSize: '0.95rem', marginBottom: '24px', lineHeight: '1.5' }}>
              Tu pedido <strong style={{color: '#0f172a'}}>#{confirmedOrderId}</strong> ha sido registrado con éxito y ya está en preparación.
            </p>

            {!optInRegistered && (
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#f0fdf4', padding: '12px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                <input 
                  type="checkbox" 
                  id="wa-optin-confirmed"
                  checked={whatsappCheckoutOptIn}
                  onChange={async (e) => {
                    const isChecked = e.target.checked;
                    setWhatsappCheckoutOptIn(isChecked);
                    if (isChecked) {
                      let phone = (user && user.telefono) || '';
                      if (!phone) {
                        phone = prompt("Ingresá tu número de WhatsApp con código de área (ej: 5493756543610):");
                        if (!phone) {
                          setWhatsappCheckoutOptIn(false);
                          return;
                        }
                      }
                      setOptInLoading(true);
                      try {
                        const res = await api.registerWhatsappOptin({
                          phoneNumber: phone,
                          ciudad: activeCity || 'Santo Tomé',
                          pedidoId: confirmedOrderId,
                          userId: user?.id || null,
                          tipo: 'delivery_update'
                        });
                        if (!res.error) {
                          setOptInRegistered(true);
                          toast.success('¡Listo! Te avisaremos cuando llegue tu pedido. 🛵');
                        } else {
                           toast.error(res.error || 'Por favor ingresá un número válido');
                           setWhatsappCheckoutOptIn(false);
                        }
                      } catch (err) {
                        console.error(err);
                        toast.error('Error al registrar aviso por WhatsApp');
                        setWhatsappCheckoutOptIn(false);
                      } finally {
                        setOptInLoading(false);
                      }
                    }
                  }}
                  style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#25D366' }}
                />
                <label htmlFor="wa-optin-confirmed" style={{ fontSize: '0.85rem', color: '#166534', lineHeight: '1.4', cursor: 'pointer', margin: 0, marginTop: '2px', fontWeight: '500', textAlign: 'left' }}>
                  {optInLoading ? 'Guardando...' : 'Avisarme por WhatsApp al llegar mi pedido'}
                </label>
              </div>
            )}

            {(!user || !user.onesignal_id) && !Capacitor.isNativePlatform() && (
              <div style={{ marginTop: '24px', marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '12px', color: '#1e293b' }}>Ahora tenés Wepi más cerca que nunca.</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                  <a href="https://apps.apple.com/ar/app/wepi-app/id6801576564" target="_blank" rel="noopener noreferrer">
                    <img src="https://i.postimg.cc/3xLdFwyB/disponible-app-store-rtt.png" alt="App Store" style={{ height: '40px' }} />
                  </a>
                  <a href="https://api.whatsapp.com/send/?phone=3756543610&text=Quiero+la+App+de+Wepi+para+Android" target="_blank" rel="noopener noreferrer">
                    <img src="https://i.postimg.cc/TYddN6vJ/disponible-en-google-play-badge-1.png" alt="Google Play" style={{ height: '40px' }} />
                  </a>
                </div>
              </div>
            )}

            <button 
              className="btn btn-secondary btn-full"
              style={{ padding: '14px 20px', borderRadius: '12px', fontWeight: '700', fontSize: '1rem', cursor: 'pointer' }}
              onClick={() => setShowConfirmedModal(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}



      {/* ——— Ice Cream Modal ——— */}
      {iceCreamModal && (
        <div className="modal-overlay" onClick={() => setIceCreamModal(null)}>
          <div className="modal-box animate-scale-in" style={{ maxWidth: 500, padding: '20px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIceCreamModal(null)}>✕</button>
            <h2 style={{ color: 'var(--red-600)', marginBottom: 8, fontSize: '1.4rem' }}>{iceCreamModal.nombre}</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--gray-500)', marginBottom: 16 }}>{iceCreamModal.descripcion}</p>
            
            <h3 style={{ fontSize: '1rem', marginBottom: 10, fontWeight: '700' }}>1. Elegí el tamaño:</h3>
            <div className="size-selector" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
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
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: selectedSize === size ? 'var(--red-600)' : 'inherit' }}>{size}</div>
                  <div style={{ color: 'var(--gray-500)', fontSize: '0.72rem', marginTop: '2px' }}>
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
            
            <div className="flavors-list" style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20, padding: '4px' }}>
              {iceCreamFlavors.map(flavor => {
                const isSelected = selectedFlavors.includes(flavor.nombre);
                const max = JSON.parse(iceCreamModal.variantes).precios[selectedSize].max;
                const canSelect = selectedFlavors.length < max;
                
                return (
                  <button 
                    key={flavor.id}
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                    style={{ 
                      justifyContent: 'flex-start', textAlign: 'left', minHeight: 40, borderRadius: '10px',
                      borderWidth: isSelected ? '2px' : '1px', fontSize: '0.75rem', padding: '4px 8px'
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
                        style={{ borderRadius: '20px', padding: '4px 10px', fontSize: '0.72rem' }}
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
                <h3 style={{ fontSize: '1.1rem', marginBottom: 12, fontWeight: '700' }}>{(iceCreamModal.salsasDisponibles || []).length > 0 ? '4' : '3'}. Adicionales <small style={{ fontWeight: '400', color: 'var(--gray-500)' }}>(Opcional)</small></h3>
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
                          <div style={{ fontSize: '2.5rem' }}>{cfg.es_pancho ? '🌭' : (cfg.es_hamburguesa ? '🍔' : '🍽️')}</div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: '700', fontSize: '1rem' }}>{cfg.es_pancho ? 'Solo el pancho' : (cfg.es_hamburguesa ? 'Solo la hamburguesa' : 'Solo el plato')}</div>
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
        <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" style={{ height: '80px', objectFit: 'contain' }} />
        <p>
          © 2026 <strong>Wepi</strong> — Plataforma de Pedidos y Delivery
          <span style={{ display: 'inline-block', marginLeft: '8px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56,189, 248, 0.4)', fontSize: '0.75rem', fontWeight: 'bold' }}>{otaVersion}</span>
        </p>
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
          ciudad={activeCity || 'Santo Tomé'}
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
          ciudad={activeCity || 'Santo Tomé'}
          onConfirm={async (data) => {
            try {
              await api.updateDireccion(user.id, data.address, data.lat, data.lng);
              updateUserAddress(data.address);
              // Podríamos necesitar recargar el usuario localmente o actualizar el context
              toast.success('Dirección de perfil actualizada');
              setShowProfileAddressSelector(false);
              setModal('editProfile');
            } catch (e) {
              toast.error('Error al actualizar perfil');
            }
          }}
          onCancel={() => {
            setShowProfileAddressSelector(false);
            setModal('editProfile');
          }}
        />
      )}

      {/* Mercado Pago Standalone Loading Overlay (for pickup/shops orders while link is generating) */}
      {checkoutLoading && !cartOpen && !searchingDriver && !showConfirmedModal && metodoPago !== 'efectivo' && (
        <div className="searching-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="searching-modal-card animate-slide-up" style={{ maxWidth: '320px', padding: '24px', textAlign: 'center' }}>
            <div className="spinner-small" style={{ width: '40px', height: '40px', border: '3px solid #f3f3f3', borderTop: '3px solid #009ee3', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ fontWeight: '600', color: '#333', fontSize: '0.95rem', margin: 0 }}>Generando enlace de pago...</p>
          </div>
        </div>
      )}

      {/* Mercado Pago Standalone Warning Modal (for pickup/shops orders without driver) */}
      {mpRedirectUrl && !searchingDriver && (
        <div className="searching-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="searching-modal-card animate-slide-up" style={{ maxWidth: '380px', padding: '24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <img 
                src="https://i.postimg.cc/Z5K8N29n/download.png" 
                alt="Mercado Pago" 
                style={{ height: '40px', objectFit: 'contain' }} 
              />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '12px', color: '#333' }}>
              Confirmación de Pago
            </h3>
            <p style={{ fontSize: '0.95rem', color: '#555', lineHeight: '1.5', marginBottom: '24px' }}>
              Se abrirá la app de Mercado Pago para realizar el pago de tu pedido.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                className="btn btn-primary" 
                style={{ background: '#009ee3', borderColor: '#009ee3', flex: 1, fontWeight: '700' }}
                onClick={() => {
                  window.location.href = mpRedirectUrl;
                }}
              >
                Aceptar
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1, fontWeight: '700' }}
                onClick={() => {
                  setMpRedirectUrl(null);
                  setCheckoutLoading(false);
                  setCartOpen(true);
                  toast.error('Pago cancelado. Puedes intentar pagar de nuevo desde tu historial.');
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Búsqueda de Repartidor */}
      {searchingDriver && (
        <div className="searching-modal-overlay">
          <div className="searching-modal-card" style={foundDriver ? { padding: '20px 24px', maxWidth: '380px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '4px' } : {}}>
            {!foundDriver ? (
              <>
                <div className="searching-animation">
                  <div className="radar"></div>
                  <img src="https://i.postimg.cc/QCcjwFRf/18611-(1).png" alt="Buscando" className="moving-moto" />
                </div>

                <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#1e293b', marginBottom: '8px', textAlign: 'center' }}>
                  🔎 Buscando un repartidor para tu pedido
                </h2>
                
                <div className="live-status-box">
                  <span className="live-status-dot"></span>
                  <span key={searchSeconds < 10 ? 'p1' : (searchSeconds < 20 ? 'p2' : (searchSeconds < 35 ? 'p3' : (searchSeconds < 50 ? 'p4' : 'p5')))} className="live-status-text">
                    {searchSeconds < 10 && '🚀 Enviando la solicitud...'}
                    {searchSeconds >= 10 && searchSeconds < 20 && '📲 Notificando repartidores cercanos...'}
                    {searchSeconds >= 20 && searchSeconds < 35 && '⏳ Esperando respuestas...'}
                    {searchSeconds >= 35 && searchSeconds < 50 && '🔎 Ampliando la búsqueda...'}
                    {searchSeconds >= 50 && '🔄 Reenviando notificaciones...'}
                  </span>
                </div>

                <div className="searching-timer" style={{ marginTop: '16px', fontSize: '0.95rem', fontWeight: '600', color: '#475569', textAlign: 'center' }}>
                  ⏱ Buscando hace{' '}
                  <span style={{ fontWeight: 800, color: 'var(--red-600, #dc2626)', fontSize: '1.1rem' }}>
                    {Math.floor(searchSeconds / 60).toString().padStart(2, '0')}:{(searchSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                <div style={{
                  background: '#fffbebf0',
                  color: '#b45309',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  marginTop: '14px',
                  border: '1px solid #fef3c7',
                  textAlign: 'center',
                  lineHeight: '1.4'
                }}>
                  💡 La mayoría de los pedidos encuentra un repartidor en menos de 2 minutos.
                </div>

                <button 
                  className="searching-cancel-btn"
                  style={{ marginTop: '16px' }}
                  onClick={handleCancelPendingOrder}
                >
                  Cancelar pedido
                </button>
              </>
            ) : (
              <div className="found-driver-animation" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <div className="success-check" style={{ 
                  background: 'none', 
                  border: '3px solid var(--red-600)', 
                  boxShadow: 'none',
                  borderRadius: '50%',
                  width: '70px',
                  height: '70px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px',
                  padding: '0'
                }}>
                  <img 
                    src="https://i.postimg.cc/RV8VGysv/wepi-(10).png" 
                    alt="Wepi" 
                    className="check-icon" 
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }} 
                  />
                </div>
                <h2 style={{ fontSize: '1.3rem', margin: '6px 0 2px', fontWeight: '800', color: '#1e293b' }}>¡Repartidor encontrado!</h2>
                <p className="success-msg" style={{ margin: '0 0 8px', fontSize: '0.8rem', color: '#64748b' }}>Ya encontramos un repartidor para llevar tu pedido.</p>
                
                <div className="found-driver-info" style={{ margin: '8px 0', padding: '10px 14px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', textAlign: 'left' }}>
                  <img src={foundDriver.foto_url || 'https://i.postimg.cc/1RWxRcKM/18611-(1)-(1).png'} alt="Repartidor" className="driver-img" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover' }} />
                  <div className="driver-details" style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="driver-name" style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>{foundDriver.nombre}</span>
                    <span className="estimated-tag" style={{ fontSize: '0.7rem', color: '#64748b' }}>Llega en {estimatedTime}</span>
                  </div>
                </div>

                {!getIsCashOrder() && (
                  <>
                    <div style={{ margin: '4px 0 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#9a3412', fontWeight: '700' }}>
                        Tiempo para realizar el pago:
                      </span>
                      <CountdownTimer 
                        startTime={acceptedOrder?.pago_pendiente_at || acceptedOrder?.created_at || new Date().toISOString()} 
                        limitMinutes={5} 
                        onTimeout={handleCancelPendingOrder} 
                      />
                    </div>

                    <div className="mp-warning-box" style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'rgba(0,158,227,0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(0,158,227,0.2)' }}>
                      <img 
                        src="https://i.postimg.cc/Z5K8N29n/download.png" 
                        alt="Mercado Pago" 
                        style={{ height: '30px', objectFit: 'contain' }} 
                      />
                      <p style={{ fontSize: '0.8rem', color: '#555', margin: 0, fontWeight: '600', lineHeight: '1.3' }}>
                        Se abrirá la app de Mercado Pago para realizar el pago.
                      </p>
                      <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '2px' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ 
                            flex: 1, 
                            background: '#009ee3', 
                            borderColor: '#009ee3', 
                            color: 'white', 
                            fontSize: '0.75rem', 
                            fontWeight: '700', 
                            padding: '6px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                          disabled={!mpRedirectUrl}
                          onClick={() => {
                            window.location.href = mpRedirectUrl;
                          }}
                        >
                          {!mpRedirectUrl && <div className="spinner-small" style={{ margin: 0, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', width: '12px', height: '12px' }}></div>}
                          {mpRedirectUrl ? 'Aceptar' : 'Generando pago...'}
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ 
                            flex: 1, 
                            fontSize: '0.75rem', 
                            fontWeight: '700', 
                            padding: '6px 12px', 
                            background: '#f3f4f6', 
                            border: 'none', 
                            color: '#4b5563' 
                          }}
                          onClick={handleCancelPendingOrder}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {driverSearchTimeout && (
        <div className="searching-modal-overlay">
          <div className="searching-modal-card animate-slide-up" style={{ padding: '24px', maxWidth: '360px', borderRadius: '24px' }}>
              {showEsperaPanel ? (
                <>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px', textAlign: 'center' }}>?</div>
                  <h4 style={{ margin: '0 0 12px 0', color: '#1e293b', textAlign: 'center', fontSize: '1.35rem' }}>Dejar en espera</h4>
                  <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '20px', textAlign: 'center' }}>
                    Durante 10 minutos seguiremos buscando un repartidor para tu pedido.
                  </p>
                  
                  <div style={{ margin: '12px 0 20px 0', display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#f0fdf4', padding: '12px', borderRadius: '12px', border: '1px solid #bbf7d0', textAlign: 'left' }}>
                    <input 
                      type="checkbox" 
                      id="wa-optin-espera"
                      checked={whatsappCheckoutOptIn}
                      onChange={e => setWhatsappCheckoutOptIn(e.target.checked)}
                      style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#25D366' }}
                    />
                    <label htmlFor="wa-optin-espera" style={{ fontSize: '0.85rem', color: '#166534', lineHeight: '1.4', cursor: 'pointer', margin: 0, marginTop: '2px', fontWeight: '500' }}>
                      Aceptalo para recibir un aviso cuando encontramos al repartidor.
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      className="btn btn-full"
                      style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '12px' }}
                      onClick={() => setShowEsperaPanel(false)}
                    >
                      Cancelar
                    </button>
                    <button 
                      className="btn btn-full"
                      style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '12px' }}
                      onClick={() => {
                        setShowEsperaPanel(false);
                        setDriverSearchTimeout(false);
                        api.extenderEsperaRepartidor(pendingOrderId, whatsappCheckoutOptIn, user?.telefono).then(() => {
                          toast.success('El pedido qued� en espera por 10 minutos ?');
                          localStorage.removeItem('pendingOrderDataPruebas');
                          localStorage.removeItem('pendingOrderData');
                          setPendingOrderId(null);
                          setSearchingDriver(false);
                          navigate('/mis-pedidos');
                        });
                      }}
                    >
                      Confirmar
                    </button>
                  </div>
                </>
              ) : (
                <>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: '#1e293b', marginBottom: '12px', textAlign: 'center' }}>
              🔎 Seguimos buscando
            </h2>
            
            <div style={{
              background: '#fefce8',
              color: '#854d0e',
              padding: '12px 14px',
              borderRadius: '12px',
              fontSize: '0.85rem',
              fontWeight: '600',
              marginBottom: '16px',
              border: '1px solid #fef08a',
              textAlign: 'center',
              lineHeight: '1.4'
            }}>
              💡 Muchos pedidos encuentran repartidor en este segundo intento.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <button 
                className="btn btn-full"
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  fontWeight: '700',
                  padding: '12px',
                  borderRadius: '12px',
                  fontSize: '0.92rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
                }}
                onClick={() => {
                  setDriverSearchTimeout(false);
                  setSearchSeconds(0); 
                  const currentShipping = cart.deliveryType === 'envio' ? (cart.shippingCost || 0) : 0;
                  api.broadcastOrderToDrivers(pendingOrderId, cart.total, cart.items[0]?.local_id, currentShipping);
                  toast.success('¡Reenviamos la solicitud a los repartidores! 🛵');
                }}
              >
                🟢 Repetir pedido
                </button>

                {!getIsCashOrder() && (() => {
                   let localId = cart.items?.[0]?.local_id;
                   if (!localId) {
                     try {
                       const pd = JSON.parse(localStorage.getItem('pendingOrderDataPruebas') || '{}');
                       localId = pd.localId;
                     } catch(e){}
                   }
                   const loc = locals.find(l => l.id === localId);
                   return loc ? isLocalOpen(loc) : true;
                })() && (
                  <button 
                    className="btn btn-full"
                    style={{
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      fontWeight: '700',
                      padding: '12px',
                      borderRadius: '12px',
                      fontSize: '0.92rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
                      marginTop: '6px',
                      marginBottom: '6px'
                    }}
                    onClick={() => setShowEsperaPanel(true)}
                  >
                    ? Dejar en espera
                  </button>
                )}

                {!optInRegistered && (
                <div style={{ margin: '6px 0', display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#f0fdf4', padding: '12px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                  <input 
                    type="checkbox" 
                    id="wa-optin-cancel"
                    checked={whatsappCheckoutOptIn}
                    onChange={e => setWhatsappCheckoutOptIn(e.target.checked)}
                    style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#25D366' }}
                  />
                  <label htmlFor="wa-optin-cancel" style={{ fontSize: '0.85rem', color: '#166534', lineHeight: '1.4', cursor: 'pointer', margin: 0, marginTop: '2px', fontWeight: '500' }}>
                    Recibir aviso en WhatsApp si no hay repartidores
                  </label>
                </div>
              )}

              <button 
                className="btn btn-full"
                style={{
                  padding: '10px',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px'
                }}
                onClick={async () => {
                  const orderIdToCancel = pendingOrderId;
                  const recipientPhone = user && user.telefono;

                  setDriverSearchTimeout(false);
                  setSearchingDriver(false);
                  setPendingOrderId(null);
                  localStorage.removeItem('pendingOrderDataPruebas');
                  
                  if (orderIdToCancel) {
                    try {
                      // Disparamos la cancelación, el opt-in, el envío de plantilla al usuario y la alerta a repartidores
                      await api.handleCancelOrderSinRepartidores({
                        orderId: orderIdToCancel,
                        phone: recipientPhone,
                        city: activeCity,
                        optIn: !optInRegistered && whatsappCheckoutOptIn
                      });

                      if (!optInRegistered && whatsappCheckoutOptIn) {
                         setOptInRegistered(true);
                      }

                      toast.success('Búsqueda cancelada');
                    } catch (e) {
                      console.error("Error cancelling order:", e);
                    }
                  }
                }}
              >
                ⚪ Cancelar pedido
                </button>
              </div>
              </>
              )}
            </div>
        </div>
      )}

      {/* Chatbot de Ayuda */}
      <HelpChatbot />
      
      {walletDetailsOpen && (
        <WalletDetailsPanel 
          onClose={() => setWalletDetailsOpen(false)}
          balance={walletBalance}
          transactions={walletBreakdown}
          promotions={allPromotions}
          userId={user?.id}
          onRefresh={refreshWallet}
        />
      )}

      {/* Pestañita Lateral Mundialista (Commented out) */}
      {/* <Link 
        to="/mundialista" 
        className="floating-lateral-tab"
        style={{
          position: 'fixed',
          right: '0',
          top: '55%',
          transform: 'translateY(-50%)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          filter: 'drop-shadow(-2px 4px 10px rgba(0,0,0,0.25))'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-50%) scale(1.08) translateX(-8px)';
          e.currentTarget.style.filter = 'brightness(1.15) drop-shadow(-4px 8px 20px rgba(0,0,0,0.45))';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(-50%)';
          e.currentTarget.style.filter = 'drop-shadow(-2px 4px 10px rgba(0,0,0,0.25))';
        }}
      >
        <img 
          src="https://i.postimg.cc/B6VcTnwf/10-(2).png" 
          alt="Mundialista Wepi" 
          style={{
            height: '110px',
            width: 'auto',
            display: 'block',
            borderRadius: '12px 0 0 12px',
          }}
        />
      </Link> */}


    </div>
  );
}

// --- SUB-COMPONENT: WalletDetailsPanel ---
function WalletDetailsPanel({ onClose, balance, transactions, promotions, userId, onRefresh }) {
  const [selectedPromo, setSelectedPromo] = React.useState(null);
  const [couponCode, setCouponCode] = React.useState('');
  const [redeemLoading, setRedeemLoading] = React.useState(false);

  const handleShowPromoTerms = async (campaignId) => {
    if (!campaignId) return;
    const promo = promotions.find(p => p.id === campaignId);
    if (promo) {
      setSelectedPromo(promo);
    } else {
      try {
        const { data, error } = await api.supabase
          .from('promociones')
          .select('*')
          .eq('id', campaignId)
          .single();
        if (error) {
          console.error("Error fetching promo terms:", error);
          toast.error("No se pudieron cargar los términos de esta promoción.");
          return;
        }
        if (data) {
          setSelectedPromo(data);
        }
      } catch (err) {
        console.error("Error in handleShowPromoTerms:", err);
      }
    }
  };

  const handleRedeemCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) {
      toast.error('Por favor ingresa un código de cupón');
      return;
    }
    if (!userId) {
      toast.error('Inicia sesión para canjear un cupón');
      return;
    }

    setRedeemLoading(true);
    try {
      const response = await api.redeemWalletCoupon(userId, couponCode.trim());
      if (response && response.success) {
        toast.success(response.message || `¡Cupón canjeado con éxito! Recibiste $${response.amount} de crédito.`);
        setCouponCode('');
        if (onRefresh) {
          await onRefresh();
        }
      } else {
        toast.error(response?.message || 'Error al canjear el cupón.');
      }
    } catch (error) {
      console.error('Error redeeming wallet coupon:', error);
      toast.error(error.message || 'Error al procesar el cupón.');
    } finally {
      setRedeemLoading(false);
    }
  };

  return (
    <div className="wallet-drawer-overlay animate-fade-in" onClick={onClose}>
      <div className="wallet-drawer-content" onClick={e => e.stopPropagation()}>
        <header className="drawer-header">
          <div className="drawer-title">
            <img src="https://i.postimg.cc/wj0SPCb4/descarga-(31)-(7).png" alt="Wallet" style={{width: 28}} />
            <h3>Mi Wepi Wallet</h3>
          </div>
          <button className="close-drawer" onClick={onClose}>×</button>
        </header>

        <div className="drawer-body">
          <div className="balance-hero">
            <label>Saldo Disponible</label>
            <div className="amount">${(balance || 0).toLocaleString()}</div>
            <p className="balance-hint">Dinero acumulado para tus próximos pedidos</p>
          </div>

          {/* Premium Coupon Redemption Card */}
          <div className="drawer-section coupon-redemption-card">
            <h4>🎟️ ¿Tienes un cupón de regalo?</h4>
            <form onSubmit={handleRedeemCoupon} className="coupon-redeem-form">
              <div className="coupon-input-wrapper">
                <input
                  type="text"
                  placeholder="Ej: INSTA1000"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  disabled={redeemLoading}
                  className="coupon-redeem-input"
                />
                <button 
                  type="submit" 
                  disabled={redeemLoading} 
                  className="coupon-redeem-button"
                >
                  {redeemLoading ? (
                    <span className="spinner-small"></span>
                  ) : (
                    'Canjear'
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="drawer-section">
            <h4>📜 Historial de Movimientos</h4>
            <div className="credits-list">
              {transactions && transactions.length > 0 ? transactions.map(trans => {
                const isExpired = trans.type === 'earn' && trans.expires_at && new Date(trans.expires_at) < new Date();
                const isEarn = trans.type === 'earn';
                const hasCampaign = !!trans.campaign_id;
                
                return (
                  <div key={trans.id} className={`credit-item-card ${isExpired ? 'expired-trans' : ''}`}>
                    <div className="item-info">
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <span className="item-name">{isEarn ? 'Crédito Ganado' : 'Crédito Usado'}</span>
                        {isExpired && <span className="badge-vencido">Vencido</span>}
                      </div>
                      <span className={`item-value ${isEarn ? 'plus' : 'minus'}`}>
                        {isEarn ? '+' : '−'}${Number(trans.amount).toLocaleString()}
                      </span>
                      <div className="item-meta">
                        <span>{trans.description}</span>
                        {isEarn && trans.expires_at && (
                          <span style={{display: 'block', marginTop: '2px'}}>
                            ⏳ {isExpired ? 'Venció el' : 'Vence el'} {new Date(trans.expires_at).toLocaleDateString('es-AR')}
                          </span>
                        )}
                      </div>
                    </div>
                    {hasCampaign && (
                      <button 
                        type="button" 
                        className="btn-info-legal" 
                        onClick={() => handleShowPromoTerms(trans.campaign_id)}
                        style={{ marginLeft: '12px', flexShrink: 0 }}
                      >
                        ℹ️ Ver T&C
                      </button>
                    )}
                  </div>
                );
              }) : (
                <div className="empty-state-simple">
                  No tienes movimientos en tu billetera.
                </div>
              )}
            </div>
          </div>

          <div className="drawer-section">
             <h4>🎁 Promos Disponibles</h4>
             <div className="credits-list">
                {promotions.filter(p => p.tipo === 'credito' && p.activo).map(promo => (
                  <div key={promo.id} className="credit-item-card promo-hint-card">
                     <div className="item-info">
                        <span className="item-name">{promo.nombre}</span>
                        <span className="item-meta">¡Ganá hasta ${promo.beneficios?.tope_valor || ''} con esta promo!</span>
                     </div>
                     <button className="btn-info-legal" onClick={() => setSelectedPromo(promo)}>Ver T&C</button>
                  </div>
                ))}
             </div>
          </div>
        </div>

        {selectedPromo && (
          <div className="legal-popup-overlay" onClick={() => setSelectedPromo(null)}>
            <div className="legal-popup-content" onClick={e => e.stopPropagation()}>
              <header>
                <h5>Términos y Condiciones</h5>
                <button onClick={() => setSelectedPromo(null)}>×</button>
              </header>
              <div className="legal-text">
                <h6>{selectedPromo.nombre}</h6>
                <p>{selectedPromo.metadata?.terminos || 'Válido para pedidos que cumplan los requisitos de la promoción.'}</p>
                <div className="legal-details">
                  <div>• Compra mínima: ${selectedPromo.triggers?.min_compra || 0}</div>
                  <div>• Vencimiento: {selectedPromo.requisitos?.vencimiento_dias || 7} días</div>
                  <div>• Máx. uso: {selectedPromo.requisitos?.max_porcentaje_uso || 100}% del pedido</div>
                </div>
              </div>
              <button className="btn btn-primary btn-full" onClick={() => setSelectedPromo(null)}>Entendido</button>
            </div>
          </div>
        )}

        {/* Widget Mundialista Flotante (Commented out) */}
        {/* <Link to="/mundialista" className="floating-mundial-trophy" title="¡Campaña Mundialista Wepi! 🏆">
          <span className="trophy-emoji">🏆</span>
          <span className="trophy-text">Mundial Wepi</span>
        </Link> */}

        {/* {showMundialPopup && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 11000,
            padding: '16px'
          }} onClick={() => setShowMundialPopup(false)}>
            <div 
              style={{
                width: '100%',
                maxWidth: '380px',
                backgroundColor: '#0f172a',
                borderRadius: '24px',
                border: '2px solid #fbbf24',
                boxShadow: '0 0 30px rgba(251, 191, 36, 0.3)',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }} 
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowMundialPopup(false)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  zIndex: 2
                }}
              >
                ✕
              </button>

              <div style={{ position: 'relative', width: '100%', height: '320px', overflow: 'hidden' }}>
                <img 
                  src="https://i.postimg.cc/zDg4r1YD/Chat-GPT-Image-Jun-4-2026-08-00-24-PM.png" 
                  alt="Mundial Wepi" 
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center'
                  }} 
                />
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '80px',
                  background: 'linear-gradient(to top, #0f172a, transparent)'
                }} />
              </div>

              <div style={{ padding: '24px', textAlign: 'center', color: '#ffffff' }}>
                <span style={{
                  background: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid #fbbf24',
                  color: '#fbbf24',
                  padding: '6px 16px',
                  borderRadius: '50px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  display: 'inline-block',
                  marginBottom: '16px'
                }}>
                  ¡Campaña Mundialista! 🏆
                </span>

                <h3 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', fontWeight: '800', color: '#ffffff' }}>
                  ¡Sumaste puntos para el ranking! ⚽
                </h3>

                <p style={{ margin: '0 0 20px 0', color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5' }}>
                  Ganaste <strong style={{ color: '#fbbf24', fontSize: '1.1rem' }}>puntos</strong> para el ranking. 
                  Participá por premios exclusivos y liderá la tabla local de Wepi.
                </p>

                <Link 
                  to="/mundialista" 
                  onClick={() => setShowMundialPopup(false)}
                  style={{
                    display: 'block',
                    background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                    color: '#000000',
                    padding: '14px',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    textDecoration: 'none',
                    boxShadow: '0 4px 15px rgba(251, 191, 36, 0.3)',
                    transition: 'all 0.2s ease',
                    marginBottom: '12px'
                  }}
                >
                  Ir al Ranking 🥇
                </Link>

                <button 
                  onClick={() => setShowMundialPopup(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Seguir Comprando
                </button>
              </div>
            </div>
          </div>
        )} */}
      {/* ESPERA PANEL MODAL */}
      {showEsperaPanel && (
        <div className="wa-optin-modal-overlay" style={{ zIndex: 999999 }}>
          <div className="wa-optin-modal-content animate-slide-up" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>?</div>
            <h4 style={{ margin: '0 0 12px 0', color: '#1e293b' }}>Dejar en espera</h4>
            <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '20px' }}>
              Durante 10 minutos seguiremos buscando un repartidor para tu pedido.
            </p>
            
            <div style={{ margin: '12px 0 20px 0', display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#f0fdf4', padding: '12px', borderRadius: '12px', border: '1px solid #bbf7d0', textAlign: 'left' }}>
              <input 
                type="checkbox" 
                id="wa-optin-espera"
                checked={whatsappCheckoutOptIn}
                onChange={e => setWhatsappCheckoutOptIn(e.target.checked)}
                style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#25D366' }}
              />
              <label htmlFor="wa-optin-espera" style={{ fontSize: '0.85rem', color: '#166534', lineHeight: '1.4', cursor: 'pointer', margin: 0, marginTop: '2px', fontWeight: '500' }}>
                Aceptalo para recibir un aviso cuando encontramos al repartidor.
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn btn-full"
                style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '12px' }}
                onClick={() => setShowEsperaPanel(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-full"
                style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '12px' }}
                onClick={() => {
                  setShowEsperaPanel(false);
                  setDriverSearchTimeout(false);
                  setEnEsperaExtra(true);
                  setSearchSeconds(0);
                  api.extenderEsperaRepartidor(pendingOrderId, whatsappCheckoutOptIn, user?.telefono);
                  toast.success('El pedido qued� en espera por 10 minutos ?');
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}