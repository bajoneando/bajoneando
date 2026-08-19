import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Landing from './pages/Landing';
import Maintenance from './pages/Maintenance';
import CustomerApp from './pages/CustomerApp';
import PruebasApp from './pages/PruebasApp';
import PruebasWalletApp from './pages/PruebasWalletApp';
import RestaurantDashboard from './pages/RestaurantDashboard';
import PruebaDashboard from './pages/PruebaDashboard';
import DriverDashboard from './pages/DriverDashboard';
import PartnerDashboard from './pages/PartnerDashboard';
import DriverProbando from './pages/DriverProbando';
import MisPedidos from './pages/MisPedidos';
import ConfirmarEmail from './pages/ConfirmarEmail';
import AdminDashboard from './pages/AdminDashboard';
import ConsentBanner from './components/ConsentBanner';
import PushNotificationManager from './components/PushNotificationManager';
import AppRedirectHandler from './components/AppRedirectHandler';
import Mundialista from './pages/Mundialista';
import WepiAds from './pages/WepiAds';
import { useAuth } from './context/AuthContext';
import * as api from './services/api';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';
import PrivacyPolicy from './pages/PrivacyPolicy';

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function MaintenanceGuard({ children, configKey }) {
  const { user } = useAuth();
  const [inMaintenance, setInMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false); // Fallback: force render if Supabase takes too long or is offline
    }, 3000);

    async function checkMaintenance() {
      try {
        const config = await api.getConfiguracion();
        if (config && config[configKey] && user?.role !== 'admin') {
          setInMaintenance(true);
        }
      } catch (error) {
        console.error("Error checking maintenance status:", error);
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    }
    checkMaintenance();

    return () => clearTimeout(timer);
  }, [configKey, user]);

  if (loading) return null;
  if (inMaintenance) return <Navigate to="/mantenimiento" replace />;
  return children;
}


export default function App() {
  const location = useLocation();

  useEffect(() => {
    // Captura de UTMs de Campañas CRM y Motor de Hábitos (Ventana de 24 hs)
    try {
      const searchParams = new URLSearchParams(location.search);
      const utmSource = searchParams.get('utm_source');
      const utmCampaign = searchParams.get('utm_campaign') || searchParams.get('campaign');
      const utmMedium = searchParams.get('utm_medium');
      const userId = searchParams.get('u') || searchParams.get('user_id');

      if (utmSource || utmCampaign) {
        const attributionData = {
          campaign: utmCampaign || 'general',
          channel: utmSource || 'link',
          medium: utmMedium || 'direct',
          user_id: userId || null,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('wepi_crm_attribution', JSON.stringify(attributionData));
        console.log('🎯 Atribución CRM capturada (Ventana 24h):', attributionData);
      }
    } catch (e) {
      console.warn("Error capturando UTMs CRM:", e);
    }
  }, [location]);

  useEffect(() => {
    // 0. Version Check & Hard Update
    const checkVersion = async () => {
      try {
        const response = await fetch('/version.json?v=' + Date.now());
        if (!response.ok) return;
        
        const data = await response.json();
        const serverVersion = data.version;
        const localVersion = localStorage.getItem('weep-app-version');

        if (localVersion && localVersion !== serverVersion) {
          console.warn('🔄 Nueva versión detectada:', serverVersion, '. Forzando actualización...');
          
          // Limpiar caché y Service Workers
          localStorage.clear();
          sessionStorage.clear();
          
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
              await registration.unregister();
            }
          }
          
          // Guardar nueva versión ANTES de recargar
          localStorage.setItem('weep-app-version', serverVersion);
          
          // Forzar recarga completa
          window.location.reload();
        } else if (!localVersion) {
          localStorage.setItem('weep-app-version', serverVersion);
        }
      } catch (e) {
        console.error('Error verificando versión:', e);
      }
    };
    checkVersion();

    // Notify Capgo Updater that app is ready
    try {
      CapacitorUpdater.notifyAppReady();
    } catch (e) {
      console.error('Error in CapacitorUpdater:', e);
    }


    // 1. Google Analytics Tracking
    if (window.gtag) {
      window.gtag('config', 'G-5QRZYRMZH2', {
        page_path: location.pathname + location.search
      });
    }

    // 2. Restore Consent State if exists
    const savedConsent = localStorage.getItem('weep-consent-v2');
    if (savedConsent && window.gtag) {
      window.gtag('consent', 'update', {
        'ad_storage': savedConsent,
        'analytics_storage': savedConsent,
        'ad_user_data': savedConsent,
        'ad_personalization': savedConsent
      });
    }

    // 3. Section Tracking for PWA Magic Redirect
    const path = location.pathname;
    if (['/pedir', '/repartidores', '/partners', '/locales', '/admin', '/prueba', '/mis-pedidos'].some(s => path.startsWith(s))) {
      localStorage.setItem('weep-last-section', path);
    }
  }, [location]);

  // 3. Dynamic PWA Manifest Update
  useEffect(() => {
    const existingLink = document.getElementById('manifest-link');
    const path = location.pathname;
    
    let config = { name: "Wepi", start: "/", title: "Wepi" };
    if (path.startsWith('/pedir') || path.startsWith('/mis-pedidos')) { config = { name: "Wepi - Pedidos", start: "/pedir", title: "Wepi - Pedidos" }; }
    else if (path.startsWith('/locales') || path.startsWith('/prueba')) { config = { name: "Wepi - Locales", start: "/locales", title: "Wepi - Locales" }; }
    else if (path.startsWith('/admin')) { config = { name: "Wepi - Admin", start: "/admin", title: "Wepi - Admin" }; }
    else if (path.startsWith('/repartidores')) { config = { name: "Wepi - Repartidores", start: "/repartidores", title: "Wepi - Repartidores" }; }
    else if (path.startsWith('/partners')) { config = { name: "Wepi - Partners", start: "/partners", title: "Wepi - Partners" }; }

    // URL Robusta para start_url (usa el truco de ?p= para evitar recortes de Safari)
    const pwaStartUrl = 'https://wepi.com.ar' + (config.start === '/' ? '/?mode=pwa' : '/?p=' + config.start + '&mode=pwa');

    const manifestData = {
      "name": "Wepi | Pedidos y Delivery",
      "short_name": "Wepi",
      "description": "Plataforma de Pedidos y Delivery",
      "start_url": pwaStartUrl, 
      "scope": "/",
      "display": "standalone",
      "background_color": "#ffffff",
      "theme_color": "#c62828",
      "icons": [
        { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
        { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" }
      ]
    };

    const blob = new Blob([JSON.stringify(manifestData)], {type: 'application/json'});
    const manifestUrl = URL.createObjectURL(blob);

    if (existingLink) {
      existingLink.href = manifestUrl;
    } else {
      const newLink = document.createElement('link');
      newLink.id = 'manifest-link';
      newLink.rel = 'manifest';
      newLink.href = manifestUrl;
      document.head.appendChild(newLink);
    }

    let canonical = document.getElementById('canonical-link');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.id = 'canonical-link';
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    const absoluteStartUrl = window.location.origin + config.start;
    canonical.setAttribute('href', absoluteStartUrl);

    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle) {
      appleTitle.setAttribute('content', config.title);
    }
  }, [location.pathname]);

  return (
    <AuthProvider>
      <CartProvider>
        <PushNotificationManager />
        <AppRedirectHandler />
        <Routes>
          <Route path="/" element={Capacitor.isNativePlatform() ? <Navigate to="/pedir" replace /> : <Landing />} />
          <Route path="/mantenimiento" element={<Maintenance />} />
          <Route path="/pedir" element={
            <MaintenanceGuard configKey="mantenimiento_pedir">
              <PruebasWalletApp />
            </MaintenanceGuard>
          } />
          <Route path="/mundialista" element={
            <MaintenanceGuard configKey="mantenimiento_pedir">
              <Mundialista />
            </MaintenanceGuard>
          } />
          <Route path="/mis-pedidos" element={
            <MaintenanceGuard configKey="mantenimiento_pedir">
              <MisPedidos />
            </MaintenanceGuard>
          } />
          <Route path="/locales" element={
            <MaintenanceGuard configKey="mantenimiento_locales">
              <RestaurantDashboard />
            </MaintenanceGuard>
          } />
          <Route path="/prueba" element={
            <MaintenanceGuard configKey="mantenimiento_locales">
              <PruebaDashboard />
            </MaintenanceGuard>
          } />
          <Route path="/repartidores" element={
            <MaintenanceGuard configKey="mantenimiento_repartidores">
              <DriverDashboard />
            </MaintenanceGuard>
          } />
          <Route path="/partners" element={
            <MaintenanceGuard configKey="mantenimiento_repartidores">
              <PartnerDashboard />
            </MaintenanceGuard>
          } />
          <Route path="/probando" element={
            <MaintenanceGuard configKey="mantenimiento_repartidores">
              <DriverProbando />
            </MaintenanceGuard>
          } />
          <Route path="/pruebas" element={
            <MaintenanceGuard configKey="mantenimiento_pedir">
              <PruebasWalletApp />
            </MaintenanceGuard>
          } />
          <Route path="/p/:slug" element={
            <MaintenanceGuard configKey="mantenimiento_pedir">
              <PruebasWalletApp />
            </MaintenanceGuard>
          } />
          <Route path="/p/:ciudad/:slug" element={
            <MaintenanceGuard configKey="mantenimiento_pedir">
              <PruebasWalletApp />
            </MaintenanceGuard>
          } />
          <Route path="/pedir/:slug" element={
            <MaintenanceGuard configKey="mantenimiento_pedir">
              <PruebasWalletApp />
            </MaintenanceGuard>
          } />
          <Route path="/pedir/:ciudad/:slug" element={
            <MaintenanceGuard configKey="mantenimiento_pedir">
              <PruebasWalletApp />
            </MaintenanceGuard>
          } />
          <Route path="/shops" element={
            <MaintenanceGuard configKey="mantenimiento_pedir">
              <PruebasWalletApp />
            </MaintenanceGuard>
          } />
          <Route path="/shops/:slug" element={
            <MaintenanceGuard configKey="mantenimiento_pedir">
              <PruebasWalletApp />
            </MaintenanceGuard>
          } />
          <Route path="/shops/:ciudad/:slug" element={
            <MaintenanceGuard configKey="mantenimiento_pedir">
              <PruebasWalletApp />
            </MaintenanceGuard>
          } />

          <Route path="/confirmar-email" element={<ConfirmarEmail />} />
          <Route path="/ads" element={<WepiAds />} />
          <Route path="/politicas-privacidad" element={<PrivacyPolicy />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ConsentBanner />
      </CartProvider>
    </AuthProvider>
  );
}
