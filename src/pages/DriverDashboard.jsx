import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { useJsApiLoader } from '@react-google-maps/api';
import CountdownTimer from '../components/CountdownTimer';
import { isValidEmail } from '../utils/validation';
import toast from 'react-hot-toast';
import MapProbandoComponent from '../components/MapProbandoComponent';
import './DriverDashboard.css';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const GOOGLE_MAPS_LIBRARIES = ['places'];

export default function DriverDashboard() {
  const { driver, loginAsDriver, logoutDriver } = useAuth();
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
    console.error("❌ Error loading Google Maps in DriverDashboard:", loadError);
  }

  const [authView, setAuthView] = React.useState('login');
  const [authLoading, setAuthLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showTerms, setShowTerms] = React.useState(false);
  const [showRegretModal, setShowRegretModal] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // Dashboard state
  const [driverData, setDriverData] = React.useState(null);
  const [isEditingEmail, setIsEditingEmail] = React.useState(false);
  const [tempEmail, setTempEmail] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('disponibles'); // 'disponibles', 'historial'
  const [pedidos, setPedidos] = React.useState([]);
  const [historial, setHistorial] = React.useState([]); 
  const [archivados, setArchivados] = React.useState([]);
  const [loadingArchivados, setLoadingArchivados] = React.useState(false);
  const [expandedCierre, setExpandedCierre] = React.useState(null);
  const [availableDriversCount, setAvailableDriversCount] = React.useState(0);

  const [localInfo, setLocalInfo] = React.useState({ nombre: '', direccion: '', lat: null, lng: null });
  const [montoLocal, setMontoLocal] = React.useState(0);
  const [realStats, setRealStats] = React.useState({ viajesHoy: 0, gananciasTotalesHoy: 0, viajesTotales: 0, gananciasGlobales: 0 });

  // Map state
  const [deliveryCoords, setDeliveryCoords] = React.useState({ lat: null, lng: null });
  const geocoderRef = React.useRef(null);
  const lastLocationSyncRef = React.useRef(0);
  const timeoutsRef = React.useRef({});

  // New views state
  const [view, setView] = React.useState('main'); // 'main', 'cobros', 'perfil', 'historial', 'archivados'
  const [showStats, setShowStats] = React.useState(true);
  const [cobrosData, setCobrosData] = React.useState(null);
  const [cobrosLoading, setCobrosLoading] = React.useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);
  const [partnerPinInput, setPartnerPinInput] = React.useState('');
  const [linking, setLinking] = React.useState(false);

  // Gamification state
  const [gamificationStats, setGamificationStats] = React.useState(null);
  const [ranking, setRanking] = React.useState([]);
  const [showRankingModal, setShowRankingModal] = React.useState(false);
  const [pointsHistory, setPointsHistory] = React.useState([]);
  const [showHistoryModal, setShowHistoryModal] = React.useState(false);

  const [driverLocation, setDriverLocation] = React.useState({ lat: null, lng: null });
  const [timeLeftStr, setTimeLeftStr] = React.useState('');
  const [notificationStatus, setNotificationStatus] = React.useState('loading'); // 'loading', 'granted', 'denied', 'default'
  const [isIOS, setIsIOS] = React.useState(false);
  const [isAndroid, setIsAndroid] = React.useState(false);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState(null);
  const [showPWAInstructions, setShowPWAInstructions] = React.useState(false);
  const [activeLocales, setActiveLocales] = React.useState([]);
  const [loadingLocales, setLoadingLocales] = React.useState(false);
  const [routeSequence, setRouteSequence] = React.useState([]);
  const [dismissedBroadcasts, setDismissedBroadcasts] = React.useState({});
  const [scheduledDates, setScheduledDates] = React.useState({});
  const [expandedOrders, setExpandedOrders] = React.useState({});
  const [directions, setDirections] = React.useState(null);
  const [now, setNow] = React.useState(new Date());

  const lastOriginRef = React.useRef(null);
  const lastPointsSignatureRef = React.useRef("");
  const geocodeAttemptsRef = React.useRef(new Set());
  const lastRouteRequestTimeRef = React.useRef(0);

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);



  const toggleOrderExpand = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // ─── LÓGICA DE NAVEGACIÓN (DIRECTIONS) ───
  React.useEffect(() => {
    if (!isMapLoaded || !driverLocation.lat || !driverLocation.lng) return;

    // 1. Recolectar todos los puntos de interés (Retiros y Entregas)
    const pedidosEnCurso = pedidos.filter(p => !p.esBroadcast && ['Confirmado', 'Retirado', 'Pendiente de Pago', 'Pendiente', 'Aceptado', 'Listo', 'Preparando'].includes(p.estado));
    const pointsMap = new Map(); // Usar Map para evitar duplicados en la misma coordenada
    
    pedidosEnCurso.forEach(p => {
      const isRetirado = p.estado === 'Retirado';
      const localObj = Array.isArray(p.locales) ? p.locales[0] : p.locales;
      
      const lat = isRetirado ? Number(p.lat) : Number(localObj?.lat || p.local_lat);
      const lng = isRetirado ? Number(p.lng) : Number(localObj?.lng || p.local_lng);
      
      if (lat && lng) {
        pointsMap.set(`${lat},${lng}`, { lat, lng });
      }
    });

    const uniquePoints = Array.from(pointsMap.values());

    if (uniquePoints.length === 0) {
      if (directions) setDirections(null);
      lastOriginRef.current = null;
      lastPointsSignatureRef.current = "";
      return;
    }

    // Comparar firma de puntos y distancia recorrida
    const currentPointsSignature = JSON.stringify(uniquePoints);
    const originLat = Number(driverLocation.lat);
    const originLng = Number(driverLocation.lng);

    let shouldRequest = false;

    if (currentPointsSignature !== lastPointsSignatureRef.current) {
      shouldRequest = true;
    } else if (!lastOriginRef.current) {
      shouldRequest = true;
    } else {
      const dist = getDistanceMeters(
        originLat, originLng,
        lastOriginRef.current.lat, lastOriginRef.current.lng
      );
      if (dist > 150) { // Umbral de 150 metros (optimizado de 50m)
        shouldRequest = true;
      }
    }

    if (!shouldRequest) {
      console.log("ℹ️ Saltando llamada a Directions API (sin cambios significativos en ruta u origen)");
      return;
    }

    // Throttling para evitar sobreconsulta (máximo una llamada cada 30 segundos)
    const nowTime = Date.now();
    if (nowTime - lastRouteRequestTimeRef.current < 30000) {
      console.log("ℹ️ Throttling route request to prevent Google API key overuse.");
      return;
    }
    lastRouteRequestTimeRef.current = nowTime;

    // Actualizar referencias antes de la llamada para evitar solicitudes concurrentes
    lastOriginRef.current = { lat: originLat, lng: originLng };
    lastPointsSignatureRef.current = currentPointsSignature;

    // 2. Configurar la ruta con Waypoints
    // El último punto será el destino, los intermedios serán waypoints
    const destination = uniquePoints[uniquePoints.length - 1];
    const waypoints = uniquePoints.slice(0, -1).map(p => ({
      location: p,
      stopover: true
    }));

    const directionsService = new window.google.maps.DirectionsService();
    console.log("🛣️ Solicitando ruta multi-punto optimizada...");
    
    directionsService.route(
      {
        origin: { lat: originLat, lng: originLng },
        destination: destination,
        waypoints: waypoints,
        optimizeWaypoints: true, // Google optimiza el orden de las paradas
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          console.log("✅ Ruta multi-punto optimizada con éxito");
          setDirections(result);
          
          // Extraer la secuencia optimizada para mostrar en la UI
          const route = result.routes[0];
          const sequence = [];
          
          // El origen es el repartidor (no lo contamos como parada)
          // Las paradas intermedias y el destino final
          if (route.legs.length > 0) {
            route.legs.forEach((leg, i) => {
              sequence.push({
                address: leg.end_address,
                lat: leg.end_location.lat(),
                lng: leg.end_location.lng(),
                distance: leg.distance.text,
                duration: leg.duration.text
              });
            });
          }
          setRouteSequence(sequence);
        } else {
          console.error(`❌ Error calculando ruta multi-punto: ${status}`);
          if (status === 'ZERO_RESULTS') {
            toast.error("No se encontró una ruta por calle.");
          }
          // IMPORTANTE: NO limpiar las referencias a null/vacío ante un error.
          // Al mantener lastOriginRef, evitamos entrar en un bucle inmediato de reintentos rápidos
          // en la siguiente actualización del GPS del repartidor.
        }
      }
    );
  }, [isMapLoaded, driverLocation, pedidos]);

  React.useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isAndroidDevice = /Android/.test(navigator.userAgent);
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);
    setIsStandalone(isStandaloneMode);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Geolocation Watcher
  React.useEffect(() => {
    let watchId = null;
    if (isActive && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          console.log("📍 Ubicación actualizada:", position.coords.latitude, position.coords.longitude, "Precisión:", position.coords.accuracy);
          setDriverLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          // Sincronizar con DB para seguimiento en tiempo real del cliente (Throttle: 20 segundos para evitar saturación de base de datos)
          if (driver?.id) {
            const nowTime = Date.now();
            if (nowTime - lastLocationSyncRef.current >= 20000) {
              lastLocationSyncRef.current = nowTime;
              api.updateDriverCoords(driver.id, position.coords.latitude, position.coords.longitude)
                .catch(err => console.warn("Error syncing coords:", err));
            }
          }

        },
        (error) => {
          console.error("❌ Error en GPS Watcher:", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [isActive]);

  const iniciarGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta GPS.');
      return;
    }
    
    toast.loading('Obteniendo ubicación exacta...', { id: 'gps-load' });
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.success('GPS Calibrado', { id: 'gps-load' });
        console.log("🎯 GPS Manual:", pos.coords.latitude, pos.coords.longitude, "Acc:", pos.coords.accuracy);
        setDriverLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      (err) => {
        toast.error('Error: ' + err.message, { id: 'gps-load' });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const isLocalOpen = React.useCallback((local) => {
    if (!local) return false;

    // Verificar si ya pasó la fecha de disponibilidad
    if (local.disponible_desde) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parts = local.disponible_desde.split('-');
      const availableDate = new Date(parts[0], parts[1] - 1, parts[2]);
      if (today < availableDate) return false;
    }
    
    // Si no tiene modo automático, dependemos del estado manual
    if (!local.modo_automatico) {
      return local.estado?.toLowerCase() === 'activo';
    }

    // Si tiene modo automático, verificamos horario y días
    const { horario_apertura, horario_cierre, dias_apertura } = local;
    if (!horario_apertura || !horario_cierre) return local.estado?.toLowerCase() === 'activo';

    // Verificar días
    if (dias_apertura && Array.isArray(dias_apertura) && dias_apertura.length > 0) {
      const daysMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const currentDayName = daysMap[new Date().getDay()];
      const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const normalizedDays = dias_apertura.map(normalize);
      const normalizedCurrentDay = normalize(currentDayName);
      if (!normalizedDays.includes(normalizedCurrentDay)) return false;
    }

    // Verificar horario
    const [hA, mA] = horario_apertura.split(':').map(Number);
    const [hC, mC] = horario_cierre.split(':').map(Number);
    const minApertura = hA * 60 + mA;
    const minCierre = hC * 60 + mC;
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();

    let insideTime = false;
    if (minApertura < minCierre) {
      insideTime = current >= minApertura && current <= minCierre;
    } else {
      insideTime = current >= minApertura || current <= minCierre;
    }

    return insideTime;
  }, []);

  const fetchActiveLocales = React.useCallback(async () => {
    setLoadingLocales(true);
    try {
      const allLocales = await api.getLocales();
      const active = allLocales.filter(l => isLocalOpen(l));
      setActiveLocales(active);
    } catch (err) {
      console.error("Error fetching active locales:", err);
    } finally {
      setLoadingLocales(false);
    }
  }, [isLocalOpen]);

  // Modals state
  const [showEntregaModal, setShowEntregaModal] = React.useState(false);
  const [showRetiroModal, setShowRetiroModal] = React.useState(false);
  const [showChatModal, setShowChatModal] = React.useState(false);
  const [activeChatPedidoId, setActiveChatPedidoId] = React.useState(null);
  const [chatMessages, setChatMessages] = React.useState([]);
  const [chatInput, setChatInput] = React.useState('');
  const [pinInput, setPinInput] = React.useState('');
  const [showMap, setShowMap] = React.useState(false);
  const [showSessionModal, setShowSessionModal] = React.useState(false);
  const [activePedido, setActivePedido] = React.useState(null);
  const [cashConfirmPedido, setCashConfirmPedido] = React.useState(null);

  // Sesion Timer Effect - ELIMINADO (Always active)
  React.useEffect(() => {
    if (isActive && driver) {
      iniciarGPS();
    }
  }, [isActive, driver]);

  // Realtime Chat Subscription
  React.useEffect(() => {
    if (!activeChatPedidoId) return;

    const channel = api.supabase
      .channel(`chat_${activeChatPedidoId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_pedidos',
        filter: `id_pedido=eq.${activeChatPedidoId}`
      }, (payload) => {
        setChatMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      api.supabase.removeChannel(channel);
    };
  }, [activeChatPedidoId]);



  const loadData = React.useCallback(async () => {
    try {
      if (!driver) return;
      const d = await api.repartidorGetDatos(driver.id);
      if (d?.success && d.data) {
        setDriverData(d.data);
        // Sync email confirmation state with context
        if (d.data.EmailConfirmado !== driver.emailConfirmado) {
          loginAsDriver(d.data);
        }
      } else {
        setDriverData(prev => prev || {
          Nombre: driver.nombre || driver.email?.split('@')[0] || 'Repartidor',
          Email: driver.email || '',
          admin_status: driver.admin_status || 'Pendiente'
        });
      }
      // Load balance and history server-side
      loadCobros();
      fetchHistorial();
      loadRealStats();
      loadGamification();
      loadScheduledDates();
      fetchArchivados();
    } catch (e) {
      toast.error('Error al cargar datos');
      setDriverData(prev => prev || {
        Nombre: driver.nombre || driver.email?.split('@')[0] || 'Repartidor',
        Email: driver.email || '',
        admin_status: driver.admin_status || 'Pendiente'
      });
    }
  }, [driver, loginAsDriver]);

  const loadScheduledDates = async () => {
    if (!driver) return;
    try {
      const dates = await api.repartidorGetScheduledPayments(driver.id);
      setScheduledDates(dates);
    } catch (err) {
      console.error("Error loading scheduled dates:", err);
    }
  };

  const loadGamification = async () => {
    if (!driver) return;
    try {
      const stats = await api.getDriverGamificationStats(driver.id);
      if (stats.success) setGamificationStats(stats.data);
      
      const rank = await api.getDriverRanking();
      if (rank.success) setRanking(rank.data);
    } catch (err) { console.error(err); }
  };

  const loadPointsHistory = async () => {
    if (!driver) return;
    try {
      const res = await api.getDriverPointsHistory(driver.id);
      if (res.success) setPointsHistory(res.data);
      setShowHistoryModal(true);
    } catch (err) { toast.error('Error al cargar historial'); }
  };

  const loadRealStats = async () => {
    if (!driver) return;
    try {
      const s = await api.repartidorGetDashboardStats(driver.id);
      if (s.success) setRealStats(s);
    } catch (err) { console.error(err); }
  };

  const fetchHistorial = async () => {
    if (!driver) return;
    try {
      const res = await api.getRepartidorHistorial(driver.id);
      if (res.success) setHistorial(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchArchivados = async () => {
    if (!driver) return;
    setLoadingArchivados(true);
    try {
      const res = await api.getRepartidorCierresArchivados(driver.id);
      if (res.success) {
        setArchivados(res.data);
      }
    } catch (err) {
      console.error("Error fetching archived closures:", err);
    } finally {
      setLoadingArchivados(false);
    }
  };

  const fetchPedidos = React.useCallback(async (silent = false) => {
    if (!driver) return;
    try {
      const res = await api.getPedidosDisponibles(driver.id);
      
      // Filtrar pedidos en curso (ya aceptados o asignados)
      const enCurso = (res.data || []).filter(p => !p.esBroadcast && ['Confirmado', 'Retirado', 'Pendiente de Pago', 'Pendiente', 'Aceptado', 'Listo', 'Preparando'].includes(p.estado));
      
      // Si ya tiene 3 o más, solo mostramos los suyos y ocultamos el aviso de nuevos pedidos
      if (enCurso.length >= 3) {
        setPedidos(enCurso.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
      } else if (res.success) {
        // Batch fetch locales to avoid N+1 query and prevent 406 join error
        const ordersToEnrich = (res.data || []).filter(
          p => ['Confirmado', 'Retirado', 'En camino', 'Listo', 'Preparando', 'Aceptado'].includes(p.estado) && p.local_id
        );
        const uniqueLocalIds = [...new Set(ordersToEnrich.map(p => p.local_id))].filter(Boolean);

        let localesMap = {};
        if (uniqueLocalIds.length > 0) {
          try {
            const { data: localesList } = await api.supabase
              .from('locales')
              .select('id, nombre, direccion, lat, lng')
              .in('id', uniqueLocalIds);
            
            if (localesList) {
              localesList.forEach(l => {
                localesMap[l.id] = l;
              });
            }
          } catch (e) {
            console.error("Error batch fetching locales:", e);
          }
        }

        const enriched = (res.data || []).map(p => {
          if (['Confirmado', 'Retirado', 'En camino', 'Listo', 'Preparando', 'Aceptado'].includes(p.estado) && p.local_id) {
            const lData = localesMap[p.local_id];
            if (lData) {
              return { 
                ...p, 
                local_nombre: lData.nombre, 
                local_direccion: lData.direccion, 
                local_lat: lData.lat, 
                local_lng: lData.lng 
              };
            }
          }
          return p;
        });

        const sorted = enriched.sort((a, b) => a.id.localeCompare(b.id));
        setPedidos(prev => {
          const pendientesNuevos = sorted.filter(p => p.estado === 'Pendiente');
          const pendientesViejos = prev.filter(p => p.estado === 'Pendiente');
          if (pendientesNuevos.length > pendientesViejos.length) {
            api.playNotificationSound();
          }
          return sorted;
        });
      }
    } catch (err) {
      console.error("❌ Error en fetchPedidos:", err);
    }
  }, [driver]);

  const checkAvailability = React.useCallback(async () => {
    if (!driver) return;
    try {
      const count = await api.getRepartidoresActivosCount(driver.id);
      setAvailableDriversCount(count);
    } catch (err) {
      console.error("Error checking availability:", err);
    }
  }, [driver]);

  // Realtime Orders Subscription
  React.useEffect(() => {
    if (!driver) return;

    console.log("📡 Subscribing to realtime updates for pedidos_general...");

    const channel = api.supabase
      .channel('public:pedidos_general_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'pedidos_general'
      }, (payload) => {
        console.log("🔔 Realtime update on pedidos_general received:", payload);
        fetchPedidos(true);

        // Si es un nuevo pedido broadcast no asignado en un estado activo de reparto,
        // programamos un fetchPedidos diferido para los repartidores sin prioridad (10 segundos)
        const newOrder = payload.new;
        if (
          newOrder &&
          !newOrder.repartidor_id &&
          newOrder.tipo_entrega === 'Con Envío' &&
          ['Pendiente', 'Buscando Repartidor', 'Confirmado'].includes(newOrder.estado)
        ) {
          const createdTime = new Date(newOrder.created_at).getTime();
          const delayRemaining = 10000 - (Date.now() - createdTime);
          
          if (delayRemaining > 0) {
            if (timeoutsRef.current[newOrder.id]) {
              clearTimeout(timeoutsRef.current[newOrder.id]);
            }
            
            console.log(`⏳ Scheduling delayed fetchPedidos in ${delayRemaining}ms for order ${newOrder.id}`);
            timeoutsRef.current[newOrder.id] = setTimeout(() => {
              console.log(`⏰ Executing delayed fetchPedidos for order ${newOrder.id}`);
              fetchPedidos(true);
              delete timeoutsRef.current[newOrder.id];
            }, delayRemaining + 500);
          }
        }
      })
      .subscribe();

    return () => {
      api.supabase.removeChannel(channel);
      Object.values(timeoutsRef.current).forEach(clearTimeout);
      timeoutsRef.current = {};
    };
  }, [driver, fetchPedidos]);  const handleSolicitarVinculacion = async (e) => {
    e.preventDefault();
    if (!partnerPinInput.trim()) return;
    setLinking(true);
    try {
      const res = await api.solicitarVinculacionPartner(driver.id, partnerPinInput);
      if (res.success) {
        toast.success(`Solicitud enviada a ${res.partnerNombre}`);
        setPartnerPinInput('');
        loadData();
      } else {
        toast.error(res.error || "Código PIN inválido o partner no encontrado");
      }
    } catch (err) {
      toast.error("Error al solicitar vinculación: " + err.message);
    } finally {
      setLinking(false);
    }
  };

  const handleCancelarSolicitud = async () => {
    if (!window.confirm("¿Seguro que deseas cancelar tu solicitud de vinculación?")) return;
    try {
      const res = await api.cancelarSolicitudVinculacion(driver.id);
      if (res.success) {
        toast.success("Solicitud cancelada");
        loadData();
      } else {
        toast.error("Error al cancelar solicitud");
      }
    } catch (err) {
      toast.error("Error: " + err.message);
    }
  };

  const handleDesvincularPropio = async () => {
    if (!window.confirm("¿Seguro que deseas desvincularte de la empresa partner? Dejarás de recibir sus pedidos asignados.")) return;
    try {
      const res = await api.desvincularDriver(driver.id);
      if (res.success) {
        toast.success("Te has desvinculado con éxito");
        loadData();
      } else {
        toast.error("Error al desvincularte");
      }
    } catch (err) {
      toast.error("Error: " + err.message);
    }
  };

  // On Login/Load
  React.useEffect(() => {
    if (driver) {
      if (driver.esPartner) {
        window.location.replace('/partners');
        return;
      }
      loadData();
      
      // ─── Sync Push Notifications (Hybrid Native/Web) ───
      const platform = Capacitor.getPlatform();
      if (platform === 'ios' || platform === 'android') {
        // Native App: Use Firebase Cloud Messaging (FCM) via Capacitor PushNotifications
        console.log("🔔 Push: Native environment detected. Using Firebase FCM.");
        
        PushNotifications.checkPermissions().then((res) => {
          if (res.receive !== 'granted') {
            PushNotifications.requestPermissions().then((res) => {
              if (res.receive === 'denied') {
                console.log("Push permissions denied.");
                setNotificationStatus('denied');
              } else {
                setNotificationStatus('granted');
                PushNotifications.register();
              }
            });
          } else {
            setNotificationStatus('granted');
            PushNotifications.register();
          }
        });

        PushNotifications.addListener('registration', async (token) => {
          console.log("✅ Firebase FCM Token obtained:", token.value);
          await api.repartidorUpdateFcmToken(driver.id, token.value).catch(console.error);
        });

        PushNotifications.addListener('registrationError', (error) => {
          console.error("❌ Firebase FCM Error:", error);
        });

      } else {
        // PWA/Web: Use OneSignal
        console.log("🔔 Push: Web environment detected. Using OneSignal.");
        if (window.OneSignalDeferred) {
          window.OneSignalDeferred.push(async (OneSignal) => {
            try {
              const updateStatus = () => {
                const perm = OneSignal.Notifications.permission;
                setNotificationStatus(perm ? 'granted' : (OneSignal.Notifications.permissionNative === 'denied' ? 'denied' : 'default'));
              };
              updateStatus();

              const currentSubscription = OneSignal.User.PushSubscription;
              if (currentSubscription.id) {
                await api.repartidorUpdateOneSignalId(driver.id, currentSubscription.id);
              }

              OneSignal.Notifications.addEventListener("permissionChange", async (permission) => {
                updateStatus();
                if (permission) {
                  const sub = OneSignal.User.PushSubscription;
                  if (sub.id) {
                    await api.repartidorUpdateOneSignalId(driver.id, sub.id).catch(console.error);
                  }
                }
              });

              OneSignal.User.PushSubscription.addEventListener("change", async (event) => {
                const newId = event.current?.id || OneSignal.User.PushSubscription.id;
                if (newId) {
                  await api.repartidorUpdateOneSignalId(driver.id, newId).catch(console.error);
                }
              });

              if (!isIOS && OneSignal.Notifications.permissionNative === 'default' && isActive) {
                const granted = await OneSignal.Notifications.requestPermission();
                if (granted) {
                  setTimeout(async () => {
                    const subId = OneSignal.User.PushSubscription.id;
                    if (subId) {
                      await api.repartidorUpdateOneSignalId(driver.id, subId).catch(console.error);
                    }
                  }, 1000);
                }
              }
            } catch (err) {
              console.error("❌ OneSignal Sync Error:", err);
            }
          });
        }
      }

      fetchActiveLocales();
    }
    fetchActiveLocales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver]);

  // Intercepción Deep Link para rescate de demanda (whatsapp)
  React.useEffect(() => {
    if (driver && driver.ciudad) {
      const searchParams = new URLSearchParams(window.location.search);
      const conectar = searchParams.get('conectar');
      if (conectar === 'true') {
        api.notifyWaitingClients(driver.ciudad).then(res => {
          if (res.success && res.count > 0) {
            toast.success(`¡Acabamos de avisar a ${res.count} clientes en espera que estás disponible!`);
          } else if (res.success) {
            toast.success("¡Estás activo para recibir pedidos!");
          }
        }).catch(err => console.error("Error notifyWaitingClients:", err));
        
        // Limpiar URL
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({path: newUrl}, '', newUrl);
      }
    }
  }, [driver]);

  // Polling para pedidos disponibles y Heartbeat
  React.useEffect(() => {
    let interval;
    let heartbeatInterval;
    let hadInteraction = true; // assume true initially

    const handleInteraction = () => {
      hadInteraction = true;
    };

    if (driver) {
      // 1. Consulta inicial (Siempre para ver broadcast)
      fetchPedidos();
      checkAvailability();
      fetchActiveLocales();
      
      // 2. Polling de disponibilidad, locales activos y resguardo de pedidos (cada 20s)
      interval = setInterval(() => {
        fetchPedidos(true);
        if (isActive) checkAvailability();
        fetchActiveLocales();
      }, 20000);

      // 3. Lógica solo si está ACTIVO (Interacción y Heartbeat)
      if (isActive) {
        window.addEventListener('mousemove', handleInteraction);
        window.addEventListener('touchstart', handleInteraction);
        window.addEventListener('scroll', handleInteraction);

        // Heartbeat cada 60s para mantener sesión activa
        heartbeatInterval = setInterval(async () => {
          api.repartidorUpdateHeartbeat(driver.id, hadInteraction);
          hadInteraction = false;
          
          try {
            const d = await api.repartidorGetDatos(driver.id);
            if (d?.success && d.data) {
              if (d.data.Estado === 'Inactivo') {
                toast.error('Sesión terminada por inactividad.');
                setIsActive(false);
                setDriverData(d.data);
              }
            }
          } catch (e) { console.error(e); }
        }, 60000);

        api.repartidorUpdateHeartbeat(driver.id, true);
      }
    }

    return () => {
      clearInterval(interval);
      clearInterval(heartbeatInterval);
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('scroll', handleInteraction);
    };
  }, [driver, isActive, fetchPedidos, checkAvailability]);

  // React.useEffect(() => {
  //   const handleUnload = () => { ... } 
  //   Evitamos desconectar al refrescar. El CRON de inactividad se encarga si cierran la página.
  // }, [driver, isActive]);

  // Sincronizar localInfo con el pedido en viaje principal para retrocompatibilidad
  React.useEffect(() => {
    const enViaje = pedidos.find(p => ['Confirmado', 'Retirado', 'En camino', 'Pendiente de Pago', 'Aceptado', 'Listo', 'Preparando'].includes(p.estado));
    if (enViaje && enViaje.local_nombre) {
      setLocalInfo({
        nombre: enViaje.local_nombre,
        direccion: enViaje.local_direccion,
        lat: enViaje.local_lat,
        lng: enViaje.local_lng
      });
    }
  }, [pedidos]);

  // Carga de datos del local para viaje en curso
  React.useEffect(() => {
    if (!isMapLoaded) return;

    const enViaje = pedidos.find(p => !p.esBroadcast && ['Confirmado', 'Retirado', 'Pendiente de Pago', 'Aceptado', 'Listo', 'Preparando'].includes(p.estado));
    if (enViaje) {
      // 1. Cargar datos del local
      if (enViaje.local_id && !enViaje.local_nombre) {
        Promise.all([
          api.getLocalDatos(enViaje.local_id),
          api.getMontoLocalPedido(enViaje.id, enViaje.local_id)
        ]).then(([lData, monto]) => {
          if (lData) {
            setLocalInfo({ 
              nombre: lData.nombre, 
              direccion: lData.direccion,
              lat: lData.lat,
              lng: lData.lng
            });

            // Si el local no tiene coordenadas, intentar geocodificar (FALLBACK)
            if (!lData.lat || !lData.lng) {
              geocodeAndSave(lData.direccion, 'local', enViaje.local_id);
            }
          }
          setMontoLocal(monto || 0);
        }).catch(e => console.error(e));
      }

      // 2. Manejar coordenadas de entrega (estrictamente desde pedidos_general)
      if (enViaje.lat && enViaje.lng) {
        setDeliveryCoords({ lat: enViaje.lat, lng: enViaje.lng });
      } else {
        // Si no existen, intentar geocodificar (FALLBACK)
        geocodeAndSave(enViaje.direccion, 'pedido', enViaje.id);
      }
    } else {
      setLocalInfo({ nombre: '', direccion: '', lat: null, lng: null });
      setDeliveryCoords({ lat: null, lng: null });
      setMontoLocal(0);
    }
  }, [pedidos, isMapLoaded]);

  const geocodeAndSave = (address, type, id) => {
    if (!address || !window.google) return;

    // Evitar reintentos infinitos si ya se intentó en la sesión actual
    const attemptKey = `${type}_${id}`;
    if (geocodeAttemptsRef.current.has(attemptKey)) return;
    geocodeAttemptsRef.current.add(attemptKey);
    
    const lowerAddr = address.toLowerCase();
    const isOberaAddr = lowerAddr.includes('obera') || lowerAddr.includes('oberá');
    const citySuffix = isOberaAddr ? 'Oberá, Misiones, Argentina' : 'Santo Tomé, Corrientes, Argentina';
    const fullAddress = address.includes('Argentina') ? address : `${address}, ${citySuffix}`;
    
    if (!geocoderRef.current) {
      geocoderRef.current = new window.google.maps.Geocoder();
    }

    geocoderRef.current.geocode({ 
      address: fullAddress,
      componentRestrictions: { country: 'AR' }
    }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const latVal = results[0].geometry.location.lat();
        const lngVal = results[0].geometry.location.lng();

        // VALIDACIÓN: Soportar Santo Tomé u Oberá
        const isSantoTome = latVal <= -28.1 && latVal >= -28.9 && lngVal <= -55.7 && lngVal >= -56.4;
        const isObera = latVal <= -27.3 && latVal >= -27.7 && lngVal <= -54.9 && lngVal >= -55.4;
        const isSafe = isSantoTome || isObera;
        
        if (isSafe) {
          if (type === 'local') {
            setLocalInfo(prev => ({ ...prev, lat: latVal, lng: lngVal }));
            api.updateLocalCoords(id, latVal, lngVal).catch(console.error);
          } else {
            setDeliveryCoords({ lat: latVal, lng: lngVal });
            api.updatePedidoCoords(id, latVal, lngVal).catch(console.error);
          }
        } else {
          console.warn('Geocoding result outside bounds, ignoring:', latVal, lngVal);
        }
      }
    });
  };

  // ─── AUTH ACTIONS ───
  const handleLogin = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setAuthLoading(true);
    try {
      const d = await api.repartidorLogin(fd.get('email'), fd.get('password'));
      if (d?.success && d.data) {
        loginAsDriver(d.data);
        toast.success('¡Bienvenido!');
      } else toast.error(d?.error || 'Credenciales incorrectas');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
  };

  const handleResendConfirmation = async () => {
    if (!driverData?.Email) return;
    const loading = toast.loading('Reenviando email...');
    try {
      const res = await api.reenviarEmailConfirmacion(driverData.Email, 'repartidor');
      if (res.success) toast.success('¡Email reenviado!', { id: loading });
      else toast.error(res.error || 'Error al reenviar', { id: loading });
    } catch { toast.error('Error de conexión', { id: loading }); }
  };

  const handleSaveEmailInBanner = async () => {
    if (!isValidEmail(tempEmail)) {
      toast.error('Ingresá un email válido');
      return;
    }
    const loading = toast.loading('Actualizando email...');
    try {
      await api.repartidorUpdatePerfil({
        driverId: driver.id,
        email: tempEmail
      });
      setDriverData(prev => prev ? { ...prev, Email: tempEmail } : null);
      toast.success('Email actualizado', { id: loading });
      setIsEditingEmail(false);
    } catch (err) {
      toast.error('Error al actualizar email: ' + err.message, { id: loading });
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!isValidEmail(fd.get('email'))) { toast.error('Ingresá un email válido'); return; }
    const prefix = fd.get('prefix');
    const localNumber = fd.get('telefono');
    const telefono = `${prefix}${localNumber}`;
    if (!localNumber) { toast.error('El teléfono es obligatorio'); return; }
    setAuthLoading(true);
    try {
      const d = await api.repartidorRegister({
        nombre: fd.get('nombre'), telefono,
        email: fd.get('email'), password: fd.get('password'),
        patente: fd.get('patente').toUpperCase(), marcaModelo: fd.get('marcaModelo'),
        termsAccepted: fd.get('terms_accepted') === 'on' || !!fd.get('terms_accepted'),
        privacyAccepted: fd.get('terms_accepted') === 'on' || !!fd.get('terms_accepted'),
        ciudad: fd.get('ciudad') || 'Santo Tomé'
      });
      if (d?.success) {
        toast.success('¡Registro exitoso! Iniciá sesión.');
        setAuthView('login');
      } else toast.error(d?.error || 'Error al registrar');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
  };

  const loadCobros = async () => {
    if (!driver) return;
    setCobrosLoading(true);
    try {
      const d = await api.repartidorGetCobros(driver.id);
      if (d.success) setCobrosData(d);
    } catch { toast.error('Error al cargar cobros'); }
    setCobrosLoading(false);
  };

  const handleSolicitarCobro = async (monto) => {
    try {
      setCobrosLoading(true);
      const res = await api.repartidorSolicitarCobro(driver.id, monto);
      if (res.success) {
        toast.success('Solicitud enviada');
        loadCobros();
      } else {
        toast.error(res.error || 'Error al solicitar');
      }
    } catch { toast.error('Error de red'); }
    setCobrosLoading(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!isValidEmail(fd.get('email'))) { toast.error('Ingresá un email válido'); return; }
    const prefix = fd.get('prefix');
    const localNumber = fd.get('telefono');
    const telefono = `${prefix}${localNumber}`;
    if (!localNumber) { toast.error('El teléfono es obligatorio'); return; }
    
    const file = fd.get('foto');

    const loading = toast.loading('Guardando perfil...');
    try {
      let fotoUrl = driverData?.FotoUrl || '';
      if (file && (file instanceof File || file instanceof Blob) && file.size > 0) {
        fotoUrl = await api.uploadImage(file);
      }
      
      const params = {
        driverId: driver.id,
        nombre: fd.get('nombre'),
        telefono,
        email: fd.get('email'),
        patente: fd.get('patente'),
        marca_modelo: fd.get('marca_modelo'),
        foto_url: fotoUrl
      };
      
      const pass = fd.get('password');
      if (pass) params.password = pass;

      await api.repartidorUpdatePerfil(params);
      toast.success('Perfil actualizado', { id: loading });
      loadData();
      setView('main');
    } catch (err) { 
      toast.error('Error: ' + err.message, { id: loading }); 
    }
  };

  const handleLogout = () => {
    logoutDriver();
    setDriverData(null);
    toast.success('Sesión cerrada');
  };



  // ─── PEDIDO ACTIONS ───
  const aceptarPedido = async (pedido) => {
    const pedidoId = typeof pedido === 'string' ? pedido : pedido.id;
    const isBroadcast = typeof pedido === 'object' ? pedido.esBroadcast : false;

    // Si es un pedido en efectivo disponible para broadcast, requerimos confirmar que se tiene el dinero
    const isCash = typeof pedido === 'object' && (pedido.pago || '').toLowerCase() === 'efectivo';
    if (isBroadcast && isCash && !pedido.skipCashCheck) {
      setCashConfirmPedido(pedido);
      return;
    }

    toast.loading('Aceptando...', { id: 'ac' });
    try {
      const res = isBroadcast 
        ? await api.aceptarPedidoBroadcast(pedidoId, driver.id)
        : await api.updateEstadoPedido(pedidoId, 'Confirmado', driver.id);
        
      if (res.success) {
        toast.success('¡Pedido aceptado!', { id: 'ac' });
        fetchPedidos();
      } else {
        toast.error(res.error || 'Error al aceptar', { id: 'ac' });
      }
    } catch { toast.error('Error de conexión', { id: 'ac' }); }
  };

  const finalizarRetiro = async (pedido, pin) => {
    if (!pin || pin.length !== 4) return toast.error('Ingresa el PIN de 4 dígitos brindado por el local');
    const tid = toast.loading('Actualizando...', { id: 'ret' });
    try {
      const res = await api.updateEstadoPedido(pedido.id, 'Retirado', driver.id, pin);
      if (res.success) {
        toast.success('Pedido marcado como RETIRADO', { id: tid });
        setShowRetiroModal(false);
        setPinInput('');
        await fetchPedidos(true);
      } else {
        toast.error(res.error || 'Error', { id: tid });
      }
    } catch (err) { 
      console.error("Error en finalizarRetiro:", err);
      toast.error('Error de conexión al marcar retiro', { id: tid }); 
    }
  };

  const confirmarRetiroClick = (pedido) => {
    setActivePedido(pedido);
    setPinInput('');
    setShowRetiroModal(true);
  };

  const confirmarEntregaClick = (pedido) => {
    setActivePedido(pedido);
    setPinInput('');
    setShowEntregaModal(true);
  };

  const finalizarEntrega = async (pedido) => {
    const pin = pinInput; // Capturar PIN actual
    if (!pin || pin.length !== 4) return toast.error('Ingresa el PIN de 4 dígitos brindado por el cliente');
    
    const tid = toast.loading('Confirmando entrega...', { id: 'ent' });
    console.log("🚀 Iniciando finalizarEntrega para pedido:", pedido.id, "con PIN:", pin);
    
    try {
      const res = await api.updateEstadoPedido(pedido.id, 'Entregado', driver.id, pin);
      console.log("✅ Respuesta de api.updateEstadoPedido:", res);
      
      if (res.success) {
        toast.success('¡Entrega confirmada!', { id: tid });
        
        try {
          console.log("🔄 Refrescando datos post-entrega...");
          if (typeof loadCobros === 'function') await loadCobros();
          if (typeof fetchHistorial === 'function') await fetchHistorial();
          await loadRealStats();
        } catch (e) { 
          console.warn("⚠️ Error no crítico refrescando stats:", e); 
        }

        setDriverData(prev => ({ ...prev, PedidosHoy: (prev?.PedidosHoy || 0) + 1 }));
        setShowEntregaModal(false);
        setPinInput('');
        setActiveTab('historial');
        await fetchPedidos(true);
      } else {
        console.warn("❌ Error reportado por el servidor:", res.error);
        toast.error(res.error || 'Error', { id: tid });
      }
    } catch (err) { 
      console.error("🔥 Error CRÍTICO en finalizarEntrega:", err);
      toast.error('Error de conexión al finalizar entrega', { id: tid }); 
    }
  };

  const rechazarPedido = async (pedidoId) => {
    if (!window.confirm('¿Estás seguro de que quieres RECHAZAR este pedido? Se buscará otro repartidor disponible.')) return;
    
    const tid = toast.loading('Reasignando pedido...');
    try {
      const res = await api.repartidorRechazarPedido(pedidoId, driver.id);
      if (res.success) {
        toast.success(`Pedido rechazado. Reasignado a: ${res.nuevoRepartidor || 'otro repartidor'}`, { id: tid });
        fetchPedidos();
        checkAvailability();
      } else {
        toast.error(res.error || 'No se pudo rechazar el pedido', { id: tid });
      }
    } catch (err) {
      toast.error('Error de conexión', { id: tid });
    }
  };



  const openChat = async (pedidoId) => {
    setActiveChatPedidoId(pedidoId);
    setShowChatModal(true);
    setChatMessages([]);
    try {
      const res = await api.getChatMessages(pedidoId);
      if (res.success) setChatMessages(res.data);
    } catch { toast.error('Error al cargar chat'); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatPedidoId) return;
    const msg = chatInput;
    setChatInput('');
    try {
      await api.sendChatMessage(activeChatPedidoId, driver.id, msg);
    } catch { toast.error('Error al enviar mensaje'); }
  };



  // ─── RENDERS ───
  const renderAuth = () => (
    <div className="dd-auth-card card animate-fade-in">
      <div className="card-body">
        <h2>Acceso Repartidor</h2>
        <div className="rd-auth-tabs">
          <button className={`btn ${authView === 'login' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => { setAuthView('login'); setShowPassword(false); }}>Iniciar Sesión</button>
          <button className={`btn ${authView === 'register' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => { setAuthView('register'); setShowPassword(false); }}>Registrarme</button>
        </div>
        {authView === 'login' ? (
          <form onSubmit={handleLogin} className="dd-form" key="login">
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
              {authLoading ? <span className="spinner spinner-white" /> : 'Iniciar Sesión'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="dd-form" key="register">
            <input name="email" type="email" className="form-input" placeholder="Email (Este será tu usuario)" required autoComplete="username" />
            <input name="nombre" className="form-input" placeholder="Nombre completo" required autoComplete="name" />
            <div className="phone-input-group">
              <select name="prefix" className="phone-prefix-select">
                <option value="+549">🇦🇷 +549</option>
                <option value="+55">🇧🇷 +55</option>
              </select>
              <input name="telefono" type="tel" className="form-input phone-number-input" placeholder="Teléfono (ej: 1123456789)" required autoComplete="tel-national" />
            </div>
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
            <input name="patente" className="form-input" placeholder="Patente de la moto" required />
            <input name="marcaModelo" className="form-input" placeholder="Marca y modelo" required />

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
                <option value="Alem (Misiones)">Alem (Misiones)</option>
                <option value="Apóstoles (Misiones)">Apóstoles (Misiones)</option>
                <option value="Villaguay (Entre Ríos)">Villaguay (Entre Ríos)</option>
                <option value="Paso de los Libres (Corrientes)">Paso de los Libres (Corrientes)</option>
                <option value="San Vicente (Misiones)">San Vicente (Misiones)</option>
                <option value="Colon (Entre Ríos)">Colon (Entre Ríos)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '16px', textAlign: 'left' }}>
              {authView === 'register' && (
                <input type="checkbox" id="terms_accepted" name="terms_accepted" required style={{ width: 'auto', marginTop: '4px' }} />
              )}
              <label htmlFor="terms_accepted" style={{ fontSize: '0.85rem', color: 'var(--gray-600)', lineHeight: '1.4' }}>
                {authView === 'register' ? (
                  <>
                    Acepto los <button type="button" style={{ background: 'none', border: 'none', color: 'var(--red-500)', padding: 0, textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }} onClick={() => setShowTerms(true)}>Términos y Condiciones y Política de Privacidad</button> para Repartidores.
                  </>
                ) : (
                  <span>Términos y Condiciones y Política de Privacidad para Repartidores.</span>
                )}
              </label>
            </div>

            <button type="submit" className="btn btn-success btn-full" disabled={authLoading}>
              {authLoading ? <span className="spinner spinner-white" /> : 'Registrarme'}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  const renderDisponibles = () => {
    // Buscar TODOS los pedidos asignados a mí que estén activos
    const pedidosEnCurso = pedidos.filter(p => !p.esBroadcast && ['Confirmado', 'Retirado', 'Pendiente de Pago', 'Pendiente', 'Aceptado', 'Listo', 'Preparando'].includes(p.estado));
    
    // Si no hay pedidos en curso reales
    const todosEnCurso = [...pedidosEnCurso].sort((a, b) => 
      new Date(a.created_at) - new Date(b.created_at)
    );

    if (todosEnCurso.length > 0) {
      return (
        <div className="dd-en-curso-container">


          {todosEnCurso.map(enViaje => {
            console.log("📦 Pedido en curso:", enViaje);
            console.log("📦 Pedido en curso:", enViaje);
            const isRetirado = enViaje.estado === 'Retirado';
            const isLento = enViaje.nivel_rapidez === 2;
            
            const localObj = Array.isArray(enViaje.locales) ? enViaje.locales[0] : enViaje.locales;
            const localNombre = localObj?.nombre || enViaje.local_nombre || 'Local';
            const localDir = localObj?.direccion || enViaje.local_direccion || 'Cargando...';
            const localLat = localObj?.lat || enViaje.local_lat;
            const localLng = localObj?.lng || enViaje.local_lng;
            const montoMostrar = enViaje.monto_local || 0;

            const isExpanded = expandedOrders[enViaje.id];

            // Ajuste de Zona Horaria (+3 horas)
            const createdDate = new Date(enViaje.created_at);
            createdDate.setHours(createdDate.getHours() + 3); 
            
            const diff = now - createdDate;
            const totalSecs = Math.max(0, Math.floor(diff / 1000));
            const mins = Math.floor(totalSecs / 60);
            const secs = totalSecs % 60;
            const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
            const isUrgent = mins >= 15; // Urgente a los 15 min

            return (
              <div key={enViaje.id} className={`dd-simple-card animate-slide-up ${isLento ? 'lento-card' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`} style={{ borderLeft: isLento ? '6px solid #f97316' : '6px solid #22c55e' }}>
                <div className="dd-simple-header" onClick={() => toggleOrderExpand(enViaje.id)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Pedido #{enViaje.id.split('-').pop()}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span className={`dd-time-counter-badge ${isUrgent ? 'urgent' : ''}`}>
                        ⏱️ {timeStr}
                      </span>
                      <span style={{ fontSize: '0.6rem', color: '#999', fontWeight: 'bold' }}>
                        {isLento ? '🍳 LENTO' : '⚡ RÁPIDO'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className={`dd-status-badge ${enViaje.estado === 'Pendiente de Pago' ? 'pulse-orange' : ''}`} style={{ fontSize: '0.7rem' }}>
                      {enViaje.estado === 'Pendiente de Pago' ? 'Pago' : enViaje.estado}
                    </div>
                    <span style={{ fontSize: '1.2rem', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                  </div>
                </div>
                
                <div className={`dd-simple-body-wrapper ${isExpanded ? 'expanded' : 'collapsed'}`}>
                  <div className="dd-simple-body">
                    {enViaje.estado === 'Pendiente de Pago' ? (
                      <div className="dd-waiting-payment-box animate-pulse" style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: '15px', borderRadius: '12px', textAlign: 'center' }}>
                        <p style={{ margin: '0 0 8px 0', color: '#9a3412' }}><strong>Pendiente de pago del cliente</strong></p>
                        <CountdownTimer 
                          startTime={enViaje.pago_pendiente_at || enViaje.created_at} 
                          limitMinutes={5} 
                          onTimeout={() => fetchPedidos()} 
                        />
                      </div>
                    ) : !isRetirado ? (
                      <>
                        <div className="dd-section-title">📍 Punto de Retiro</div>
                        <div className="dd-info-block">
                          <div className="dd-info-row">
                            <span className="dd-info-label">Local</span>
                            <span className="dd-info-value">{localNombre}</span>
                          </div>
                          <div className="dd-info-row">
                            <span className="dd-info-label">Dirección</span>
                            <span className="dd-info-value">{localDir}</span>
                          </div>

                          <div className="dd-info-row">
                            <span className="dd-info-value monto">
                              {(enViaje.metodo_pago || enViaje.pago)?.toLowerCase() === 'efectivo' 
                                ? `Debés pagar: $${Number(montoMostrar).toLocaleString('es-AR')}` 
                                : 'Ya Pago (Retirá sin pagar)'}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="dd-section-title">🏁 Punto de Entrega</div>
                        <div className="dd-info-block">
                          <div className="dd-info-row">
                            <span className="dd-info-label">Cliente</span>
                            <span className="dd-info-value" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              {enViaje.nombre_cliente || 'Cliente'}
                              {enViaje.telefono_cliente && (
                                <button 
                                  className="btn btn-sm btn-success"
                                  onClick={() => window.open(`https://wa.me/${enViaje.telefono_cliente.replace(/\D/g, '')}`, '_blank')}
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', background: '#25D366', border: 'none', color: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                                >
                                  💬 WhatsApp
                                </button>
                              )}
                            </span>
                          </div>
                          <div className="dd-info-row">
                            <span className="dd-info-label">Dirección</span>
                            <span className="dd-info-value">{enViaje.direccion}</span>
                          </div>

                          <div className="dd-info-row">
                            <span className="dd-info-value monto cobrar">
                              {(enViaje.metodo_pago || enViaje.pago)?.toLowerCase() === 'efectivo' 
                                ? `Debés cobrar: $${Number(enViaje.total || enViaje.monto || 0).toLocaleString('es-AR')}` 
                                : 'Ya Pago (No cobrar)'}
                            </span>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="dd-simple-actions">
                      {enViaje.estado !== 'Pendiente de Pago' && (
                        <div className="dd-btn-row">
                          {!isRetirado ? (
                            <button className="dd-btn-rojo" onClick={() => confirmarRetiroClick(enViaje)}>
                              🏍️ RETIRAR
                            </button>
                          ) : (
                            <button className="dd-btn-verde" onClick={() => confirmarEntregaClick(enViaje)}>
                              🚀 ENTREGAR
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* No mostrar renderPendientes aquí, ahora es un pop-up */}
        </div>
      );
    }

    return null;
  };

  const renderBroadcastOverlay = () => {
    // Solo mostrar si el repartidor tiene menos de 3 pedidos
    const pedidosEnCurso = pedidos.filter(p => !p.esBroadcast && ['Confirmado', 'Retirado', 'Pendiente de Pago', 'Pendiente', 'Aceptado', 'Listo', 'Preparando'].includes(p.estado));
    if (pedidosEnCurso.length >= 3) return null;

    const pendientesReales = pedidos.filter(p => ['Pendiente', 'Buscando Repartidor', 'Listo', 'Preparando'].includes(p.estado) && p.esBroadcast);
    const todosDisponibles = [...pendientesReales]
      .filter(p => !dismissedBroadcasts[p.id]);

    if (todosDisponibles.length === 0) return null;

    // Mostrar solo el más reciente (o el primero de la lista)
    const p = todosDisponibles[0];
    const isLento = p.nivel_rapidez === 2;
    const isStacking = p.esStacking;

    return (
      <div className="dd-broadcast-overlay">
        <div className={`dd-broadcast-popup animate-pop-in ${isLento ? 'lento' : ''} ${isStacking ? 'stacking' : ''}`}>
          <div className="popup-header">
            <div className="popup-badge">NUEVO PEDIDO DISPONIBLE</div>
            {isStacking && <div className="stacking-tag">📍 MISMO LOCAL</div>}
          </div>
          
          <div className="popup-body">
            <div className="popup-amount">
              <span className="amount-label">Ganancia Envío</span>
              <span className="amount-value">${Number(p.precio_envio || 0).toLocaleString('es-AR')}</span>
            </div>
            
            <div className="popup-details">
              <div className="detail-item">
                <span className="detail-icon">👤</span>
                <span className="detail-text"><strong>{p.nombre_cliente}</strong></span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">📍</span>
                <span className="detail-text">{p.direccion}</span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">💳</span>
                <span className="detail-text"><strong>Método de pago:</strong> {p.pago || 'Efectivo'}</span>
              </div>
            </div>
          </div>

          <div className="popup-footer">
            <button 
              className="btn-cancel" 
              onClick={() => setDismissedBroadcasts(prev => ({ ...prev, [p.id]: true }))}
            >
              Cerrar
            </button>
            <button 
              className="btn-accept" 
              onClick={() => aceptarPedido(p)}
            >
              Tomar Pedido →
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPendientes = (actuales = []) => {
    const pendientesReales = pedidos.filter(p => ['Pendiente', 'Buscando Repartidor', 'Listo', 'Preparando'].includes(p.estado) && p.esBroadcast);
    const pendientes = [...pendientesReales];

    if (pendientes.length === 0 && actuales.length === 0) {
      return null;
    }

    if (pendientes.length === 0) return null;

    return (
      <div className="dd-available-section">
        <h3 style={{ fontSize: '1.2rem', color: 'var(--gray-800)', marginBottom: '1rem', marginTop: actuales.length > 0 ? '2rem' : 0 }}>
          {actuales.length > 0 ? '➕ Otros pedidos disponibles' : 'Pedidos Disponibles'}
        </h3>
        <div className="dd-orders-grid animate-fade-in">
          {pendientes.map(p => {
            const isLento = p.nivel_rapidez === 2;
            const isStacking = p.esStacking;

            return (
              <div className={`dd-order-card broadcast-card ${isLento ? 'lento-card' : ''} ${isStacking ? 'stacking-card' : ''}`} key={p.id} style={{ borderTop: isStacking ? '6px solid #6366f1' : 'none' }}>
                <div className="dd-order-head">
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h5>Pedido #{p.id.split('-').pop()}</h5>
                    {isStacking && <span style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 'bold' }}>📍 ¡MISMO LOCAL!</span>}
                  </div>
                  <span className={`dd-badge ${isLento ? 'bg-lento' : 'bg-broadcast'}`}>
                    {isLento ? 'LENTO 🍳' : 'RÁPIDO ⚡'}
                  </span>
                </div>
                <div className="dd-order-amount">
                  <small style={{ display: 'block', fontSize: '0.75rem', color: 'var(--gray-400)' }}>Ganancia Envío</small>
                  ${Number(p.precio_envio || 0).toLocaleString('es-AR')}
                </div>
                <div className="dd-order-info">
                  <p>👤 <strong>Cliente:</strong> {p.nombre_cliente}</p>
                  <p>📍 <strong>Destino:</strong> {p.direccion}</p>
                </div>
                <div className="dd-order-actions">
                  <button 
                    className={isStacking ? "dd-btn-stacking" : (isLento ? "dd-btn-lento" : "dd-btn-broadcast")}
                    onClick={() => aceptarPedido(p)}
                  >
                    {isStacking ? 'Tomar para este local' : 'Tomar Viaje →'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderActiveLocales = () => {
    if (loadingLocales && activeLocales.length === 0) return null;
    
    return (
      <div className="dd-active-locales animate-fade-in" style={{ marginTop: '30px', marginBottom: '30px' }}>
        <div className="dd-section-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--gray-800)' }}>Locales Activos</h4>
          <span style={{ padding: '2px 8px', background: 'var(--green-100)', color: 'var(--green-700)', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
            {activeLocales.length}
          </span>
        </div>
        
        {activeLocales.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', fontSize: '0.9rem', textAlign: 'center', padding: '10px' }}>No hay locales abiertos en este momento.</p>
        ) : (
          <div className="dd-locales-scroll" style={{ 
            display: 'flex', 
            gap: '12px', 
            overflowX: 'auto', 
            paddingBottom: '15px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            {activeLocales.map(local => (
              <div key={local.id} className="dd-local-badge" style={{
                flex: '0 0 auto',
                width: '80px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '15px',
                  background: 'white',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
                  margin: '0 auto 8px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #f0f0f0'
                }}>
                  <img 
                    src={local.logo || "https://i.postimg.cc/Y0Ln7qb3/Digitalizacion-y-logistica-para-Santo-Tome-(1).png"} 
                    alt={local.nombre} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.src = "https://i.postimg.cc/Y0Ln7qb3/Digitalizacion-y-logistica-para-Santo-Tome-(1).png"; }}
                  />
                </div>
                <span style={{ 
                  fontSize: '0.7rem', 
                  color: 'var(--gray-600)', 
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontWeight: '500'
                }}>{local.nombre}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderHistorial = () => {
    if (historial.length === 0) {
      return (
        <div className="empty-state">
          <h3>No hay historial de entregas</h3>
          <p>Tus pedidos entregados aparecerán aquí.</p>
        </div>
      );
    }
    return (
      <div className="dd-orders-grid animate-fade-in">
        {historial.map((h, i) => (
          <div className="dd-order-card" key={i}>
            <div className="dd-order-head">
              <small style={{ color: 'var(--gray-500)' }}>
                {new Date(h.created_at).toLocaleDateString()}
              </small>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <span className={`dd-badge ${h.cobro_repartidor_procesado ? 'bg-success' : (h.metodo_pago === 'Efectivo' ? 'bg-info' : 'bg-warning')}`} style={{ fontSize: '0.7rem' }}>
                  {h.cobro_repartidor_procesado ? '✓ Cobrado' : (h.metodo_pago === 'Efectivo' ? 'Cash Recibido' : 'Pendiente de cobro')}
                </span>
                {scheduledDates[h.id] && !h.cobro_repartidor_procesado && (
                  <span className="dd-badge" style={{ fontSize: '0.65rem', background: '#6366f1', color: 'white' }}>
                    📅 Pago: {scheduledDates[h.id].split('-').reverse().join('-')}
                  </span>
                )}
              </div>
            </div>
            <p style={{ margin: '8px 0', fontWeight: 'bold', fontSize: '0.9rem' }}>{h.direccion}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="dd-order-amount" style={{ margin: 0, fontSize: '1.2rem' }}>${Number(h.precio_envio || 0).toLocaleString('es-AR')}</div>
              <small style={{ color: 'var(--gray-400)', fontSize: '0.7rem' }}>Pago: {h.metodo_pago}</small>
            </div>
          </div>
        ))}
      </div>
    );
  };


  const renderArchivados = () => {
    if (loadingArchivados) return <div className="spinner-container" style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><span className="spinner" /></div>;

    if (archivados.length === 0) {
      return (
        <div className="empty-state">
          <h3>No hay liquidaciones archivadas</h3>
          <p>Tus cierres de caja finalizados aparecerán aquí.</p>
        </div>
      );
    }

    return (
      <div className="dd-archivados-list animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {archivados.map((c, i) => (
          <div key={c.id} className="dd-order-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div 
              style={{ padding: '15px', cursor: 'pointer', background: expandedCierre === c.id ? 'var(--gray-50)' : 'white' }}
              onClick={() => setExpandedCierre(expandedCierre === c.id ? null : c.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <small style={{ color: 'var(--gray-500)', fontWeight: 600 }}>LIQUIDACIÓN #{c.id.slice(-6).toUpperCase()}</small>
                  <p style={{ margin: '4px 0', fontWeight: 'bold' }}>{new Date(c.fecha).toLocaleDateString('es-AR')}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--red-600)', fontWeight: 800, fontSize: '1.1rem' }}>${Number(c.monto_total).toLocaleString('es-AR')}</div>
                  <small style={{ color: 'var(--gray-500)' }}>{c.cantidad_viajes} viajes</small>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.75rem', color: 'var(--red-500)', fontWeight: 600 }}>
                {expandedCierre === c.id ? '🔼 Ocultar detalles' : '🔽 Ver detalle de viajes'}
              </div>
            </div>

            {expandedCierre === c.id && (
              <div style={{ background: '#f8fafc', borderTop: '1px solid #eee', padding: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {c.pedidos.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed #e2e8f0' }}>
                      <div style={{ maxWidth: '70%' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{p.direccion}</div>
                        <small style={{ color: 'var(--gray-500)', fontSize: '0.7rem' }}>#{p.id.slice(0,8)} • {p.metodo_pago}</small>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>${Number(p.precio_envio).toLocaleString('es-AR')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderCobros = () => {
    if (cobrosLoading && !cobrosData) return <div className="spinner-container" style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><span className="spinner" /></div>;
    
    return (
      <div className="dd-cobros-view animate-fade-in">
        <div className="dd-card-header" style={{ marginBottom: '24px' }}>
          <h3>Gestión de Cobros</h3>
          <p style={{ color: 'var(--gray-600)' }}>Retirá tus ganancias acumuladas por pagos con transferencia o tarjeta.</p>
        </div>

        <div className="dd-stats-grid" style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          <div className="dd-stat-item highlight" style={{ background: 'var(--red-50)', border: '1px solid var(--red-200)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
            <small style={{ color: 'var(--gray-600)', display: 'block', marginBottom: '8px', fontSize: '1rem' }}>Saldo a Cobrar (Transferencia/Tarjeta)</small>
            <strong style={{ fontSize: '2.5rem', color: 'var(--red-600)' }}>${Number(cobrosData?.totalDisponible || 0).toLocaleString('es-AR')}</strong>
            {cobrosData?.cantidadEntregas > 0 && (
              <div style={{ marginTop: '8px', fontSize: '0.9rem', color: 'var(--red-500)', fontWeight: 'bold' }}>
                {cobrosData.cantidadEntregas} {cobrosData.cantidadEntregas === 1 ? 'entrega pendiente' : 'entregas pendientes'} de cobro
              </div>
            )}
          </div>
        </div>

        <div className="dd-card" style={{ marginBottom: '24px', padding: '20px', background: '#fff', borderRadius: '12px', border: '1px solid #eee' }}>
          <h4 style={{ marginBottom: '15px' }}>Datos para Transferencia</h4>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const alias = fd.get('alias_cbu');
            const cuenta = fd.get('nombre_cuenta');
            const loading = toast.loading('Guardando datos...');
            const res = await api.repartidorUpdatePerfil({ driverId: driver.id, alias_cbu: alias, nombre_cuenta: cuenta });
            if (res.success) {
              toast.success('Datos guardados', { id: loading });
              loadData(); // reload driverData
            } else {
              toast.error(res.error || 'Error al guardar', { id: loading });
            }
          }}>
            <div className="dd-form-group" style={{ marginBottom: '15px' }}>
              <label>Alias / CBU</label>
              <input type="text" name="alias_cbu" className="dd-input" defaultValue={driverData?.alias_cbu || ''} placeholder="Ej: mimoto.mp" required />
            </div>
            <div className="dd-form-group" style={{ marginBottom: '15px' }}>
              <label>Nombre de la Cuenta</label>
              <input type="text" name="nombre_cuenta" className="dd-input" defaultValue={driverData?.nombre_cuenta || ''} placeholder="Ej: Juan Perez" required />
            </div>
            <button type="submit" className="dd-btn-outline" style={{ width: '100%', padding: '12px', borderRadius: '8px' }}>Guardar Datos Bancarios</button>
          </form>
        </div>

        <button 
          className="dd-btn-rojo dd-btn-large" 
          disabled={!cobrosData?.totalDisponible || cobrosData.totalDisponible <= 0 || cobrosLoading}
          onClick={() => handleSolicitarCobro(cobrosData.totalDisponible)}
        >
          {cobrosLoading ? 'Procesando...' : 'Solicitar Cobro'}
        </button>

        <div className="dd-history-section" style={{ marginTop: 32 }}>
          <h4 style={{ marginBottom: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Historial de Solicitudes</h4>
          {cobrosData?.historial?.length === 0 ? (
            <p className="empty-msg" style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '20px' }}>No hay solicitudes previas.</p>
          ) : (
            <div className="dd-history-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cobrosData?.historial?.map((h, i) => (
                <div className="dd-history-item" key={i} style={{ background: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="dd-history-info">
                    <span className="dd-date" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--gray-500)' }}>{new Date(h.fechaSolicitud).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</span>
                    <span className="dd-amount" style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>${Number(h.montoNeto).toLocaleString('es-AR')}</span>
                  </div>
                  <span className={`dd-badge status-${h.estado.toLowerCase()}`} style={{ 
                    padding: '4px 12px', 
                    borderRadius: '20px', 
                    fontSize: '0.8rem', 
                    fontWeight: 'bold',
                    backgroundColor: h.estado === 'Pagado' ? '#e6fffa' : '#fff7ed',
                    color: h.estado === 'Pagado' ? '#047481' : '#c2410c'
                  }}>{h.estado}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPerfil = () => {
    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const currentDays = driverData?.DiasApertura || [];

    return (
      <div className="dd-perfil-view animate-fade-in" style={{ paddingBottom: '40px' }}>
        {/* Vincular Partner Section */}
        <div className="dd-form-section" style={{ marginBottom: '32px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ margin: '0 0 12px 0', color: 'var(--gray-800)', borderLeft: '4px solid var(--red-500)', paddingLeft: '12px', fontSize: '0.95rem', fontWeight: 'bold' }}>Vinculación con Empresa Partner</h4>
          
          {driverData?.partner_id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                Vinculado a: <strong style={{ color: '#10b981' }}>🛵 {driverData?.partner_nombre || 'Partner Logístico'}</strong>
              </span>
              <button 
                type="button" 
                className="btn btn-outline btn-sm text-red" 
                onClick={handleDesvincularPropio}
                style={{ alignSelf: 'flex-start', marginTop: '4px' }}
              >
                Desvincularme
              </button>
            </div>
          ) : driverData?.partner_vinculo_status === 'Pendiente' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem', color: '#b45309', background: '#fffbeb', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                ⏳ Solicitud enviada a: <strong>{driverData?.partner_solicitado_nombre || 'Partner'}</strong> (Esperando aprobación)
              </span>
              <button 
                type="button" 
                className="btn btn-outline btn-sm text-red" 
                onClick={handleCancelarSolicitud}
                style={{ alignSelf: 'flex-start', marginTop: '4px' }}
              >
                Cancelar Solicitud
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#64748b' }}>
                Si trabajas para una empresa de logística, ingresa su PIN de vinculación para asociar tu cuenta:
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="PIN de 6 dígitos" 
                  className="form-input" 
                  value={partnerPinInput}
                  onChange={e => setPartnerPinInput(e.target.value)}
                  style={{ margin: 0, padding: '8px 12px', fontSize: '0.9rem' }}
                  maxLength={6}
                />
                <button 
                  type="button" 
                  className="btn btn-primary btn-sm" 
                  onClick={handleSolicitarVinculacion}
                  disabled={linking || !partnerPinInput.trim()}
                  style={{ padding: '8px 16px' }}
                >
                  {linking ? 'Vinculando...' : 'Vincular'}
                </button>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSaveProfile} className="dd-profile-form">
          <div className="dd-form-section" style={{ marginBottom: '32px' }}>
            <h4 style={{ marginBottom: '20px', color: 'var(--gray-800)', borderLeft: '4px solid var(--red-500)', paddingLeft: '12px' }}>Información Personal</h4>
            
            <div className="dd-photo-upload" style={{ textAlign: 'center', marginBottom: 24 }}>
              <div className="dd-avatar-preview" style={{ position: 'relative', display: 'inline-block' }}>
                <img src={driverData?.FotoUrl || "https://i.postimg.cc/Z5N1N0c9/user-avatar.png"} alt="Perfil" style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '4px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <label className="dd-photo-edit-badge" style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--red-500)', color: 'white', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                  📷
                  <input name="foto" type="file" accept="image/*" style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', fontWeight: '500' }}>Nombre Completo</label>
              <input name="nombre" className="form-input" defaultValue={driverData?.Nombre} required />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', fontWeight: '500' }}>Email</label>
              <input name="email" type="email" className="form-input" defaultValue={driverData?.Email} required />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', fontWeight: '500' }}>Teléfono</label>
              <div className="phone-input-group">
                <select name="prefix" className="phone-prefix-select" defaultValue={driverData?.Telefono?.startsWith('+55') ? '+55' : '+549'}>
                  <option value="+549">🇦🇷 +549</option>
                  <option value="+55">🇧🇷 +55</option>
                </select>
                <input 
                  name="telefono" 
                  type="tel" 
                  className="form-input phone-number-input" 
                  defaultValue={driverData?.Telefono ? driverData.Telefono.replace(/^\+549|^\+54|^\+55/, '') : ''} 
                  placeholder="Número (ej: 1123456789)" 
                  required 
                />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', fontWeight: '500' }}>Nueva Contraseña (opcional)</label>
              <input name="password" type="password" className="form-input" placeholder="Dejar vacío para no cambiar" />
            </div>
          </div>

          <div className="dd-form-section" style={{ marginBottom: '32px' }}>
            <h4 style={{ marginBottom: '20px', color: 'var(--gray-800)', borderLeft: '4px solid var(--red-500)', paddingLeft: '12px' }}>Vehículo</h4>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', fontWeight: '500' }}>Patente</label>
              <input name="patente" className="form-input" defaultValue={driverData?.Patente} required />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', fontWeight: '500' }}>Marca y Modelo</label>
              <input name="marca_modelo" className="form-input" defaultValue={driverData?.MarcaModelo} required />
            </div>
          </div>

          <div className="dd-profile-actions" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button type="submit" className="dd-btn-rojo dd-btn-large">Guardar Cambios</button>
            <button type="button" className="dd-btn-outline dd-btn-large" onClick={() => setView('main')}>Cancelar</button>
          </div>
        </form>
      </div>
    );
  };
  const renderPWAInstructionsModal = () => {
    if (!showPWAInstructions) return null;

    return (
      <div className="dd-modal-overlay" onClick={() => setShowPWAInstructions(false)}>
        <div className="dd-modal-content animate-slide-down" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
          <div className="dd-modal-header" style={{ background: 'var(--red-600)' }}>
            <h5 style={{ color: 'white', margin: 0 }}>
              {isIOS ? '📱 Instrucciones para iPhone' : '📲 Instalar en Android'}
            </h5>
            <button className="dd-modal-close" onClick={() => setShowPWAInstructions(false)}>×</button>
          </div>
          <div className="dd-modal-body" style={{ textAlign: 'center', padding: '24px' }}>
            {isIOS ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '1rem', color: 'var(--gray-700)', lineHeight: '1.5' }}>
                  Para recibir <strong>ubicación y notificaciones</strong> correctamente en iOS, debes añadir Wepi a tu inicio:
                </p>
                <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '12px', textAlign: 'left', border: '1px solid #eee' }}>
                  <p style={{ margin: '0 0 8px 0' }}>1. Presiona el botón <strong>Compartir</strong> <img src="https://i.postimg.cc/85zPzCH7/ios-share.png" alt="share" style={{ height: '20px', verticalAlign: 'middle' }} /> abajo en Safari.</p>
                  <p style={{ margin: '0 0 8px 0' }}>2. Desliza hacia abajo y selecciona <strong>"Añadir a la pantalla de inicio"</strong>.</p>
                  <p style={{ margin: 0 }}>3. Abre la aplicación desde el nuevo icono en tu pantalla.</p>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>
                  * Esto habilitará los permisos nativos requeridos por el sistema.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '1rem', color: 'var(--gray-700)', lineHeight: '1.5' }}>
                  Habilita la <strong>App de Repartidores</strong> para asegurar el seguimiento GPS y alertas en tiempo real.
                </p>
                
                {deferredPrompt ? (
                  <button 
                    className="dd-btn-rojo dd-btn-large" 
                    onClick={async () => {
                      deferredPrompt.prompt();
                      const { outcome } = await deferredPrompt.userChoice;
                      if (outcome === 'accepted') setDeferredPrompt(null);
                      setShowPWAInstructions(false);
                    }}
                  >
                    🚀 Descargar / Instalar Ahora
                  </button>
                ) : (
                  <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '12px', textAlign: 'left', border: '1px solid #eee' }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '8px', color: 'var(--red-600)' }}>Si no ves el botón de instalar:</p>
                    <p style={{ margin: '0 0 8px 0' }}>1. Toca los <strong>tres puntos</strong> (⋮) arriba a la derecha en Chrome.</p>
                    <p style={{ margin: 0 }}>2. Selecciona <strong>"Instalar aplicación"</strong> o "Añadir a pantalla de inicio".</p>
                  </div>
                )}
                <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>
                  Al usar la App dedicada, Android prioriza la ubicación y evita que el sistema cierre la aplicación.
                </p>
              </div>
            )}
          </div>
          <div className="dd-modal-footer">
            <button className="btn btn-secondary btn-full" onClick={() => setShowPWAInstructions(false)}>Entendido</button>
          </div>
        </div>
      </div>
    );
  };

  // ─── MAIN RENDER ───
  return (
    <div className="dd-page">
      <header className="dd-header">
        <div className="dd-header-top">
          <Link to="/">
            <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" className="dd-logo" />
          </Link>
          {driver && (
            <button className="dd-header-menu-btn" onClick={() => setProfileMenuOpen(true)}>☰ Menú</button>
          )}
        </div>
        
      </header>

      <main className={`dd-main ${driver ? 'map-active' : ''}`}>
        {driver && !driver.emailConfirmado && (
          <div className="unconfirmed-banner" style={{
            background: '#fff7e6',
            border: '1px solid #ffd591',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.9rem',
            color: '#874d00'
          }}>
            {isEditingEmail ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', width: '100%' }}>
                <span style={{ fontWeight: 'bold' }}>Editar Email:</span>
                <input
                  type="email"
                  value={tempEmail}
                  onChange={(e) => setTempEmail(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #faad14',
                    fontSize: '0.9rem',
                    outline: 'none',
                    minWidth: '220px',
                    flex: 1,
                    background: '#fff',
                    color: '#000'
                  }}
                  placeholder="nuevo-email@dominio.com"
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-sm"
                    style={{ background: '#52c41a', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    onClick={handleSaveEmailInBanner}
                  >
                    Guardar
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ background: '#ff4d4f', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    onClick={() => setIsEditingEmail(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>⚠️ <strong>Email no confirmado:</strong> Por favor confirma tu correo.</span>
                  <span style={{ background: '#ffe7ba', padding: '2px 8px', borderRadius: '4px', border: '1px solid #ffd591', fontSize: '0.85rem', color: '#d46b08', fontWeight: 'bold' }}>
                    {driverData?.Email || driver.email}
                  </span>
                  <button
                    onClick={() => {
                      setTempEmail(driverData?.Email || driver.email || '');
                      setIsEditingEmail(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#1890ff',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      textDecoration: 'underline',
                      padding: 0,
                      fontWeight: 'bold'
                    }}
                  >
                    (Editar)
                  </button>
                </div>
                <button 
                  className="btn btn-sm" 
                  style={{ background: '#faad14', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  onClick={handleResendConfirmation}
                >
                  Enviar Código
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── Banner de Notificaciones ─── */}
        {driver && notificationStatus !== 'granted' && (
          <div className={`notification-status-banner ${notificationStatus === 'denied' ? 'denied' : 'pending'}`}>
            <span className="banner-text">
              {notificationStatus === 'denied' ? (
                <>🚫 <strong>Bloqueadas:</strong> No recibirás alertas de pedidos. Revisa los permisos.</>
              ) : (
                <>🔔 <strong>Activa alertas:</strong> Presiona el botón para recibir pedidos al instante.</>
              )}
            </span>
            <div className="banner-actions">
              {notificationStatus !== 'denied' && (
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => {
                    if (window.OneSignal) {
                      window.OneSignal.Notifications.requestPermission();
                    }
                  }}
                >
                  Activar 🔔
                </button>
              )}
            </div>
          </div>
        )}


        {!driver ? renderAuth() : (
          driverData === null ? (
            <div className="loading-state" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', fontSize: '1.2rem', color: 'var(--gray-600)' }}>
              <div className="spinner" style={{ marginRight: '12px' }}></div> Cargando panel de repartidor...
            </div>
          ) : driverData.admin_status !== 'Aceptado' ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 'calc(100vh - 120px)',
              padding: '24px',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              textAlign: 'center'
            }}>
              <div className="card" style={{
                maxWidth: '480px',
                width: '100%',
                padding: '40px 32px',
                borderRadius: '24px',
                boxShadow: 'var(--shadow-lg)',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                animation: 'scaleIn 0.5s var(--ease-out) both'
              }}>
                <div className="pulse-orange" style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: '#fffbeb',
                  border: '2px solid #f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.5rem',
                  marginBottom: '24px'
                }}>
                  ⏳
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--gray-900)', marginBottom: '16px' }}>
                  Cuenta pendiente de activación
                </h2>
                <p style={{ color: 'var(--gray-600)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '28px' }}>
                  Hola <strong>{driverData.Nombre || driver.nombre}</strong>. Tu cuenta de repartidor aún no ha sido dada de alta por la administración de Wepi.
                  <br /><br />
                  Para comenzar a recibir pedidos y realizar entregas, debés solicitar tu activación.
                </p>

                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '0.85rem',
                  color: 'var(--gray-700)',
                  width: '100%',
                  textAlign: 'left',
                  marginBottom: '28px'
                }}>
                  <strong>Email registrado:</strong> {driverData.Email || driver.email}
                </div>

                <a 
                  href={`https://wa.me/5493756543610?text=${encodeURIComponent(`quiero dar de alta mi cuenta de repartidor en Wepi. Email registrado: ${driverData.Email || driver.email}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-full"
                  style={{
                    background: '#25D366',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(37, 211, 102, 0.3)',
                    border: 'none',
                    fontSize: '1rem',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '8px',
                    textDecoration: 'none'
                  }}
                >
                  💬 Pedir alta por WhatsApp
                </a>

                <button 
                  onClick={logoutDriver}
                  className="btn btn-ghost btn-full"
                  style={{ marginTop: '12px', color: 'var(--red-600)', borderColor: 'var(--red-200)' }}
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          ) :
            <div style={{ 
              display: 'flex',
              flexDirection: 'row',
              position: 'relative', 
              height: 'calc(100vh - 120px)', 
              width: '100%', 
              overflow: 'hidden',
              background: '#f8f9fa'
            }}>
            {/* ─── PANEL LATERAL (Side Panel para Subvistas) ─── */}
            {view !== 'main' && (
              <div className="dd-side-panel animate-slide-right">
                <div style={{ padding: '20px', borderBottom: '1px solid #edf2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--gray-900)' }}>
                    {view === 'historial' && '📜 Historial de Entregas'}
                    {view === 'archivados' && '📁 Liquidaciones Archivadas'}
                    {view === 'cobros' && '💰 Gestión Cobros'}
                    {view === 'perfil' && '👤 Configuración'}
                  </h3>
                  <button className="btn btn-outline btn-sm" style={{ padding: '4px 8px', minWidth: 'auto', border: '1px solid #cbd5e1' }} onClick={() => setView('main')}>✕ Cerrar</button>
                </div>
                <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                  {view === 'historial' && renderHistorial()}
                  {view === 'archivados' && renderArchivados()}
                  {view === 'cobros' && renderCobros()}
                  {view === 'perfil' && renderPerfil()}
                </div>
              </div>
            )}

            {/* ─── MAPA DE FONDO ─── */}
            <div style={{ position: 'relative', flex: 1, height: '100%', zIndex: 0 }}>
              <MapProbandoComponent 
                localLat={localInfo.lat} 
                localLng={localInfo.lng} 
                pedidosActivos={pedidos.filter(p => !p.esBroadcast && ['Confirmado', 'Retirado', 'Pendiente de Pago', 'Pendiente', 'Aceptado', 'Listo', 'Preparando'].includes(p.estado))}
                driverLat={driverLocation.lat} 
                driverLng={driverLocation.lng}
                localName={localInfo.nombre} 
                isLoaded={isMapLoaded}
                directions={directions}
                routeSequence={routeSequence}
                ciudad={driverData?.ciudad}
              />

              {/* ─── CAPA SUPERIOR (Estadísticas y Locales) ─── */}
              {view === 'main' && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: '12px 16px', pointerEvents: 'none' }}>
                  <div className="dd-stats-box animate-slide-down" style={{ 
                    pointerEvents: 'auto', 
                    background: 'rgba(255,255,255,0.95)', 
                    backdropFilter: 'blur(10px)',
                    marginBottom: '10px',
                    padding: '12px 16px',
                    borderRadius: '16px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                    border: '1px solid rgba(0,0,0,0.05)'
                  }}>
                    <div className="dd-next-stop-container" style={{ position: 'relative', top: 0, left: 0, transform: 'none', width: '100%', maxWidth: 'none', zIndex: 1, marginBottom: showStats ? 12 : 0 }}>
                      {routeSequence.length > 0 ? (
                        <div className="dd-next-stop-banner" style={{ background: 'transparent', boxShadow: 'none', border: 'none', padding: 0 }}>
                          <div className="next-stop-icon">🎯</div>
                          <div className="next-stop-info">
                            <span className="next-stop-label">Siguiente Parada</span>
                            <span className="next-stop-address">{routeSequence[0].address}</span>
                            <div className="next-stop-meta">
                              <span>{routeSequence[0].distance}</span>
                              <span className="dot">•</span>
                              <span>{routeSequence[0].duration} aprox.</span>
                            </div>
                          </div>
                          <button onClick={() => setShowStats(!showStats)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--red-600)', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                            {showStats ? '▴' : '▾'}
                          </button>
                        </div>
                      ) : (
                        <div className="dd-next-stop-banner" style={{ background: 'transparent', boxShadow: 'none', border: 'none', padding: 0 }}>
                          <div className="next-stop-icon" style={{ background: '#94a3b8' }}>🏁</div>
                          <div className="next-stop-info">
                            <span className="next-stop-label" style={{ color: '#64748b' }}>Estado</span>
                            <span className="next-stop-address">Buscando pedidos para entregar...</span>
                          </div>
                          <button onClick={() => setShowStats(!showStats)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--red-600)', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                            {showStats ? '▴' : '▾'}
                          </button>
                        </div>
                      )}
                    </div>

                    {showStats && (
                      <div className="dd-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                        <div className="dd-stat-item" onClick={() => setShowRankingModal(true)} style={{ padding: '6px 4px', border: 'none', background: '#fff9f0' }}>
                          <small style={{ fontSize: '0.55rem' }}>🏆 Rank</small>
                          <strong style={{ fontSize: '0.9rem' }}>#{gamificationStats?.rank_posicion || '—'}</strong>
                        </div>
                        <div className="dd-stat-item" onClick={loadPointsHistory} style={{ padding: '6px 4px', border: 'none', background: '#f1f8ff' }}>
                          <small style={{ fontSize: '0.55rem' }}>💎 Pts</small>
                          <strong style={{ fontSize: '0.9rem' }}>{gamificationStats?.puntos_totales || 0}</strong>
                        </div>
                        <div className="dd-stat-item" style={{ padding: '6px 4px', border: 'none', background: '#f0fdf4' }}>
                          <small style={{ fontSize: '0.55rem' }}>📦 Env</small>
                          <strong style={{ fontSize: '0.9rem' }}>{realStats.viajesHoy || 0}</strong>
                        </div>
                        <div className="dd-stat-item" onClick={() => setView('cobros')} style={{ padding: '6px 4px', border: 'none', background: '#fef2f2' }}>
                          <small style={{ fontSize: '0.55rem' }}>💰 Gan</small>
                          <strong style={{ fontSize: '0.9rem' }}>${realStats.gananciasTotalesHoy || 0}</strong>
                        </div>
                        <div className="dd-stat-item" style={{ padding: '6px 4px', border: 'none', background: '#f5f3ff' }}>
                          <small style={{ fontSize: '0.55rem' }}>⏱️ Retiro</small>
                          <strong style={{ fontSize: '0.9rem' }}>{realStats.promedioRetiro !== undefined && realStats.promedioRetiro !== null ? `${realStats.promedioRetiro}m` : '—'}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── CAPA INFERIOR (Pedidos Flotantes) ─── */}
              <div style={{ 
                position: 'absolute', 
                bottom: '0', 
                left: 0, 
                right: 0, 
                zIndex: 10, 
                padding: '10px 16px 20px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.15) 0%, transparent 100%)',
                pointerEvents: 'none',
              }}>
                {view === 'main' && (
                  <div style={{ pointerEvents: 'auto', maxHeight: '50vh', overflowY: 'auto', scrollbarWidth: 'none', paddingBottom: '10px' }}>
                    <div className="dd-floating-orders-list">
                      {renderDisponibles()}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {renderBroadcastOverlay()}
          </div>
        )}
      </main>



      {/* Profile Sidebar/Menu */}
      {driver && profileMenuOpen && (
        <div className="dd-sidebar-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 1500 }} onClick={() => setProfileMenuOpen(false)}>
          <div className="dd-sidebar animate-slide-right" style={{ background: 'white', width: '280px', height: '100%', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="dd-sidebar-header" style={{ padding: '30px 20px', background: 'var(--gray-50)', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <img src={driverData?.FotoUrl || "https://i.postimg.cc/Z5N1N0c9/user-avatar.png"} alt="Avatar" className="dd-user-avatar" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--red-500)' }} />
              <div className="dd-user-info">
                <strong style={{ display: 'block', fontSize: '1.1rem' }}>{driverData?.Nombre}</strong>
                <small style={{ color: 'var(--gray-500)' }}>{driverData?.Email}</small>
              </div>
            </div>
            <nav className="dd-sidebar-nav" style={{ flex: 1, padding: '20px 0' }}>
              <button className={`dd-nav-item ${view === 'main' ? 'active' : ''}`} style={{ 
                width: '100%', padding: '15px 20px', textAlign: 'left', border: 'none', background: view === 'main' ? 'var(--red-50)' : 'transparent', color: view === 'main' ? 'var(--red-600)' : 'var(--gray-700)', fontWeight: view === 'main' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '12px' 
              }} onClick={() => { setView('main'); setProfileMenuOpen(false); }}>
                🏁 Mis Entregas
              </button>
              <button className={`dd-nav-item ${view === 'historial' ? 'active' : ''}`} style={{ 
                width: '100%', padding: '15px 20px', textAlign: 'left', border: 'none', background: view === 'historial' ? 'var(--red-50)' : 'transparent', color: view === 'historial' ? 'var(--red-600)' : 'var(--gray-700)', fontWeight: view === 'historial' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '12px' 
              }} onClick={() => { setView('historial'); setProfileMenuOpen(false); }}>
                📜 Historial de Entregas
              </button>
              <button className={`dd-nav-item ${view === 'archivados' ? 'active' : ''}`} style={{ 
                width: '100%', padding: '15px 20px', textAlign: 'left', border: 'none', background: view === 'archivados' ? 'var(--red-50)' : 'transparent', color: view === 'archivados' ? 'var(--red-600)' : 'var(--gray-700)', fontWeight: view === 'archivados' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '12px' 
              }} onClick={() => { setView('archivados'); fetchArchivados(); setProfileMenuOpen(false); }}>
                📁 Liquidaciones Archivadas
              </button>
              <button className={`dd-nav-item ${view === 'cobros' ? 'active' : ''}`} style={{ 
                width: '100%', padding: '15px 20px', textAlign: 'left', border: 'none', background: view === 'cobros' ? 'var(--red-50)' : 'transparent', color: view === 'cobros' ? 'var(--red-600)' : 'var(--gray-700)', fontWeight: view === 'cobros' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '12px' 
              }} onClick={() => { setView('cobros'); loadCobros(); setProfileMenuOpen(false); }}>
                💰 Gestión Cobros
              </button>
              <button className={`dd-nav-item ${view === 'perfil' ? 'active' : ''}`} style={{ 
                width: '100%', padding: '15px 20px', textAlign: 'left', border: 'none', background: view === 'perfil' ? 'var(--red-50)' : 'transparent', color: view === 'perfil' ? 'var(--red-600)' : 'var(--gray-700)', fontWeight: view === 'perfil' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '12px' 
              }} onClick={() => { setView('perfil'); setProfileMenuOpen(false); }}>
                👤 Configuración
              </button>

              <div style={{ margin: '20px 0', height: '1px', background: '#eee' }}></div>
              <button className="dd-nav-item text-red" style={{ 
                width: '100%', padding: '15px 20px', textAlign: 'left', border: 'none', background: 'transparent', color: 'var(--red-600)', display: 'flex', alignItems: 'center', gap: '12px' 
              }} onClick={handleLogout}>
                🚪 Cerrar Sesión
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {showChatModal && (
        <div className="dd-modal-overlay" onClick={() => { setShowChatModal(false); setActiveChatPedidoId(null); }}>
          <div className="dd-modal-content animate-slide-down" onClick={e => e.stopPropagation()} style={{ height: '500px' }}>
            <div className="dd-modal-header">
              <h5>Chat con Cliente</h5>
              <button className="dd-modal-close" onClick={() => { setShowChatModal(false); setActiveChatPedidoId(null); }}>×</button>
            </div>
            <div className="dd-modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--gray-400)', margin: 'auto' }}>Inicia la conversación con el cliente</div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} style={{ 
                    textAlign: msg.sender_id === driver.id ? 'right' : 'left',
                    marginBottom: '8px'
                  }}>
                    <div style={{ 
                      background: msg.sender_id === driver.id ? 'var(--red-600)' : '#f0f0f0', 
                      color: msg.sender_id === driver.id ? 'white' : 'black', 
                      padding: '8px 12px', 
                      borderRadius: '12px', 
                      display: 'inline-block',
                      maxWidth: '80%',
                      fontSize: '0.9rem',
                      lineHeight: '1.4'
                    }}>
                      {msg.message}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '2px' }}>
                      {new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                    </div>
                  </div>
                ))
              )}
            </div>
            <form className="dd-modal-footer" onSubmit={handleSendMessage}>
              <input
                type="text"
                className="dd-chat-input"
                placeholder="Escribe aquí..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
              />
              <button type="submit" className="dd-btn-rojo" style={{ width: 'auto', padding: '10px 16px' }}>Enviar</button>
            </form>
          </div>
        </div>
      )}

      {/* Retiro Modal */}
      {showRetiroModal && (
        <div className="dd-modal-overlay" onClick={() => { setShowRetiroModal(false); setActivePedido(null); }}>
          <div className="dd-modal-content animate-slide-down" onClick={e => e.stopPropagation()}>
            <div className="dd-modal-header">
              <h5>Confirmar Retiro</h5>
              <button className="dd-modal-close" onClick={() => { setShowRetiroModal(false); setActivePedido(null); }}>×</button>
            </div>
            <div className="dd-modal-body" style={{ textAlign: 'center', padding: '30px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🏍️</div>
              <p style={{ color: 'var(--gray-600)', marginBottom: '20px' }}>
                Ingresa el <strong>PIN de 4 dígitos</strong> proporcionado por el local para confirmar el retiro del pedido.
              </p>
              <input
                type="number"
                pattern="\d*"
                inputMode="numeric"
                className="form-input"
                style={{ fontSize: '2rem', textAlign: 'center', letterSpacing: '8px', height: '60px' }}
                placeholder="0000"
                value={pinInput}
                onChange={e => setPinInput(e.target.value.slice(0, 4))}
              />
            </div>
            <div className="dd-modal-footer">
              <button 
                className="dd-btn-rojo dd-btn-large" 
                onClick={() => finalizarRetiro(activePedido, pinInput)}
              >
                Confirmar Retiro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entrega Modal */}
      {showEntregaModal && (
        <div className="dd-modal-overlay" onClick={() => { setShowEntregaModal(false); setActivePedido(null); }}>
          <div className="dd-modal-content animate-slide-down" onClick={e => e.stopPropagation()}>
            <div className="dd-modal-header">
              <h5>Confirmar Entrega</h5>
              <button className="dd-modal-close" onClick={() => { setShowEntregaModal(false); setActivePedido(null); }}>×</button>
            </div>
            <div className="dd-modal-body" style={{ textAlign: 'center', padding: '30px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🚀</div>
              <p style={{ color: 'var(--gray-600)', marginBottom: '20px' }}>
                Ingresa el <strong>PIN de 4 dígitos</strong> proporcionado por el cliente para finalizar la entrega.
              </p>
              <input
                type="number"
                pattern="\d*"
                inputMode="numeric"
                className="form-input"
                style={{ fontSize: '2rem', textAlign: 'center', letterSpacing: '8px', height: '60px' }}
                placeholder="0000"
                value={pinInput}
                onChange={e => setPinInput(e.target.value.slice(0, 4))}
              />
            </div>
            <div className="dd-modal-footer">
              <button 
                className="dd-btn-verde dd-btn-large" 
                onClick={() => finalizarEntrega(activePedido)}
              >
                Confirmar Entrega
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Confirmation Modal */}
      {cashConfirmPedido && (
        <div className="dd-modal-overlay" style={{ zIndex: 10000 }} onClick={() => setCashConfirmPedido(null)}>
          <div className="dd-modal-content animate-slide-down" onClick={e => e.stopPropagation()}>
            <div className="dd-modal-header" style={{ borderBottom: '1px solid #fee2e2', background: '#fef2f2' }}>
              <h5 style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                ⚠️ Confirmación de Efectivo
              </h5>
              <button className="dd-modal-close" onClick={() => setCashConfirmPedido(null)}>×</button>
            </div>
            <div className="dd-modal-body" style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💸</div>
              <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--gray-800)', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                ¿Tenés el efectivo necesario para abonar el pedido al local?
              </p>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--gray-500)', display: 'block', fontWeight: '600' }}>
                  VALOR DEL SUBTOTAL A PAGAR AL LOCAL:
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: '850', color: '#10b981' }}>
                  ${Number(cashConfirmPedido.monto_local || 0).toLocaleString('es-AR')}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', margin: 0, lineHeight: '1.4', background: '#f1f5f9', padding: '10px', borderRadius: '6px' }}>
                💡 <strong>Aclaración:</strong> Wepi no abonará doble viaje en caso de no tener el efectivo necesario para retirar el pedido.
              </p>
            </div>
            <div className="dd-modal-footer" style={{ display: 'flex', gap: '12px', padding: '16px' }}>
              <button 
                className="dd-btn-rojo dd-btn-large" 
                style={{ flex: 1, background: '#64748b', color: 'white' }}
                onClick={() => setCashConfirmPedido(null)}
              >
                No
              </button>
              <button 
                className="dd-btn-verde dd-btn-large" 
                style={{ flex: 1, background: '#10b981', color: 'white' }}
                onClick={() => {
                  aceptarPedido({ ...cashConfirmPedido, skipCashCheck: true });
                  setCashConfirmPedido(null);
                }}
              >
                Sí
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer" style={{ background: 'var(--red-800)', color: 'white', borderTop: 'none', padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" style={{ height: '50px', objectFit: 'contain' }} />
        <p style={{ margin: 0 }}>© 2026 Wepi - Todos los derechos reservados</p>
        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold' }}>v. 1.1.2</p>
        <p style={{ fontSize: '0.8rem', opacity: 0.8, margin: 0 }}>PWA optimizada para uso en moto 🛵 GPS en tiempo real</p>
        <button 
          onClick={() => setShowTerms(true)} 
          style={{ background: 'none', border: 'none', color: 'white', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem', opacity: 0.9 }}
        >
          Ver Términos y Condiciones
        </button>
        <button 
          onClick={() => setShowRegretModal(true)} 
          style={{ background: 'none', border: 'none', color: '#ffb3b3', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
        >
          Botón de Arrepentimiento
        </button>
      </footer>

      {showRegretModal && (
        <div className="dd-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }} onClick={() => setShowRegretModal(false)}>
          <div className="dd-modal-content animate-slide-down" style={{ background: 'white', padding: '24px', borderRadius: '12px', maxWidth: '400px', width: '90%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h4 style={{ color: 'var(--red-600)', marginBottom: '16px', fontSize: '1.2rem' }}>Botón de Arrepentimiento</h4>
            <p style={{ fontSize: '0.92rem', color: 'var(--gray-600)', lineHeight: 1.5, overflowY: 'auto', maxHeight: '400px', marginBottom: '20px' }}>
              ¿Deseas arrepentirte de tu registro y eliminar tu cuenta de repartidor permanentemente de Wepi? <br/>
              <strong>Esta acción no se puede deshacer.</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className="dd-btn-rojo dd-btn-large" 
                style={{ width: '100%' }} 
                disabled={deleting}
                onClick={async () => {
                  if (!driver?.id) {
                    toast.error("Debes iniciar sesión para eliminar tu cuenta.");
                    setShowRegretModal(false);
                    return;
                  }
                  setDeleting(true);
                  try {
                    await api.deleteRepartidorAccount(driver.id);
                    toast.success("Cuenta eliminada correctamente.");
                    logoutDriver();
                    window.location.href = "/";
                  } catch (e) {
                    toast.error("No se pudo eliminar la cuenta. Verifica que no tengas pedidos en curso.");
                  } finally {
                    setDeleting(false);
                    setShowRegretModal(false);
                  }
                }}
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar mi registro'}
              </button>
              <button className="btn btn-secondary dd-btn-large" style={{ width: '100%', border: '1px solid #ddd' }} onClick={() => setShowRegretModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTerms && (
        <div className="dd-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }} onClick={() => setShowTerms(false)}>
          <div className="dd-modal-content animate-slide-down" style={{ background: 'white', padding: '24px', borderRadius: '12px', maxWidth: '500px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <h4 style={{ color: 'var(--red-600)', marginBottom: '16px', fontSize: '1.2rem' }}>Términos y Condiciones y Política de Privacidad</h4>
            <div style={{ fontSize: '0.88rem', color: 'var(--gray-600)', lineHeight: 1.5, overflowY: 'auto', paddingRight: '10px', textAlign: 'left', flex: 1 }}>
              <h5 style={{ color: 'red', marginTop: 0 }}>📄 3. REPARTIDORES – TÉRMINOS Y CONDICIONES</h5>
              <p><strong>1. Naturaleza</strong></p>
              <p>El repartidor es un trabajador independiente, no tiene relación laboral con Wepi y opera bajo su propio riesgo.</p>
              <p><strong>2. Autonomía</strong></p>
              <p>Puede aceptar/rechazar pedidos libremente, define sus propios horarios y no existe exclusividad.</p>
              <p><strong>3. Logística</strong></p>
              <p>Wepi solo facilita la asignación de pedidos. No dirige la actividad como empleador.</p>
              <p><strong>4. Responsabilidad total</strong></p>
              <p>El repartidor es responsable de accidentes, daños, estado del vehículo y cumplimiento de normas viales.</p>
              <p><strong>5. Seguro</strong></p>
              <p>Debe contar con seguro propio y cobertura médica. Wepi no provee seguros.</p>
              <p><strong>6. Exención de responsabilidad</strong></p>
              <p>Wepi no será responsable por accidentes, lesiones o daños a terceros durante la actividad.</p>
              <p><strong>7. Indemnidad</strong></p>
              <p>El repartidor mantiene indemne a Wepi ante cualquier reclamo de terceros.</p>
              <p><strong>8. Conducta</strong></p>
              <p>Debe actuar de forma segura, legal y respetuosa.</p>
              <hr style={{ margin: '15px 0', borderColor: '#eee' }} />
              <h5 style={{ color: 'red' }}>🔒 REPARTIDORES – POLÍTICA DE PRIVACIDAD</h5>
              <p><strong>Datos recolectados:</strong></p>
              <ul style={{ paddingLeft: '18px', marginBottom: '10px' }}>
                <li>Datos personales (nombre, teléfono, email)</li>
                <li>Ubicación en tiempo real (GPS)</li>
                <li>Actividad de entregas</li>
              </ul>
              <p><strong>Uso de datos:</strong></p>
              <ul style={{ paddingLeft: '18px', marginBottom: '10px' }}>
                <li>Asignación de pedidos y optimización de rutas</li>
                <li>Seguimiento del pedido por el cliente</li>
                <li>Seguridad del sistema</li>
              </ul>
              <p><strong>Compartición:</strong></p>
              <ul style={{ paddingLeft: '18px', marginBottom: '10px' }}>
                <li>Usuarios (clientes)</li>
                <li>Comercios (locales)</li>
              </ul>
            </div>
            <button className="btn btn-secondary btn-full" onClick={() => setShowTerms(false)} style={{ marginTop: 16 }}>Cerrar</button>
          </div>
        </div>
      )}
      {showSessionModal && (
        <div className="dd-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }} onClick={() => setShowSessionModal(false)}>
          <div className="dd-modal-content animate-slide-up" style={{ background: 'white', padding: '30px', borderRadius: '24px', maxWidth: '400px', width: '92%', textAlign: 'center', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div className="dd-modal-title">¿Cuánto tiempo vas a trabajar?</div>
            <p className="dd-modal-subtitle">Elegí tu tiempo de disponibilidad. <br/> Al terminar, pasarás a modo Inactivo automáticamente.</p>
            <div className="dd-duration-grid">
              <button 
                className="dd-duration-btn"
                style={{ borderColor: 'var(--red-600)' }}
                onClick={() => confirmarActivacion(1)}
              >
                <span className="icon">🧪</span>
                <span className="time">1 min</span>
                <span className="label">Solo Prueba</span>
              </button>
              <button 
                className="dd-duration-btn"
                onClick={() => confirmarActivacion(15)}
              >
                <span className="icon">⏱️</span>
                <span className="time">15 min</span>
                <span className="label">Sesión corta</span>
              </button>

              <button 
                className="dd-duration-btn"
                onClick={() => confirmarActivacion(30)}
              >
                <span className="icon">🛵</span>
                <span className="time">30 min</span>
                <span className="label">Sesión normal</span>
              </button>
            </div>

            <button 
              className="btn btn-secondary dd-btn-large" 
              style={{ width: '100%', marginTop: '24px', borderRadius: '14px', border: '1px solid #eee', color: '#666', fontWeight: 'bold' }} 
              onClick={() => setShowSessionModal(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {/* Ranking Modal */}
      {showRankingModal && (
        <div className="dd-modal-overlay" onClick={() => setShowRankingModal(false)}>
          <div className="dd-modal-content animate-slide-down" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="dd-modal-header" style={{ background: 'var(--red-600)' }}>
              <h5 style={{ color: 'white' }}>🏆 Top 5 Semanal</h5>
              <button className="dd-modal-close" onClick={() => setShowRankingModal(false)}>×</button>
            </div>
            <div className="dd-modal-body" style={{ padding: '0' }}>
              <div className="ranking-list">
                {ranking.map((r, i) => (
                  <div key={i} className={`ranking-item ${r.nombre === driverData?.Nombre ? 'is-me' : ''}`} style={{
                    display: 'flex', alignItems: 'center', gap: 15, padding: '15px 20px', borderBottom: '1px solid #eee',
                    background: r.posicion <= 3 ? '#fffcf0' : 'white'
                  }}>
                    <div className="rank-number" style={{ width: 30, fontWeight: 'bold', fontSize: '1.2rem', color: r.posicion <= 3 ? '#eab308' : '#999' }}>
                      {r.posicion === 1 ? '🥇' : r.posicion === 2 ? '🥈' : r.posicion === 3 ? '🥉' : r.posicion}
                    </div>
                    <img src={r.foto_url || "https://i.postimg.cc/Z5N1N0c9/user-avatar.png"} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold' }}>{r.nombre} {r.nombre === driverData?.Nombre && '(Tú)'}</div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>{r.streak_actual || 0} racha 🔥</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--red-600)' }}>{r.puntos_totales} <small>pts</small></div>
                      <div style={{ fontSize: '0.75rem', color: '#888' }}>{r.entregas_totales || 0} entregas</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Points History Modal */}
      {showHistoryModal && (
        <div className="dd-modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="dd-modal-content animate-slide-down" onClick={e => e.stopPropagation()}>
            <div className="dd-modal-header">
              <h5>📜 Historial de Puntos</h5>
              <button className="dd-modal-close" onClick={() => setShowHistoryModal(false)}>×</button>
            </div>
            <div className="dd-modal-body" style={{ maxHeight: 400, overflowY: 'auto' }}>
              {pointsHistory.length === 0 ? (
                <p style={{ textAlign: 'center', padding: 20 }}>Aún no has acumulado puntos. ¡Responde a las alertas para ganar!</p>
              ) : (
                <div className="history-list">
                  {pointsHistory.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                          {p.motivo.startsWith('RESPONSE') ? '🎯 Respuesta a Alerta' : 
                           p.motivo.startsWith('STREAK') ? '🔥 Bonus de Racha' : p.motivo}
                        </div>
                        <small style={{ color: '#999' }}>{new Date(p.created_at).toLocaleString()}</small>
                      </div>
                      <div style={{ color: 'var(--red-500)', fontWeight: 'bold' }}>+{p.puntos}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

   
 